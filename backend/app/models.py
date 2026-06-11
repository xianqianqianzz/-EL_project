from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    apiVersion: str


class AreaSummary(BaseModel):
    id: str
    name: str
    type: Literal["outdoor", "indoor"]
    dataUrl: str
    mapUrl: str
    buildingId: str | None = None


class AreaIndexResponse(BaseModel):
    version: int
    defaultOutdoorAreaId: str
    areas: list[AreaSummary]
