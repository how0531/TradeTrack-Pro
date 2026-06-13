# Backend tests

Run from the **repo root**:

```bash
pip install pytest
pytest backend/tests
```

Why repo root: `conftest.py` adds the repo root to `sys.path` so
`from backend.core.job_store import ...` works the same way the
production import path does. Running from inside `backend/` would
shadow that path.

## What's covered

- `test_job_store.py` — the SQLite persistence layer added in v3.2.0
  (create/update/complete/fail roundtrips, orphan recovery, cleanup).

## What's not covered (yet)

`pnl.py` and `session.py` both call `shioaji` at module level, so they
can't be unit-tested without either (a) a stub `shioaji` package or
(b) splitting the I/O surface out into a thin layer. Both are
worthwhile but bigger lifts. For now, the most important
business-logic regression risk (v3.2.0 job persistence) is locked in.

The frontend has matching coverage under `src/**/*.test.ts*` — run
with `npm run test` from the repo root.
