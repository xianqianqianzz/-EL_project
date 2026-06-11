import httpx
import pytest

from backend.app.main import app


async def request(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


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
    assert response.json()["detail"] == "区域不存在"


@pytest.mark.asyncio
async def test_backend_serves_existing_frontend() -> None:
    response = await request("/")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert "南京大学仙林校区地图" in response.text
