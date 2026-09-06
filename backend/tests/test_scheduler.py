import asyncio
from unittest.mock import MagicMock, patch

from app.scheduler import (
    HORA_POR_DEFECTO,
    ID_JOB_BATCH_DE_CONFIANZA,
    ID_JOB_CIERRE_DIA,
    _leer_hora_corrida_cierre_dia,
    lifespan,
)


def _fake_db_parametro(datos):
    fake_client = MagicMock()
    tabla = MagicMock()
    (
        tabla.select.return_value.eq.return_value.lte.return_value.order.return_value.limit
        .return_value.execute.return_value.data
    ) = datos
    fake_client.postgrest.schema.return_value.table.return_value = tabla
    return fake_client


def test_lee_hora_del_parametro():
    fake_db = _fake_db_parametro([{"valor": "02:30"}])
    with patch("app.scheduler.get_service_client", return_value=fake_db):
        assert _leer_hora_corrida_cierre_dia() == (2, 30)


def test_sin_fila_de_parametro_usa_default():
    fake_db = _fake_db_parametro([])
    with patch("app.scheduler.get_service_client", return_value=fake_db):
        assert _leer_hora_corrida_cierre_dia() == HORA_POR_DEFECTO


def test_error_leyendo_parametro_usa_default_no_tumba_arranque():
    with patch("app.scheduler.get_service_client", side_effect=RuntimeError("sin red")):
        assert _leer_hora_corrida_cierre_dia() == HORA_POR_DEFECTO


def test_lifespan_arranca_ambos_jobs_a_la_misma_hora_y_apaga_el_scheduler():
    """Sin pytest-asyncio en el proyecto -- se maneja el context manager async a mano con
    asyncio.run en vez de declarar el test como async def (quedaría sin correr, sin plugin).
    de_confianza y cierre_dia comparten la misma hora leída una sola vez (SCJ-PRO-14: "mismo
    colchón/hora que SCJ-PRO-12"), cada uno con su propio id fijo + replace_existing=True."""
    fake_scheduler = MagicMock()

    async def escenario():
        with (
            patch("app.scheduler.BackgroundScheduler", return_value=fake_scheduler),
            patch("app.scheduler._leer_hora_corrida_cierre_dia", return_value=(3, 0)),
        ):
            app_falso = MagicMock()
            async with lifespan(app_falso):
                assert fake_scheduler.add_job.call_count == 2
                ids_configurados = {
                    llamada.kwargs["id"] for llamada in fake_scheduler.add_job.call_args_list
                }
                assert ids_configurados == {ID_JOB_BATCH_DE_CONFIANZA, ID_JOB_CIERRE_DIA}
                for llamada in fake_scheduler.add_job.call_args_list:
                    assert llamada.kwargs["replace_existing"] is True
                    assert llamada.kwargs["hour"] == 3
                    assert llamada.kwargs["minute"] == 0
                fake_scheduler.start.assert_called_once()
                fake_scheduler.shutdown.assert_not_called()

    asyncio.run(escenario())
    fake_scheduler.shutdown.assert_called_once()
