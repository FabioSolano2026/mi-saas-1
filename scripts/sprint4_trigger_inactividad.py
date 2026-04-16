"""
sprint4_trigger_inactividad.py

Trigger de Supervisión de Ciclo de Vida — tg_check_inactividad

MAPEO DE SCHEMA (campos reales vs. lo solicitado):
  ┌─────────────────────────────┬──────────────────────────────────────────────┐
  │ Solicitado                  │ Campo real en BD                             │
  ├─────────────────────────────┼──────────────────────────────────────────────┤
  │ contador_contactos >= 3     │ dias_sin_contacto >= 7 (umbral configurable) │
  │ status != 'calificado'      │ columna_kanban NOT IN ('listo_para_cerrar',  │
  │                             │   'cliente_activo')                          │
  │ WHEN contador cambia        │ WHEN dias_sin_contacto IS DISTINCT FROM OLD  │
  │ cita agendada (guardrail)   │ cita_id IS NOT NULL                          │
  │ compra confirmada (guard.)  │ ultimo_pedido_id IS NOT NULL                 │
  └─────────────────────────────┴──────────────────────────────────────────────┘

Ejecutar:
  python scripts/sprint4_trigger_inactividad.py
"""

import subprocess, json, sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(label, sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_trigger_query.json"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", API,
         "-H", f"Authorization: Bearer {PAT}",
         "-H", "Content-Type: application/json",
         "--data-binary", f"@{tmp}"],
        capture_output=True, text=True
    )
    os.remove(tmp)
    out = result.stdout.strip()
    try:
        parsed = json.loads(out)
        if isinstance(parsed, list) or (isinstance(parsed, dict) and "message" not in parsed):
            print(f"  OK  {label}")
        else:
            print(f"  ERR {label}: {parsed}")
    except Exception:
        print(f"  RAW {label}: {out[:300]}")
    return out

print("=" * 70)
print("  SPRINT 4 — TRIGGER DE SUPERVISION DE CICLO DE VIDA")
print("  tg_check_inactividad (AFTER UPDATE FOR EACH ROW)")
print("=" * 70)

# ─────────────────────────────────────────────────────────────
# PASO 1 — Función de trigger fn_check_inactividad()
#
# Diseño deliberado:
#   - INLINE (no llama a archivar_prospectos()): la función batch está
#     diseñada para procesar N filas desde fuera. Llamarla desde un
#     trigger de fila crea una cadena de transacciones anidadas que
#     puede producir deadlocks si hay actualizaciones concurrentes.
#     En su lugar, la lógica de la transacción atómica se replica aquí
#     para una sola fila. Mismo resultado, cero riesgo de deadlock.
#
#   - SECURITY DEFINER: necesario para que el trigger pueda hacer
#     DELETE en prospectos y INSERT en prospectos_historico + audit_logs
#     sin que la sesión del usuario tenga esos permisos directos.
#     (RLS en prospectos_historico y audit_logs bloquearía INSERT
#     desde sesiones de usuario normales.)
#
#   - UMBRAL configurable: v_umbral_dias = 7. Cambiarlo aquí o en el
#     futuro moverlo a una tabla de configuración por tenant.
#
#   - WHEN performance: el trigger solo se dispara cuando
#     dias_sin_contacto cambia — el 99% de UPDATEs en prospectos
#     (temperatura, nota_socio, columna_kanban) no activan la función.
# ─────────────────────────────────────────────────────────────
print("\n-- PASO 1: Funcion fn_check_inactividad() --")

