from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.deps import CallerIdentity, get_caller_client, get_caller_identity
from app.main import app

EVENTO_ID = "11111111-1111-1111-1111-111111111111"
PERSONA_ID = "aaaaaaaa-0000-0000-0000-000000000001"
MARCA_ID = 42

GATE_PERSONA_ID = "persona-ficticia-gate"
GATE_PUESTO_ID = "puesto-ficticio-gate"
GATE_IDENTITY = CallerIdentity(auth_user_id="auth-ficticio-gate", correo="gate-ficticio@example.com")


def _payload(**overrides):
    payload = {
        "evento_id": EVENTO_ID,
        "persona_id": PERSONA_ID,
        "terminal_id": "rh-captura-01",
    }
    payload.update(overrides)
    return payload


def _tabla_select_simple(datos):
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _tabla_select_eq_is(datos):
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = datos
    return tabla


def _tabla_select_doble_eq(datos):
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _tabla_marca_select(datos):
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _tabla_excepcion_select(datos):
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.order.return_value.execute.return_value.data = datos
    return tabla


def _tabla_marca_insert():
    tabla = MagicMock()
    tabla.insert.return_value.execute.return_value.data = [{}]
    return tabla


def _tabla_marca_insert_conflicto():
    tabla = MagicMock()
    tabla.insert.return_value.execute.side_effect = APIError(
        {"code": "23505", "message": "duplicate key value violates uq_marca_evento_id"}
    )
    return tabla


def _entradas_gate():
    return [
        ("usuario", _tabla_select_simple([{"persona_id": GATE_PERSONA_ID}])),
        ("asignacion", _tabla_select_eq_is([{"puesto_id": GATE_PUESTO_ID}])),
        ("puesto_permiso", _tabla_select_doble_eq([{"puesto_id": GATE_PUESTO_ID}])),
    ]


def _fake_client_secuencia(secuencia):
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table
    iterador = iter(secuencia)

    def side_effect(nombre_tabla):
        nombre_esperado, mock_tabla = next(iterador)
        assert nombre_tabla == nombre_esperado, f"esperaba tabla {nombre_esperado!r}, llegó {nombre_tabla!r}"
        return mock_tabla

    tabla_mock.side_effect = side_effect
    return fake_client


def _override_identidad():
    app.dependency_overrides[get_caller_identity] = lambda: GATE_IDENTITY


def _fila_marca(**overrides):
    fila = {
        "id": MARCA_ID,
        "evento_id": EVENTO_ID,
        "requiere_revision": False,
        "momento_recepcion": "2026-09-06T12:00:00+00:00",
    }
    fila.update(overrides)
    return fila


def test_captura_manual_exitosa_sin_revision():
    fake_client = _fake_client_secuencia(
        _entradas_gate()
        + [
            ("marca", _tabla_marca_select([])),  # busca evento_id -- no existe
            ("persona", _tabla_select_simple([{"id": PERSONA_ID}])),
            ("marca", _tabla_marca_insert()),
            ("marca", _tabla_marca_select([_fila_marca()])),  # relectura post-trigger
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.post(
        "/api/marcas/captura-manual", json=_payload(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201, response.text
    cuerpo = response.json()
    assert cuerpo["evento_id"] == EVENTO_ID
    assert cuerpo["duplicado"] is False
    assert cuerpo["requiere_revision"] is False
    assert cuerpo["motivos_revision"] == []


def test_captura_manual_con_revision_devuelve_motivos():
    fake_client = _fake_client_secuencia(
        _entradas_gate()
        + [
            ("marca", _tabla_marca_select([])),
            ("persona", _tabla_select_simple([{"id": PERSONA_ID}])),
            ("marca", _tabla_marca_insert()),
            ("marca", _tabla_marca_select([_fila_marca(requiere_revision=True)])),
            (
                "excepcion",
                _tabla_excepcion_select(
                    [{"motivo_revision": "persona_inactiva"}, {"motivo_revision": "dia_cerrado"}]
                ),
            ),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.post(
        "/api/marcas/captura-manual", json=_payload(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 201, response.text
    cuerpo = response.json()
    assert cuerpo["requiere_revision"] is True
    assert cuerpo["motivos_revision"] == ["persona_inactiva", "dia_cerrado"]


def test_captura_manual_evento_id_ya_existente_es_idempotente_200():
    fake_client = _fake_client_secuencia(
        _entradas_gate()
        + [
            ("marca", _tabla_marca_select([_fila_marca()])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.post(
        "/api/marcas/captura-manual", json=_payload(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    assert response.json()["duplicado"] is True


def test_captura_manual_carrera_en_insert_es_idempotente_200():
    fake_client = _fake_client_secuencia(
        _entradas_gate()
        + [
            ("marca", _tabla_marca_select([])),
            ("persona", _tabla_select_simple([{"id": PERSONA_ID}])),
            ("marca", _tabla_marca_insert_conflicto()),
            ("marca", _tabla_marca_select([_fila_marca()])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.post(
        "/api/marcas/captura-manual", json=_payload(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    assert response.json()["duplicado"] is True


def test_captura_manual_persona_invalida_devuelve_422():
    fake_client = _fake_client_secuencia(
        _entradas_gate()
        + [
            ("marca", _tabla_marca_select([])),
            ("persona", _tabla_select_simple([])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.post(
        "/api/marcas/captura-manual", json=_payload(), headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422


def test_captura_manual_terminal_id_vacio_devuelve_422_sin_llegar_a_bd():
    fake_client = _fake_client_secuencia(_entradas_gate())
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.post(
        "/api/marcas/captura-manual",
        json=_payload(terminal_id=""),
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 422
