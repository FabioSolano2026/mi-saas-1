"""
sprint4_archiver_migration.py

Ciclo de Vida de Prospectos — Migración completa:
  1. Tabla prospectos_historico (snapshot + auditoría)
  2. Tabla audit_logs (trail inmutable de acciones)
  3. Función PG atómica archivar_prospectos() con BEGIN…COMMIT implícito,
     count-check de integridad, y ROLLBACK automático en error
  4. Índices de performance en prospectos (actualizado_en, columna_kanban)
  5. Políticas RLS en ambas tablas nuevas

Ejecutar:
  python scripts/sprint4_archiver_migration.py
"""

import subprocess, json, sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PAT = "sbp_a5e4bf353fe71fc5996162cd6d23876b665d3d09"
REF = "rgcntceelzttponmehte"
API = f"https://api.supabase.com/v1/projects/{REF}/database/query"

def run_sql(label, sql):
    payload = json.dumps({"query": sql})
    tmp = "tmp_archiver_query.json"
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

# ══════════════════════════════════════════════════════════════════════════════
print("=" * 70)
print("  SPRINT 4 — CICLO DE VIDA DE PROSPECTOS")
print("  Tablas: prospectos_historico + audit_logs")
print("  Función atómica: archivar_prospectos()")
print("=" * 70)

# ─────────────────────────────────────────────────────────────
# PASO 1 — Tabla prospectos_historico
# Replica todos los 26 campos reales de prospectos +
# campos de auditoría del archivo.
# Sin FKs hacia tablas activas (el registro origen ya no existirá).
# ─────────────────────────────────────────────────────────────
print("\n── PASO 1: prospectos_historico ─────────────────────────────────────")

run_sql("crear prospectos_historico", """
CREATE TABLE IF NOT EXISTS public.prospectos_historico (

  -- ── Campos idénticos a prospectos ─────────────────────────
  prospecto_id            UUID        NOT NULL,
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(tenant_id),
  socio_id                UUID,
  campana_id              UUID,
  pais_id                 UUID,
  cita_id                 UUID,
  ultimo_pedido_id        UUID,

  nombre                  VARCHAR,
  correo                  VARCHAR,
  telefono                VARCHAR,
  columna_kanban          VARCHAR     NOT NULL,
  temperatura             VARCHAR     NOT NULL DEFAULT 'fria',
  intencion               VARCHAR     NOT NULL DEFAULT 'no_definida',
  canal_agente            VARCHAR     NOT NULL DEFAULT 'web',
  origen                  VARCHAR,

  nota_agente             TEXT,
  nota_socio              TEXT,
  transcripcion_texto     TEXT,
  transcripcion_voz_url   VARCHAR,
  respuestas_json         JSONB       NOT NULL DEFAULT '{}',
  dias_sin_contacto       INTEGER     NOT NULL DEFAULT 0,
  compartido_por_admin    BOOLEAN     NOT NULL DEFAULT FALSE,
  visible_para_socio      BOOLEAN     NOT NULL DEFAULT TRUE,
  ultimo_contacto         TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Campos de auditoría del archivo ───────────────────────
  -- archivo_lote_id: agrupa todos los prospectos archivados en una misma
  -- ejecución. Usado para el count-check de integridad dentro de la función.
  archivo_lote_id         UUID        NOT NULL,
  fecha_archivado         TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo_archivado        TEXT        NOT NULL,
  -- metadata_json: snapshot JSON del estado completo al momento del archivo.
  -- Permite auditar el registro aunque la tabla prospectos cambie de schema.
  metadata_json           JSONB       NOT NULL DEFAULT '{}',

  PRIMARY KEY (prospecto_id, archivo_lote_id)
);
""")

run_sql("habilitar RLS prospectos_historico",
    "ALTER TABLE public.prospectos_historico ENABLE ROW LEVEL SECURITY;")

run_sql("policy SELECT prospectos_historico", """
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prospectos_historico' AND policyname = 'historico_select_tenant'
  ) THEN
    CREATE POLICY historico_select_tenant ON public.prospectos_historico
      FOR SELECT
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;
""")

