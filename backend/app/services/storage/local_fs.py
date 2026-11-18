import os
import shutil
from pathlib import Path
from typing import List, Set, Union
from app.core.config import settings
from app.schemas.files import FileNode
from app.services.storage.base import (
    WorkspaceFS,
    PathTraversalError,
    FileNotFoundStorageError,
    FileExistsStorageError,
    FileTooLargeStorageError,
    BinaryFileNotSupportedError,
    StorageError,
)


class LocalWorkspaceFS(WorkspaceFS):
    """
    Local filesystem implementation of WorkspaceFS.
    Enforces strict directory boundary isolation and path validation.
    """

    def __init__(self, workspace_id: Union[str, Path]):
        self.workspace_id = str(workspace_id)
        base_root = Path(settings.WORKSPACES_ROOT).resolve()
        self.root_dir = (base_root / self.workspace_id).resolve()
        # Ensure root directory exists
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, rel_path: str, must_exist: bool = False) -> Path:
        """
        Validate, normalize and securely resolve a path within the workspace root.
        Rejects directory traversal, absolute paths, null bytes, and symlink escapes.
        """
        if not rel_path or not rel_path.strip():
            return self.root_dir

        # 1. Null byte detection
        if "\0" in rel_path:
            raise PathTraversalError("Invalid character detected in path (null byte)")

        # 2. Check for absolute paths (both POSIX and Windows styles)
        # e.g., /foo, \foo, C:\foo
        cleaned = rel_path.strip()
        if (
            cleaned.startswith("/")
            or cleaned.startswith("\\")
            or (len(cleaned) >= 2 and cleaned[1] == ":")
        ):
            raise PathTraversalError(f"Absolute path '{rel_path}' is not permitted")

        # 3. Path traversal token inspection
        parts = Path(cleaned).parts
        for part in parts:
            if part == "..":
                raise PathTraversalError(f"Directory traversal component '..' found in '{rel_path}'")

        # 4. Resolve against root
        candidate = (self.root_dir / cleaned).resolve()

        # 5. Boundary check
        try:
            candidate.relative_to(self.root_dir)
        except ValueError:
            raise PathTraversalError(f"Path '{rel_path}' escapes workspace boundary")

        # 6. Symlink escape check for existing path
        if candidate.exists():
            real_path = Path(os.path.realpath(candidate))
            real_root = Path(os.path.realpath(self.root_dir))
            try:
                real_path.relative_to(real_root)
            except ValueError:
                raise PathTraversalError(f"Symlink target for '{rel_path}' points outside workspace")

        if must_exist and not candidate.exists():
            raise FileNotFoundStorageError(f"File or directory '{rel_path}' not found")

        return candidate

    async def list_tree(self) -> List[FileNode]:
        """Return the nested tree structure of files and folders."""
        ignored: Set[str] = settings.IGNORED_TREE_NAMES

        def build_node(dir_path: Path) -> List[FileNode]:
            nodes: List[FileNode] = []
            try:
                entries = sorted(list(dir_path.iterdir()), key=lambda e: (not e.is_dir(), e.name.lower()))
            except (OSError, PermissionError):
                return nodes

            for entry in entries:
                if entry.name in ignored:
                    continue

                rel = entry.relative_to(self.root_dir).as_posix()
                if entry.is_dir():
                    children = build_node(entry)
                    nodes.append(
                        FileNode(
                            name=entry.name,
                            path=rel,
                            type="dir",
                            children=children,
                        )
                    )
                else:
                    try:
                        sz = entry.stat().st_size
                    except OSError:
                        sz = 0
                    nodes.append(
                        FileNode(
                            name=entry.name,
                            path=rel,
                            type="file",
                            size=sz,
                        )
                    )
            return nodes

        return build_node(self.root_dir)

    async def read_file(self, path: str) -> str:
        """Read and return UTF-8 text file content."""
        file_path = self._resolve_safe_path(path, must_exist=True)

        if not file_path.is_file():
            raise FileNotFoundStorageError(f"Path '{path}' is a directory, not a file")

        # Check file size limit (2 MB)
        file_size = file_path.stat().st_size
        if file_size > settings.MAX_FILE_SIZE_BYTES:
            raise FileTooLargeStorageError(
                f"File '{path}' exceeds max allowed size of {settings.MAX_FILE_SIZE_BYTES // (1024*1024)} MB "
                f"({file_size} bytes)"
            )

        # Inspect bytes for binary content
        try:
            with open(file_path, "rb") as f:
                header = f.read(8000)
                if b"\0" in header:
                    raise BinaryFileNotSupportedError(f"File '{path}' appears to be binary and cannot be edited")

            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            raise BinaryFileNotSupportedError(f"File '{path}' is not valid UTF-8 text")
        except OSError as e:
            raise StorageError(f"Failed to read file: {str(e)}")

    async def write_file(self, path: str, content: str) -> int:
        """Write content to a file, returning written byte count."""
        file_path = self._resolve_safe_path(path)

        # Ensure parent directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        content_bytes = content.encode("utf-8")
        if len(content_bytes) > settings.MAX_FILE_SIZE_BYTES:
            raise FileTooLargeStorageError(
                f"Content size ({len(content_bytes)} bytes) exceeds max limit of {settings.MAX_FILE_SIZE_BYTES} bytes"
            )

        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            return len(content_bytes)
        except OSError as e:
            raise StorageError(f"Failed to write file: {str(e)}")

    async def create_file(self, path: str) -> None:
        """Create a new empty file at path."""
        file_path = self._resolve_safe_path(path)
        if file_path.exists():
            raise FileExistsStorageError(f"File '{path}' already exists")

        file_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            file_path.touch(exist_ok=False)
        except OSError as e:
            raise StorageError(f"Failed to create file: {str(e)}")

    async def create_dir(self, path: str) -> None:
        """Create a new directory at path."""
        dir_path = self._resolve_safe_path(path)
        if dir_path.exists():
            raise FileExistsStorageError(f"Directory '{path}' already exists")

        try:
            dir_path.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise StorageError(f"Failed to create directory: {str(e)}")

    async def rename(self, path: str, new_path: str) -> None:
        """Rename or move a file or directory."""
        source = self._resolve_safe_path(path, must_exist=True)
        dest = self._resolve_safe_path(new_path)

        if dest.exists():
            raise FileExistsStorageError(f"Destination path '{new_path}' already exists")

        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.move(str(source), str(dest))
        except OSError as e:
            raise StorageError(f"Failed to move/rename: {str(e)}")

    async def delete(self, path: str) -> None:
        """Delete a file or directory recursively."""
        target = self._resolve_safe_path(path, must_exist=True)

        # Do not allow deleting the workspace root itself via files API
        if target == self.root_dir:
            raise PathTraversalError("Cannot delete the workspace root directory")

        try:
            if target.is_dir():
                shutil.rmtree(str(target))
            else:
                target.unlink()
        except OSError as e:
            raise StorageError(f"Failed to delete '{path}': {str(e)}")

    async def initialize_template(self, template: str) -> None:
        """Populate initial workspace structure from starter template."""
        if template == "starter_web":
            await self.write_file(
                "index.html",
                """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevSync Web App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Welcome to DevSync</h1>
    <p>A collaborative cloud development environment.</p>
    <button id="btn">Click Me</button>
  </div>
  <script src="app.js"></script>
</body>
</html>
""",
            )
            await self.write_file(
                "style.css",
                """body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 2rem;
  background-color: #0f172a;
  color: #f8fafc;
}
.container {
  max-width: 600px;
  margin: 0 auto;
}
button {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #2563eb;
}
""",
            )
            await self.write_file(
                "app.js",
                """document.getElementById('btn').addEventListener('click', () => {
  alert('Hello from DevSync IDE!');
});
console.log('DevSync starter loaded.');
""",
            )
            await self.write_file(
                "README.md",
                """# Web Starter Project

This is a starter web project in DevSync.
- `index.html` - Main HTML markup
- `style.css` - Styles
- `app.js` - Client JavaScript
""",
            )
        elif template == "starter_python":
            await self.write_file(
                "main.py",
                """def main():
    print("Welcome to DevSync Python Project!")
    names = ["Alice", "Bob", "Charlie"]
    for name in names:
        print(f"Hello, {name}!")

if __name__ == "__main__":
    main()
""",
            )
            await self.write_file(
                "requirements.txt",
                """# DevSync Python Starter Requirements
requests>=2.31.0
""",
            )
            await self.write_file(
                "README.md",
                """# Python Starter Project

A Python 3 starter workspace on DevSync.
Run `python main.py` to get started.
""",
            )
        else:
            # Empty template: just create an initial README.md
            await self.write_file(
                "README.md",
                """# New Workspace

Welcome to your new DevSync workspace!
Create files in the left sidebar explorer to begin coding.
""",
            )
