from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.deps import get_caller_client
from app.main import app

AREA_ID = "33333333-3333-3333-3333-333333333333"


def _fila_area(**overrides):
    fila = {
        "id": AREA_ID,
        "nombre_area": "Comercial",
        "activo": True,
        "creado_en": "2026-08-31T00:00:00+00:00",
        "actualizado_en": "2026-08-31T00:00:00+00:00",
    }
    fila.update(overrides)
    return fila


def test_listar_areas():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        _fila_area(),
        _fila_area(id="44444444-4444-4444-4444-444444444444", nombre_area="Operaciones"),
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get("/api/areas", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()
    assert len(cuerpo) == 2
    assert cuerpo[0]["nombre_area"] == "Comercial"


def test_alta_area_inserta_area():
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table
    insert_mock = tabla_mock.return_value.insert
    insert_mock.return_value.execute.return_value.data = [_fila_area()]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/areas",
        json={"nombre_area": "Comercial"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["nombre_area"] == "Comercial"
    assert tabla_mock.call_args_list[0].args[0] == "area"
    assert insert_mock.call_args_list[0].args[0] == {"nombre_area": "Comercial"}


def test_alta_area_normaliza_espacios_en_nombre():
    fake_client = MagicMock()
    insert_mock = fake_client.postgrest.schema.return_value.table.return_value.insert
    insert_mock.return_value.execute.return_value.data = [_fila_area(nombre_area="Comercial Norte")]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/areas",
        json={"nombre_area": "  Comercial   Norte  "},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert insert_mock.call_args_list[0].args[0] == {"nombre_area": "Comercial Norte"}


def test_alta_area_duplicada_devuelve_409():
    fake_client = MagicMock()
    insert_mock = fake_client.postgrest.schema.return_value.table.return_value.insert
    insert_mock.return_value.execute.side_effect = APIError(
        {
            "code": "23505",
            "message": 'duplicate key value violates unique constraint "uq_area_nombre"',
        }
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/areas",
        json={"nombre_area": "Comercial"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 409


def test_renombrar_area():
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table
    update_mock = tabla_mock.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = [
        _fila_area(nombre_area="Comercial y Marketing")
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/areas/{AREA_ID}",
        json={"nombre_area": "Comercial y Marketing"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["nombre_area"] == "Comercial y Marketing"
    update_mock.return_value.eq.assert_called_with("id", AREA_ID)


def test_renombrar_area_duplicada_devuelve_409():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.side_effect = APIError(
        {
            "code": "23505",
            "message": 'duplicate key value violates unique constraint "uq_area_nombre"',
        }
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/areas/{AREA_ID}",
        json={"nombre_area": "Operaciones"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 409


def test_desactivar_area():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = [
        _fila_area(activo=False)
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/areas/{AREA_ID}/estado",
        json={"activo": False},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["activo"] is False
    datos_actualizados = update_mock.call_args_list[0].args[0]
    assert datos_actualizados["activo"] is False


def test_reactivar_area():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = [
        _fila_area(activo=True)
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/areas/{AREA_ID}/estado",
        json={"activo": True},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["activo"] is True


def test_obtener_area():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        _fila_area()
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(f"/api/areas/{AREA_ID}", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["id"] == AREA_ID


def test_obtener_area_no_encontrada():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        []
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(f"/api/areas/{AREA_ID}", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_renombrar_area_no_encontrada():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = []
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/areas/{AREA_ID}",
        json={"nombre_area": "Comercial y Marketing"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_cambiar_estado_area_no_encontrada():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = []
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/areas/{AREA_ID}/estado",
        json={"activo": False},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_listar_areas_sin_token():
    client = TestClient(app)
    response = client.get("/api/areas")

    assert response.status_code in (401, 422)


def test_alta_area_sin_token():
    client = TestClient(app)
    response = client.post("/api/areas", json={"nombre_area": "Comercial"})

    assert response.status_code in (401, 422)
