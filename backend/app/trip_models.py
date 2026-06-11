from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Recurrence = Literal["once", "daily", "weekly", "monthly"]
OccurrenceStatus = Literal["upcoming", "leave_soon", "leave_now", "late"]


class TripWrite(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    area_id: str = Field(min_length=1, max_length=80)
    from_place_id: str = Field(min_length=1, max_length=100)
    to_place_id: str = Field(min_length=1, max_length=100)
    start_date: date
    end_date: date | None = None
    latest_arrival_time: time
    recurrence: Recurrence = "once"
    reminder_minutes: int = Field(default=10, ge=0, le=120)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_dates(self):
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("行程名称不能为空")
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("结束日期不能早于开始日期")
        if self.recurrence == "once" and self.end_date:
            raise ValueError("一次性行程不能设置结束日期")
        return self


class TripPublic(TripWrite):
    id: int
    from_label: str
    to_label: str
    estimated_distance_meters: int
    estimated_duration_minutes: int
    created_at: datetime


class TripOccurrence(BaseModel):
    trip_id: int
    title: str
    area_id: str
    occurrence_date: date
    from_place_id: str
    from_label: str
    to_place_id: str
    to_label: str
    latest_arrival_at: datetime
    suggested_departure_at: datetime
    estimated_distance_meters: int
    estimated_duration_minutes: int
    reminder_minutes: int
    recurrence: Recurrence
    status: OccurrenceStatus
