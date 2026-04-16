-- Campos de validación en perfiles_socio
ALTER TABLE perfiles_socio
  ADD COLUMN IF NOT EXISTS voz_aprobada    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avatar_aprobado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS validado_por    UUID,
  ADD COLUMN IF NOT EXISTS validado_en     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nota_validacion TEXT;

-- Tabla de frases maestras / audios del socio
CREATE TABLE IF NOT EXISTS audios_socio (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id       UUID NOT NULL REFERENCES socios(usuario_id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL,
  clave          TEXT NOT NULL,
  guion          TEXT NOT NULL,
  audio_url      TEXT,
  estado         TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'validado', 'rechazado')),
  validado_por   UUID,
  validado_en    TIMESTAMPTZ,
  nota_admin     TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(socio_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_as_socio  ON audios_socio(socio_id);
CREATE INDEX IF NOT EXISTS idx_as_estado ON audios_socio(socio_id, estado);

ALTER TABLE audios_socio ENABLE ROW LEVEL SECURITY;

CREATE POLICY as_socio_own
  ON audios_socio FOR ALL
  USING (socio_id = auth.uid());

CREATE POLICY as_auditor_read
  ON audios_socio FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM socios
      WHERE usuario_id = auth.uid() AND es_auditor = TRUE
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY as_auditor_update
  ON audios_socio FOR UPDATE
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM socios
      WHERE usuario_id = auth.uid() AND es_auditor = TRUE
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Política para que auditores puedan validar perfiles de identidad
CREATE POLICY ps_auditor_validate
  ON perfiles_socio FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM socios
      WHERE usuario_id = auth.uid() AND es_auditor = TRUE
    )
  );
