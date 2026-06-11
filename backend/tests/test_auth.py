from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from backend.app.auth import require_roles
from backend.app.main import app


async def request(path: str, method: str = "GET", **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


async def register_user(username: str = "student01") -> httpx.Response:
    return await request(
        "/api/v1/auth/register",
        "POST",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "display_name": "测试用户",
            "password": "correct-horse-123",
        },
    )


async def login_user(username: str = "student01", password: str = "correct-horse-123"):
    return await request(
        "/api/v1/auth/token",
        "POST",
        data={"username": username, "password": password},
    )


@pytest.mark.asyncio
async def test_register_login_and_read_current_user() -> None:
    register_response = await register_user()
    login_response = await login_user()
    token = login_response.json()["access_token"]
    me_response = await request(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert register_response.status_code == 201
    assert register_response.json()["role"] == "user"
    assert "password" not in register_response.json()
    assert login_response.status_code == 200
    assert login_response.json()["token_type"] == "bearer"
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "student01"


@pytest.mark.asyncio
async def test_duplicate_registration_is_rejected() -> None:
    await register_user()
    response = await register_user()

    assert response.status_code == 409
    assert response.json()["detail"] == "用户名或邮箱已被使用"


@pytest.mark.asyncio
async def test_registration_rejects_role_and_blank_display_name() -> None:
    role_response = await request(
        "/api/v1/auth/register",
        "POST",
        json={
            "username": "role_attempt",
            "email": "role@example.com",
            "display_name": "测试用户",
            "password": "correct-horse-123",
            "role": "admin",
        },
    )
    blank_name_response = await request(
        "/api/v1/auth/register",
        "POST",
        json={
            "username": "blank_name",
            "email": "blank@example.com",
            "display_name": "   ",
            "password": "correct-horse-123",
        },
    )

    assert role_response.status_code == 422
    assert blank_name_response.status_code == 422


@pytest.mark.asyncio
async def test_invalid_password_and_token_are_rejected() -> None:
    await register_user()
    login_response = await login_user(password="wrong-password")
    me_response = await request(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert login_response.status_code == 401
    assert me_response.status_code == 401


def test_role_dependency_allows_only_configured_roles() -> None:
    staff_or_admin = require_roles("staff", "admin")
    admin = SimpleNamespace(role="admin")
    user = SimpleNamespace(role="user")

    assert staff_or_admin(admin) is admin
    with pytest.raises(HTTPException) as error:
        staff_or_admin(user)
    assert error.value.status_code == 403
