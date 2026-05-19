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

**Zeabur's build system is `zbpack`. It reads `zbpack.json`. It does NOT
read a file called `zeabur.json`.**

A `zeabur.json` with `build_type: static` looks plausible but is silently
ignored. When no valid static config is found, zbpack auto-detects the
project, sees a `start` script in `package.json`, and deploys the SPA as a
**long-running Node service** (`serve -s dist -l ...$PORT`). That makes a
static site depend on a Node process staying alive and bound to the right
port — every redeploy / restart / free-tier sleep then yields:

```
502: SERVICE_UNAVAILABLE — 沒有監聽正確的 Port
```

### Correct Zeabur config

`zbpack.json` at the repo root (already committed):

```json
{
  "build_command": "VITE_API_URL=https://tradetrack-pro.onrender.com npm install && npm run build",
  "output_dir": "dist"
}
```

`output_dir` is the key line: its presence tells zbpack to deploy the
build output as a **true static site** (served by Zeabur's edge/Caddy) —
no Node process, no port binding, nothing to keep alive.

### After deploying — verify in the Zeabur dashboard

`zbpack.json` only wins if the dashboard has **not** been manually
overridden. After a redeploy, check the service:

- ✅ Deployment type shows **Static** (no "running process" / port info)
  → fixed, 502 gone.
- ❌ Still shows **Service** / has a port → the dashboard has a manual
  override that beats `zbpack.json`. zbpack.json cannot fix this. You
  must either change the service to a Static deployment in the Zeabur
  panel, or delete and recreate it as a fresh Git service so it
  re-detects from `zbpack.json`.

If a redeploy still 502s, grab the Zeabur **Build / Deployment log** and
look for whether it says it detected a static site vs. "starting service
/ npm start" — that distinguishes "zbpack.json not picked up" from
"dashboard override".

> Do **not** re-add `zeabur.json`. Nothing reads it; it only misleads.

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
| Zeabur | static deploy serves `index.html` fallback for SPA frameworks | ✅ via `zbpack.json` static mode |

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
