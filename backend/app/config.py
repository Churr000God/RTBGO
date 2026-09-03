"""Configuración leída de variables de entorno (.env en la raíz del repo)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    frontend_url: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
