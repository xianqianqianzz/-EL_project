import json
from pathlib import Path
from typing import Any


class AreaNotFoundError(LookupError):
    pass


class InvalidAreaDataError(ValueError):
    pass


class AreaRepository:
    def __init__(self, project_root: Path):
        self.project_root = project_root.resolve()
        self.areas_root = (self.project_root / "data" / "areas").resolve()
        self.index_path = self.areas_root / "index.json"

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        try:
            with path.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError) as error:
            raise InvalidAreaDataError(f"无法读取区域数据：{path.name}") from error
        if not isinstance(data, dict):
            raise InvalidAreaDataError(f"区域数据根对象必须是 JSON object：{path.name}")
        return data

    def _safe_project_path(self, relative_path: str) -> Path:
        candidate = (self.project_root / relative_path).resolve()
        if not candidate.is_relative_to(self.areas_root):
            raise InvalidAreaDataError("区域索引中的路径超出 data/areas")
        return candidate

    def load_index(self) -> dict[str, Any]:
        index = self._read_json(self.index_path)
        if not isinstance(index.get("areas"), list):
            raise InvalidAreaDataError("区域索引缺少 areas 数组")
        return index

    def get_entry(self, area_id: str) -> dict[str, Any]:
        for entry in self.load_index()["areas"]:
            if isinstance(entry, dict) and entry.get("id") == area_id:
                return entry
        raise AreaNotFoundError(area_id)

    def get_area_path(self, area_id: str) -> Path:
        entry = self.get_entry(area_id)
        relative_path = entry.get("path")
        if not isinstance(relative_path, str):
            raise InvalidAreaDataError(f"区域 {area_id} 未配置有效 path")
        area_path = self._safe_project_path(relative_path)
        if not area_path.is_file():
            raise InvalidAreaDataError(f"区域 {area_id} 的 area.json 不存在")
        return area_path

    def get_area(self, area_id: str) -> dict[str, Any]:
        area = self._read_json(self.get_area_path(area_id))
        if area.get("areaId") != area_id:
            raise InvalidAreaDataError(f"区域索引 ID 与 area.json 的 areaId 不一致：{area_id}")
        return area

    def get_map_path(self, area_id: str) -> Path:
        area_path = self.get_area_path(area_id)
        area = self._read_json(area_path)
        image_path = area.get("image", {}).get("path")
        if not isinstance(image_path, str):
            raise InvalidAreaDataError(f"区域 {area_id} 未配置有效图片路径")
        candidate = (area_path.parent / image_path).resolve()
        if not candidate.is_relative_to(area_path.parent) or not candidate.is_file():
            raise InvalidAreaDataError(f"区域 {area_id} 的地图图片不存在或路径无效")
        return candidate

    def public_index(self) -> dict[str, Any]:
        index = self.load_index()
        areas = []
        for entry in index["areas"]:
            if not isinstance(entry, dict):
                raise InvalidAreaDataError("区域索引包含非 object 项")
            area_id = entry.get("id")
            if not isinstance(area_id, str):
                raise InvalidAreaDataError("区域索引包含无效 id")
            areas.append(
                {
                    "id": area_id,
                    "name": entry.get("name", area_id),
                    "type": entry.get("type", "outdoor"),
                    "buildingId": entry.get("buildingId"),
                    "dataUrl": f"/api/v1/areas/{area_id}",
                    "mapUrl": f"/api/v1/areas/{area_id}/map",
                }
            )
        return {
            "version": index.get("version", 1),
            "defaultOutdoorAreaId": index.get("defaultOutdoorAreaId", ""),
            "areas": areas,
        }
