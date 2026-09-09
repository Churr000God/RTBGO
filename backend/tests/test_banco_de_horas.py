from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import CallerIdentity, get_caller_client, get_caller_identity, get_service_client
from app.main import app

PERSONA_1 = "aaaaaaaa-0000-0000-0000-000000000001"
PERSONA_2 = "aaaaaaaa-0000-0000-0000-000000000002"
GATE_PERSONA_ID = "persona-ficticia-gate"
GATE_PUESTO_ID = "puesto-ficticio-gate"
GATE_IDENTITY = CallerIdentity(auth_user_id="auth-ficticio-gate", correo="gate-ficticio@example.com")

AHORA = datetime.now(timezone.utc)


def _iso(hace_dias: int) -> str:
    return (AHORA - timedelta(days=hace_dias)).isoformat()


# ---------------------------------------------------------------------------
# Helpers de gate -- AND entre 2 Depends(requiere_permiso(...)) separados
# (banco_de_horas_lectura) y (movimiento_de_saldo_lectura OR movimiento_de_saldo_edicion),
# cada uno resuelve su propio persona_id desde cero (no son la misma dependencia FastAPI).
# ---------------------------------------------------------------------------


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
    """Camino feliz: los 2 permisos se resuelven en el primer código de cada grupo."""
    grupo = [
        ("usuario", _tabla_select_simple([{"persona_id": GATE_PERSONA_ID}])),
        ("asignacion", _tabla_select_eq_is([{"puesto_id": GATE_PUESTO_ID}])),
        ("puesto_permiso", _tabla_select_doble_eq([{"puesto_id": GATE_PUESTO_ID}])),
    ]
    return grupo + grupo  # banco_de_horas_lectura, después movimiento_de_saldo_lectura


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


def _tabla_puesto_permiso_por_codigo(codigos_con_permiso):
    tabla = MagicMock()

    def eq_codigo(campo, valor):
        siguiente = MagicMock()
        tiene = valor in codigos_con_permiso
        siguiente.eq.return_value.execute.return_value.data = (
            [{"puesto_id": GATE_PUESTO_ID}] if tiene else []
        )
        return siguiente

    tabla.select.return_value.eq.side_effect = eq_codigo
    return tabla


def _fake_caller_client_con_permisos(codigos_con_permiso):
    def side_effect(nombre_tabla):
        if nombre_tabla == "usuario":
            return _tabla_select_simple([{"persona_id": GATE_PERSONA_ID}])
        if nombre_tabla == "asignacion":
            return _tabla_select_eq_is([{"puesto_id": GATE_PUESTO_ID}])
        if nombre_tabla == "puesto_permiso":
            return _tabla_puesto_permiso_por_codigo(codigos_con_permiso)
        if nombre_tabla == "permiso":
            tabla = MagicMock()
            tabla.select.return_value.eq.return_value.execute.return_value.data = [
                {"heredable": False}
            ]
            return tabla
        return MagicMock()

    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.side_effect = side_effect
    return fake_client


def _override_identidad():
    app.dependency_overrides[get_caller_identity] = lambda: GATE_IDENTITY


def _limpiar():
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers de dato (service client)
# ---------------------------------------------------------------------------


def _tabla_parametro(valor=None):
    tabla = MagicMock()
    datos = [{"valor": str(valor)}] if valor is not None else []
    (
        tabla.select.return_value.eq.return_value.lte.return_value.order.return_value.limit
        .return_value.execute.return_value.data
    ) = datos
    return tabla


def _tabla_plana(datos):
    tabla = MagicMock()
    tabla.select.return_value.execute.return_value.data = datos
    return tabla


def _tabla_eq(datos):
    tabla = MagicMock()
    tabla.select.return_value.eq.return_value.execute.return_value.data = datos
    return tabla


def _tabla_in(datos):
    tabla = MagicMock()
    tabla.select.return_value.in_.return_value.execute.return_value.data = datos
    return tabla


def _tabla_persona(busqueda_ids=None, nombres=None):
    tabla = MagicMock()
    tabla.select.return_value.or_.return_value.execute.return_value.data = (
        [{"id": pid} for pid in busqueda_ids] if busqueda_ids is not None else []
    )
    tabla.select.return_value.in_.return_value.execute.return_value.data = nombres or []
    return tabla


def _fake_service_client(parametro=None, banco=None, movimiento=None, persona=None):
    defaults = {
        "parametro": parametro if parametro is not None else _tabla_parametro(),
        "banco_de_horas": banco if banco is not None else _tabla_plana([]),
        "movimiento_de_saldo": movimiento if movimiento is not None else _tabla_in([]),
        "persona": persona if persona is not None else _tabla_persona(nombres=[]),
    }

    def side_effect(nombre_tabla):
        return defaults.get(nombre_tabla, MagicMock())

    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.side_effect = side_effect
    return fake_client


