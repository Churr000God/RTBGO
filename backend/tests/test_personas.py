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


def test_alta_persona_normaliza_curp_rfc_a_mayusculas():
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table
    insert_mock = tabla_mock.return_value.insert
    insert_mock.return_value.execute.return_value.data = [
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
            "curp": "aarm910427mdflvr03",
            "rfc": "aarm910427h8a",
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
    datos_insertados = insert_mock.call_args_list[0].args[0]
    assert datos_insertados["curp"] == "AARM910427MDFLVR03"
    assert datos_insertados["rfc"] == "AARM910427H8A"


def test_listar_personas():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.execute.return_value.data = [
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
            "fecha_baja": None,
            "estado": "activo",
        },
        {
            "id": "44444444-4444-4444-4444-444444444444",
            "primer_nombre": "Jorge",
            "segundo_nombre": None,
            "apellido_paterno": "Del Bosque",
            "apellido_materno": None,
            "curp": "DBJJ850101HDFLRR07",
            "rfc": "DBJJ850101H8A",
            "nss": "12345678901",
            "fecha_nacimiento": "1985-01-01",
            "fecha_ingreso": "2020-01-01",
            "fecha_baja": "2026-06-15",
            "estado": "baja_definitiva",
        },
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get("/api/personas", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()
    assert len(cuerpo) == 2
    assert cuerpo[0]["fecha_baja"] is None
    assert cuerpo[1]["fecha_baja"] == "2026-06-15"


def test_ficha_persona_incluye_expediente():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
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
        "expediente": {"tipo_contrato": "indefinido", "documento_ref": "RTB-2026-001"},
    }
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        "/api/personas/11111111-1111-1111-1111-111111111111",
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["documento_ref"] == "RTB-2026-001"


def test_ficha_persona_sin_expediente_no_crashea():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
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
        "expediente": None,
    }
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        "/api/personas/11111111-1111-1111-1111-111111111111",
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["tipo_contrato"] is None
    assert cuerpo["documento_ref"] is None
