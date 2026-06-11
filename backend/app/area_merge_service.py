import copy
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from backend.app.area_repository import AreaRepository
from backend.app.config import DEFAULT_DATA_ROOT
from backend.app.proposal_models import ProposalChanges


class AreaMergeError(ValueError):
    pass


class AreaMergeService:
    def __init__(self, repository: AreaRepository):
        self.repository = repository

    def preview(self, area_id: str, changes: ProposalChanges) -> tuple[dict, dict]:
        area = copy.deepcopy(self.repository.get_area(area_id))
        nodes = area.get("nodes", [])
        edges = area.get("edges", [])
        node_ids = {node["id"] for node in nodes}
        edge_ids = {edge["id"] for edge in edges}
        image = area.get("image", {})

        missing_removals = sorted(set(changes.remove_edge_ids) - edge_ids)
        if missing_removals:
            raise AreaMergeError(f"待删除边不存在：{', '.join(missing_removals[:5])}")
        edges[:] = [edge for edge in edges if edge["id"] not in set(changes.remove_edge_ids)]

        node_id_map = {}
        for proposed in changes.add_nodes:
            if proposed.x > image.get("width", -1) or proposed.y > image.get("height", -1):
                raise AreaMergeError(f"节点 {proposed.id} 超出地图图片范围")
            formal_id = self._next_id(area_id, "node", node_ids)
            node_ids.add(formal_id)
            node_id_map[proposed.id] = formal_id
            nodes.append({"id": formal_id, "type": "node", "x": proposed.x, "y": proposed.y})

        existing_pairs = {self._pair(edge["from"], edge["to"]) for edge in edges}
        added_edge_ids = []
        for proposed in changes.add_edges:
            from_id = node_id_map.get(proposed.from_node, proposed.from_node)
            to_id = node_id_map.get(proposed.to_node, proposed.to_node)
            if from_id not in node_ids or to_id not in node_ids:
                raise AreaMergeError(f"新增边 {proposed.id} 引用了不存在的节点")
            pair = self._pair(from_id, to_id)
            if pair in existing_pairs:
                raise AreaMergeError(f"新增边 {proposed.id} 与现有边重复")
            formal_id = self._next_id(area_id, "edge", edge_ids)
            edge_ids.add(formal_id)
            existing_pairs.add(pair)
            added_edge_ids.append(formal_id)
            edges.append(
                {
                    "id": formal_id,
                    "from": from_id,
                    "to": to_id,
                    "type": "edge",
                    "walkable": proposed.walkable,
                    "reviewStatus": "reviewed",
                }
            )

        self._validate_candidate(area)
        summary = {
            "addedNodeIds": list(node_id_map.values()),
            "addedEdgeIds": added_edge_ids,
            "removedEdgeIds": changes.remove_edge_ids,
        }
        return area, summary

    def merge(self, area_id: str, changes: ProposalChanges) -> dict:
        candidate, summary = self.preview(area_id, changes)
        area_path = self.repository.get_area_path(area_id)
        self._backup(area_id, area_path)
        temp_path = area_path.with_name(f".{area_path.name}.{uuid4().hex}.tmp")
        temp_path.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temp_path, area_path)
        return summary

    @staticmethod
    def _pair(from_id: str, to_id: str) -> tuple[str, str]:
        return tuple(sorted((from_id, to_id)))

    @staticmethod
    def _next_id(area_id: str, kind: str, used_ids: set[str]) -> str:
        number = 1
        while True:
            candidate = f"{area_id}-{kind}-{number:03d}"
            if candidate not in used_ids:
                return candidate
            number += 1

    @staticmethod
    def _validate_candidate(area: dict) -> None:
        nodes = area.get("nodes", [])
        edges = area.get("edges", [])
        node_ids = [node.get("id") for node in nodes]
        if len(node_ids) != len(set(node_ids)):
            raise AreaMergeError("合并后存在重复节点 ID")
        coordinates = [(node.get("x"), node.get("y")) for node in nodes]
        if len(coordinates) != len(set(coordinates)):
            raise AreaMergeError("合并后存在重复节点坐标")
        adjacency = {node_id: set() for node_id in node_ids}
        edge_pairs = set()
        for edge in edges:
            if edge.get("from") not in adjacency or edge.get("to") not in adjacency:
                raise AreaMergeError("合并后存在引用无效节点的边")
            pair = AreaMergeService._pair(edge["from"], edge["to"])
            if pair in edge_pairs:
                raise AreaMergeError("合并后存在重复边")
            edge_pairs.add(pair)
            if edge.get("walkable") is False:
                continue
            adjacency[edge["from"]].add(edge["to"])
            adjacency[edge["to"]].add(edge["from"])
        isolated = [node_id for node_id, neighbors in adjacency.items() if not neighbors]
        if isolated:
            raise AreaMergeError(f"合并后存在孤立节点：{isolated[0]}")
        places = area.get("places", [])
        if places:
            start = places[0].get("routeNodeId")
            visited = {start}
            stack = [start]
            while stack:
                stack.extend(adjacency.get(stack.pop(), set()) - visited)
                visited.update(stack)
            unreachable = [place["label"] for place in places if place.get("routeNodeId") not in visited]
            if unreachable:
                raise AreaMergeError(f"合并后地点不可达：{unreachable[0]}")

    @staticmethod
    def _backup(area_id: str, area_path: Path) -> None:
        backup_dir = DEFAULT_DATA_ROOT / "area-backups" / area_id
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = backup_dir / f"{timestamp}-{uuid4().hex[:8]}.area.json"
        backup_path.write_bytes(area_path.read_bytes())
