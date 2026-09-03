from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SCJ — Personas y Usuarios")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import personas  # noqa: E402

app.include_router(personas.router)


@app.get("/salud")
def salud() -> dict:
    return {"estado": "ok"}
