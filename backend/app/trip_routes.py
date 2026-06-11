from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.area_repository import AreaRepository
from backend.app.auth import get_current_user
from backend.app.database import get_db
from backend.app.route_service import PlaceNotFoundError, RouteNotFoundError, RouteService
from backend.app.trip_model import Trip
from backend.app.trip_models import TripOccurrence, TripPublic, TripWrite
from backend.app.trip_service import APP_TIMEZONE, occurrence_for, occurs_on, trip_public
from backend.app.user_model import User


router = APIRouter(prefix="/api/v1/trips", tags=["trips"])


def get_route_service() -> RouteService:
    from backend.app.main import PROJECT_ROOT

    return RouteService(AreaRepository(PROJECT_ROOT))


def estimate_or_422(route_service: RouteService, area_id: str, from_id: str, to_id: str):
    try:
        return route_service.estimate(area_id, from_id, to_id)
    except (PlaceNotFoundError, RouteNotFoundError) as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error


@router.post("", response_model=TripPublic, status_code=status.HTTP_201_CREATED)
def create_trip(
    payload: TripWrite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    route_service: RouteService = Depends(get_route_service),
) -> TripPublic:
    estimate = estimate_or_422(route_service, payload.area_id, payload.from_place_id, payload.to_place_id)
    trip = Trip(user_id=current_user.id, **payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip_public(trip, estimate)


@router.get("", response_model=list[TripPublic])
def list_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    route_service: RouteService = Depends(get_route_service),
) -> list[TripPublic]:
    trips = db.scalars(select(Trip).where(Trip.user_id == current_user.id).order_by(Trip.start_date, Trip.latest_arrival_time)).all()
    return [
        trip_public(trip, estimate_or_422(route_service, trip.area_id, trip.from_place_id, trip.to_place_id))
        for trip in trips
    ]


@router.get("/today", response_model=list[TripOccurrence])
def today_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    route_service: RouteService = Depends(get_route_service),
) -> list[TripOccurrence]:
    now = datetime.now(APP_TIMEZONE)
    trips = db.scalars(select(Trip).where(Trip.user_id == current_user.id)).all()
    occurrences = [
        occurrence_for(
            trip,
            estimate_or_422(route_service, trip.area_id, trip.from_place_id, trip.to_place_id),
            now.date(),
            now,
        )
        for trip in trips
        if occurs_on(trip, now.date())
    ]
    return sorted(occurrences, key=lambda occurrence: occurrence.latest_arrival_at)


@router.put("/{trip_id}", response_model=TripPublic)
def update_trip(
    trip_id: int,
    payload: TripWrite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    route_service: RouteService = Depends(get_route_service),
) -> TripPublic:
    trip = db.scalar(select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id))
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="行程不存在")
    estimate = estimate_or_422(route_service, payload.area_id, payload.from_place_id, payload.to_place_id)
    for field, value in payload.model_dump().items():
        setattr(trip, field, value)
    db.commit()
    db.refresh(trip)
    return trip_public(trip, estimate)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    trip = db.scalar(select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id))
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="行程不存在")
    db.delete(trip)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