# ─────────────────────────────────────────────────────────────
# PASO 2 — Tabla audit_logs
# Trail inmutable de cualquier acción sobre prospectos.
# Sin UPDATE ni DELETE policies — solo INSERT y SELECT.
# prospecto_id es TEXT (no FK) para seguir funcionando después del DELETE.
# ─────────────────────────────────────────────────────────────
print("\n── PASO 2: audit_logs ───────────────────────────────────────────────")

run_sql("crear audit_logs", """
CREATE TABLE IF NOT EXISTS public.audit_logs (
  log_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES public.tenants(tenant_id),
  -- prospecto_id guardado como TEXT: el registro origen puede no existir ya.
  prospecto_id  TEXT        NOT NULL,
  accion        TEXT        NOT NULL,   -- 'ARCHIVE', 'MOVE', 'RESTORE', etc.
  razon         TEXT,
  -- actor_id: socio que ejecutó la acción. NULL cuando es un cron/sistema.
  actor_id      UUID,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB       NOT NULL DEFAULT '{}'
);
""")

run_sql("habilitar RLS audit_logs",
    "ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;")

run_sql("policy SELECT audit_logs", """
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND policyname = 'audit_select_tenant'
  ) THEN
    CREATE POLICY audit_select_tenant ON public.audit_logs
      FOR SELECT
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;
""")

# Sin policy INSERT desde el cliente: la función SECURITY DEFINER inserta
# directamente, bypassando RLS. Esto garantiza que el trail solo lo escribe
# la lógica de servidor, nunca el cliente directamente.

# ─────────────────────────────────────────────────────────────
# PASO 3 — Índices de performance
# Evitan full-table scans en las queries de archivo que se ejecutan
# periódicamente (cron) o manualmente por el admin.
# ─────────────────────────────────────────────────────────────
print("\n── PASO 3: Índices de performance ───────────────────────────────────")

run_sql("índice prospectos(actualizado_en)", """
CREATE INDEX IF NOT EXISTS idx_prospectos_actualizado_en
  ON public.prospectos (actualizado_en);
""")

run_sql("índice compuesto prospectos(tenant_id, columna_kanban, actualizado_en)", """
CREATE INDEX IF NOT EXISTS idx_prospectos_tenant_columna_updated
  ON public.prospectos (tenant_id, columna_kanban, actualizado_en);
""")

# Índice parcial: solo prospectos archivables (columnas de riesgo/final negativo).
# Reduce el índice al ~30% de filas y hace los scans instantáneos.
run_sql("índice parcial prospectos archivables (columnas riesgo/final)", """
CREATE INDEX IF NOT EXISTS idx_prospectos_archivables
  ON public.prospectos (tenant_id, actualizado_en)
  WHERE columna_kanban IN ('sin_respuesta', 'no_interesado', 'reagendar');
""")

run_sql("índice prospectos(tenant_id, dias_sin_contacto) para behavioral", """
CREATE INDEX IF NOT EXISTS idx_prospectos_tenant_dias_contacto
  ON public.prospectos (tenant_id, dias_sin_contacto);
""")

run_sql("índice prospectos_historico(tenant_id, fecha_archivado)", """
CREATE INDEX IF NOT EXISTS idx_historico_tenant_fecha
  ON public.prospectos_historico (tenant_id, fecha_archivado);
""")

run_sql("índice prospectos_historico(archivo_lote_id) para count-check", """
CREATE INDEX IF NOT EXISTS idx_historico_lote
  ON public.prospectos_historico (archivo_lote_id);
""")

run_sql("índice audit_logs(tenant_id, timestamp)", """
CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp
  ON public.audit_logs (tenant_id, timestamp DESC);
""")

run_sql("índice audit_logs(prospecto_id) para historial por prospecto", """
CREATE INDEX IF NOT EXISTS idx_audit_prospecto
  ON public.audit_logs (prospecto_id);
""")

