import calendar
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from backend.app.route_service import RouteEstimate, RouteService
from backend.app.trip_model import Trip
from backend.app.trip_models import TripOccurrence, TripPublic


APP_TIMEZONE = ZoneInfo("Asia/Shanghai")


def occurs_on(trip: Trip, target_date: date) -> bool:
    if target_date < trip.start_date or (trip.end_date and target_date > trip.end_date):
        return False
    if trip.recurrence == "once":
        return target_date == trip.start_date
    if trip.recurrence == "daily":
        return True
    if trip.recurrence == "weekly":
        return target_date.weekday() == trip.start_date.weekday()
    if trip.recurrence == "monthly":
        last_day = calendar.monthrange(target_date.year, target_date.month)[1]
        occurrence_day = min(trip.start_date.day, last_day)
        return target_date.day == occurrence_day
    return False


def trip_public(trip: Trip, estimate: RouteEstimate) -> TripPublic:
    return TripPublic(
        id=trip.id,
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
        estimated_distance_meters=estimate.distance_meters,
        estimated_duration_minutes=estimate.duration_minutes,
        created_at=trip.created_at,
    )


def occurrence_for(
    trip: Trip,
    estimate: RouteEstimate,
    target_date: date,
    now: datetime,
) -> TripOccurrence:
    arrival = datetime.combine(target_date, trip.latest_arrival_time, APP_TIMEZONE)
    departure = arrival - timedelta(minutes=estimate.duration_minutes)
    reminder_at = departure - timedelta(minutes=trip.reminder_minutes)
    if now > arrival:
        status = "late"
    elif now >= departure:
        status = "leave_now"
    elif now >= reminder_at:
        status = "leave_soon"
    else:
        status = "upcoming"
    return TripOccurrence(
        trip_id=trip.id,
        title=trip.title,
        area_id=trip.area_id,
        occurrence_date=target_date,
        from_place_id=trip.from_place_id,
        from_label=estimate.from_label,
        to_place_id=trip.to_place_id,
        to_label=estimate.to_label,
        latest_arrival_at=arrival,
        suggested_departure_at=departure,
        estimated_distance_meters=estimate.distance_meters,
        estimated_duration_minutes=estimate.duration_minutes,
        reminder_minutes=trip.reminder_minutes,
        recurrence=trip.recurrence,
        status=status,
    )
