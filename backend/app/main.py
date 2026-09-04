import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SCJ — Personas y Usuarios")

# Se lee directo del entorno (no de app.config.Settings) para no forzar, sólo por el
# middleware de CORS, la validación de las credenciales de Supabase al importar el
# módulo — eso rompería la colección de pruebas cuando no hay .env con esas llaves.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import personas  # noqa: E402
from app.routers import usuarios  # noqa: E402
from app.routers import movimientos  # noqa: E402
from app.routers import sesion  # noqa: E402
from app.routers import areas  # noqa: E402

app.include_router(personas.router)
app.include_router(usuarios.router)
app.include_router(movimientos.router)
app.include_router(sesion.router)
app.include_router(areas.router)


@app.get("/salud")
def salud() -> dict:
    return {"estado": "ok"}
