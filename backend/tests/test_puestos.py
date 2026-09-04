from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import get_caller_client
from app.main import app

DEPARTAMENTO_ID = "55555555-5555-5555-5555-555555555555"
PUESTO_ID = "77777777-7777-7777-7777-777777777777"
SUPERIOR_ID = "88888888-8888-8888-8888-888888888888"


def _fila_puesto(**overrides):
    fila = {
        "id": PUESTO_ID,
        "departamento_id": DEPARTAMENTO_ID,
        "nombre_puesto": "Ejecutivo de Ventas",
        "nivel": "operativo",
        "plazas_totales": 3,
        "reporta_a_id": SUPERIOR_ID,
        "activo": True,
        "creado_en": "2026-08-31T00:00:00+00:00",
        "actualizado_en": "2026-08-31T00:00:00+00:00",
    }
    fila.update(overrides)
    return fila


def _tabla_select_simple(datos):
    """MagicMock para una tabla donde el router hace .select(...).eq(...).execute().data
    (una sola cadena .eq)."""
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _tabla_select_doble_eq(datos):
    """MagicMock para .select(...).eq(...).eq(...).execute().data (dos cadenas .eq, el caso
    de la consulta de subordinados activos)."""
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _tabla_insert(datos):
    tabla = MagicMock()
    tabla.insert.return_value.execute.return_value.data = datos
    return tabla


def _tabla_update(datos):
    tabla = MagicMock()
    tabla.update.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _fake_client_secuencia(secuencia):
    """secuencia: lista de (nombre_tabla_esperado, mock_a_devolver), en el orden exacto en que
    el router llama a .table(...). cambiar_estado_puesto hace varias llamadas a .table("puesto")
    con formas distintas (select simple, select doble-eq, update) -- no alcanza con un side_effect
    por nombre de tabla, hace falta uno por posición."""
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table
    iterador = iter(secuencia)

    def side_effect(nombre_tabla):
        nombre_esperado, mock_tabla = next(iterador)
        assert nombre_tabla == nombre_esperado, f"esperaba tabla {nombre_esperado!r}, llegó {nombre_tabla!r}"
        return mock_tabla

    tabla_mock.side_effect = side_effect
    return fake_client