def _preparar(**tablas):
    fake_caller = _fake_caller_client_secuencia(_entradas_gate())
    fake_service = _fake_service_client(**tablas)
    app.dependency_overrides[get_caller_client] = lambda: fake_caller
    app.dependency_overrides[get_service_client] = lambda: fake_service
    _override_identidad()
    return fake_caller, fake_service


def _fila_banco(persona_id=PERSONA_1, banco_id=1, monto=0.0, vivo_desde=None):
    return {
        "id": banco_id,
        "persona_id": persona_id,
        "monto": str(monto),
        "vivo_desde": vivo_desde,
        "actualizado_en": AHORA.isoformat(),
    }


def _mov(mov_id, banco_id, creado_en, monto):
    return {"id": mov_id, "banco_de_horas_id": banco_id, "creado_en": creado_en, "monto": str(monto)}


def _pedir(**params):
    client = TestClient(app)
    return client.get(
        "/api/banco-de-horas", params=params, headers={"Authorization": "Bearer fake-token"}
    )


# ---------------------------------------------------------------------------
# GET /api/banco-de-horas
# ---------------------------------------------------------------------------


def test_listar_banco_de_horas_resuelve_nombre_y_resumen():
    banco = _tabla_plana(
        [
            _fila_banco(PERSONA_1, 1, monto=10.0, vivo_desde=_iso(10)),
            _fila_banco(PERSONA_2, 2, monto=0.0, vivo_desde=None),
        ]
    )
    movimiento = _tabla_in([_mov(1, 1, _iso(10), 10.0)])
    persona = _tabla_persona(
        nombres=[
            {"id": PERSONA_1, "primer_nombre": "Ana", "apellido_paterno": "Pérez"},
            {"id": PERSONA_2, "primer_nombre": "Beto", "apellido_paterno": "Ruiz"},
        ]
    )
    _preparar(banco=banco, movimiento=movimiento, persona=persona)

    response = _pedir()

    _limpiar()
    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["resumen"]["total_personas"] == 2
    assert cuerpo["resumen"]["en_deuda"] == 1
    assert cuerpo["resumen"]["sin_deuda"] == 1
    assert cuerpo["resumen"]["ventana_meses"] == 6
    saldos_por_persona = {item["persona_id"]: item for item in cuerpo["saldos"]}
    assert saldos_por_persona[PERSONA_1]["persona_nombre"] == "Ana Pérez"
    assert saldos_por_persona[PERSONA_1]["monto"] == 10.0
    assert saldos_por_persona[PERSONA_1]["horas_reciente"] == 10.0
    assert saldos_por_persona[PERSONA_1]["conciliado"] is True
    assert saldos_por_persona[PERSONA_2]["monto"] == 0.0


def test_listar_banco_de_horas_filtra_por_tramo_antiguedad():
    banco = _tabla_plana(
        [
            _fila_banco(PERSONA_1, 1, monto=5.0, vivo_desde=_iso(10)),  # reciente
            _fila_banco(PERSONA_2, 2, monto=5.0, vivo_desde=_iso(250)),  # fuera_ventana
        ]
    )
    movimiento = _tabla_in(
        [
            _mov(1, 1, _iso(10), 5.0),
            _mov(2, 2, _iso(250), 5.0),
        ]
    )
    _preparar(banco=banco, movimiento=movimiento)

    response = _pedir(tramo_antiguedad="fuera_ventana")

    _limpiar()
    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["total"] == 1
    assert cuerpo["saldos"][0]["persona_id"] == PERSONA_2
    # el resumen sigue reflejando a las 2 personas, el filtro no lo toca.
    assert cuerpo["resumen"]["total_personas"] == 2


def test_listar_banco_de_horas_orden_monto_asc():
    banco = _tabla_plana(
        [
            _fila_banco(PERSONA_1, 1, monto=20.0, vivo_desde=_iso(10)),
            _fila_banco(PERSONA_2, 2, monto=5.0, vivo_desde=_iso(10)),
        ]
    )
    movimiento = _tabla_in(
        [
            _mov(1, 1, _iso(10), 20.0),
            _mov(2, 2, _iso(10), 5.0),
        ]
    )
    _preparar(banco=banco, movimiento=movimiento)

    response = _pedir(orden="monto_asc")

    _limpiar()
    assert response.status_code == 200, response.text
    montos = [item["monto"] for item in response.json()["saldos"]]
    assert montos == [5.0, 20.0]


def test_listar_banco_de_horas_paginacion():
    banco = _tabla_plana(
        [
            _fila_banco(PERSONA_1, 1, monto=30.0, vivo_desde=_iso(10)),
            _fila_banco(PERSONA_2, 2, monto=20.0, vivo_desde=_iso(10)),
        ]
    )
    movimiento = _tabla_in(
        [
            _mov(1, 1, _iso(10), 30.0),
            _mov(2, 2, _iso(10), 20.0),
        ]
    )
    _preparar(banco=banco, movimiento=movimiento)

    response = _pedir(limite=1, desplazamiento=1)

    _limpiar()
    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["total"] == 2
    assert len(cuerpo["saldos"]) == 1
    assert cuerpo["saldos"][0]["monto"] == 20.0  # monto_desc por defecto -- el segundo es el menor


