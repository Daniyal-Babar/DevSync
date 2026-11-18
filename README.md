# DevSync (Phase 1)

**DevSync** is a browser-based collaborative cloud development environment.

Phase 1 provides the core foundation:
- **Authentication**: JWT access (15 min) + secure httpOnly refresh tokens (7 days), password hashing via bcrypt, user registration & session management.
- **Workspaces**: Isolated workspace projects with role-based access control (`owner`, `editor`, `viewer`), starter templates (`empty`, `starter_web`, `starter_python`).
- **File Management**: Abstract `WorkspaceFS` interface with `LocalWorkspaceFS` driver, strict path traversal & symlink escape security, 2 MB size limits, binary file rejection, hidden `.git` / `node_modules`.
- **Browser Code Editor**: Monaco Editor with auto language detection, tab management, unsaved indicators, Ctrl/Cmd+S shortcuts, dark/light theme, and role-based read-only mode.
- **Architectural Seams**: Pre-designed clean seams for Docker containers (Phase 2), WebSocket PTY terminal (Phase 2), snapshots & Git (Phase 3), and Yjs real-time collaboration (Phase 4).

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Monaco Editor (`@monaco-editor/react`), React Router v6, TanStack Query v5, Zustand, Tailwind CSS, Lucide icons.
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, PyJWT, bcrypt, aiosqlite (test suite) / asyncpg (PostgreSQL).
- **Infra**: Docker Compose running PostgreSQL 16.

---

## Directory Structure

```text
devsync/
├── backend/
│   ├── alembic/              # Alembic database migrations
│   ├── app/
│   │   ├── api/              # API endpoints (auth, workspaces, files)
│   │   ├── core/             # Config, security, reusable dependencies
│   │   ├── db/               # SQLAlchemy session & base declarative models
│   │   ├── models/           # User, Workspace, WorkspaceMember models
│   │   ├── schemas/          # Pydantic v2 validation schemas
│   │   ├── services/
│   │   │   └── storage/      # WorkspaceFS abstract interface & LocalWorkspaceFS
│   │   └── main.py           # FastAPI application entrypoint & CORS
│   ├── tests/                # Pytest async test suite
│   ├── alembic.ini
│   ├── pytest.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/              # Typed API clients (auth, workspaces, files)
│   │   ├── components/       # CodeEditor, EditorTabs, FileExplorer, ContextMenu, TopBar, BottomPanel
│   │   ├── pages/            # LoginPage, RegisterPage, DashboardPage, WorkspacePage
│   │   ├── stores/           # Zustand stores (authStore, editorStore, uiStore)
│   │   └── types/            # TypeScript interfaces mirroring backend schemas
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml        # PostgreSQL service
├── .env.example              # Environment variables template
└── README.md
```

---

## Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+ and npm

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start PostgreSQL
Run the PostgreSQL container in the background:
```bash
docker compose up -d postgres
```

### 4. Setup and Run Backend
Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

Run database migrations:
```bash
alembic upgrade head
```

Start the FastAPI backend server (runs on `http://127.0.0.1:8000`):
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
API Documentation will be available at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 5. Setup and Run Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The Vite development server will start at `http://localhost:5173`. Open this URL in your browser to access DevSync.

---

## Seed & Development Instructions

1. Navigate to `http://localhost:5173/register` and create an account (e.g. username: `alice`, password: `Password123!`).
2. Upon registration, you are automatically logged in and redirected to the **Workspaces Dashboard**.
3. Click **New Workspace**:
   - Choose a workspace name (e.g. `My Web Project`).
   - Select a starter template:
     - **Empty**: A minimal workspace with an introductory `README.md`.
     - **Web App**: Starter `index.html`, `style.css`, `app.js`, and `README.md`.
     - **Python**: Starter `main.py`, `requirements.txt`, and `README.md`.
4. Click into the workspace card to open the **DevSync IDE**:
   - Explore and manage files in the left sidebar.
   - Right-click for context menu actions: **New File**, **New Folder**, **Rename**, and **Delete**.
   - Edit files with full syntax highlighting in Monaco.
   - Use `Ctrl+S` (or `Cmd+S`) to save changes.
   - Open multiple tabs and switch between files effortlessly.
   - Toggle between Dark and Light themes.

---

## Running Tests

### Backend Test Suite
The backend includes a comprehensive pytest suite covering:
- Authentication & JWT cookie refresh flow
- User scoping & workspace permissions (Viewers cannot write/create/delete; Editors can edit files; Owners can delete workspace)
- Security & path-traversal prevention (`..`, absolute paths, null byte injections, symlink escape protection, file size > 2MB rejection, binary file rejection, `.git`/`node_modules` exclusion).

Run tests:
```bash
cd backend
pytest -v
```

### Frontend Type-Check & Build
Run TypeScript type-checking and production build:
```bash
cd frontend
npm run type-check
npm run build
```

---

## Architectural Seams for Later Phases

- **Docker Backend (Phase 2)**: All file operations are channeled through the abstract `WorkspaceFS` base class (`services/storage/base.py`). In Phase 2, `LocalWorkspaceFS` can be swapped for a `DockerWorkspaceFS` or container mount driver without modifying any API routes.
- **Terminal & Shell (Phase 2)**: The bottom panel in the IDE (`components/BottomPanel.tsx`) is an isolated placeholder ready to connect to a WebSocket PTY stream attached to a Docker container.
- **Snapshots & Git (Phase 3)**: Workspace data models and storage roots are isolated by workspace UUID, allowing point-in-time filesystem snapshots or Git repository clones to be attached per workspace.
- **Real-Time Collaboration (Phase 4)**: The `editorStore` (`stores/editorStore.ts`) maintains editor state keyed by file path (`files[path]`). In Phase 4, the content provider can be hooked directly to Yjs document providers (`y-webrtc` / `y-websocket`) without altering the Monaco editor wrapper (`CodeEditor.tsx`).
