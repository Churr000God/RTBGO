from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import CallerIdentity, get_caller_identity, get_service_client
from app.main import app

AUTH_USER_ID = "22222222-2222-2222-2222-222222222222"
PERSONA_ID = "11111111-1111-1111-1111-111111111111"


def _fake_db(filas_usuario, filas_persona=None):
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table

    def side_effect(nombre_tabla):
        tabla = MagicMock()
        if nombre_tabla == "usuario":
            tabla.select.return_value.eq.return_value.execute.return_value.data = filas_usuario
        elif nombre_tabla == "persona":
            tabla.select.return_value.eq.return_value.execute.return_value.data = (
                filas_persona or []
            )
        return tabla

    tabla_mock.side_effect = side_effect
    return fake_client


def _overrides(fake_client, correo="mariana.alcantara@example.com"):
    app.dependency_overrides[get_service_client] = lambda: fake_client
    app.dependency_overrides[get_caller_identity] = lambda: CallerIdentity(
        auth_user_id=AUTH_USER_ID, correo=correo
    )


def test_sesion_persona_activa_permite_acceso():
    fake_client = _fake_db(
        filas_usuario=[
            {
                "auth_user_id": AUTH_USER_ID,
                "nombre_usuario": "mariana.alcantara",
                "persona_id": PERSONA_ID,
            }
        ],
        filas_persona=[{"estado": "activo"}],
    )
    _overrides(fake_client)

    client = TestClient(app)
    response = client.get("/api/sesion", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["acceso_permitido"] is True
    assert body["motivo_bloqueo"] is None
    assert body["persona_estado"] == "activo"


def test_sesion_persona_suspendida_bloquea_acceso():
    fake_client = _fake_db(
        filas_usuario=[
            {
                "auth_user_id": AUTH_USER_ID,
                "nombre_usuario": "mariana.alcantara",
                "persona_id": PERSONA_ID,
            }
        ],
        filas_persona=[{"estado": "suspension"}],
    )
    _overrides(fake_client)

    client = TestClient(app)
    response = client.get("/api/sesion", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["acceso_permitido"] is False
    assert body["motivo_bloqueo"] == "suspension"


def test_sesion_persona_baja_definitiva_bloquea_acceso():
    fake_client = _fake_db(
        filas_usuario=[
            {
                "auth_user_id": AUTH_USER_ID,
                "nombre_usuario": "mariana.alcantara",
                "persona_id": PERSONA_ID,
            }
        ],
        filas_persona=[{"estado": "baja_definitiva"}],
    )
    _overrides(fake_client)

    client = TestClient(app)
    response = client.get("/api/sesion", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["acceso_permitido"] is False
    assert body["motivo_bloqueo"] == "baja_definitiva"


def test_sesion_usuario_sin_persona_bloquea_acceso():
    fake_client = _fake_db(
        filas_usuario=[
            {
                "auth_user_id": AUTH_USER_ID,
                "nombre_usuario": "mariana.alcantara",
                "persona_id": None,
            }
        ],
    )
    _overrides(fake_client)

    client = TestClient(app)
    response = client.get("/api/sesion", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["acceso_permitido"] is False
    assert body["motivo_bloqueo"] == "sin_persona"


def test_sesion_sin_fila_usuario_bloquea_acceso():
    fake_client = _fake_db(filas_usuario=[])
    _overrides(fake_client)

    client = TestClient(app)
    response = client.get("/api/sesion", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    body = response.json()
    assert body["acceso_permitido"] is False
    assert body["motivo_bloqueo"] == "sin_usuario"


def test_sesion_rechaza_sin_token():
    fake_client = _fake_db(filas_usuario=[])
    app.dependency_overrides[get_service_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get("/api/sesion")

    app.dependency_overrides.clear()
    assert response.status_code in (401, 422)