def test_listar_banco_de_horas_busqueda_filtra_sin_tocar_el_resumen():
    banco = _tabla_plana(
        [
            _fila_banco(PERSONA_1, 1, monto=10.0, vivo_desde=_iso(10)),
            _fila_banco(PERSONA_2, 2, monto=10.0, vivo_desde=_iso(10)),
        ]
    )
    movimiento = _tabla_in(
        [
            _mov(1, 1, _iso(10), 10.0),
            _mov(2, 2, _iso(10), 10.0),
        ]
    )
    persona = _tabla_persona(
        busqueda_ids=[PERSONA_1],
        nombres=[
            {"id": PERSONA_1, "primer_nombre": "Ana", "apellido_paterno": "Pérez"},
            {"id": PERSONA_2, "primer_nombre": "Beto", "apellido_paterno": "Ruiz"},
        ],
    )
    _preparar(banco=banco, movimiento=movimiento, persona=persona)

    response = _pedir(busqueda_persona="Ana")

    _limpiar()
    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["total"] == 1
    assert cuerpo["saldos"][0]["persona_id"] == PERSONA_1
    assert cuerpo["resumen"]["total_personas"] == 2


def test_listar_banco_de_horas_sin_banco_de_horas_lectura_devuelve_403():
    fake_caller = _fake_caller_client_con_permisos(
        {"movimiento_de_saldo_lectura", "movimiento_de_saldo_edicion"}
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_caller
    app.dependency_overrides[get_service_client] = lambda: MagicMock()
    _override_identidad()

    response = _pedir()

    _limpiar()
    assert response.status_code == 403


def test_listar_banco_de_horas_sin_permiso_de_ledger_devuelve_403():
    """El AND entre grupos: banco_de_horas_lectura solo no alcanza."""
    fake_caller = _fake_caller_client_con_permisos({"banco_de_horas_lectura"})
    app.dependency_overrides[get_caller_client] = lambda: fake_caller
    app.dependency_overrides[get_service_client] = lambda: MagicMock()
    _override_identidad()

    response = _pedir()

    _limpiar()
    assert response.status_code == 403


def test_listar_banco_de_horas_desconciliado_marca_bandera():
    """movimientos que no cuadran contra monto -- conciliado=False + fallback a vivo_desde."""
    banco = _tabla_plana([_fila_banco(PERSONA_1, 1, monto=8.0, vivo_desde=_iso(150))])  # media
    movimiento = _tabla_in([_mov(1, 1, _iso(10), 2.0)])  # sólo reconstruye 2, banco dice 8
    _preparar(banco=banco, movimiento=movimiento)

    response = _pedir()

    _limpiar()
    assert response.status_code == 200, response.text
    saldo = response.json()["saldos"][0]
    assert saldo["conciliado"] is False
    assert saldo["horas_media"] == 8.0


# ---------------------------------------------------------------------------
# GET /api/banco-de-horas/{persona_id}/movimientos
# ---------------------------------------------------------------------------


def _pedir_movimientos(persona_id=PERSONA_1):
    client = TestClient(app)
    return client.get(
        f"/api/banco-de-horas/{persona_id}/movimientos",
        headers={"Authorization": "Bearer fake-token"},
    )


def test_listar_movimientos_calcula_saldo_corrido_y_vivo():
    banco = _tabla_eq([{"id": 1}])
    movimiento = _tabla_eq(
        [
            {
                "id": 1,
                "tipo": "generado_quincena",
                "monto": "5.00",
                "motivo": None,
                "autor_id": None,
                "creado_en": _iso(20),
            },
            {
                "id": 2,
                "tipo": "cubrir",
                "monto": "-2.00",
                "motivo": "cubrió falta",
                "autor_id": None,
                "creado_en": _iso(10),
            },
        ]
    )
    _preparar(banco=banco, movimiento=movimiento)

    response = _pedir_movimientos()

    _limpiar()
    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["total"] == 2
    por_id = {item["id"]: item for item in cuerpo["movimientos"]}
    assert por_id[1]["saldo_corrido"] == 5.0
    assert por_id[1]["vivo"] is True
    assert por_id[2]["saldo_corrido"] == 3.0
    assert por_id[2]["vivo"] is False
    # más reciente primero
    assert cuerpo["movimientos"][0]["id"] == 2


def test_listar_movimientos_persona_sin_banco_de_horas_devuelve_vacio():
    banco = _tabla_eq([])
    _preparar(banco=banco)

    response = _pedir_movimientos()

    _limpiar()
    assert response.status_code == 200, response.text
    assert response.json() == {"total": 0, "movimientos": []}
