import json
from pathlib import Path
import shutil
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import select

from backend.app.area_merge_service import AreaMergeError, AreaMergeService
from backend.app.area_repository import AreaRepository
from backend.app.database import SessionLocal
from backend.app.main import app
from backend.app.proposal_routes import get_merge_service
from backend.app.user_model import User


async def request(path: str, method: str = "GET", **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


async def token_for(username: str, role: str = "user") -> str:
    await request(
        "/api/v1/auth/register",
        "POST",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "display_name": username,
            "password": "correct-horse-123",
        },
    )
    if role != "user":
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.username == username))
            user.role = role
            db.commit()
    response = await request(
        "/api/v1/auth/token",
        "POST",
        data={"username": username, "password": "correct-horse-123"},
    )
    return response.json()["access_token"]


def proposal_payload():
    return {
        "area_id": "outdoor-xianlin",
        "title": "新增一条可通行路径",
        "description": "现场确认这里存在可通行道路，请工作人员审核合并。",
        "changes": {
            "add_nodes": [
                {"id": "proposal-node-001", "type": "node", "x": 2700, "y": 5140}
            ],
            "add_edges": [
                {
                    "id": "proposal-edge-001",
                    "type": "edge",
                    "from": "outdoor-xianlin-node-001",
                    "to": "proposal-node-001",
                    "walkable": True,
                },
                {
                    "id": "proposal-edge-002",
                    "type": "edge",
                    "from": "proposal-node-001",
                    "to": "outdoor-xianlin-node-008",
                    "walkable": True,
                },
            ],
            "remove_edge_ids": ["outdoor-xianlin-edge-001"],
        },
    }


class FakeMergeService:
    def preview(self, area_id, changes):
        return {}, {"preview": True}

    def merge(self, area_id, changes):
        return {
            "addedNodeIds": ["outdoor-xianlin-node-999"],
            "addedEdgeIds": ["outdoor-xianlin-edge-999"],
            "removedEdgeIds": changes.remove_edge_ids,
        }


@pytest.fixture
def fake_merge_service():
    app.dependency_overrides[get_merge_service] = lambda: FakeMergeService()
    yield
    app.dependency_overrides.pop(get_merge_service, None)


@pytest.mark.asyncio
async def test_user_submits_and_sees_own_proposal(fake_merge_service) -> None:
    token = await token_for("proposal_user")
    headers = {"Authorization": f"Bearer {token}"}

    created = await request("/api/v1/proposals", "POST", headers=headers, json=proposal_payload())
    mine = await request("/api/v1/proposals/mine", headers=headers)

    assert created.status_code == 201
    assert created.json()["status"] == "pending"
    assert mine.status_code == 200
    assert len(mine.json()) == 1


@pytest.mark.asyncio
async def test_staff_can_approve_and_user_cannot(fake_merge_service) -> None:
    user_token = await token_for("proposal_owner")
    staff_token = await token_for("proposal_staff", "staff")
    created = await request(
        "/api/v1/proposals",
        "POST",
        headers={"Authorization": f"Bearer {user_token}"},
        json=proposal_payload(),
    )
    proposal_id = created.json()["id"]

    forbidden = await request(
        f"/api/v1/proposals/{proposal_id}/approve",
        "POST",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"note": "普通用户不能批准"},
    )
    approved = await request(
        f"/api/v1/proposals/{proposal_id}/approve",
        "POST",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"note": "已现场核验，同意合并"},
    )
    repeated = await request(
        f"/api/v1/proposals/{proposal_id}/reject",
        "POST",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"note": "不能重复处理"},
    )

    assert forbidden.status_code == 403
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["merge_summary"]
    assert repeated.status_code == 409


def temporary_repository(tmp_path: Path) -> AreaRepository:
    project_root = Path(__file__).resolve().parents[2]
    target = tmp_path / "project"
    area_dir = target / "data" / "areas" / "outdoor-xianlin"
    area_dir.mkdir(parents=True)
    shutil.copy(project_root / "data" / "areas" / "index.json", target / "data" / "areas" / "index.json")
    shutil.copy(
        project_root / "data" / "areas" / "outdoor-xianlin" / "area.json",
        area_dir / "area.json",
    )
    shutil.copy(
        project_root / "data" / "areas" / "outdoor-xianlin" / "map.png",
        area_dir / "map.png",
    )
    return AreaRepository(target)


def test_merge_service_remaps_ids_and_preserves_connectivity(tmp_path, monkeypatch) -> None:
    repository = temporary_repository(tmp_path)
    service = AreaMergeService(repository)
    monkeypatch.setattr(service, "_backup", lambda *_: None)
    changes = proposal_payload()["changes"]

    from backend.app.proposal_models import ProposalChanges

    summary = service.merge("outdoor-xianlin", ProposalChanges.model_validate(changes))
    merged = repository.get_area("outdoor-xianlin")

    assert len(summary["addedNodeIds"]) == 1
    assert len(summary["addedEdgeIds"]) == 2
    assert "outdoor-xianlin-edge-001" not in {edge["id"] for edge in merged["edges"]}
    assert summary["addedNodeIds"][0] in {node["id"] for node in merged["nodes"]}


def test_merge_service_rejects_disconnected_or_duplicate_changes(tmp_path) -> None:
    repository = temporary_repository(tmp_path)
    service = AreaMergeService(repository)
    from backend.app.proposal_models import ProposalChanges

    isolated = ProposalChanges.model_validate(
        {"add_nodes": [{"id": "temp", "type": "node", "x": 10, "y": 10}]}
    )
    duplicate_edge = ProposalChanges.model_validate(
        {
            "add_edges": [
                {
                    "id": "temp-edge",
                    "type": "edge",
                    "from": "outdoor-xianlin-node-001",
                    "to": "outdoor-xianlin-node-008",
                }
            ]
        }
    )

    with pytest.raises(AreaMergeError):
        service.preview("outdoor-xianlin", isolated)
    with pytest.raises(AreaMergeError):
        service.preview("outdoor-xianlin", duplicate_edge)


def test_merge_service_rejects_removing_edge_that_disconnects_place(tmp_path) -> None:
    repository = temporary_repository(tmp_path)
    service = AreaMergeService(repository)
    area = repository.get_area("outdoor-xianlin")
    place_nodes = {place["routeNodeId"] for place in area["places"]}
    degrees = {node["id"]: 0 for node in area["nodes"]}
    for edge in area["edges"]:
        degrees[edge["from"]] += 1
        degrees[edge["to"]] += 1
    critical_edge = next(
        edge
        for edge in area["edges"]
        if (edge["from"] in place_nodes and degrees[edge["from"]] == 1)
        or (edge["to"] in place_nodes and degrees[edge["to"]] == 1)
    )
    from backend.app.proposal_models import ProposalChanges

    changes = ProposalChanges.model_validate({"remove_edge_ids": [critical_edge["id"]]})

    with pytest.raises(AreaMergeError):
        service.preview("outdoor-xianlin", changes)
