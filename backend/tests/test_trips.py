from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import httpx
import pytest

from backend.app.main import app
from backend.app.trip_model import Trip
from backend.app.trip_service import APP_TIMEZONE, occurs_on, occurrence_for
from backend.app.route_service import RouteEstimate


async def request(path: str, method: str = "GET", **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


async def token_for(username: str) -> str:
    await request(
        "/api/v1/auth/register",
        "POST",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "display_name": username,
            "password": "correct-horse-123",
        },
    )
    response = await request(
        "/api/v1/auth/token",
        "POST",
        data={"username": username, "password": "correct-horse-123"},
    )
    return response.json()["access_token"]


def trip_payload(**overrides):
    payload = {
        "title": "去图书馆",
        "area_id": "outdoor-xianlin",
        "from_place_id": "outdoor-xianlin-place-001",
        "to_place_id": "outdoor-xianlin-place-002",
        "start_date": date.today().isoformat(),
        "latest_arrival_time": "18:00",
        "recurrence": "once",
        "reminder_minutes": 10,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_create_list_update_and_delete_trip() -> None:
    token = await token_for("trip_owner")
    headers = {"Authorization": f"Bearer {token}"}

    created = await request("/api/v1/trips", "POST", headers=headers, json=trip_payload())
    listed = await request("/api/v1/trips", headers=headers)
    updated = await request(
        f"/api/v1/trips/{created.json()['id']}",
        "PUT",
        headers=headers,
        json=trip_payload(title="更新后的行程", recurrence="daily"),
    )
    deleted = await request(f"/api/v1/trips/{created.json()['id']}", "DELETE", headers=headers)

    assert created.status_code == 201
    assert created.json()["from_label"] == "南大门"
    assert created.json()["to_label"] == "图书馆"
    assert created.json()["estimated_duration_minutes"] > 0
    assert len(listed.json()) == 1
    assert updated.json()["title"] == "更新后的行程"
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_trips_are_private_to_their_owner() -> None:
    owner_token = await token_for("owner")
    other_token = await token_for("other")
    created = await request(
        "/api/v1/trips",
        "POST",
        headers={"Authorization": f"Bearer {owner_token}"},
        json=trip_payload(),
    )
    other_headers = {"Authorization": f"Bearer {other_token}"}

    listed = await request("/api/v1/trips", headers=other_headers)
    deleted = await request(f"/api/v1/trips/{created.json()['id']}", "DELETE", headers=other_headers)

    assert listed.json() == []
    assert deleted.status_code == 404


@pytest.mark.asyncio
async def test_invalid_route_and_dates_are_rejected() -> None:
    token = await token_for("invalid_trip")
    headers = {"Authorization": f"Bearer {token}"}

    same_place = await request(
        "/api/v1/trips",
        "POST",
        headers=headers,
        json=trip_payload(to_place_id="outdoor-xianlin-place-001"),
    )
    invalid_dates = await request(
        "/api/v1/trips",
        "POST",
        headers=headers,
        json=trip_payload(start_date="2026-06-20", end_date="2026-06-10", recurrence="daily"),
    )

    assert same_place.status_code == 422
    assert invalid_dates.status_code == 422


@pytest.mark.asyncio
async def test_today_returns_occurrence_for_active_daily_trip() -> None:
    token = await token_for("today_trip")
    headers = {"Authorization": f"Bearer {token}"}
    today = datetime.now(APP_TIMEZONE).date()
    await request(
        "/api/v1/trips",
        "POST",
        headers=headers,
        json=trip_payload(start_date=today.isoformat(), recurrence="daily"),
    )

    response = await request("/api/v1/trips/today", headers=headers)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["occurrence_date"] == today.isoformat()
    assert response.json()[0]["suggested_departure_at"].endswith("+08:00")


@pytest.mark.asyncio
async def test_demo_trips_are_created_once_for_empty_account() -> None:
    token = await token_for("demo_trip_user")
    headers = {"Authorization": f"Bearer {token}"}

    first = await request("/api/v1/trips/demo", "POST", headers=headers)
    second = await request("/api/v1/trips/demo", "POST", headers=headers)
    listed = await request("/api/v1/trips", headers=headers)

    assert first.status_code == 200
    assert [trip["title"] for trip in first.json()] == ["教学楼课程", "图书馆还书", "体育馆训练"]
    assert second.json() == []
    assert len(listed.json()) == 3


def bare_trip(recurrence: str, start_date: date, end_date: date | None = None) -> Trip:
    return Trip(
        id=1,
        user_id=1,
        title="测试",
        area_id="outdoor-xianlin",
        from_place_id="from",
        to_place_id="to",
        start_date=start_date,
        end_date=end_date,
        latest_arrival_time=time(10, 0),
        recurrence=recurrence,
        reminder_minutes=10,
        created_at=datetime(2026, 1, 1),
    )


def test_recurrence_rules() -> None:
    assert occurs_on(bare_trip("once", date(2026, 6, 11)), date(2026, 6, 11))
    assert not occurs_on(bare_trip("once", date(2026, 6, 11)), date(2026, 6, 12))
    assert occurs_on(bare_trip("daily", date(2026, 6, 11)), date(2026, 6, 12))
    assert occurs_on(bare_trip("weekly", date(2026, 6, 11)), date(2026, 6, 18))
    assert not occurs_on(bare_trip("weekly", date(2026, 6, 11)), date(2026, 6, 19))
    assert occurs_on(bare_trip("monthly", date(2026, 1, 31)), date(2026, 2, 28))
    assert not occurs_on(
        bare_trip("daily", date(2026, 6, 11), end_date=date(2026, 6, 12)),
        date(2026, 6, 13),
    )


def test_occurrence_status_uses_suggested_departure_and_reminder() -> None:
    trip = bare_trip("once", date(2026, 6, 11))
    estimate = RouteEstimate("area", "from", "起点", "to", "终点", 720, 10)
    timezone = ZoneInfo("Asia/Shanghai")

    upcoming = occurrence_for(trip, estimate, date(2026, 6, 11), datetime(2026, 6, 11, 9, 30, tzinfo=timezone))
    leave_soon = occurrence_for(trip, estimate, date(2026, 6, 11), datetime(2026, 6, 11, 9, 45, tzinfo=timezone))
    leave_now = occurrence_for(trip, estimate, date(2026, 6, 11), datetime(2026, 6, 11, 9, 55, tzinfo=timezone))
    late = occurrence_for(trip, estimate, date(2026, 6, 11), datetime(2026, 6, 11, 10, 1, tzinfo=timezone))

    assert upcoming.status == "upcoming"
    assert leave_soon.status == "leave_soon"
    assert leave_now.status == "leave_now"
    assert late.status == "late"
