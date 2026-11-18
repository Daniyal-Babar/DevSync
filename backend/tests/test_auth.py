import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "newuser@example.com",
            "username": "newuser123",
            "password": "Password123!",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["username"] == "newuser123"
    assert "id" in data
    assert "password_hash" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "dup@example.com",
        "username": "dupuser1",
        "password": "Password123!",
    }
    r1 = await client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    payload2 = {
        "email": "dup@example.com",
        "username": "dupuser2",
        "password": "Password123!",
    }
    r2 = await client.post("/api/auth/register", json=payload2)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_login_success_and_cookie(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={
            "email": "logintest@example.com",
            "username": "logintest",
            "password": "Password123!",
        },
    )
    assert reg.status_code == 201

    login_resp = await client.post(
        "/api/auth/login",
        json={"login": "logintest@example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "logintest"
    # Check refresh_token cookie
    assert "refresh_token" in login_resp.cookies


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={"login": "logintest@example.com", "password": "WrongPassword"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_protected(client: AsyncClient, auth_headers: dict):
    # Authorized
    res = await client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert "id" in res.json()

    # Unauthorized
    unauth = await client.get("/api/auth/me")
    assert unauth.status_code == 401


@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    res = await client.post("/api/auth/logout")
    assert res.status_code == 200