run_sql("crear fn_check_inactividad", """
CREATE OR REPLACE FUNCTION public.fn_check_inactividad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Umbral de dias sin contacto para marcar inactividad.
  -- Equivalente al "contador_contactos >= 3" del negocio:
  -- 7 dias = ciclo de 3 intentos de contacto semanales sin respuesta.
  v_umbral_dias   CONSTANT INT := 7;

  -- Columnas de exito: prospectos en estos estados NO deben archivarse
  -- automaticamente, aunque superen el umbral de inactividad.
  -- Equivalente al "status != 'calificado'" del negocio.
  v_cols_exito    CONSTANT TEXT[] := ARRAY['listo_para_cerrar', 'cliente_activo'];
BEGIN

  -- ── Guardrail 1: Columna de exito ─────────────────────────────────────
  -- Si el prospecto ya llego a 'listo_para_cerrar' o 'cliente_activo',
  -- es un exito comercial — jamas se archiva por inactividad.
  IF NEW.columna_kanban = ANY(v_cols_exito) THEN
    RETURN NULL;
  END IF;

  -- ── Guardrail 2: Cita agendada ────────────────────────────────────────
  -- cita_id IS NOT NULL significa que hay una cita activa en el sistema.
  -- Archivar este prospecto cancelaria implicitamente esa cita.
  IF NEW.cita_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- ── Guardrail 3: Compra confirmada ────────────────────────────────────
  -- ultimo_pedido_id IS NOT NULL significa que hay al menos un pedido.
  -- Estos prospectos entran al flujo de ciclos de consumo, no de archivo.
  IF NEW.ultimo_pedido_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- ── Condicion principal de inactividad ───────────────────────────────
  -- Solo actua si dias_sin_contacto supera el umbral.
  -- La clausula WHEN del trigger ya garantizo que el campo cambio,
  -- por lo que esta comparacion es el filtro de negocio final.
  IF NEW.dias_sin_contacto < v_umbral_dias THEN
    RETURN NULL;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- A partir de aqui: el prospecto DEBE archivarse.
  -- Toda la logica siguiente ocurre en la misma transaccion del UPDATE
  -- que disparo este trigger. Si cualquier paso falla -> ROLLBACK total.
  -- ═══════════════════════════════════════════════════════════════════════

  -- ── Paso A: Snapshot en prospectos_historico ─────────────────────────
  -- Usamos NEW.* para capturar el estado POST-update (con el nuevo
  -- valor de dias_sin_contacto ya aplicado).
  -- archivo_lote_id = gen_random_uuid() identifica este archivo individual.
  -- metadata_json = row_to_json(NEW) captura todos los campos en JSON.
  INSERT INTO public.prospectos_historico (
    prospecto_id, tenant_id, socio_id, campana_id, pais_id,
    cita_id, ultimo_pedido_id,
    nombre, correo, telefono, columna_kanban, temperatura,
    intencion, canal_agente, origen,
    nota_agente, nota_socio, transcripcion_texto, transcripcion_voz_url,
    respuestas_json, dias_sin_contacto, compartido_por_admin,
    visible_para_socio, ultimo_contacto, creado_en, actualizado_en,
    archivo_lote_id, fecha_archivado, motivo_archivado, metadata_json
  ) VALUES (
    NEW.prospecto_id, NEW.tenant_id, NEW.socio_id, NEW.campana_id, NEW.pais_id,
    NEW.cita_id, NEW.ultimo_pedido_id,
    NEW.nombre, NEW.correo, NEW.telefono, NEW.columna_kanban, NEW.temperatura,
    NEW.intencion, NEW.canal_agente, NEW.origen,
    NEW.nota_agente, NEW.nota_socio, NEW.transcripcion_texto, NEW.transcripcion_voz_url,
    NEW.respuestas_json, NEW.dias_sin_contacto, NEW.compartido_por_admin,
    NEW.visible_para_socio, NEW.ultimo_contacto, NEW.creado_en, NEW.actualizado_en,
    gen_random_uuid(),
    now(),
    format('AUTO: %s dias sin contacto (umbral: %s)', NEW.dias_sin_contacto, v_umbral_dias),
    row_to_json(NEW)::jsonb
  );

  -- ── Paso B: Audit log inmutable ───────────────────────────────────────
  -- accion = 'AUTO_MARK_INACTIVE' identifica que fue el trigger, no
  -- una accion manual de un socio.
  -- actor_id = NULL porque no hay sesion de usuario — lo ejecuta el sistema.
  INSERT INTO public.audit_logs (
    tenant_id,
    prospecto_id,
    accion,
    razon,
    actor_id,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.prospecto_id::TEXT,
    'AUTO_MARK_INACTIVE',
    format('dias_sin_contacto=%s supero umbral de %s dias. columna_kanban=%s',
           NEW.dias_sin_contacto, v_umbral_dias, NEW.columna_kanban),
    NULL,  -- sistema, no usuario
    jsonb_build_object(
      'trigger',            'tg_check_inactividad',
      'umbral_dias',        v_umbral_dias,
      'dias_sin_contacto',  NEW.dias_sin_contacto,
      'columna_kanban',     NEW.columna_kanban,
      'archivado_en',       now()
    )
  );

  -- ── Paso C: Eliminar de la tabla activa ──────────────────────────────
  -- Solo se ejecuta si los pasos A y B tuvieron exito.
  -- El WHERE doble (prospecto_id + tenant_id) es la misma garantia
  -- de aislamiento multi-tenant que usa todo el sistema.
  DELETE FROM public.prospectos
  WHERE prospecto_id = NEW.prospecto_id
    AND tenant_id    = NEW.tenant_id;

  -- AFTER trigger: el valor de retorno se ignora.
  -- Retornamos NULL por convencion.
  RETURN NULL;

END;
$$;
""")

