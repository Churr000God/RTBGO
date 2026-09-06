from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import CallerIdentity, get_caller_client, get_caller_identity
from app.main import app

PERSONA_ID = "aaaaaaaa-0000-0000-0000-000000000001"
PUESTO_ID = "puesto-caller"
CALLER_IDENTITY = CallerIdentity(auth_user_id="auth-caller", correo="caller@example.com")


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


def _tabla_banco_listar(datos):
    tabla = MagicMock()
    tabla.select.return_value.execute.return_value.data = datos
    return tabla


def _tabla_in(datos):
    tabla = MagicMock()
    tabla.select.return_value.in_.return_value.execute.return_value.data = datos
    return tabla


def _entradas_gate():
    return [
        ("usuario", _tabla_select_simple([{"persona_id": "persona-gate"}])),
        ("asignacion", _tabla_select_eq_is([{"puesto_id": PUESTO_ID}])),
        ("puesto_permiso", _tabla_select_doble_eq([{"puesto_id": PUESTO_ID}])),
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
    app.dependency_overrides[get_caller_identity] = lambda: CALLER_IDENTITY


def test_listar_banco_de_horas_resuelve_nombre():
    fake_client = _fake_client_secuencia(
        _entradas_gate()
        + [
            (
                "banco_de_horas",
                _tabla_banco_listar(
                    [
                        {
                            "persona_id": PERSONA_ID,
                            "monto": "3.50",
                            "vivo_desde": "2026-03-01T00:00:00+00:00",
                            "actualizado_en": "2026-03-01T00:00:00+00:00",
                        }
                    ]
                ),
            ),
            ("persona", _tabla_in([{"id": PERSONA_ID, "primer_nombre": "Ficticia", "apellido_paterno": "Alfa"}])),
        ]
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.get("/api/banco-de-horas", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200, response.text
    cuerpo = response.json()[0]
    assert cuerpo["persona_nombre"] == "Ficticia Alfa"
    assert cuerpo["monto"] == 3.5


def test_listar_banco_de_horas_vacio_no_consulta_persona():
    fake_client = _fake_client_secuencia(_entradas_gate() + [("banco_de_horas", _tabla_banco_listar([]))])
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

    client = TestClient(app)
    response = client.get("/api/banco-de-horas", headers={"Authorization": "Bearer fake-token"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == []
