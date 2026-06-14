# Backend (FastAPI)

This folder contains a minimal FastAPI backend for the Amazon Next prototype.

Quick start (from this repository root):

```bash
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The API exposes:

- `GET /api/restock/{category}` — returns a `CartResponse` containing example items and `total_cost`.
