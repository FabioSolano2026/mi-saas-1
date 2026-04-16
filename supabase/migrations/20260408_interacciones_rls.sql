-- ═══════════════════════════════════════════════════════════════════
-- RLS: Motor de Auditoría — acceso en capas
-- ═══════════════════════════════════════════════════════════════════

-- ─── interacciones_leads ──────────────────────────────────────────
ALTER TABLE interacciones_leads ENABLE ROW LEVEL SECURITY;

-- Socios: solo tipo='texto' de sus propios prospectos
CREATE POLICY "il_socio_read_texto"
  ON interacciones_leads FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND tipo = 'texto'
    AND prospecto_id IN (
      SELECT prospecto_id FROM prospectos
      WHERE socio_id = auth.uid()
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Auditores: todo el tenant (texto + metadata de voz, sin datos privados)
CREATE POLICY "il_auditor_read_all"
  ON interacciones_leads FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM socios
      WHERE usuario_id = auth.uid()
        AND es_auditor = TRUE
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- ─── interacciones_privado ────────────────────────────────────────
-- SOLO auditores explícitos. Los socios sin permiso NUNCA ven audio ni transcripción.
ALTER TABLE interacciones_privado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iprivado_auditor_only"
  ON interacciones_privado FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM socios s
      JOIN interacciones_leads il ON il.id = interacciones_privado.interaccion_id
      WHERE s.usuario_id = auth.uid()
        AND s.es_auditor = TRUE
        AND s.tenant_id = il.tenant_id
    )
  );

-- ─── scripts_maestros ─────────────────────────────────────────────
ALTER TABLE scripts_maestros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm_auditor_read"
  ON scripts_maestros FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM socios
      WHERE usuario_id = auth.uid()
        AND es_auditor = TRUE
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY "sm_auditor_write"
  ON scripts_maestros FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM socios
      WHERE usuario_id = auth.uid()
        AND es_auditor = TRUE
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
