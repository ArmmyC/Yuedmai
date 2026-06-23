# AGENTS.md

## Project overview

YUEDMAI Next is a camera-first, web/PWA-first stretching companion. The product direction is a server-hosted FastAPI backend with a Vite frontend. The main experience should reward consistency, completion, safe camera visibility, and daily practice. Do not design features that score body shape, body size, attractiveness, or extreme flexibility.

## Repository layout

- `backend/`: FastAPI app, API routes, services, models, and backend tests.
- `frontend/`: Vite frontend app, browser camera UI, PWA shell, and frontend assets.
- `docs/`: architecture notes, migration notes, and feature specs.
- `docs/specs/`: implementation specs that Codex should follow for feature work.

## Tech stack

Backend:

- Python
- FastAPI
- Uvicorn
- Pydantic

Frontend:

- Vite
- Plain JavaScript modules
- HTML
- CSS

Do not migrate the frontend to a framework unless a feature spec explicitly requires it.

## Package manager

Use `pip` for backend Python dependencies.

Use `npm` for frontend dependencies.

On Windows PowerShell, `npm.cmd` may be needed if script execution is blocked.

## Install commands

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
```

## Development commands

Backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

## Test commands

If backend tests exist:

```bash
cd backend
pytest
```

If frontend tests exist, use the test script defined in `frontend/package.json`.

Do not invent test commands in final summaries. If no test command exists, say so.

## Lint and typecheck commands

Use existing lint and typecheck scripts if they exist.

If no lint or typecheck command exists, state that they are unavailable.

Do not add lint or typecheck tooling unless a feature spec requires it.

## Database and migrations

The current starter is in-memory unless a feature spec adds persistence.

Do not add a database, ORM, or migration system unless the active feature spec requires it.

## Code style conventions

- Follow existing file structure and naming patterns.
- Keep backend API modules small and focused.
- Keep business logic in services instead of route handlers when practical.
- Use Pydantic models for request and response validation.
- Keep frontend code modular and readable.
- Prefer semantic HTML and accessible controls.
- Avoid large rewrites unless required by the feature spec.

## Testing expectations

- Add or update tests for changed backend behavior when practical.
- Prefer small unit tests for services and integration tests for API routes.
- Do not add a large frontend testing framework unless required by the feature spec.
- Existing behavior must not be broken.

## Security and privacy rules

- Never commit secrets, API keys, tokens, credentials, or `.env` files with real values.
- Use `.env.example` for documented configuration.
- Do not store camera frames unless a feature spec explicitly requires storage and privacy behavior.
- Do not log personal data.
- Validate all client input on the backend.
- Treat room codes and client-provided IDs as untrusted input.

## Dependency rules

- Do not introduce new dependencies unless necessary.
- Prefer small, well-maintained dependencies.
- If a dependency is added, explain why in the final summary.
- Do not replace the existing stack without explicit instruction.

## What Codex should avoid changing

- Do not add Arduino, Nano BLE, serial, or wearable hardware dependencies to the main product path.
- Do not modify unrelated files.
- Do not perform broad formatting-only rewrites.
- Do not move the project to a different framework without a spec.
- Do not add real authentication, database persistence, deployment infrastructure, or pose inference unless the active spec asks for it.
- Do not put feature-specific requirements in `AGENTS.md`; keep them in `docs/specs/`.
