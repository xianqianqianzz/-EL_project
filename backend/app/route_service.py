import heapq
import math
from dataclasses import dataclass

from backend.app.area_repository import AreaNotFoundError, AreaRepository, InvalidAreaDataError


WALKING_SPEED_METERS_PER_SECOND = 1.2


class RouteNotFoundError(LookupError):
    pass


class PlaceNotFoundError(LookupError):
    pass


@dataclass(frozen=True)
class RouteEstimate:
    area_id: str
    from_place_id: str
    from_label: str
    to_place_id: str
    to_label: str
    distance_meters: int
    duration_minutes: int


class RouteService:
    def __init__(self, repository: AreaRepository):
        self.repository = repository

    def estimate(self, area_id: str, from_place_id: str, to_place_id: str) -> RouteEstimate:
        try:
            area = self.repository.get_area(area_id)
        except (AreaNotFoundError, InvalidAreaDataError) as error:
            raise PlaceNotFoundError("区域不存在或数据无效") from error

        places = {place["id"]: place for place in area.get("places", [])}
        from_place = places.get(from_place_id)
        to_place = places.get(to_place_id)
        if not from_place or not to_place:
            raise PlaceNotFoundError("起点或终点地点不存在")
        if from_place_id == to_place_id:
            raise RouteNotFoundError("起点和终点不能相同")

        nodes = {node["id"]: node for node in area.get("nodes", [])}
        scale = float(area.get("image", {}).get("metersPerPixel", 1))
        adjacency: dict[str, list[tuple[str, float]]] = {node_id: [] for node_id in nodes}
        for edge in area.get("edges", []):
            if edge.get("walkable") is False:
                continue
            from_node = nodes.get(edge.get("from"))
            to_node = nodes.get(edge.get("to"))
            if not from_node or not to_node:
                continue
            weight = edge.get("weight")
            if not isinstance(weight, (int, float)):
                weight = math.hypot(from_node["x"] - to_node["x"], from_node["y"] - to_node["y"]) * scale
            adjacency[from_node["id"]].append((to_node["id"], float(weight)))
            adjacency[to_node["id"]].append((from_node["id"], float(weight)))

        start_id = from_place["routeNodeId"]
        goal_id = to_place["routeNodeId"]
        distance = self._shortest_distance(adjacency, start_id, goal_id)
        if distance is None:
            raise RouteNotFoundError("起点和终点之间没有可达路径")

        return RouteEstimate(
            area_id=area_id,
            from_place_id=from_place_id,
            from_label=from_place["label"],
            to_place_id=to_place_id,
            to_label=to_place["label"],
            distance_meters=round(distance),
            duration_minutes=max(1, math.ceil(distance / WALKING_SPEED_METERS_PER_SECOND / 60)),
        )

    @staticmethod
    def _shortest_distance(
        adjacency: dict[str, list[tuple[str, float]]],
        start_id: str,
        goal_id: str,
    ) -> float | None:
        distances = {start_id: 0.0}
        queue = [(0.0, start_id)]
        while queue:
            distance, node_id = heapq.heappop(queue)
            if node_id == goal_id:
                return distance
            if distance > distances.get(node_id, math.inf):
                continue
            for neighbor_id, weight in adjacency.get(node_id, []):
                candidate = distance + weight
                if candidate < distances.get(neighbor_id, math.inf):
                    distances[neighbor_id] = candidate
                    heapq.heappush(queue, (candidate, neighbor_id))
        return None
