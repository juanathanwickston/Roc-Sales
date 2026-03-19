# Phase 1 Setup Guide

> Status: Active
> Last Updated: 2026-03-18

---

## 1. Prerequisites

- Node.js 20 LTS (use the `.node-version` file with nvm)
- PostgreSQL (local install or Railway-provisioned)
- A Daily.co account with an API key

---

## 2. Clone and Install

```bash
cd roc_academy
# The meridian directory should already exist in the repo
cd meridian
npm install
```

---

## 3. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Required for Phase 1:

| Variable | Where to Get It |
|---|---|
| `PORT` | Use `3000` for local development |
| `DATABASE_URL` | Your PostgreSQL connection string (Railway auto-injects this) |
| `DAILY_API_KEY` | Daily.co dashboard, Developers section |

Not required until later phases: `CLAUDE_API_KEY`, `DEEPGRAM_API_KEY`, `INWORLD_API_KEY`, `REPLICATE_API_TOKEN`.

---

## 4. Database Setup

### Local PostgreSQL

```bash
createdb meridian
```

### Railway PostgreSQL

Provision a new PostgreSQL database in your Railway project. Railway auto-injects `DATABASE_URL` into the service environment.

---

## 5. Run Migrations

```bash
npm run migrate
```

This creates the `sessions` table and a `_migrations` tracking table. Migrations are idempotent and safe to run multiple times.

On Railway, migrations run automatically before the server starts (via the Procfile).

---

## 6. Start the Server

Development (auto-restart on file changes):
```bash
npm run dev
```

Production:
```bash
npm start
```

The server logs a JSON message when it starts:
```
{"timestamp":"...","level":"info","message":"Server started","context":{"port":3000,"env":"development"}}
```

---

## 7. Verify

Health check:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"...","uptime":5,"database":"connected"}
```

Create a session (requires `DAILY_API_KEY`):
```bash
curl -X POST http://localhost:3000/api/sessions
```

---

## 8. Run Tests

```bash
npm test
```

Tests use Jest and mock all external dependencies (Daily.co, PostgreSQL).

---

## 9. Deploy to Railway

1. Push to the `staging` branch in the roc_academy repo.
2. In Railway, create a new service pointing to the `meridian/` root directory.
3. Set environment variables in the Railway dashboard (Section 3 above).
4. Railway runs `npm install`, then the Procfile: `node server/db/migrate.js && node server/index.js`.
5. Hit the health endpoint at the Railway-assigned URL to verify.
