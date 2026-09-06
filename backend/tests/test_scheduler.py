import asyncio
from unittest.mock import MagicMock, patch

from app.scheduler import (
    HORA_POR_DEFECTO,
    ID_JOB_BATCH_DE_CONFIANZA,
    _leer_hora_corrida_de_confianza,
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
        assert _leer_hora_corrida_de_confianza() == (2, 30)


def test_sin_fila_de_parametro_usa_default():
    fake_db = _fake_db_parametro([])
    with patch("app.scheduler.get_service_client", return_value=fake_db):
        assert _leer_hora_corrida_de_confianza() == HORA_POR_DEFECTO


def test_error_leyendo_parametro_usa_default_no_tumba_arranque():
    with patch("app.scheduler.get_service_client", side_effect=RuntimeError("sin red")):
        assert _leer_hora_corrida_de_confianza() == HORA_POR_DEFECTO


def test_lifespan_arranca_y_apaga_el_scheduler_con_id_fijo():
    """Sin pytest-asyncio en el proyecto -- se maneja el context manager async a mano con
    asyncio.run en vez de declarar el test como async def (quedaría sin correr, sin plugin)."""
    fake_scheduler = MagicMock()

    async def escenario():
        with (
            patch("app.scheduler.BackgroundScheduler", return_value=fake_scheduler),
            patch("app.scheduler._leer_hora_corrida_de_confianza", return_value=(3, 0)),
        ):
            app_falso = MagicMock()
            async with lifespan(app_falso):
                fake_scheduler.add_job.assert_called_once()
                _, kwargs = fake_scheduler.add_job.call_args
                assert kwargs["id"] == ID_JOB_BATCH_DE_CONFIANZA
                assert kwargs["replace_existing"] is True
                assert kwargs["hour"] == 3
                assert kwargs["minute"] == 0
                fake_scheduler.start.assert_called_once()
                fake_scheduler.shutdown.assert_not_called()

    asyncio.run(escenario())
    fake_scheduler.shutdown.assert_called_once()
