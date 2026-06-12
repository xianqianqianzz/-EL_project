from datetime import date, datetime, time

from pydantic import BaseModel


class AdminSummary(BaseModel):
    user_count: int
    active_user_count: int
    trip_count: int
    today_trip_count: int
    pending_proposal_count: int


class AdminUserSummary(BaseModel):
    id: int
    username: str
    display_name: str
    masked_email: str
    role: str
    status: str
    trip_count: int
    today_trip_count: int
    created_at: datetime


class AdminTripSummary(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: str
    title: str
    area_id: str
    from_place_id: str
    from_label: str
    to_place_id: str
    to_label: str
    start_date: date
    end_date: date | None
    latest_arrival_time: time
    recurrence: str
    reminder_minutes: int
    created_at: datetime
