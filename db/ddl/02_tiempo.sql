-- 02_tiempo.sql
-- Tablas del subsistema de Tiempo.
-- Depende de: 00_esquemas.sql, 01_persona_stub.sql
-- Justificación: SCJ-MOD-03 · Decisiones SCJ-DEC-01 a SCJ-DEC-09
--
-- Nota de alcance (2026-09-02, actualizada): SCJ-DEC-01, SCJ-DEC-04 y SCJ-DEC-08 ya son
-- Aceptadas y este DDL las refleja:
--   - Paridad (SCJ-DEC-01, Opción C): no hay restricción que bloquee un número impar de marcas al
--     insertar — un tramo con marca_cierre_id nulo es un tramo abierto, válido. La cuenta de
--     marcas por persona/día se valida en la aplicación al cerrar el día, no en la base.
--   - Vigencias (SCJ-DEC-04, Opción A): `vigente_desde date NOT NULL` + `vigente_hasta date`
--     (`NULL` = vigente), sin `EXCLUDE GIST`. El traslape se valida en la aplicación antes de
--     insertar o actualizar una vigencia — ver CONVENCIONES.md §II.
--   - Clave de la marca (SCJ-DEC-08, Opción B): id bigint identity como PK (convención universal
--     de este repo, "clave primaria siempre id") y evento_id uuid como llave de negocio UNIQUE
--     para idempotencia. Confirmada como definitiva, sin cambios de esquema.

-- ============================================================================
-- Catálogos independientes
-- ============================================================================

CREATE TABLE tiempo.tope_legal (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vigente_desde    date NOT NULL,
  vigente_hasta    date,
  maximo_semanal   numeric(6,2) NOT NULL,
  maximo_extra     numeric(6,2) NOT NULL,
  CONSTRAINT uq_tope_legal_vigente_desde UNIQUE (vigente_desde)
);

COMMENT ON TABLE tiempo.tope_legal IS
  'Máximo semanal y de horas extra, con vigencia. vigente_hasta NULL = vigente actual; el '
  'traslape entre vigencias se valida en la aplicación (SCJ-DEC-04, Opción A). Ver SCJ-ESP-01 '
  '§VI.4.';

CREATE TABLE tiempo.dia_festivo (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha   date NOT NULL,
  nombre  varchar(100) NOT NULL,
  CONSTRAINT uq_dia_festivo_fecha UNIQUE (fecha)
);

COMMENT ON TABLE tiempo.dia_festivo IS
  'Catálogo de días festivos. No calculable por fórmula (festivos móviles) — se carga a mano. '
  'Domingo no necesita catálogo: se deriva de la fecha. Usado para separar, al corte quincenal, '
  'las horas trabajadas en domingo o festivo con su concepto de pago — sin importar si esas horas '
  'fueron ordinarias, de reposición o extra.';

CREATE TABLE tiempo.parametro (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave           varchar(100) NOT NULL,
  valor           text NOT NULL,
  vigente_desde   date NOT NULL,
  CONSTRAINT uq_parametro_clave_vigente UNIQUE (clave, vigente_desde)
);

COMMENT ON TABLE tiempo.parametro IS
  'Valor de regla de negocio, configurable y versionado por vigente_desde — mismo patrón que '
  'tope_legal. Ver SCJ-ESP-01 §VI.9 y SCJ-DIC-01 §IV para el catálogo de claves conocidas '
  '(tolerancia_retardo_min, hora_corte_dia, ventana_banco_meses, umbral_aviso_pct, '
  'umbral_escalamiento_pct, descuento_pausa_no_registrada_min).';

-- ============================================================================
-- Jornada
-- ============================================================================

CREATE TABLE tiempo.jornada_asignada (
  id                              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  persona_id                      uuid NOT NULL REFERENCES tiempo.persona (id),
  tipo_jornada                    varchar(20) NOT NULL,
  vigente_desde                   date NOT NULL,
  vigente_hasta                   date,
  descuento_comida_fija           boolean NOT NULL DEFAULT false,
  minutos_descuento_comida_fija   int,
  horas_semanales_calculadas      numeric(6,2),
  CONSTRAINT ck_jornada_asignada_tipo
    CHECK (tipo_jornada IN ('normal', 'flexible', 'de_confianza')),
  CONSTRAINT ck_jornada_asignada_descuento_fijo
    CHECK ((descuento_comida_fija) = (minutos_descuento_comida_fija IS NOT NULL))
);

