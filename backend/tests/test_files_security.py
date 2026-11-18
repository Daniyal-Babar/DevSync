import os
from pathlib import Path
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_path_traversal_attempts(client: AsyncClient, auth_headers: dict):
    # Create workspace
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "Security Test Space", "template": "empty"},
    )
    ws_id = ws_resp.json()["id"]

    traversal_payloads = [
        "../test.txt",
        "../../test.txt",
        "nested/../../secret.txt",
        "/etc/passwd",
        "/var/log/syslog",
        "\\Windows\\System32\\cmd.exe",
        "C:\\Windows\\win.ini",
        "foo/bar/../../../escaped.txt",
    ]

    for malicious_path in traversal_payloads:
        # 1. Read attempt
        read_resp = await client.get(
            f"/api/workspaces/{ws_id}/files/content",
            params={"path": malicious_path},
            headers=auth_headers,
        )
        assert read_resp.status_code == 400, f"Expected 400 for read '{malicious_path}', got {read_resp.status_code}"
        assert "Security violation" in read_resp.json()["detail"] or "not permitted" in read_resp.json()["detail"]

        # 2. Write attempt
        write_resp = await client.put(
            f"/api/workspaces/{ws_id}/files/content",
            headers=auth_headers,
            json={"path": malicious_path, "content": "malicious content"},
        )
        assert write_resp.status_code == 400, f"Expected 400 for write '{malicious_path}', got {write_resp.status_code}"

        # 3. Create attempt
        create_resp = await client.post(
            f"/api/workspaces/{ws_id}/files",
            headers=auth_headers,
            json={"path": malicious_path, "type": "file"},
        )
        assert create_resp.status_code == 400, f"Expected 400 for create '{malicious_path}', got {create_resp.status_code}"

        # 4. Delete attempt
        del_resp = await client.delete(
            f"/api/workspaces/{ws_id}/files",
            params={"path": malicious_path},
            headers=auth_headers,
        )
        assert del_resp.status_code == 400, f"Expected 400 for delete '{malicious_path}', got {del_resp.status_code}"


@pytest.mark.asyncio
async def test_null_byte_injection(client: AsyncClient, auth_headers: dict):
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "Null Byte Test", "template": "empty"},
    )
    ws_id = ws_resp.json()["id"]

    null_path = "safe.txt\0.exe"
    resp = await client.get(
        f"/api/workspaces/{ws_id}/files/content",
        params={"path": null_path},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "null byte" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_file_size_limit_rejection(client: AsyncClient, auth_headers: dict):
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "Size Limit Test", "template": "empty"},
    )
    ws_id = ws_resp.json()["id"]

    # 2MB + 100 bytes
    oversized_content = "A" * (2 * 1024 * 1024 + 100)

    resp = await client.put(
        f"/api/workspaces/{ws_id}/files/content",
        headers=auth_headers,
        json={"path": "huge.txt", "content": oversized_content},
    )
    assert resp.status_code == 413
    assert "exceeds" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_binary_file_rejection(client: AsyncClient, auth_headers: dict):
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "Binary Test", "template": "empty"},
    )
    ws_id = ws_resp.json()["id"]

    # Get workspace folder on disk and write a binary file with null bytes directly
    from app.core.config import settings
    ws_path = Path(settings.WORKSPACES_ROOT) / ws_id
    binary_file = ws_path / "image.png"
    with open(binary_file, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00")

    resp = await client.get(
        f"/api/workspaces/{ws_id}/files/content?path=image.png",
        headers=auth_headers,
    )
    assert resp.status_code == 415
    assert "binary" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_tree_ignores_git_and_node_modules(client: AsyncClient, auth_headers: dict):
    ws_resp = await client.post(
        "/api/workspaces",
        headers=auth_headers,
        json={"name": "Tree Filter Test", "template": "empty"},
    )
    ws_id = ws_resp.json()["id"]

    # Create .git and node_modules folders on disk
    from app.core.config import settings
    ws_path = Path(settings.WORKSPACES_ROOT) / ws_id
    (ws_path / ".git").mkdir(exist_ok=True)
    (ws_path / ".git" / "config").touch()
    (ws_path / "node_modules").mkdir(exist_ok=True)
    (ws_path / "node_modules" / "package.json").touch()

    # Create normal file
    (ws_path / "src").mkdir(exist_ok=True)
    (ws_path / "src" / "index.js").touch()

    tree_resp = await client.get(f"/api/workspaces/{ws_id}/files/tree", headers=auth_headers)
    assert tree_resp.status_code == 200
    names = [node["name"] for node in tree_resp.json()["root"]]
    assert ".git" not in names
    assert "node_modules" not in names
    assert "src" in names
