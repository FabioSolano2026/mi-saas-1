-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: es_auditor → rol  (admin / auditor / socio)
-- Sprint 12 · 2026-04-11
-- ═══════════════════════════════════════════════════════════════════

-- ─── PASO 4: Reescribir políticas que usaban es_auditor ──────────────

-- audios_socio
DROP POLICY IF EXISTS as_auditor_read   ON audios_socio;
DROP POLICY IF EXISTS as_auditor_update ON audios_socio;

CREATE POLICY as_auditor_read ON audios_socio FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND public.es_auditor_o_admin()
  );

CREATE POLICY as_auditor_update ON audios_socio FOR UPDATE
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND public.es_auditor_o_admin()
  );

-- interacciones_leads
DROP POLICY IF EXISTS il_auditor_read_all ON interacciones_leads;

CREATE POLICY il_auditor_read_all ON interacciones_leads FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND public.es_auditor_o_admin()
  );

-- interacciones_privado
DROP POLICY IF EXISTS iprivado_auditor_only ON interacciones_privado;

CREATE POLICY iprivado_auditor_only ON interacciones_privado FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interacciones_leads il
      WHERE il.id = interacciones_privado.interaccion_id
        AND il.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
    AND public.es_auditor_o_admin()
  );

-- scripts_maestros
DROP POLICY IF EXISTS sm_auditor_read  ON scripts_maestros;
DROP POLICY IF EXISTS sm_auditor_write ON scripts_maestros;

CREATE POLICY sm_auditor_read ON scripts_maestros FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND public.es_auditor_o_admin()
  );

CREATE POLICY sm_auditor_write ON scripts_maestros FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND public.es_auditor_o_admin()
  );

-- perfiles_socio
DROP POLICY IF EXISTS ps_auditor_validate ON perfiles_socio;

CREATE POLICY ps_auditor_validate ON perfiles_socio FOR UPDATE
  USING (public.es_auditor_o_admin());

-- notificaciones_leads
DROP POLICY IF EXISTS nl_auditor_read ON notificaciones_leads;

CREATE POLICY nl_auditor_read ON notificaciones_leads FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    AND public.es_auditor_o_admin()
  );

-- ─── PASO 5: Políticas de bypass admin (cross-tenant) ────────────────

-- socios: admin ve todos los socios sin filtro de tenant
DROP POLICY IF EXISTS socios_admin_select ON socios;
CREATE POLICY socios_admin_select ON socios FOR SELECT
  USING (public.es_admin());

-- socios: admin puede modificar cualquier socio
DROP POLICY IF EXISTS socios_admin_write ON socios;
CREATE POLICY socios_admin_write ON socios FOR ALL
  USING (public.es_admin());

-- prospectos: admin ve todos cross-tenant
DROP POLICY IF EXISTS prospectos_admin_select ON prospectos;
CREATE POLICY prospectos_admin_select ON prospectos FOR SELECT
  USING (public.es_admin());

-- prospectos: admin puede actualizar bajo cualquier tenant
DROP POLICY IF EXISTS prospectos_admin_write ON prospectos;
CREATE POLICY prospectos_admin_write ON prospectos FOR UPDATE
  USING (public.es_admin());

-- campanas: admin ve todas
DROP POLICY IF EXISTS campanas_admin_select ON campanas;
CREATE POLICY campanas_admin_select ON campanas FOR SELECT
  USING (public.es_admin());

-- tenants: admin puede gestionar todos
DROP POLICY IF EXISTS tenants_admin_all ON tenants;
CREATE POLICY tenants_admin_all ON tenants FOR ALL
  USING (public.es_admin());

-- interacciones_leads: admin ve todo (ya cubierto por es_auditor_o_admin)
-- interacciones_privado: ya cubierto arriba

-- ─── PASO 6: Actualizar función recalcular_score ─────────────────────
CREATE OR REPLACE FUNCTION recalcular_score(p_interaccion_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  IF auth.role() NOT IN ('service_role') THEN
    IF NOT public.es_auditor_o_admin() THEN
      RAISE EXCEPTION 'auth_required';
    END IF;
  END IF;

  UPDATE interacciones_privado
  SET transcripcion = transcripcion
  WHERE interaccion_id = p_interaccion_id
  RETURNING score_cumplimiento INTO v_score;

  RETURN v_score;
END;
$$;

-- ─── PASO 7: Actualizar custom_access_token_hook (embebe rol en JWT) ──
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_rol       text;
  claims      jsonb;
BEGIN
  SELECT tenant_id, rol
    INTO v_tenant_id, v_rol
    FROM public.socios
   WHERE usuario_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id));
  END IF;

  IF v_rol IS NOT NULL THEN
    claims := jsonb_set(claims, '{rol}', to_jsonb(v_rol));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- ─── PASO 8: Vista de auditoría Kanban ───────────────────────────────
-- security_invoker = true → la vista respeta el RLS del usuario que la consulta
-- Admin llama → ve todo; socio llama → solo sus prospectos visibles
CREATE OR REPLACE VIEW vista_auditoria_kanban
WITH (security_invoker = true)
AS
SELECT
  p.prospecto_id,
  p.nombre                AS prospecto_nombre,
  p.telefono              AS prospecto_telefono,
  p.correo                AS prospecto_correo,
  p.columna_kanban,
  p.estado_temperatura,
  p.temperatura,
  p.intencion,
  p.ultimo_contacto,
  p.dias_sin_contacto,
  p.creado_en,
  p.actualizado_en,
  p.tenant_id,
  s.nombre_completo       AS socio_nombre,
  s.correo                AS socio_correo,
  s.rol                   AS socio_rol,
  c.nombre                AS campana_nombre,
  c.tipo                  AS campana_tipo,
  c.campana_id
FROM prospectos p
JOIN   socios  s ON s.usuario_id = p.socio_id
LEFT JOIN campanas c ON c.campana_id = p.campana_id;

-- ─── PASO 9: DROP es_auditor (limpieza final) ─────────────────────────
ALTER TABLE socios DROP COLUMN IF EXISTS es_auditor;

-- ─── VERIFICACIÓN ─────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'socios'
  AND column_name  IN ('rol', 'es_auditor')
ORDER BY column_name;
