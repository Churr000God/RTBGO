from datetime import date
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.deps import CallerIdentity, get_caller_client, get_caller_identity, get_service_client
from app.main import app

GATE_PERSONA_ID = "persona-ficticia-gate"
GATE_PUESTO_ID = "puesto-ficticio-gate"
GATE_IDENTITY = CallerIdentity(auth_user_id="auth-ficticio-gate", correo="gate-ficticio@example.com")


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


def _entradas_gate():
    return [
        ("usuario", _tabla_select_simple([{"persona_id": GATE_PERSONA_ID}])),
        ("asignacion", _tabla_select_eq_is([{"puesto_id": GATE_PUESTO_ID}])),
        ("puesto_permiso", _tabla_select_doble_eq([{"puesto_id": GATE_PUESTO_ID}])),
    ]


def _fake_caller_client_secuencia(secuencia):
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


def test_listar_corridas_batch_devuelve_todas_las_filas():
    tabla_corrida = MagicMock()
    tabla_corrida.select.return_value.order.return_value.execute.return_value.data = [
        {
            "id": 1,
            "tipo_batch": "de_confianza",
            "fecha": "2026-09-06",
            "estado": "exitosa",
            "intentos": 1,
            "iniciado_en": "2026-09-06T00:00:00+00:00",
            "terminado_en": "2026-09-06T00:00:05+00:00",
            "detalle": "3 día(s) creado(s), 0 ya existían.",
        }
    ]
    fake_caller_client = _fake_caller_client_secuencia(
        _entradas_gate() + [("corrida_batch", tabla_corrida)]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_caller_client
    _override_identidad()

    client = TestClient(app)
    response = client.get(
        "/api/corridas-batch", headers={"Authorization": "Bearer fake-token"}
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["tipo_batch"] == "de_confianza"


def test_disparar_batch_de_confianza_llama_a_la_funcion_y_devuelve_su_resultado():
    fake_caller_client = _fake_caller_client_secuencia(_entradas_gate())
    fake_service_client = MagicMock()
    app.dependency_overrides[get_caller_client] = lambda: fake_caller_client
    app.dependency_overrides[get_service_client] = lambda: fake_service_client
    _override_identidad()

    resultado_esperado = {
        "id": 1,
        "tipo_batch": "de_confianza",
        "fecha": "2026-09-06",
        "estado": "exitosa",
        "intentos": 1,
        "iniciado_en": "2026-09-06T00:00:00+00:00",
        "terminado_en": "2026-09-06T00:00:05+00:00",
        "detalle": "3 día(s) creado(s), 0 ya existían.",
    }

    with patch(
        "app.routers.corridas_batch.ejecutar_batch_de_confianza",
        return_value=resultado_esperado,
    ) as mock_ejecutar:
        client = TestClient(app)
        response = client.post(
            "/api/corridas-batch/de-confianza",
            json={"fecha": "2026-09-06"},
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "exitosa"
    mock_ejecutar.assert_called_once()
    (fecha_llamada, db_llamado), _ = mock_ejecutar.call_args
    assert fecha_llamada.isoformat() == "2026-09-06"
    assert db_llamado is fake_service_client


def test_disparar_batch_de_confianza_sin_body_usa_hoy():
    """Regresión (hallazgo de testing): el botón manual del frontend hace POST sin body en
    absoluto -- ni siquiera '{}'. Con `datos: EjecutarBatchRequest` sin default, FastAPI exige
    que llegue un body igual y esto daba 422 siempre. Este test manda la request tal cual la
    manda el frontend (sin `json=`), no un '{}' explícito, que no habría detectado el bug."""
    fake_caller_client = _fake_caller_client_secuencia(_entradas_gate())
    app.dependency_overrides[get_caller_client] = lambda: fake_caller_client
    app.dependency_overrides[get_service_client] = lambda: MagicMock()
    _override_identidad()

    with patch(
        "app.routers.corridas_batch.ejecutar_batch_de_confianza",
        return_value={
            "id": 2,
            "tipo_batch": "de_confianza",
            "fecha": "2026-09-06",
            "estado": "exitosa",
            "intentos": 1,
            "iniciado_en": "2026-09-06T00:00:00+00:00",
            "terminado_en": "2026-09-06T00:00:05+00:00",
            "detalle": "0 día(s) creado(s), 0 ya existían.",
        },
    ) as mock_ejecutar:
        client = TestClient(app)
        response = client.post(
            "/api/corridas-batch/de-confianza",
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    mock_ejecutar.assert_called_once()
    (fecha_llamada, _db), _ = mock_ejecutar.call_args
    assert fecha_llamada == date.today()


def test_disparar_cierre_dia_llama_a_la_funcion_y_devuelve_su_resultado():
    fake_caller_client = _fake_caller_client_secuencia(_entradas_gate())
    fake_service_client = MagicMock()
    app.dependency_overrides[get_caller_client] = lambda: fake_caller_client
    app.dependency_overrides[get_service_client] = lambda: fake_service_client
    _override_identidad()

    resultado_esperado = {
        "id": 3,
        "tipo_batch": "cierre_dia",
        "fecha": "2026-09-06",
        "estado": "exitosa",
        "intentos": 1,
        "iniciado_en": "2026-09-06T03:00:00+00:00",
        "terminado_en": "2026-09-06T03:00:05+00:00",
        "detalle": "2 cerrado(s), 0 bloqueado(s), 0 ausencia(s) creada(s), 1 saltada(s).",
    }

    with patch(
        "app.routers.corridas_batch.ejecutar_cierre_dia",
        return_value=resultado_esperado,
    ) as mock_ejecutar:
        client = TestClient(app)
        response = client.post(
            "/api/corridas-batch/cierre-dia",
            json={"fecha": "2026-09-06"},
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    assert response.json()["tipo_batch"] == "cierre_dia"
    mock_ejecutar.assert_called_once()
    (fecha_llamada, db_llamado), _ = mock_ejecutar.call_args
    assert fecha_llamada.isoformat() == "2026-09-06"
    assert db_llamado is fake_service_client


def test_disparar_cierre_dia_sin_body_usa_hoy():
    """Mismo bug de de_confianza (default faltante) -- se prueba igual acá para no repetirlo."""
    fake_caller_client = _fake_caller_client_secuencia(_entradas_gate())
    app.dependency_overrides[get_caller_client] = lambda: fake_caller_client
    app.dependency_overrides[get_service_client] = lambda: MagicMock()
    _override_identidad()

    with patch(
        "app.routers.corridas_batch.ejecutar_cierre_dia",
        return_value={
            "id": 4,
            "tipo_batch": "cierre_dia",
            "fecha": "2026-09-06",
            "estado": "exitosa",
            "intentos": 1,
            "iniciado_en": "2026-09-06T03:00:00+00:00",
            "terminado_en": "2026-09-06T03:00:05+00:00",
            "detalle": "0 cerrado(s), 0 bloqueado(s), 0 ausencia(s) creada(s), 0 saltada(s).",
        },
    ) as mock_ejecutar:
        client = TestClient(app)
        response = client.post(
            "/api/corridas-batch/cierre-dia",
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    mock_ejecutar.assert_called_once()
    (fecha_llamada, _db), _ = mock_ejecutar.call_args
    assert fecha_llamada == date.today()


def test_disparar_batch_de_confianza_sin_permiso_devuelve_403():
    # Sin poseedor directo del código en puesto_permiso, tiene_permiso cae a heredable ->
    # mapa_hijos_por_puesto (select("id, reporta_a_id") sin filtros, shape distinto al resto) ->
    # sin hijos, sin permiso.
    tabla_puesto_reporta = MagicMock()
    tabla_puesto_reporta.select.return_value.execute.return_value.data = []

    fake_caller_client = _fake_caller_client_secuencia(
        [
            ("usuario", _tabla_select_simple([{"persona_id": GATE_PERSONA_ID}])),
            ("asignacion", _tabla_select_eq_is([{"puesto_id": GATE_PUESTO_ID}])),
            ("puesto_permiso", _tabla_select_doble_eq([])),
            ("permiso", _tabla_select_simple([{"heredable": True}])),
            ("puesto", tabla_puesto_reporta),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_caller_client
    app.dependency_overrides[get_service_client] = lambda: MagicMock()
    _override_identidad()

    with patch("app.routers.corridas_batch.ejecutar_batch_de_confianza") as mock_ejecutar:
        client = TestClient(app)
        response = client.post(
            "/api/corridas-batch/de-confianza",
            json={"fecha": "2026-09-06"},
            headers={"Authorization": "Bearer fake-token"},
        )

    app.dependency_overrides.clear()
    assert response.status_code == 403
    mock_ejecutar.assert_not_called()
