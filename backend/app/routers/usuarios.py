from fastapi import APIRouter, Depends
from supabase import Client

from app.deps import get_service_client
from app.schemas.usuarios import UsuarioCreate, UsuarioOut

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


@router.post("", status_code=201, response_model=UsuarioOut)
def alta_usuario(datos: UsuarioCreate, db: Client = Depends(get_service_client)) -> dict:
    """SCJ-PRO-01: A2 (crear usuario) + A4 (invitación). A3 (bitácora) lo dispara
    trg_usuario_bitacora_alta en la base de datos, no hay nada que hacer aquí para eso."""
    invite = db.auth.admin.invite_user_by_email(datos.correo)

    usuario = (
        db.postgrest.schema("personas")
        .table("usuario")
        .insert(
            {
                "auth_user_id": invite.user.id,
                "persona_id": datos.persona_id,
                "nombre_usuario": datos.nombre_usuario,
            }
        )
        .execute()
        .data[0]
    )
    return usuario
