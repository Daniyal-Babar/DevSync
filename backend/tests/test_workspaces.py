import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.workspace_member import WorkspaceMember, WorkspaceRole


@pytest.mark.asyncio
async def test_create_workspace_assigns_owner(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={
            "name": "My Project",
            "description": "Demo workspace",
            "template": "starter_web",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Project"
    assert data["role"] == "owner"
    assert "id" in data

    # Verify files created by template
    ws_id = data["id"]
    tree_resp = await client.get(f"/api/workspaces/{ws_id}/files/tree", headers=auth_headers)
    assert tree_resp.status_code == 200
    file_names = [n["name"] for n in tree_resp.json()["root"]]
    assert "index.html" in file_names
    assert "style.css" in file_names


@pytest.mark.asyncio
async def test_workspace_scoping(
    client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    second_user: User,
    second_user_headers: dict,
):
    # User 1 creates workspace
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "User 1 Secret", "template": "empty"},
    )
    ws_id = ws_resp.json()["id"]

    # User 1 sees it in list
    list1 = await client.get("/api/workspaces", headers=auth_headers)
    assert any(w["id"] == ws_id for w in list1.json())

    # User 2 does NOT see it in list
    list2 = await client.get("/api/workspaces", headers=second_user_headers)
    assert not any(w["id"] == ws_id for w in list2.json())

    # User 2 accessing it directly gets 403 Forbidden
    direct = await client.get(f"/api/workspaces/{ws_id}", headers=second_user_headers)
    assert direct.status_code == 403


@pytest.mark.asyncio
async def test_viewer_permission_boundaries(
    client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    second_user: User,
    second_user_headers: dict,
    db_session: AsyncSession,
):
    # Owner creates workspace
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "Shared Space", "template": "starter_python"},
    )
    ws_id = ws_resp.json()["id"]

    # Add second_user as VIEWER
    viewer_member = WorkspaceMember(
        workspace_id=uuid.UUID(ws_resp.json()["id"]),
        user_id=second_user.id,
        role=WorkspaceRole.VIEWER,
    )
    db_session.add(viewer_member)
    await db_session.commit()

    # Viewer CAN read tree
    tree_resp = await client.get(f"/api/workspaces/{ws_id}/files/tree", headers=second_user_headers)
    assert tree_resp.status_code == 200

    # Viewer CAN read content
    content_resp = await client.get(
        f"/api/workspaces/{ws_id}/files/content?path=main.py",
        headers=second_user_headers,
    )
    assert content_resp.status_code == 200

    # Viewer CANNOT write / save content (403 Forbidden)
    write_resp = await client.put(
        f"/api/workspaces/{ws_id}/files/content",
        headers=second_user_headers,
        json={"path": "main.py", "content": "print('Hacked')"},
    )
    assert write_resp.status_code == 403

    # Viewer CANNOT create a new file (403 Forbidden)
    create_resp = await client.post(
        f"/api/workspaces/{ws_id}/files",
        headers=second_user_headers,
        json={"path": "hacked.py", "type": "file"},
    )
    assert create_resp.status_code == 403

    # Viewer CANNOT delete a file (403 Forbidden)
    delete_resp = await client.delete(
        f"/api/workspaces/{ws_id}/files?path=main.py",
        headers=second_user_headers,
    )
    assert delete_resp.status_code == 403


@pytest.mark.asyncio
async def test_editor_permissions(
    client: AsyncClient,
    test_user: User,
    auth_headers: dict,
    second_user: User,
    second_user_headers: dict,
    db_session: AsyncSession,
):
    # Owner creates workspace
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "Collaborative Space", "template": "empty"},
    )
    ws_id = ws_resp.json()["id"]

    # Add second_user as EDITOR
    editor_member = WorkspaceMember(
        workspace_id=uuid.UUID(ws_resp.json()["id"]),
        user_id=second_user.id,
        role=WorkspaceRole.EDITOR,
    )
    db_session.add(editor_member)
    await db_session.commit()

    # Editor CAN create file
    create_resp = await client.post(
        f"/api/workspaces/{ws_id}/files",
        headers=second_user_headers,
        json={"path": "script.py", "type": "file"},
    )
    assert create_resp.status_code == 201

    # Editor CAN write file
    save_resp = await client.put(
        f"/api/workspaces/{ws_id}/files/content",
        headers=second_user_headers,
        json={"path": "script.py", "content": "print('Hello world!')"},
    )
    assert save_resp.status_code == 200

    # Editor CANNOT delete the workspace (Owner only)
    del_ws_resp = await client.delete(f"/api/workspaces/{ws_id}", headers=second_user_headers)
    assert del_ws_resp.status_code == 403

    # Owner CAN delete workspace
    owner_del = await client.delete(f"/api/workspaces/{ws_id}", headers=auth_headers)
    assert owner_del.status_code == 200
