from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.deps import get_caller_client
from app.main import app

PERSONA_ID = "aaaaaaaa-0000-0000-0000-000000000001"
PUESTO_ID = "bbbbbbbb-0000-0000-0000-000000000002"
PUESTO_NUEVO_ID = "bbbbbbbb-0000-0000-0000-000000000003"
ASIGNACION_ID = "cccccccc-0000-0000-0000-000000000004"


def _fila_asignacion_plana(**overrides):
    fila = {
        "id": ASIGNACION_ID,
        "persona_id": PERSONA_ID,
        "puesto_id": PUESTO_ID,
        "vigente_desde": "2026-01-01",
        "vigente_hasta": None,
        "creado_en": "2026-08-31T00:00:00+00:00",
        "actualizado_en": "2026-08-31T00:00:00+00:00",
    }
    fila.update(overrides)
    return fila


def _fila_asignacion_con_embed(**overrides):
    fila = {
        "id": ASIGNACION_ID,
        "persona_id": PERSONA_ID,
        "puesto_id": PUESTO_ID,
        "vigente_desde": "2026-01-01",
        "vigente_hasta": None,
        "creado_en": "2026-08-31T00:00:00+00:00",
        "actualizado_en": "2026-08-31T00:00:00+00:00",
        "persona": {"primer_nombre": "Ficticia", "apellido_paterno": "Alfa"},
        "puesto": {
            "nombre_puesto": "Puesto Ficticio Alfa",
            "departamento": {
                "nombre_departamento": "Departamento Ficticio Alfa",
                "area": {"nombre_area": "Área Ficticia Alfa"},
            },
        },
    }
    fila.update(overrides)
    return fila


def _tabla_select_simple(datos):
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _tabla_select_eq_is(datos):
    """.select(...).eq(...).is_(...).execute().data -- la consulta de plazas ocupadas."""
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = datos
    return tabla


def _tabla_insert(datos):
    tabla = MagicMock()
    tabla.insert.return_value.execute.return_value.data = datos
    return tabla


def _tabla_insert_error(error):
    tabla = MagicMock()
    tabla.insert.return_value.execute.side_effect = error
    return tabla


def _tabla_update(datos):
    tabla = MagicMock()
    tabla.update.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _fake_client_secuencia(secuencia):
    """secuencia: lista de (nombre_tabla_esperado, mock_a_devolver), en el orden exacto en que
    el router llama a .table(...). alta/cambiar-puesto encadenan varias tablas distintas
    (persona, puesto, asignacion) con formas de consulta distintas -- hace falta control por
    posición, no sólo por nombre."""
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table
    iterador = iter(secuencia)

    def side_effect(nombre_tabla):
        nombre_esperado, mock_tabla = next(iterador)
        assert nombre_tabla == nombre_esperado, f"esperaba tabla {nombre_esperado!r}, llegó {nombre_tabla!r}"
        return mock_tabla

    tabla_mock.side_effect = side_effect
    return fake_client


