from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.admin_models import AdminSummary, AdminTripSummary, AdminUserSummary
from backend.app.auth import require_roles
from backend.app.database import get_db
from backend.app.proposal_model import MapProposal
from backend.app.route_service import RouteService
from backend.app.trip_model import Trip
from backend.app.trip_routes import get_route_service
from backend.app.trip_service import APP_TIMEZONE, occurs_on
from backend.app.user_model import User


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def masked_email(email: str) -> str:
    local, separator, domain = email.partition("@")
    if not separator:
        return "***"
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}***@{domain}"


@router.get("/summary", response_model=AdminSummary)
def admin_summary(
    _: User = Depends(require_roles("staff", "admin")),
    db: Session = Depends(get_db),
) -> AdminSummary:
    today = datetime.now(APP_TIMEZONE).date()
    trips = db.scalars(select(Trip)).all()
    return AdminSummary(
        user_count=db.scalar(select(func.count(User.id))) or 0,
        active_user_count=db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0,
        trip_count=len(trips),
        today_trip_count=sum(1 for trip in trips if occurs_on(trip, today)),
        pending_proposal_count=db.scalar(
            select(func.count(MapProposal.id)).where(MapProposal.status == "pending")
        ) or 0,
    )


@router.get("/users", response_model=list[AdminUserSummary])
def admin_users(
    _: User = Depends(require_roles("staff", "admin")),
    db: Session = Depends(get_db),
) -> list[AdminUserSummary]:
    today = datetime.now(APP_TIMEZONE).date()
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    trips = db.scalars(select(Trip)).all()
    trips_by_user: dict[int, list[Trip]] = {}
    for trip in trips:
        trips_by_user.setdefault(trip.user_id, []).append(trip)
    return [
        AdminUserSummary(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            masked_email=masked_email(user.email),
            role=user.role,
            status="正常" if user.is_active else "已停用",
            trip_count=len(trips_by_user.get(user.id, [])),
            today_trip_count=sum(1 for trip in trips_by_user.get(user.id, []) if occurs_on(trip, today)),
            created_at=user.created_at,
        )
        for user in users
    ]


@router.get("/trips", response_model=list[AdminTripSummary])
def admin_trips(
    _: User = Depends(require_roles("staff", "admin")),
    db: Session = Depends(get_db),
    route_service: RouteService = Depends(get_route_service),
) -> list[AdminTripSummary]:
    users = {user.id: user for user in db.scalars(select(User)).all()}
    trips = db.scalars(select(Trip).order_by(Trip.start_date, Trip.latest_arrival_time)).all()
    result = []
    for trip in trips:
        estimate = route_service.estimate(trip.area_id, trip.from_place_id, trip.to_place_id)
        user = users[trip.user_id]
        result.append(
            AdminTripSummary(
                id=trip.id,
                user_id=user.id,
                username=user.username,
                display_name=user.display_name,
                title=trip.title,
                area_id=trip.area_id,
                from_place_id=trip.from_place_id,
                from_label=estimate.from_label,
                to_place_id=trip.to_place_id,
                to_label=estimate.to_label,
                start_date=trip.start_date,
                end_date=trip.end_date,
                latest_arrival_time=trip.latest_arrival_time,
                recurrence=trip.recurrence,
                reminder_minutes=trip.reminder_minutes,
                created_at=trip.created_at,
            )
        )
    return result
