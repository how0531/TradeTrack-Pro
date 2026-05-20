# Deployment

TradeTrack Pro has two deployable pieces:

| Piece | What it is | Needs a running process? |
|---|---|---|
| **Frontend** | Vite SPA, build output in `dist/` | **No** — it is static files. Serve them from a CDN/static host. |
| **Backend** | Python Flask + Shioaji (`backend/app.py`) | **Yes** — long-running web process. Only required for broker (Shioaji) sync. |

The frontend works fully offline-first (IndexedDB) and with Firebase cloud
sync **without** the backend. The backend is only needed for pulling P&L
directly from the broker.

---

## ⚠️ The Zeabur trap (read this first)

**The fix that actually holds: deploy Zeabur from the `Dockerfile`.**
Everything below explains why zbpack auto-detection (`zeabur.json` /
`zbpack.json`) was unreliable and kept flipping the site between 502 and
a blank screen.

zbpack auto-detection is unreliable here: a `zeabur.json` with
`build_type: static` is silently ignored, and even `zbpack.json` with
`output_dir` competes with the `start` script in `package.json`. When
zbpack classifies the project as a **serverful Node app** it runs
`npm start` (`serve -s dist -l ...$PORT`), the SPA then depends on a Node
process staying alive and bound to the right port, and every redeploy /
restart / free-tier sleep yields:

```
502: SERVICE_UNAVAILABLE — 沒有監聽正確的 Port
```

### Authoritative config: the `Dockerfile`

A `Dockerfile` at the repo root **takes precedence over all zbpack/
buildpack auto-detection** on Zeabur (and Render, and any Docker-aware
host). It removes every "static vs serverful / which port" guess.

The committed `Dockerfile` is a multi-stage build:

1. `node:20-alpine` → `npm ci` → `npm run build` (with
   `VITE_API_URL` baked in via `ARG`/`ENV`)
2. `nginx:alpine` serves `dist/` with SPA fallback
   (`try_files … /index.html`) and immutable asset caching

It listens on `${PORT}` via the official nginx image's envsubst template
mechanism (defaults to 80), so it works whether the host routes to the
EXPOSEd port or injects a dynamic `$PORT`.

> Do **not** re-add `zeabur.json` or `zbpack.json`. With a `Dockerfile`
> present they are ignored; keeping them only invites the old confusion.
> The `Dockerfile` is the single source of truth for container hosts.

### After deploying — verify in the Zeabur dashboard

The `Dockerfile` only wins if the dashboard service hasn't been pinned to
a non-Docker build type. After a redeploy, check the **Build log**:

- ✅ Log shows it building **from the Dockerfile** (`node:20-alpine`,
  `nginx:alpine` stages) → fixed.
- ❌ Log shows `npm start` / zbpack Node detection / "starting service"
  → the dashboard has a manual override beating the Dockerfile. Fix in
  the Zeabur panel: set the service build type to **Dockerfile**, or
  delete and recreate it as a fresh Git service so it re-detects.
- ❓ No new deployment at all → Zeabur isn't auto-deploying from `main`;
  trigger a manual redeploy and/or wire up the Git auto-deploy hook.
  (If nothing in the repo ever seems to take effect, this is why.)

---

## Render (`render.yaml`)

`render.yaml` defines **two** services:

1. **`tradetrack-backend`** — Python/Flask via gunicorn
   - `gunicorn --workers 1 --timeout 120 --bind 0.0.0.0:$PORT backend.app:app`
   - `PYTHONPATH=.` so `backend.app` imports resolve
2. **`tradetrack-frontend`** — static Vite site
   - `staticPublishPath: ./dist`
   - `VITE_API_URL` is wired from the backend service's external URL at
     build time

This is the canonical full-stack deployment (frontend + broker backend).

---

## Netlify

Three Netlify sites are wired to this repo (`tradetrack1`,
`tradetrack888`, `tttttt8888`). Netlify **does** read `public/_redirects`:

```
/* /index.html 200
```

This is the SPA fallback so client-side routes (`/journal`, `/logs`,
`/settings`) resolve on hard refresh. **Keep `public/_redirects`** — it is
Netlify-specific and harmless to the other hosts (Zeabur/Render ignore
it). It is not a Zeabur config.

---

## Environment variables

See `.env.example` for the full list. Summary:

| Var | Where | Notes |
|---|---|---|
| `VITE_API_URL` | build time (frontend) | Backend base URL. Empty → local Vite proxy to `localhost:5000`. |
| `VITE_FIREBASE_*` | build time (frontend) | Firebase Web SDK. Public by design; protect with Firestore Rules + App Check. Source has working defaults so a fork builds without them. |
| `ALLOWED_ORIGINS` | runtime (backend) | Comma-separated CORS allowlist. Defaults to localhost only. Set to your frontend origin(s) in production. |

---

## SPA routing per host

Client-side routing (react-router) needs the host to fall back to
`index.html` for unknown paths:

| Host | Mechanism | Status |
|---|---|---|
| Netlify | `public/_redirects` | ✅ configured |
| Render | `env: static` handles SPA | ✅ default |
| Zeabur | nginx `try_files … /index.html` in the Dockerfile | ✅ via Dockerfile |

If sub-route refresh 404s on Zeabur after the 502 is resolved, that is a
separate (secondary) SPA-fallback issue — revisit Zeabur static SPA
settings then; it does not block the 502 fix.

---

## Quick local production check

Reproduce a host build before pushing:

```bash
rm -rf dist node_modules
npm ci
VITE_API_URL=https://tradetrack-pro.onrender.com npm run build
npx serve -s dist -l 8080   # smoke test: open http://localhost:8080
```

`npm ci` (not `npm install`) matches what hosts do and catches
lockfile/dependency drift early.
