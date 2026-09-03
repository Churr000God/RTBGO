from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import get_caller_client
from app.main import app


def test_crear_movimiento_de_suspension():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "persona_id": "11111111-1111-1111-1111-111111111111",
            "tipo_movimiento": "suspension",
            "fecha_efectiva": "2026-09-03T10:00:00+00:00",
            "motivo": "Licencia sin goce de sueldo",
            "registrado_por": None,
        }
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/personas/11111111-1111-1111-1111-111111111111/movimientos",
        json={"tipo_movimiento": "suspension", "motivo": "Licencia sin goce de sueldo"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["tipo_movimiento"] == "suspension"


def test_listar_movimientos_de_una_persona():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "persona_id": "11111111-1111-1111-1111-111111111111",
            "tipo_movimiento": "alta",
            "fecha_efectiva": "2026-01-01T09:00:00+00:00",
            "motivo": None,
            "registrado_por": "22222222-2222-2222-2222-222222222222",
        }
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        "/api/personas/11111111-1111-1111-1111-111111111111/movimientos",
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()[0]["tipo_movimiento"] == "alta"
