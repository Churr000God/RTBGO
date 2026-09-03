from fastapi import APIRouter, Depends
from supabase import Client

from app.config import Settings, get_settings
from app.deps import get_caller_client, get_service_client
from app.schemas.usuarios import UsuarioCreate, UsuarioOut

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


@router.post("", status_code=201, response_model=UsuarioOut)
def alta_usuario(
    datos: UsuarioCreate,
    db: Client = Depends(get_service_client),
    settings: Settings = Depends(get_settings),
    _caller: Client = Depends(get_caller_client),
) -> dict:
    """SCJ-PRO-01: A2 (crear usuario) + A4 (invitación). A3 (bitácora) lo dispara
    trg_usuario_bitacora_alta en la base de datos, no hay nada que hacer aquí para eso.
    redirect_to es obligatorio: sin él, Supabase manda el link al Site URL (la raíz, el
    login), no a /completar-invitacion -- la persona invitada nunca llega a definir su
    contraseña. _caller: sólo exige Bearer token (SCJ-PRA-01 #02) -- no hay chequeo de
    rol todavía, cualquier caller con token válido puede invitar."""
    invite = db.auth.admin.invite_user_by_email(
        datos.correo,
        {"redirect_to": f"{settings.frontend_url}/completar-invitacion"},
    )

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