def test_listar_asignaciones_con_detalle_aplanado():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        _fila_asignacion_con_embed(),
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get("/api/asignaciones", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()[0]
    assert cuerpo["persona_nombre"] == "Ficticia Alfa"
    assert cuerpo["nombre_puesto"] == "Puesto Ficticio Alfa"
    assert cuerpo["nombre_departamento"] == "Departamento Ficticio Alfa"
    assert cuerpo["nombre_area"] == "Área Ficticia Alfa"
    assert "persona" not in cuerpo
    assert "puesto" not in cuerpo


def test_obtener_asignacion_no_encontrada():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        []
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        f"/api/asignaciones/{ASIGNACION_ID}", headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def _cuerpo_alta():
    return {
        "persona_id": PERSONA_ID,
        "puesto_id": PUESTO_ID,
        "vigente_desde": "2026-01-01",
    }


def test_alta_asignacion_exitosa():
    fake_client = _fake_client_secuencia(
        [
            ("persona", _tabla_select_simple([{"id": PERSONA_ID, "estado": "activo"}])),
            ("puesto", _tabla_select_simple([{"id": PUESTO_ID, "activo": True, "plazas_totales": 2}])),
            ("asignacion", _tabla_select_eq_is([{"id": "otra-asignacion"}])),
            ("asignacion", _tabla_insert([_fila_asignacion_plana()])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/asignaciones", json=_cuerpo_alta(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["persona_id"] == PERSONA_ID


def test_alta_asignacion_persona_inactiva_devuelve_422():
    fake_client = _fake_client_secuencia(
        [("persona", _tabla_select_simple([{"id": PERSONA_ID, "estado": "baja_definitiva"}]))]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/asignaciones", json=_cuerpo_alta(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_alta_asignacion_puesto_inactivo_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            ("persona", _tabla_select_simple([{"id": PERSONA_ID, "estado": "activo"}])),
            ("puesto", _tabla_select_simple([{"id": PUESTO_ID, "activo": False, "plazas_totales": 2}])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/asignaciones", json=_cuerpo_alta(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_alta_asignacion_plazas_llenas_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            ("persona", _tabla_select_simple([{"id": PERSONA_ID, "estado": "activo"}])),
            ("puesto", _tabla_select_simple([{"id": PUESTO_ID, "activo": True, "plazas_totales": 1}])),
            ("asignacion", _tabla_select_eq_is([{"id": "otra-asignacion"}])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/asignaciones", json=_cuerpo_alta(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_alta_asignacion_vigente_duplicada_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            ("persona", _tabla_select_simple([{"id": PERSONA_ID, "estado": "activo"}])),
            ("puesto", _tabla_select_simple([{"id": PUESTO_ID, "activo": True, "plazas_totales": 2}])),
            ("asignacion", _tabla_select_eq_is([])),
            (
                "asignacion",
                _tabla_insert_error(
                    APIError(
                        {
                            "code": "23505",
                            "message": 'duplicate key value violates unique constraint "ux_asignacion_vigente_persona_puesto"',
                        }
                    )
                ),
            ),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        "/api/asignaciones", json=_cuerpo_alta(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_terminar_asignacion_ya_cerrada_devuelve_422():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"vigente_hasta": "2026-06-01"}
    ]
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/asignaciones/{ASIGNACION_ID}/terminar",
        json={"vigente_hasta": "2026-07-01"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_terminar_asignacion_no_encontrada():
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
        []
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/asignaciones/{ASIGNACION_ID}/terminar",
        json={"vigente_hasta": "2026-07-01"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 404


def test_terminar_asignacion_exitosa():
    fake_client = _fake_client_secuencia(
        [
            ("asignacion", _tabla_select_simple([{"vigente_hasta": None}])),
            ("asignacion", _tabla_update([_fila_asignacion_plana(vigente_hasta="2026-07-01")])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.patch(
        f"/api/asignaciones/{ASIGNACION_ID}/terminar",
        json={"vigente_hasta": "2026-07-01"},
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["vigente_hasta"] == "2026-07-01"


def _cuerpo_cambiar_puesto():
    return {"puesto_nuevo_id": PUESTO_NUEVO_ID, "fecha": "2026-07-01"}


def test_cambiar_puesto_destino_invalido_devuelve_422():
    fake_client = _fake_client_secuencia([("puesto", _tabla_select_simple([]))])
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        f"/api/asignaciones/{ASIGNACION_ID}/cambiar-puesto",
        json=_cuerpo_cambiar_puesto(),
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422
    fake_client.postgrest.schema.return_value.rpc.assert_not_called()


def test_cambiar_puesto_destino_inactivo_devuelve_422():
    fake_client = _fake_client_secuencia(
        [("puesto", _tabla_select_simple([{"id": PUESTO_NUEVO_ID, "activo": False, "plazas_totales": 2}]))]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        f"/api/asignaciones/{ASIGNACION_ID}/cambiar-puesto",
        json=_cuerpo_cambiar_puesto(),
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422
    fake_client.postgrest.schema.return_value.rpc.assert_not_called()


def test_cambiar_puesto_plazas_llenas_en_destino_devuelve_422():
    fake_client = _fake_client_secuencia(
        [
            ("puesto", _tabla_select_simple([{"id": PUESTO_NUEVO_ID, "activo": True, "plazas_totales": 1}])),
            ("asignacion", _tabla_select_eq_is([{"id": "otra-asignacion"}])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        f"/api/asignaciones/{ASIGNACION_ID}/cambiar-puesto",
        json=_cuerpo_cambiar_puesto(),
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422
    fake_client.postgrest.schema.return_value.rpc.assert_not_called()


def test_cambiar_puesto_rpc_con_asignacion_cerrada_o_inexistente_devuelve_422():
    """El RPC rechaza con RAISE EXCEPTION (SQLSTATE por omisión P0001) cuando la asignación
    origen no existe o ya está cerrada -- postgrest-py lo propaga como APIError."""
    fake_client = _fake_client_secuencia(
        [
            ("puesto", _tabla_select_simple([{"id": PUESTO_NUEVO_ID, "activo": True, "plazas_totales": 2}])),
            ("asignacion", _tabla_select_eq_is([])),
        ]
    )
    fake_client.postgrest.schema.return_value.rpc.return_value.execute.side_effect = APIError(
        {"code": "P0001", "message": "La asignación no existe o ya está cerrada."}
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        f"/api/asignaciones/{ASIGNACION_ID}/cambiar-puesto",
        json=_cuerpo_cambiar_puesto(),
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422
    assert response.json()["detail"] == "La asignación no existe o ya está cerrada."


def test_cambiar_puesto_exitoso_rpc_devuelve_dict_plano():
    """fn_asignacion_cambiar_puesto RETURNS personas.asignacion (fila única, no SETOF) --
    PostgREST/postgrest-py devuelve resultado.data como dict plano, no lista de un elemento."""
    fake_client = _fake_client_secuencia(
        [
            ("puesto", _tabla_select_simple([{"id": PUESTO_NUEVO_ID, "activo": True, "plazas_totales": 2}])),
            ("asignacion", _tabla_select_eq_is([])),
        ]
    )
    fake_client.postgrest.schema.return_value.rpc.return_value.execute.return_value.data = _fila_asignacion_plana(
        puesto_id=PUESTO_NUEVO_ID
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.post(
        f"/api/asignaciones/{ASIGNACION_ID}/cambiar-puesto",
        json=_cuerpo_cambiar_puesto(),
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["puesto_id"] == PUESTO_NUEVO_ID
    fake_client.postgrest.schema.return_value.rpc.assert_called_once_with(
        "fn_asignacion_cambiar_puesto",
        {
            "p_asignacion_id": ASIGNACION_ID,
            "p_puesto_nuevo_id": PUESTO_NUEVO_ID,
            "p_fecha": "2026-07-01",
        },
    )


def test_listar_asignaciones_sin_token():
    client = TestClient(app)
    response = client.get("/api/asignaciones")

    assert response.status_code in (401, 422)


def test_alta_asignacion_sin_token():
    client = TestClient(app)
    response = client.post("/api/asignaciones", json=_cuerpo_alta())

    assert response.status_code in (401, 422)
