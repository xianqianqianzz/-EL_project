import httpx
import pytest

from backend.app.main import app


async def request(path: str, method: str = "GET", **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


@pytest.mark.asyncio
async def test_health() -> None:
    response = await request("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "nju-campus-map-api",
        "apiVersion": "v1",
    }


@pytest.mark.asyncio
async def test_area_index_uses_public_api_urls() -> None:
    response = await request("/api/v1/areas")

    assert response.status_code == 200
    payload = response.json()
    assert payload["defaultOutdoorAreaId"] == "outdoor-xianlin"
    assert payload["areas"][0]["dataUrl"] == "/api/v1/areas/outdoor-xianlin"
    assert payload["areas"][0]["mapUrl"] == "/api/v1/areas/outdoor-xianlin/map"
    assert "path" not in payload["areas"][0]


@pytest.mark.asyncio
async def test_area_and_map_are_available() -> None:
    area_response = await request("/api/v1/areas/outdoor-xianlin")
    map_response = await request("/api/v1/areas/outdoor-xianlin/map")

    assert area_response.status_code == 200
    assert area_response.headers["cache-control"] == "no-store"
    assert area_response.json()["areaId"] == "outdoor-xianlin"
    assert area_response.json()["places"]
    assert map_response.status_code == 200
    assert map_response.headers["content-type"] == "image/png"


@pytest.mark.asyncio
async def test_unknown_area_returns_404() -> None:
    response = await request("/api/v1/areas/not-found")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_backend_serves_redesigned_map_frontend() -> None:
    response = await request("/")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert "仙林校区地图与日程系统" in response.text
    assert "login.html" in response.text
    assert "schedule.html" in response.text


@pytest.mark.asyncio
async def test_backend_serves_independent_account_and_schedule_pages() -> None:
    login_response = await request("/login.html")
    schedule_response = await request("/schedule.html")
    missing_response = await request("/unknown.html")

    assert login_response.status_code == 200
    assert "欢迎回来" in login_response.text
    assert schedule_response.status_code == 200
    assert "今日行程" in schedule_response.text
    assert missing_response.status_code == 404
