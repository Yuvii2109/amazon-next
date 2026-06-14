from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router, _load_or_build_embeddings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: pre-load embeddings so first request is fast
    try:
        _load_or_build_embeddings()
    except Exception as e:
        print(f"[RAG] Warning: could not pre-load embeddings on startup: {e}")
    yield


app = FastAPI(title="Amazon Next - Mock Backend", lifespan=lifespan)

origins = ["http://localhost:8080"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
