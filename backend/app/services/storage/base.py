from abc import ABC, abstractmethod
from typing import List
from app.schemas.files import FileNode


class StorageError(Exception):
    """Base storage exception."""
    pass


class PathTraversalError(StorageError):
    """Raised when a path escapes the workspace root."""
    pass


class FileNotFoundStorageError(StorageError):
    """Raised when a requested file or directory does not exist."""
    pass


class FileExistsStorageError(StorageError):
    """Raised when creating or renaming to a target that already exists."""
    pass


class FileTooLargeStorageError(StorageError):
    """Raised when a file exceeds the allowed size limit."""
    pass


class BinaryFileNotSupportedError(StorageError):
    """Raised when attempting to read binary content."""
    pass


class WorkspaceFS(ABC):
    """
    Abstract interface for workspace file operations.
    Designed to allow interchangeable backends (LocalWorkspaceFS in Phase 1,
    Docker container / volume in Phase 2, S3/Cloud in future).
    """

    @abstractmethod
    async def list_tree(self) -> List[FileNode]:
        """Return the nested tree structure of files and folders."""
        pass

    @abstractmethod
    async def read_file(self, path: str) -> str:
        """Read and return UTF-8 text file content."""
        pass

    @abstractmethod
    async def write_file(self, path: str, content: str) -> int:
        """Write content to an existing or new file, returning byte size."""
        pass

    @abstractmethod
    async def create_file(self, path: str) -> None:
        """Create a new empty file at path."""
        pass

    @abstractmethod
    async def create_dir(self, path: str) -> None:
        """Create a new directory at path."""
        pass

    @abstractmethod
    async def rename(self, path: str, new_path: str) -> None:
        """Rename or move a file or directory."""
        pass

    @abstractmethod
    async def delete(self, path: str) -> None:
        """Delete a file or directory recursively."""
        pass

    @abstractmethod
    async def initialize_template(self, template: str) -> None:
        """Populate initial workspace structure from a starter template."""
        pass
