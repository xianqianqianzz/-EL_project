from datetime import date

import httpx
import pytest
from sqlalchemy import select

from backend.app.database import SessionLocal
from backend.app.main import app
from backend.app.user_model import User


async def request(path: str, method: str = "GET", **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


async def token_for(username: str, role: str = "user") -> str:
    await request("/api/v1/auth/register", "POST", json={
        "username": username,
        "email": f"{username}@example.com",
        "display_name": username,
        "password": "correct-horse-123",
    })
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


@pytest.mark.asyncio
async def test_admin_can_read_processed_user_and_trip_information() -> None:
    user_token = await token_for("admin_view_user")
    admin_token = await token_for("admin_view_admin", "admin")
    await request("/api/v1/trips", "POST", headers={"Authorization": f"Bearer {user_token}"}, json={
        "title": "测试日程",
        "area_id": "outdoor-xianlin",
        "from_place_id": "outdoor-xianlin-place-001",
        "to_place_id": "outdoor-xianlin-place-002",
        "start_date": date.today().isoformat(),
        "latest_arrival_time": "18:00",
        "recurrence": "daily",
        "reminder_minutes": 10,
    })
    headers = {"Authorization": f"Bearer {admin_token}"}

    summary = await request("/api/v1/admin/summary", headers=headers)
    users = await request("/api/v1/admin/users", headers=headers)
    trips = await request("/api/v1/admin/trips", headers=headers)

    assert summary.status_code == 200
    assert summary.json()["user_count"] == 2
    assert summary.json()["trip_count"] == 1
    assert users.status_code == 200
    assert all("***@" in user["masked_email"] for user in users.json())
    assert trips.status_code == 200
    assert trips.json()[0]["display_name"] == "admin_view_user"


@pytest.mark.asyncio
async def test_ordinary_user_cannot_read_admin_information() -> None:
    token = await token_for("admin_forbidden_user")
    response = await request(
        "/api/v1/admin/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_create_and_list_backups(tmp_path) -> None:
    from backend.app.config import get_settings

    get_settings().backup_root = tmp_path
    admin_token = await token_for("backup_admin", "admin")
    headers = {"Authorization": f"Bearer {admin_token}"}

    created = await request("/api/v1/admin/backups", "POST", headers=headers)
    listed = await request("/api/v1/admin/backups", headers=headers)
    status = await request("/api/v1/admin/operations", headers=headers)

    assert created.status_code == 201
    assert created.json()["name"].endswith(".zip")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert status.status_code == 200
    assert status.json()["backup_count"] == 1


@pytest.mark.asyncio
async def test_staff_cannot_create_backup() -> None:
    staff_token = await token_for("backup_staff", "staff")
    response = await request(
        "/api/v1/admin/backups",
        "POST",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert response.status_code == 403