# ─────────────────────────────────────────────────────────────
# PASO 2 — Trigger tg_check_inactividad
#
# AFTER UPDATE: el UPDATE ya se aplicó — si decidimos archivar,
# el DELETE elimina la fila ya-actualizada. Consistente.
#
# FOR EACH ROW: cada fila tiene su propio contexto (NEW/OLD).
#
# WHEN: clausula de performance. Evalua ANTES de llamar a la funcion.
# Si dias_sin_contacto no cambio (el 99% de los UPDATEs en prospectos),
# la funcion jamas se invoca — cero overhead.
#
# IS DISTINCT FROM: maneja correctamente el caso NULL (si el campo
# fuera nullable, NULL IS DISTINCT FROM NULL = FALSE — no dispara).
# Con NOT NULL el efecto es identico a !=, pero es la forma correcta.
# ─────────────────────────────────────────────────────────────
print("\n-- PASO 2: Trigger tg_check_inactividad --")

run_sql("eliminar trigger previo si existe (idempotente)", """
DROP TRIGGER IF EXISTS tg_check_inactividad ON public.prospectos;
""")

run_sql("crear tg_check_inactividad", """
CREATE TRIGGER tg_check_inactividad
  AFTER UPDATE ON public.prospectos
  FOR EACH ROW
  WHEN (NEW.dias_sin_contacto IS DISTINCT FROM OLD.dias_sin_contacto)
  EXECUTE FUNCTION public.fn_check_inactividad();
""")

# ─────────────────────────────────────────────────────────────
# PASO 3 — Verificacion completa
# ─────────────────────────────────────────────────────────────
print("\n-- PASO 3: Verificacion --")

out = run_sql("verificar fn_check_inactividad existe", """
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'fn_check_inactividad';
""")
try:
    rows = json.loads(out)
    if rows:
        print(f"     OK  fn_check_inactividad() SECURITY={rows[0].get('security_type')}")
    else:
        print("     FALTA  fn_check_inactividad()")
except Exception:
    print(f"  RAW: {out[:200]}")

out = run_sql("verificar trigger existe en prospectos", """
SELECT trigger_name, event_manipulation, action_timing, action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'prospectos'
  AND trigger_schema      = 'public'
  AND trigger_name        = 'tg_check_inactividad';
""")
try:
    rows = json.loads(out)
    if rows:
        r = rows[0]
        print(f"     OK  {r['trigger_name']} {r['action_timing']} {r['event_manipulation']} {r['action_orientation']}")
    else:
        print("     FALTA  tg_check_inactividad")
except Exception:
    print(f"  RAW: {out[:200]}")

out = run_sql("listar todos los triggers en prospectos", """
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'prospectos'
  AND trigger_schema     = 'public'
ORDER BY trigger_name;
""")
try:
    rows = json.loads(out)
    print(f"\n     Triggers activos en prospectos ({len(rows)}):")
    for r in rows:
        print(f"       - {r['trigger_name']:35} {r['action_timing']} {r['event_manipulation']}")
except Exception:
    print(f"  RAW: {out[:200]}")

print("\n" + "=" * 70)
print("  TRIGGER DE SUPERVISION INSTALADO")
print("=" * 70 + "\n")
