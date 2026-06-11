from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base
from backend.app.user_model import utc_now


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint(
            "recurrence IN ('once', 'daily', 'weekly', 'monthly')",
            name="ck_trips_recurrence",
        ),
        CheckConstraint("reminder_minutes BETWEEN 0 AND 120", name="ck_trips_reminder_minutes"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(80))
    area_id: Mapped[str] = mapped_column(String(80))
    from_place_id: Mapped[str] = mapped_column(String(100))
    to_place_id: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    latest_arrival_time: Mapped[time] = mapped_column(Time)
    recurrence: Mapped[str] = mapped_column(String(16))
    reminder_minutes: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
