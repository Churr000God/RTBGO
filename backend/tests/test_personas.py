from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import get_caller_client
from app.main import app


def test_alta_persona_inserta_persona_y_expediente():
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table
    tabla_mock.return_value.insert.return_value.execute.return_value.data = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "primer_nombre": "Mariana",
            "segundo_nombre": None,
            "apellido_paterno": "Alcántara",
            "apellido_materno": None,
            "curp": "AARM910427MDFLVR03",
            "rfc": "AARM910427H8A",
            "nss": "62119145338",
            "fecha_nacimiento": "1991-04-27",
            "fecha_ingreso": "2026-01-01",
            "estado": "activo",
        }
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/personas",
        json={
            "primer_nombre": "Mariana",
            "apellido_paterno": "Alcántara",
            "curp": "AARM910427MDFLVR03",
            "rfc": "AARM910427H8A",
            "nss": "62119145338",
            "fecha_nacimiento": "1991-04-27",
            "fecha_ingreso": "2026-01-01",
            "tipo_contrato": "indefinido",
            "documento_ref": "RTB-2026-001",
        },
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["curp"] == "AARM910427MDFLVR03"
    assert tabla_mock.call_args_list[0].args[0] == "persona"
    assert tabla_mock.call_args_list[1].args[0] == "expediente"
