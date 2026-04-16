-- ═══════════════════════════════════════════════════════════════════
-- Motor de Auditoría de Interacciones — Sprint 6
-- ═══════════════════════════════════════════════════════════════════

-- 1. Columna es_auditor en socios
ALTER TABLE socios ADD COLUMN IF NOT EXISTS es_auditor BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Tabla pública de interacciones (visible a socios con restricciones)
CREATE TABLE IF NOT EXISTS interacciones_leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id    UUID NOT NULL REFERENCES prospectos(prospecto_id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  campana_id      UUID REFERENCES campanas(campana_id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('texto', 'voz')),
  contenido       TEXT,
  emisor          TEXT NOT NULL CHECK (emisor IN ('agente', 'socio', 'lead')),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_il_prospecto    ON interacciones_leads(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_il_tenant       ON interacciones_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_il_tipo_emisor  ON interacciones_leads(tipo, emisor);
CREATE INDEX IF NOT EXISTS idx_il_creado_en    ON interacciones_leads(creado_en DESC);

-- 3. Tabla privada: audio + transcripción (propiedad intelectual — acceso restringido)
CREATE TABLE IF NOT EXISTS interacciones_privado (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaccion_id       UUID NOT NULL REFERENCES interacciones_leads(id) ON DELETE CASCADE,
  audio_url            TEXT,
  transcripcion        TEXT,
  score_cumplimiento   NUMERIC(5,2),
  score_detalle_json   JSONB,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_iprivado_interaccion ON interacciones_privado(interaccion_id);

-- 4. Scripts Maestros por tenant (referencia de cumplimiento)
CREATE TABLE IF NOT EXISTS scripts_maestros (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  nombre       TEXT NOT NULL,
  -- secciones: [{clave, descripcion, peso}]
  -- Ejemplo: [{"clave":"saludo","descripcion":"Saludo personalizado con nombre","peso":15}]
  secciones    JSONB NOT NULL DEFAULT '[]',
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sm_tenant_activo ON scripts_maestros(tenant_id, activo);