def test_listar_puestos():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        _fila_puesto(),
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get("/api/puestos", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()[0]["nombre_puesto"] == "Ejecutivo de Ventas"


def test_alta_puesto_inserta_puesto():
    fake_client = _fake_client_secuencia(
        [
            ("departamento", _tabla_select_simple([{"id": DEPARTAMENTO_ID, "activo": True}])),
            ("puesto", _tabla_select_simple([{"id": SUPERIOR_ID}])),
            ("puesto", _tabla_insert([_fila_puesto()])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/puestos",
        json={
            "departamento_id": DEPARTAMENTO_ID,
            "reporta_a_id": SUPERIOR_ID,
            "nombre_puesto": "Ejecutivo de Ventas",
            "nivel": "operativo",
            "plazas_totales": 3,
        },
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["nombre_puesto"] == "Ejecutivo de Ventas"


def test_alta_puesto_departamento_inexistente_devuelve_422():
    fake_client = _fake_client_secuencia([("departamento", _tabla_select_simple([]))])
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/puestos",
        json={
            "departamento_id": DEPARTAMENTO_ID,
            "reporta_a_id": SUPERIOR_ID,
            "nombre_puesto": "Ejecutivo de Ventas",
            "nivel": "operativo",
            "plazas_totales": 3,
        },
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_alta_puesto_departamento_inactivo_devuelve_422():
    fake_client = _fake_client_secuencia(
        [("departamento", _tabla_select_simple([{"id": DEPARTAMENTO_ID, "activo": False}]))]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/puestos",
        json={
            "departamento_id": DEPARTAMENTO_ID,
            "reporta_a_id": SUPERIOR_ID,
            "nombre_puesto": "Ejecutivo de Ventas",
            "nivel": "operativo",
            "plazas_totales": 3,
        },
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_alta_puesto_reporta_a_inexistente_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            ("departamento", _tabla_select_simple([{"id": DEPARTAMENTO_ID, "activo": True}])),
            ("puesto", _tabla_select_simple([])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/puestos",
        json={
            "departamento_id": DEPARTAMENTO_ID,
            "reporta_a_id": SUPERIOR_ID,
            "nombre_puesto": "Ejecutivo de Ventas",
            "nivel": "operativo",
            "plazas_totales": 3,
        },
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_obtener_puesto():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        _fila_puesto()
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(f"/api/puestos/{PUESTO_ID}", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["id"] == PUESTO_ID


def test_obtener_puesto_no_encontrado():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        []
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(f"/api/puestos/{PUESTO_ID}", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_actualizar_puesto_rename_nivel_plazas():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = [
        _fila_puesto(nombre_puesto="Gerente de Ventas", nivel="gerencia", plazas_totales=1)
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}",
        json={"nombre_puesto": "Gerente de Ventas", "nivel": "gerencia", "plazas_totales": 1},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["nombre_puesto"] == "Gerente de Ventas"
    assert cuerpo["nivel"] == "gerencia"
    assert cuerpo["plazas_totales"] == 1


def test_actualizar_puesto_no_encontrado():
    fake_client = MagicMock()
    update_mock = fake_client.postgrest.schema.return_value.table.return_value.update
    update_mock.return_value.eq.return_value.execute.return_value.data = []
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}",
        json={"nombre_puesto": "Gerente de Ventas", "nivel": "gerencia", "plazas_totales": 1},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_desactivar_puesto_con_subordinados_activos_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            ("puesto", _tabla_select_simple([{"departamento_id": DEPARTAMENTO_ID, "reporta_a_id": None}])),
            ("puesto", _tabla_select_doble_eq([{"id": "subordinado-1"}])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}/estado",
        json={"activo": False},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_desactivar_puesto_sin_subordinados_devuelve_200():
    fake_client = _fake_client_secuencia(
        [
            ("puesto", _tabla_select_simple([{"departamento_id": DEPARTAMENTO_ID, "reporta_a_id": None}])),
            ("puesto", _tabla_select_doble_eq([])),
            ("puesto", _tabla_update([_fila_puesto(activo=False, reporta_a_id=None)])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}/estado",
        json={"activo": False},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["activo"] is False


def test_reactivar_puesto_departamento_inactivo_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            ("puesto", _tabla_select_simple([{"departamento_id": DEPARTAMENTO_ID, "reporta_a_id": None}])),
            ("departamento", _tabla_select_simple([{"activo": False}])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}/estado",
        json={"activo": True},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_reactivar_puesto_superior_inactivo_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            (
                "puesto",
                _tabla_select_simple(
                    [{"departamento_id": DEPARTAMENTO_ID, "reporta_a_id": SUPERIOR_ID}]
                ),
            ),
            ("departamento", _tabla_select_simple([{"activo": True}])),
            ("puesto", _tabla_select_simple([{"activo": False}])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}/estado",
        json={"activo": True},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_reactivar_puesto_valido_devuelve_200():
    fake_client = _fake_client_secuencia(
        [
            (
                "puesto",
                _tabla_select_simple(
                    [{"departamento_id": DEPARTAMENTO_ID, "reporta_a_id": SUPERIOR_ID}]
                ),
            ),
            ("departamento", _tabla_select_simple([{"activo": True}])),
            ("puesto", _tabla_select_simple([{"activo": True}])),
            ("puesto", _tabla_update([_fila_puesto(activo=True)])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}/estado",
        json={"activo": True},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["activo"] is True


def test_reactivar_puesto_tope_sin_superior_devuelve_200():
    fake_client = _fake_client_secuencia(
        [
            ("puesto", _tabla_select_simple([{"departamento_id": DEPARTAMENTO_ID, "reporta_a_id": None}])),
            ("departamento", _tabla_select_simple([{"activo": True}])),
            ("puesto", _tabla_update([_fila_puesto(activo=True, reporta_a_id=None)])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}/estado",
        json={"activo": True},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["activo"] is True


def test_cambiar_estado_puesto_no_encontrado():
    fake_client = _fake_client_secuencia([("puesto", _tabla_select_simple([]))])
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/puestos/{PUESTO_ID}/estado",
        json={"activo": False},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_listar_puestos_sin_token():
    client = TestClient(app)
    response = client.get("/api/puestos")

    assert response.status_code in (401, 422)


def test_alta_puesto_sin_token():
    client = TestClient(app)
    response = client.post(
        "/api/puestos",
        json={
            "departamento_id": DEPARTAMENTO_ID,
            "reporta_a_id": SUPERIOR_ID,
            "nombre_puesto": "Ejecutivo de Ventas",
            "nivel": "operativo",
            "plazas_totales": 3,
        },
    )

    assert response.status_code in (401, 422)
