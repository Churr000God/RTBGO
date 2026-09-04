-- 27_puesto_permiso_mapeo_inicial.sql
-- Mapeo real de permisos, confirmado con el usuario, sobre los puestos REALES ya sembrados del
-- organigrama (RH = "Responsable de Recursos Humanos", TI = "Encargado de TI", Dirección =
-- "Gerente General"). Distinto del bootstrap genérico de 26_*.sql — este archivo asume el seed de
-- organigrama (11/13/15/16) ya aplicado.
--
-- Heredables: RH y TI otorgados directo; Dirección los recibe automático por herencia
-- (reporta_a_id apunta a Gerente General) salvo ver_modulo_1/ver_modulo_2, que se otorgan
-- explícito a los tres. No heredables: mismo patrón en Área/Departamento/Puesto/Permiso (RH
-- lectura, TI edición, Dirección lectura). Puesto_permiso y Asignación: los tres en edición,
-- lectura de ninguno se otorga por ahora (la edición ya cubre el caso de uso). 28 filas en total.
--
-- 28 INSERT en bitacora_movimiento_puesto_permiso (tipo_movimiento='otorgado'), resolviendo
-- puesto_id por nombre_puesto vía subconsulta, mismo patrón que 16_puesto_migracion_inicial.sql.
-- WHERE NOT EXISTS por fila para que reejecutar el archivo sea inocuo.
-- Depende de: 16_puesto_migracion_inicial.sql, 24_puesto_permiso_trigger.sql,
--   25_permiso_migracion_inicial.sql

INSERT INTO personas.bitacora_movimiento_puesto_permiso (puesto_id, codigo, tipo_movimiento)
SELECT p.id, m.codigo, 'otorgado'
FROM (VALUES
  -- Heredables: RH y TI otorgados directo.
  ('Responsable de Recursos Humanos', 'alta_personas_usuarios'),
  ('Encargado de TI',                 'alta_personas_usuarios'),
  ('Responsable de Recursos Humanos', 'cambio_estado_persona'),
  ('Encargado de TI',                 'cambio_estado_persona'),
  -- ver_modulo_1/ver_modulo_2: explícitos también en Dirección (no dependen de herencia acá).
  ('Responsable de Recursos Humanos', 'ver_modulo_1'),
  ('Encargado de TI',                 'ver_modulo_1'),
  ('Gerente General',                 'ver_modulo_1'),
  ('Responsable de Recursos Humanos', 'ver_modulo_2'),
  ('Encargado de TI',                 'ver_modulo_2'),
  ('Gerente General',                 'ver_modulo_2'),
  -- No heredables: RH lectura, TI edición, Dirección lectura, mismo patrón en los cuatro.
  ('Responsable de Recursos Humanos', 'area_lectura'),
  ('Encargado de TI',                 'area_edicion'),
  ('Gerente General',                 'area_lectura'),
  ('Responsable de Recursos Humanos', 'departamento_lectura'),
  ('Encargado de TI',                 'departamento_edicion'),
  ('Gerente General',                 'departamento_lectura'),
  ('Responsable de Recursos Humanos', 'puesto_lectura'),
  ('Encargado de TI',                 'puesto_edicion'),
  ('Gerente General',                 'puesto_lectura'),
  ('Responsable de Recursos Humanos', 'permiso_lectura'),
  ('Encargado de TI',                 'permiso_edicion'),
  ('Gerente General',                 'permiso_lectura'),
  -- Puesto_permiso y Asignación: los tres en edición.
  ('Responsable de Recursos Humanos', 'puesto_permiso_edicion'),
  ('Encargado de TI',                 'puesto_permiso_edicion'),
  ('Gerente General',                 'puesto_permiso_edicion'),
  ('Responsable de Recursos Humanos', 'asignacion_edicion'),
  ('Encargado de TI',                 'asignacion_edicion'),
  ('Gerente General',                 'asignacion_edicion')
) AS m(nombre_puesto, codigo)
JOIN personas.puesto p ON p.nombre_puesto = m.nombre_puesto
WHERE NOT EXISTS (
  SELECT 1 FROM personas.puesto_permiso pp
  WHERE pp.puesto_id = p.id AND pp.codigo = m.codigo AND pp.activo
);