COMMENT ON TABLE tiempo.jornada_asignada IS
  'Qué jornada tuvo una persona, con vigencia. normal/flexible siguen el patrón semanal y '
  'registran marca; de_confianza no pasa por terminal, no maneja horas extra ni banco de horas, '
  'sólo primas dominical/festivo cuando aplique. vigente_hasta NULL = vigente actual; el '
  'traslape entre vigencias de la misma persona se valida en la aplicación, no con EXCLUDE '
  '(SCJ-DEC-04, Opción A).';
COMMENT ON COLUMN tiempo.jornada_asignada.horas_semanales_calculadas IS
  'Derivado de patron_semanal — se recalcula al modificar el patrón. No es fuente de verdad.';

CREATE TABLE tiempo.patron_semanal (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jornada_asignada_id    bigint NOT NULL REFERENCES tiempo.jornada_asignada (id),
  dia_semana             varchar(10) NOT NULL,
  hora_entrada           time NOT NULL,
  hora_salida            time NOT NULL,
  minutos_comida         int NOT NULL DEFAULT 0,
  horas_efectivas        numeric(5,2),
  CONSTRAINT ck_patron_semanal_dia_semana CHECK (dia_semana IN
    ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')),
  CONSTRAINT ck_patron_semanal_horario CHECK (hora_salida > hora_entrada)
);

COMMENT ON TABLE tiempo.patron_semanal IS
  'Qué días, con qué horario y con qué pausa de comida. Admite jornada partida vía varias filas '
  'del mismo día_semana con distinto horario si hace falta (no restringido a una fila por día).';
COMMENT ON COLUMN tiempo.patron_semanal.horas_efectivas IS
  'Derivado: (hora_salida - hora_entrada) - minutos_comida. No es fuente de verdad.';

-- ============================================================================
-- Marca, día, tramo
-- ============================================================================

CREATE TABLE tiempo.marca (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evento_id            uuid NOT NULL DEFAULT gen_random_uuid(),
  persona_id           uuid NOT NULL REFERENCES tiempo.persona (id),
  terminal_id          uuid,
  secuencia_local      bigint,
  momento_terminal     timestamptz NOT NULL,
  momento_servidor     timestamptz NOT NULL DEFAULT now(),
  origen               varchar(20) NOT NULL,
  reloj_sincronizado   boolean NOT NULL,
  requiere_revision    boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_marca_evento_id UNIQUE (evento_id),
  CONSTRAINT ck_marca_origen CHECK (origen IN ('terminal', 'contingencia', 'captura_manual')),
  CONSTRAINT ck_marca_secuencia_solo_terminal
    CHECK ((origen = 'terminal') = (terminal_id IS NOT NULL AND secuencia_local IS NOT NULL))
);

CREATE UNIQUE INDEX uq_marca_terminal_secuencia
  ON tiempo.marca (terminal_id, secuencia_local)
  WHERE origen = 'terminal';

COMMENT ON TABLE tiempo.marca IS
  'Evento crudo producido por el terminal. Inmutable — ningún flujo de la aplicación emite UPDATE '
  'ni DELETE sobre esta tabla, sólo INSERT. Cualquier corrección pasa por tiempo.correccion '
  '(SCJ-DEC-03). Nunca guarda huella ni plantilla biométrica — sólo el identificador ya resuelto '
  'a persona_id.';
COMMENT ON COLUMN tiempo.marca.evento_id IS
  'Llave de negocio para idempotencia global de reintentos de envío. No es la PK física, por '
  'decisión confirmada — ver SCJ-DEC-08, Opción B.';
COMMENT ON COLUMN tiempo.marca.secuencia_local IS
  'Contador del terminal, nulo salvo origen = terminal. Sirve para detectar huecos: si llegan 1, '
  '2 y 4, se perdió la 3. Ver SCJ-DEC-09.';
COMMENT ON COLUMN tiempo.marca.reloj_sincronizado IS
  'Estado del reloj del terminal en el momento exacto de esta marca, reportado por el propio '
  'dispositivo — no se deriva aquí.';
COMMENT ON COLUMN tiempo.marca.requiere_revision IS
  'Bandera rápida, calculada como NOT reloj_sincronizado salvo que un proceso posterior la '
  'levante por otra razón. El detalle y el ciclo de vida de la revisión viven en tiempo.excepcion '
  '(SCJ-DEC-07).';

CREATE TABLE tiempo.dia (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  persona_id      uuid NOT NULL REFERENCES tiempo.persona (id),
  fecha           date NOT NULL,
  estado          varchar(20) NOT NULL DEFAULT 'abierto',
  horas_totales   numeric(5,2),
  origen          varchar(20),
  CONSTRAINT uq_dia_persona_fecha UNIQUE (persona_id, fecha),
  CONSTRAINT ck_dia_estado CHECK (estado IN ('abierto', 'cerrado', 'bloqueado', 'revisado')),
  CONSTRAINT ck_dia_origen CHECK (origen IS NULL OR origen IN ('terminal', 'automatico_confianza'))
);

COMMENT ON TABLE tiempo.dia IS
  'Marcas de una persona en una fecha, con estado. Entidad materializada, no vista — el bloqueo '
  'es una decisión que sobrevive a marcas tardías (SCJ-DEC-06). bloqueado pasa a revisado cuando '
  'RH lo revisa; nunca vuelve a cerrado automáticamente.';
COMMENT ON COLUMN tiempo.dia.horas_totales IS
  'Derivado de la suma de tramo.minutos_trabajados del día. No es fuente de verdad.';
COMMENT ON COLUMN tiempo.dia.origen IS
  'NULL para jornada normal/flexible (el día nace de marcas reales). automatico_confianza para '
  'jornada de_confianza, que no pasa por terminal — un proceso por lotes crea el día directo, sin '
  'marca ni tramo sintéticos (contaminarían marca como evidencia de jornada).';

CREATE TABLE tiempo.tramo (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dia_id              bigint NOT NULL REFERENCES tiempo.dia (id),
  marca_apertura_id   bigint NOT NULL REFERENCES tiempo.marca (id),
  marca_cierre_id     bigint REFERENCES tiempo.marca (id),
  inicio              timestamptz NOT NULL,
  fin                 timestamptz,
  minutos_trabajados  numeric(6,2),
  CONSTRAINT uq_tramo_marca_apertura UNIQUE (marca_apertura_id),
  CONSTRAINT uq_tramo_marca_cierre UNIQUE (marca_cierre_id),
  CONSTRAINT ck_tramo_fin_posterior_a_inicio CHECK (fin IS NULL OR fin > inicio)
);

COMMENT ON TABLE tiempo.tramo IS
  'Par de marcas: la impar abre, la par cierra. marca_cierre_id nulo es un tramo abierto (día con '
  'número impar de marcas) — no es un error de restricción, es un dato que el proceso de cierre '
  'usa para decidir el estado de tiempo.dia. Ver SCJ-ESP-01 §VI.1 y SCJ-DEC-01.';
COMMENT ON COLUMN tiempo.tramo.minutos_trabajados IS
  'Derivado de fin - inicio. Nulo mientras el tramo esté abierto. No es fuente de verdad.';

CREATE TABLE tiempo.clasificacion_de_tiempo (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tramo_id  bigint NOT NULL REFERENCES tiempo.tramo (id),
  tipo      varchar(20),
  CONSTRAINT uq_clasificacion_de_tiempo_tramo UNIQUE (tramo_id),
  CONSTRAINT ck_clasificacion_de_tiempo_tipo
    CHECK (tipo IS NULL OR tipo IN ('ordinario', 'reposicion', 'extra'))
);

COMMENT ON TABLE tiempo.clasificacion_de_tiempo IS
  'Ordinario, reposición o extra, sobre un tramo. tipo se calcula comparando las horas '
  'acumuladas del tramo contra tope_legal vigente y contra si la persona tiene banco_de_horas '
  'pendiente — la regla exacta del disparador queda pendiente de programar.';

-- ============================================================================
-- Banco de horas
-- ============================================================================

CREATE TABLE tiempo.banco_de_horas (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  persona_id       uuid NOT NULL REFERENCES tiempo.persona (id),
  monto            numeric(8,2) NOT NULL DEFAULT 0,
  vivo_desde       timestamptz,
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_banco_de_horas_persona UNIQUE (persona_id)
);

COMMENT ON TABLE tiempo.banco_de_horas IS
  'Deuda de horas acumulada de una persona. monto y vivo_desde nunca se escriben con UPDATE '
  'directo — sólo el disparador que reacciona a tiempo.movimiento_de_saldo los recalcula. Ver '
  'SCJ-DEC-02.';
COMMENT ON COLUMN tiempo.banco_de_horas.vivo_desde IS
  'Fecha del movimiento que llevó monto de 0 a positivo por última vez. NULL cuando monto = 0. '
  'Permite evaluar los umbrales de SCJ-ESP-01 §VI.6 (aviso al 100%, escalamiento al 200%, cuarto '
  'mes con saldo vivo) sin recorrer el histórico de movimientos en cada consulta.';

CREATE TABLE tiempo.movimiento_de_saldo (
  id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  banco_de_horas_id           bigint NOT NULL REFERENCES tiempo.banco_de_horas (id),
  clasificacion_de_tiempo_id  bigint REFERENCES tiempo.clasificacion_de_tiempo (id),
  tipo                        varchar(20) NOT NULL,
  monto                       numeric(8,2) NOT NULL,
  motivo                      text,
  autor_id                    uuid REFERENCES tiempo.persona (id),
  creado_en                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_movimiento_de_saldo_tipo CHECK (tipo IN
    ('generado_quincena', 'cubrir', 'arrastrar', 'descontar', 'condonar'))
);

COMMENT ON TABLE tiempo.movimiento_de_saldo IS
  'Libro de movimientos del banco de horas — única fuente de verdad, banco_de_horas.monto es '
  'caché derivado. Ver SCJ-DEC-02.';
COMMENT ON COLUMN tiempo.movimiento_de_saldo.tipo IS
  'generado_quincena: +monto, automático al corte quincenal, sólo si horas_esperadas > '
  'horas_trabajadas (nunca genera saldo a favor). cubrir: -monto, automático desde una '
  'clasificacion_de_tiempo tipo reposicion. arrastrar: 0, pasa el saldo vivo al siguiente bloque '
  'semestral, manual RH. descontar/condonar: -monto, cancelan a cero, manual Dirección + RH.';
COMMENT ON COLUMN tiempo.movimiento_de_saldo.autor_id IS
  'NULL cuando el movimiento lo genera el sistema (generado_quincena, cubrir automático desde '
  'reposición). No nulo para arrastrar/descontar/condonar, siempre decisión humana.';

-- ============================================================================
-- Correcciones, ausencias, excepciones
-- ============================================================================

CREATE TABLE tiempo.correccion (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  marca_id              bigint NOT NULL REFERENCES tiempo.marca (id),
  valor_corregido       timestamptz NOT NULL,
  motivo                text NOT NULL,
  autor_id              uuid NOT NULL REFERENCES tiempo.persona (id),
  creado_en             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tiempo.correccion IS
  'Registro nuevo que apunta a una marca anterior — nunca se sobrescribe momento_terminal. Ver '
  'SCJ-DEC-03. Siempre lleva autor: una corrección es, por definición, una decisión humana tras '
  'revisar una excepción.';
COMMENT ON COLUMN tiempo.correccion.valor_corregido IS
  'Asume que sólo se corrige momento_terminal (encaja con el caso de uso real: reloj no '
  'sincronizado detectado, RH corrige la hora tras revisar). persona_id no se corrige aquí — el '
  'identificador biométrico ya resuelto es dato único y confiable, no un valor a ajustar.';

CREATE TABLE tiempo.ausencia (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  persona_id             uuid NOT NULL REFERENCES tiempo.persona (id),
  tipo_de_ausencia       varchar(30) NOT NULL,
  fecha_inicio           date NOT NULL,
  fecha_fin              date NOT NULL,
  estado_autorizacion    varchar(20) NOT NULL DEFAULT 'pendiente',
  documento_ref          varchar(50),
  CONSTRAINT ck_ausencia_tipo CHECK (tipo_de_ausencia IN
    ('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'incapacidad', 'falta')),
  CONSTRAINT ck_ausencia_estado_autorizacion
    CHECK (estado_autorizacion IN ('pendiente', 'autorizada', 'rechazada')),
  CONSTRAINT ck_ausencia_fechas CHECK (fecha_fin >= fecha_inicio)
);

COMMENT ON TABLE tiempo.ausencia IS
  'Periodo no trabajado, con naturaleza y autorización. tipo_de_ausencia usa el enumerado ya '
  'documentado en SCJ-DIC-01 §III.';
COMMENT ON COLUMN tiempo.ausencia.estado_autorizacion IS
  'Placeholder de un solo paso — NO implementa el flujo de autorización configurable de pasos '
  'variables que SCJ-DEC-05 exige (esa decisión sigue "Propuesta"). Cuando SCJ-DEC-05 se resuelva, '
  'esta columna probablemente se sustituye por la entidad de flujo/instancia que ahí se decida.';
COMMENT ON COLUMN tiempo.ausencia.documento_ref IS
  'Evidencia cargada y conservada — SCJ-ESP-01 exige que una falta justificada la tenga antes de '
  'pagarse. NULL admitido: vacaciones/incapacidad pueden no requerir documento propio si ya '
  'consta en otro expediente.';

CREATE TABLE tiempo.excepcion (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  marca_id          bigint REFERENCES tiempo.marca (id),
  dia_id            bigint REFERENCES tiempo.dia (id),
  motivo_revision   text NOT NULL,
  estado            varchar(20) NOT NULL DEFAULT 'pendiente',
  creado_en         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_excepcion_estado CHECK (estado IN ('pendiente', 'resuelto')),
  CONSTRAINT ck_excepcion_marca_o_dia
    CHECK ((marca_id IS NOT NULL) <> (dia_id IS NOT NULL))
);

COMMENT ON TABLE tiempo.excepcion IS
  'Marca o día apartado para revisión humana — nunca ambos, nunca ninguno '
  '(ck_excepcion_marca_o_dia). Ver SCJ-DEC-07. Casos: reloj no sincronizado (marca_id), día sin '
  'checada y sin ausencia que lo justifique (dia_id), jornada ordinaria en domingo/festivo sin '
  'autorización previa (dia_id).';

-- ============================================================================
-- Disparadores
-- ============================================================================

CREATE FUNCTION tiempo.fn_movimiento_de_saldo_actualiza_banco()
RETURNS trigger AS $$
DECLARE
  v_monto_antes numeric(8,2);
  v_monto_despues numeric(8,2);
BEGIN
  SELECT monto INTO v_monto_antes FROM tiempo.banco_de_horas WHERE id = NEW.banco_de_horas_id;
  v_monto_despues := v_monto_antes + NEW.monto;

  UPDATE tiempo.banco_de_horas
  SET monto = v_monto_despues,
      actualizado_en = NEW.creado_en,
      vivo_desde = CASE
        WHEN v_monto_antes = 0 AND v_monto_despues > 0 THEN NEW.creado_en
        WHEN v_monto_despues = 0 THEN NULL
        ELSE vivo_desde
      END
  WHERE id = NEW.banco_de_horas_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_de_saldo_actualiza_banco
  AFTER INSERT ON tiempo.movimiento_de_saldo
  FOR EACH ROW
  EXECUTE FUNCTION tiempo.fn_movimiento_de_saldo_actualiza_banco();

COMMENT ON FUNCTION tiempo.fn_movimiento_de_saldo_actualiza_banco() IS
  'Única vía de escritura de banco_de_horas.monto y .vivo_desde. Ver SCJ-DEC-02.';

CREATE FUNCTION tiempo.fn_ausencia_resuelve_excepcion()
RETURNS trigger AS $$
BEGIN
  IF NEW.estado_autorizacion = 'autorizada' THEN
    UPDATE tiempo.excepcion
    SET estado = 'resuelto',
        motivo_revision = motivo_revision || ' — resuelto por ausencia autorizada, carga tardía'
    WHERE estado = 'pendiente'
      AND dia_id IN (
        SELECT d.id FROM tiempo.dia d
        WHERE d.persona_id = NEW.persona_id
          AND d.fecha BETWEEN NEW.fecha_inicio AND NEW.fecha_fin
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ausencia_resuelve_excepcion
  AFTER INSERT OR UPDATE OF estado_autorizacion ON tiempo.ausencia
  FOR EACH ROW
  EXECUTE FUNCTION tiempo.fn_ausencia_resuelve_excepcion();

COMMENT ON FUNCTION tiempo.fn_ausencia_resuelve_excepcion() IS
  'Si una ausencia se carga o se autoriza después de que ya se generó una excepcion por día sin '
  'checada, la resuelve sola — RH no tiene que cerrarla a mano. Sólo actúa cuando '
  'estado_autorizacion pasa a autorizada; pendiente/rechazada no tocan nada.';
