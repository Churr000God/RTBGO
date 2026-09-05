from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.deps import CallerIdentity, get_caller_client, get_caller_identity
from app.main import app

# alta_persona ahora exige requiere_permiso("alta_personas_usuarios") -- el gate toca
# usuario/asignacion/puesto_permiso ANTES del insert propio del router (persona + expediente,
# ambos contra la MISMA tabla_pe compartida, calcando el diseño original del test). Ver
# test_areas.py para el razonamiento completo.
GATE_PERSONA_ID = "persona-ficticia-gate"
GATE_PUESTO_ID = "puesto-ficticio-gate"
GATE_IDENTITY = CallerIdentity(auth_user_id="auth-ficticio-gate", correo="gate-ficticio@example.com")


def _tabla_gate(nombre_tabla):
    tabla = MagicMock()
    if nombre_tabla == "usuario":
        tabla.select.return_value.eq.return_value.execute.return_value.data = [
            {"persona_id": GATE_PERSONA_ID}
        ]
    elif nombre_tabla == "asignacion":
        tabla.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = [
            {"puesto_id": GATE_PUESTO_ID}
        ]
    elif nombre_tabla == "puesto_permiso":
        tabla.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"puesto_id": GATE_PUESTO_ID}
        ]
    return tabla


def _override_identidad():
    app.dependency_overrides[get_caller_identity] = lambda: GATE_IDENTITY


def test_alta_persona_inserta_persona_y_expediente():
    tabla_pe = MagicMock()
    tabla_pe.insert.return_value.execute.return_value.data = [
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
    llamadas_tabla = []

    def side_effect(nombre):
        llamadas_tabla.append(nombre)
        return tabla_pe if nombre in ("persona", "expediente") else _tabla_gate(nombre)

    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.side_effect = side_effect
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

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
    llamadas_negocio = [n for n in llamadas_tabla if n in ("persona", "expediente")]
    assert llamadas_negocio == ["persona", "expediente"]


def test_alta_persona_normaliza_curp_rfc_a_mayusculas():
    tabla_pe = MagicMock()
    insert_mock = tabla_pe.insert
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
    fake_client = MagicMock()
    fake_client.postgrest.schema.return_value.table.side_effect = (
        lambda nombre: tabla_pe if nombre in ("persona", "expediente") else _tabla_gate(nombre)
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

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


def test_alta_persona_sin_permiso_devuelve_403():
    """Caller autenticado y activo, pero sin alta_personas_usuarios -- el gate debe rechazar
    antes de insertar persona/expediente."""
    fake_client = MagicMock()

    def side_effect(nombre_tabla):
        tabla = MagicMock()
        if nombre_tabla == "usuario":
            tabla.select.return_value.eq.return_value.execute.return_value.data = [
                {"persona_id": GATE_PERSONA_ID}
            ]
        elif nombre_tabla == "asignacion":
            tabla.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = [
                {"puesto_id": GATE_PUESTO_ID}
            ]
        elif nombre_tabla == "puesto_permiso":
            tabla.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        elif nombre_tabla == "permiso":
            tabla.select.return_value.eq.return_value.execute.return_value.data = [
                {"heredable": False}
            ]
        return tabla

    fake_client.postgrest.schema.return_value.table.side_effect = side_effect
    app.dependency_overrides[get_caller_client] = lambda: fake_client
    _override_identidad()

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
    assert response.status_code == 403


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


PERSONA_ID = "11111111-1111-1111-1111-111111111111"
AUTH_USER_ID = "22222222-2222-2222-2222-222222222222"


def _fake_db_ficha(fila_persona, filas_usuario=None, filas_asignacion=None):
    fake_client = MagicMock()
    tabla_mock = fake_client.postgrest.schema.return_value.table

    def side_effect(nombre_tabla):
        tabla = MagicMock()
        if nombre_tabla == "persona":
            tabla.select.return_value.eq.return_value.single.return_value.execute.return_value.data = (
                fila_persona
            )
        elif nombre_tabla == "usuario":
            tabla.select.return_value.eq.return_value.execute.return_value.data = (
                filas_usuario or []
            )
        elif nombre_tabla == "asignacion":
            tabla.select.return_value.eq.return_value.is_.return_value.execute.return_value.data = (
                filas_asignacion or []
            )
        return tabla

    tabla_mock.side_effect = side_effect
    return fake_client


def test_ficha_persona_incluye_expediente_y_tiene_usuario():
    fake_client = _fake_db_ficha(
        fila_persona={
            "id": PERSONA_ID,
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
        },
        filas_usuario=[{"auth_user_id": AUTH_USER_ID}],
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        f"/api/personas/{PERSONA_ID}",
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["documento_ref"] == "RTB-2026-001"
    assert cuerpo["tiene_usuario"] is True


def test_ficha_persona_sin_expediente_ni_usuario_no_crashea():
    fake_client = _fake_db_ficha(
        fila_persona={
            "id": PERSONA_ID,
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
        },
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        f"/api/personas/{PERSONA_ID}",
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["tipo_contrato"] is None
    assert cuerpo["tiene_usuario"] is False
    assert cuerpo["documento_ref"] is None


def test_ficha_persona_incluye_puestos_vigentes_aplanados():
    fake_client = _fake_db_ficha(
        fila_persona={
            "id": PERSONA_ID,
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
        },
        filas_asignacion=[
            {
                "id": "asignacion-ficticia-1",
                "puesto": {
                    "id": "puesto-ficticio-1",
                    "nombre_puesto": "Puesto Ficticio Uno",
                    "departamento": {
                        "nombre_departamento": "Departamento Ficticio Uno",
                        "area": {"nombre_area": "Área Ficticia Uno"},
                    },
                },
            }
        ],
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        f"/api/personas/{PERSONA_ID}",
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    puestos_vigentes = response.json()["puestos_vigentes"]
    assert len(puestos_vigentes) == 1
    assert puestos_vigentes[0] == {
        "asignacion_id": "asignacion-ficticia-1",
        "puesto_id": "puesto-ficticio-1",
        "nombre_puesto": "Puesto Ficticio Uno",
        "nombre_departamento": "Departamento Ficticio Uno",
        "nombre_area": "Área Ficticia Uno",
    }


def test_ficha_persona_sin_asignaciones_devuelve_puestos_vigentes_vacio():
    fake_client = _fake_db_ficha(
        fila_persona={
            "id": PERSONA_ID,
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
        },
    )
    app.dependency_overrides[get_caller_client] = lambda: fake_client

    client = TestClient(app)
    response = client.get(
        f"/api/personas/{PERSONA_ID}",
        headers={"Authorization": "Bearer fake-token"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["puestos_vigentes"] == []
