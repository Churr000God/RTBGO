from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import get_caller_client, get_service_client
from app.main import app


def test_alta_usuario_invita_y_crea_fila_usuario():
    fake_client = MagicMock()
    fake_invite = MagicMock()
    fake_invite.user.id = "22222222-2222-2222-2222-222222222222"
    fake_client.auth.admin.invite_user_by_email.return_value = fake_invite
    fake_client.postgrest.schema.return_value.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "auth_user_id": "22222222-2222-2222-2222-222222222222",
            "persona_id": "11111111-1111-1111-1111-111111111111",
            "nombre_usuario": "mariana.alcantara",
            "estado": "activo",
        }
    ]
    app.dependency_overrides[get_service_client] = lambda: fake_client
    app.dependency_overrides[get_caller_client] = lambda: MagicMock()

    client = TestClient(app)
    response = client.post(
        "/api/usuarios",
        json={
            "persona_id": "11111111-1111-1111-1111-111111111111",
            "correo": "mariana.alcantara@example.com",
            "nombre_usuario": "mariana.alcantara",
        },
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    fake_client.auth.admin.invite_user_by_email.assert_called_once_with(
        "mariana.alcantara@example.com",
        {"redirect_to": "http://localhost:5173/completar-invitacion"},
    )
    assert response.json()["auth_user_id"] == "22222222-2222-2222-2222-222222222222"


def test_alta_usuario_rechaza_sin_token():
    fake_client = MagicMock()
    app.dependency_overrides[get_service_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/usuarios",
        json={
            "persona_id": "11111111-1111-1111-1111-111111111111",
            "correo": "mariana.alcantara@example.com",
            "nombre_usuario": "mariana.alcantara",
        },
    )

    app.dependency_overrides.clear()
    assert response.status_code in (401, 422)
    fake_client.auth.admin.invite_user_by_email.assert_not_called()