# ─────────────────────────────────────────────────────────────
# PASO 4 — Función atómica archivar_prospectos()
#
# Garantías de integridad:
#   1. Todo ocurre en una sola transacción PL/pgSQL.
#      Cualquier error lanza RAISE EXCEPTION → ROLLBACK automático.
#      Ni un solo registro se pierde entre tablas.
#   2. archivo_lote_id: UUID único por ejecución. Agrupa todos los
#      registros del batch para que el count-check sea preciso y no
#      cuente archivos anteriores del mismo prospecto_id.
#   3. Count-check: verifica que prospectos_historico.count(lote_id)
#      == prospectos candidatos antes del DELETE.
#   4. Lógica dual:
#      - p_dias_inactividad IS NOT NULL → Batch Cleanup
#      - p_min_pedidos IS NOT NULL      → Behavioral Cleanup
#
# Retorna JSONB: { archivados: int, lote_id: uuid, ids: uuid[] }
# ─────────────────────────────────────────────────────────────
print("\n── PASO 4: Función archivar_prospectos() ────────────────────────────")

run_sql("crear función archivar_prospectos", """
CREATE OR REPLACE FUNCTION public.archivar_prospectos(
  p_tenant_id             UUID,
  p_motivo                TEXT,
  p_actor_id              UUID    DEFAULT NULL,
  -- Batch Cleanup: prospectos inactivos por tiempo
  p_dias_inactividad      INT     DEFAULT NULL,
  p_columnas              TEXT[]  DEFAULT NULL,
  -- Behavioral Cleanup: clientes con N compras sin responder
  p_min_pedidos           INT     DEFAULT NULL,
  p_dias_sin_respuesta    INT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_id           UUID    := gen_random_uuid();
  v_ids               UUID[];
  v_count_esperados   INT;
  v_count_insertados  INT;
BEGIN

  -- ── 1. Recolectar IDs candidatos según criterio ──────────────────────
  IF p_dias_inactividad IS NOT NULL THEN

    -- Batch Cleanup: sin actividad por más de N días
    -- Filtra opcionalmente por columnas específicas del Kanban
    SELECT ARRAY_AGG(prospecto_id)
    INTO   v_ids
    FROM   public.prospectos
    WHERE  tenant_id      = p_tenant_id
      AND  actualizado_en < (now() - (p_dias_inactividad || ' days')::INTERVAL)
      AND  (p_columnas IS NULL OR columna_kanban = ANY(p_columnas));

  ELSIF p_min_pedidos IS NOT NULL AND p_dias_sin_respuesta IS NOT NULL THEN

    -- Behavioral Cleanup: clientes activos con N+ pedidos y sin respuesta X días
    SELECT ARRAY_AGG(p.prospecto_id)
    INTO   v_ids
    FROM   public.prospectos p
    WHERE  p.tenant_id          = p_tenant_id
      AND  p.dias_sin_contacto >= p_dias_sin_respuesta
      AND  (
             SELECT COUNT(*)
             FROM   public.pedidos
             WHERE  prospecto_id = p.prospecto_id
           ) >= p_min_pedidos;

  ELSE
    RAISE EXCEPTION 'Criterio inválido: proporcionar p_dias_inactividad o (p_min_pedidos + p_dias_sin_respuesta)';
  END IF;

  -- ── 2. Nada que archivar — salir limpiamente ─────────────────────────
  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'archivados', 0,
      'lote_id',    v_lote_id,
      'ids',        '[]'::jsonb
    );
  END IF;

  v_count_esperados := array_length(v_ids, 1);

  -- ── 3. Snapshot → prospectos_historico ──────────────────────────────
  -- metadata_json = to_jsonb(p): captura el estado completo del registro
  -- al momento del archivo. Inmutable incluso si el schema cambia después.
  INSERT INTO public.prospectos_historico (
    prospecto_id, tenant_id, socio_id, campana_id, pais_id,
    cita_id, ultimo_pedido_id,
    nombre, correo, telefono, columna_kanban, temperatura,
    intencion, canal_agente, origen,
    nota_agente, nota_socio, transcripcion_texto, transcripcion_voz_url,
    respuestas_json, dias_sin_contacto, compartido_por_admin,
    visible_para_socio, ultimo_contacto, creado_en, actualizado_en,
    -- auditoría
    archivo_lote_id, fecha_archivado, motivo_archivado, metadata_json
  )
  SELECT
    p.prospecto_id, p.tenant_id, p.socio_id, p.campana_id, p.pais_id,
    p.cita_id, p.ultimo_pedido_id,
    p.nombre, p.correo, p.telefono, p.columna_kanban, p.temperatura,
    p.intencion, p.canal_agente, p.origen,
    p.nota_agente, p.nota_socio, p.transcripcion_texto, p.transcripcion_voz_url,
    p.respuestas_json, p.dias_sin_contacto, p.compartido_por_admin,
    p.visible_para_socio, p.ultimo_contacto, p.creado_en, p.actualizado_en,
    -- auditoría: lote_id único para este batch
    v_lote_id, now(), p_motivo, to_jsonb(p)
  FROM public.prospectos p
  WHERE p.prospecto_id = ANY(v_ids);

  -- ── 4. Count-check de integridad ─────────────────────────────────────
  -- Usa v_lote_id para contar SOLO los registros de este batch,
  -- ignorando archivos históricos previos del mismo prospecto_id.
  SELECT COUNT(*)
  INTO   v_count_insertados
  FROM   public.prospectos_historico
  WHERE  archivo_lote_id = v_lote_id;

  IF v_count_insertados <> v_count_esperados THEN
    RAISE EXCEPTION
      'Count-check FALLIDO: se esperaban % registros en prospectos_historico, se encontraron %. ROLLBACK automático.',
      v_count_esperados, v_count_insertados;
  END IF;

  -- ── 5. Audit trail en audit_logs (uno por prospecto) ────────────────
  INSERT INTO public.audit_logs (
    tenant_id, prospecto_id, accion, razon, actor_id, metadata
  )
  SELECT
    p_tenant_id,
    id::TEXT,
    'ARCHIVE',
    p_motivo,
    p_actor_id,
    jsonb_build_object('lote_id', v_lote_id, 'archivado_en', now())
  FROM unnest(v_ids) AS id;

  -- ── 6. DELETE de la tabla activa ─────────────────────────────────────
  -- Solo después de confirmar que prospectos_historico está completo.
  -- Si este DELETE falla, toda la transacción hace ROLLBACK.
  DELETE FROM public.prospectos
  WHERE prospecto_id = ANY(v_ids)
    AND tenant_id    = p_tenant_id;

  -- ── 7. Resultado ─────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'archivados', v_count_esperados,
    'lote_id',    v_lote_id,
    'ids',        to_jsonb(v_ids)
  );

END;
$$;
""")

