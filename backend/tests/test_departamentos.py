from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.deps import get_caller_client
from app.main import app

AREA_ID = "33333333-3333-3333-3333-333333333333"
DEPARTAMENTO_ID = "55555555-5555-5555-5555-555555555555"


def _fila_departamento(**overrides):
    fila = {
        "id": DEPARTAMENTO_ID,
        "area_id": AREA_ID,
        "nombre_departamento": "Ventas",
        "activo": True,
        "creado_en": "2026-08-31T00:00:00+00:00",
        "actualizado_en": "2026-08-31T00:00:00+00:00",
    }
    fila.update(overrides)
    return fila


def _fake_client_area_valida():
    """MagicMock donde el SELECT de validación de area_id (alta_departamento) devuelve un
    área existente y activa. Otras tablas se configuran aparte por side_effect si hace falta."""
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table

    def side_effect(nombre_tabla):
        tabla = MagicMock()
        if nombre_tabla == "area":
            tabla.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": AREA_ID, "activo": True}
            ]
        return tabla

    tabla_mock.side_effect = side_effect
    return fake_client, tabla_mock


def test_listar_departamentos():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        _fila_departamento(),
        _fila_departamento(id="66666666-6666-6666-6666-666666666666", nombre_departamento="Cobranza"),
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get("/api/departamentos", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()
    assert len(cuerpo) == 2
    assert cuerpo[0]["nombre_departamento"] == "Ventas"


def test_alta_departamento_inserta_departamento():
    fake_client, tabla_mock = _fake_client_area_valida()
    tabla_departamento = MagicMock()
    tabla_departamento.insert.return_value.execute.return_value.data = [_fila_departamento()]

    def side_effect(nombre_tabla):
        if nombre_tabla == "area":
            tabla = MagicMock()
            tabla.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": AREA_ID, "activo": True}
            ]
            return tabla
        return tabla_departamento

    tabla_mock.side_effect = side_effect
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/departamentos",
        json={"area_id": AREA_ID, "nombre_departamento": "Ventas"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["nombre_departamento"] == "Ventas"
    assert tabla_departamento.insert.call_args_list[0].args[0] == {
        "area_id": AREA_ID,
        "nombre_departamento": "Ventas",
    }


def test_alta_departamento_area_inexistente_devuelve_422():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        []
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/departamentos",
        json={"area_id": AREA_ID, "nombre_departamento": "Ventas"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_alta_departamento_area_inactiva_devuelve_422():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": AREA_ID, "activo": False}
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/departamentos",
        json={"area_id": AREA_ID, "nombre_departamento": "Ventas"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_alta_departamento_duplicado_devuelve_409():
    fake_client, tabla_mock = _fake_client_area_valida()
    tabla_departamento = MagicMock()
    tabla_departamento.insert.return_value.execute.side_effect = APIError(
        {
            "code": "23505",
            "message": 'duplicate key value violates unique constraint "uq_departamento_nombre"',
        }
    )

    def side_effect(nombre_tabla):
        if nombre_tabla == "area":
            tabla = MagicMock()
            tabla.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": AREA_ID, "activo": True}
            ]
            return tabla
        return tabla_departamento

    tabla_mock.side_effect = side_effect
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/departamentos",
        json={"area_id": AREA_ID, "nombre_departamento": "Ventas"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 409


def test_obtener_departamento():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        _fila_departamento()
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        f"/api/departamentos/{DEPARTAMENTO_ID}", headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["id"] == DEPARTAMENTO_ID


def test_obtener_departamento_no_encontrado():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        []
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        f"/api/departamentos/{DEPARTAMENTO_ID}", headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_renombrar_departamento():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = [
        _fila_departamento(nombre_departamento="Ventas Nacionales")
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/departamentos/{DEPARTAMENTO_ID}",
        json={"nombre_departamento": "Ventas Nacionales"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["nombre_departamento"] == "Ventas Nacionales"
    update_mock.return_value.eq.assert_called_with("id", DEPARTAMENTO_ID)


def test_renombrar_departamento_duplicado_devuelve_409():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.side_effect = APIError(
        {
            "code": "23505",
            "message": 'duplicate key value violates unique constraint "uq_departamento_nombre"',
        }
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/departamentos/{DEPARTAMENTO_ID}",
        json={"nombre_departamento": "Cobranza"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 409


def test_renombrar_departamento_no_encontrado():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = []
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/departamentos/{DEPARTAMENTO_ID}",
        json={"nombre_departamento": "Ventas Nacionales"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_desactivar_departamento():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = [
        _fila_departamento(activo=False)
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/departamentos/{DEPARTAMENTO_ID}/estado",
        json={"activo": False},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["activo"] is False


def test_reactivar_departamento():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = [
        _fila_departamento(activo=True)
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/departamentos/{DEPARTAMENTO_ID}/estado",
        json={"activo": True},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["activo"] is True


def test_cambiar_estado_departamento_no_encontrado():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = []
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/departamentos/{DEPARTAMENTO_ID}/estado",
        json={"activo": False},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_listar_departamentos_sin_token():
    client = TestClient(app)
    response = client.get("/api/departamentos")

    assert response.status_code in (401, 422)


def test_alta_departamento_sin_token():
    client = TestClient(app)
    response = client.post(
        "/api/departamentos", json={"area_id": AREA_ID, "nombre_departamento": "Ventas"}
    )

    assert response.status_code in (401, 422)
