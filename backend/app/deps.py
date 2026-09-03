"""Dependencias de FastAPI: cliente de Supabase con el JWT del caller (respeta RLS) y cliente
con service_role (para operaciones administrativas: invitar usuarios, subir al bucket)."""
from fastapi import Depends, Header, HTTPException, status
from supabase import Client, create_client

from app.config import Settings, get_settings


def get_service_client(settings: Settings = Depends(get_settings)) -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_caller_client(
    authorization: str = Header(...),
    settings: Settings = Depends(get_settings),
) -> Client:
    """Cliente con el token del usuario que llama — cualquier consulta con este cliente respeta
    la RLS de personas.fn_caller_activo() (SCJ-PRO-02), no hay chequeo de estado aparte aquí."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta el token de acceso")
    token = authorization.removeprefix("Bearer ")
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(token)
    return client