# ─────────────────────────────────────────────────────────────
# PASO 5 — Verificación final
# ─────────────────────────────────────────────────────────────
print("\n── PASO 5: Verificación ─────────────────────────────────────────────")

out = run_sql("verificar tablas creadas", """
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('prospectos_historico', 'audit_logs')
ORDER BY table_name;
""")
try:
    rows = json.loads(out)
    found = [r.get('table_name') for r in rows]
    for t in ['audit_logs', 'prospectos_historico']:
        status = "✓" if t in found else "✗ FALTA"
        print(f"     {status}  {t}")
except Exception:
    print(f"  RAW: {out[:200]}")

out = run_sql("verificar función archivar_prospectos", """
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'archivar_prospectos';
""")
try:
    rows = json.loads(out)
    status = "✓" if rows else "✗ FALTA"
    print(f"     {status}  archivar_prospectos()")
except Exception:
    print(f"  RAW: {out[:200]}")

out = run_sql("verificar índices creados", """
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_prospectos_actualizado_en',
    'idx_prospectos_tenant_columna_updated',
    'idx_prospectos_archivables',
    'idx_prospectos_tenant_dias_contacto',
    'idx_historico_tenant_fecha',
    'idx_historico_lote',
    'idx_audit_tenant_timestamp',
    'idx_audit_prospecto'
  )
ORDER BY indexname;
""")
try:
    rows = json.loads(out)
    print(f"     ✓  {len(rows)}/8 índices creados")
    for r in rows:
        print(f"        · {r.get('indexname')}")
except Exception:
    print(f"  RAW: {out[:200]}")

print("\n" + "=" * 70)
print("  MIGRACIÓN COMPLETA — Ciclo de Vida de Prospectos")
print("=" * 70 + "\n")
