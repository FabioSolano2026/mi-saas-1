-- ═══════════════════════════════════════════════════════════════════
-- Scoring automático vs Script Maestro + trigger
-- ═══════════════════════════════════════════════════════════════════

-- Función principal de scoring
-- Recibe la fila NEW de interacciones_privado como parámetro implícito (trigger)
CREATE OR REPLACE FUNCTION fn_score_interaccion()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id         UUID;
  v_script_secciones  JSONB;
  v_score             NUMERIC := 0;
  v_total_peso        NUMERIC := 0;
  v_encontradas       JSONB   := '[]';
  v_seccion           JSONB;
  v_peso              NUMERIC;
  v_clave             TEXT;
  v_ok                BOOLEAN;
BEGIN
  -- Solo procesar si hay transcripción con contenido
  IF NEW.transcripcion IS NULL OR length(trim(NEW.transcripcion)) < 10 THEN
    RETURN NEW;
  END IF;

  -- Obtener tenant_id de la interacción padre
  SELECT il.tenant_id INTO v_tenant_id
  FROM interacciones_leads il
  WHERE il.id = NEW.interaccion_id;

  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener script activo del tenant
  SELECT secciones INTO v_script_secciones
  FROM scripts_maestros
  WHERE tenant_id = v_tenant_id AND activo = TRUE
  ORDER BY creado_en DESC
  LIMIT 1;

  IF v_script_secciones IS NULL OR jsonb_array_length(v_script_secciones) = 0 THEN
    RETURN NEW;
  END IF;

  -- Evaluar cada sección del script (búsqueda insensible a mayúsculas)
  FOR v_seccion IN SELECT * FROM jsonb_array_elements(v_script_secciones) LOOP
    v_clave := lower(trim(v_seccion->>'clave'));
    v_peso  := COALESCE((v_seccion->>'peso')::NUMERIC, 10);
    v_ok    := lower(NEW.transcripcion) ILIKE '%' || v_clave || '%';

    v_total_peso := v_total_peso + v_peso;
    IF v_ok THEN
      v_score := v_score + v_peso;
      v_encontradas := v_encontradas || jsonb_build_object(
        'clave', v_seccion->>'clave',
        'peso', v_peso,
        'ok', TRUE
      );
    ELSE
      v_encontradas := v_encontradas || jsonb_build_object(
        'clave', v_seccion->>'clave',
        'peso', v_peso,
        'ok', FALSE
      );
    END IF;
  END LOOP;

  IF v_total_peso > 0 THEN
    NEW.score_cumplimiento := ROUND((v_score / v_total_peso) * 100, 2);
    NEW.score_detalle_json := jsonb_build_object(
      'score',        NEW.score_cumplimiento,
      'secciones',    v_encontradas,
      'calculado_en', NOW()
    );
  END IF;

  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: dispara en INSERT o cuando se actualiza la transcripción
DROP TRIGGER IF EXISTS tr_score_interaccion ON interacciones_privado;
CREATE TRIGGER tr_score_interaccion
  BEFORE INSERT OR UPDATE OF transcripcion
  ON interacciones_privado
  FOR EACH ROW
  EXECUTE FUNCTION fn_score_interaccion();

-- ─── Vista de auditoría semanal ───────────────────────────────────
-- Agrega scores por tenant/semana para el reporte de auditoría
CREATE OR REPLACE VIEW v_auditoria_semanal AS
SELECT
  il.tenant_id,
  il.campana_id,
  date_trunc('week', il.creado_en)::date                          AS semana,
  count(*)                                                         AS total_interacciones,
  count(*) FILTER (WHERE ip.score_cumplimiento IS NOT NULL)        AS con_score,
  round(avg(ip.score_cumplimiento)::numeric, 2)                   AS score_promedio,
  round(min(ip.score_cumplimiento)::numeric, 2)                   AS score_minimo,
  round(max(ip.score_cumplimiento)::numeric, 2)                   AS score_maximo,
  count(*) FILTER (WHERE ip.score_cumplimiento >= 80)             AS interacciones_ok,
  count(*) FILTER (WHERE ip.score_cumplimiento < 60
                    AND ip.score_cumplimiento IS NOT NULL)         AS interacciones_criticas
FROM interacciones_leads il
LEFT JOIN interacciones_privado ip ON ip.interaccion_id = il.id
WHERE il.emisor = 'agente'
GROUP BY 1, 2, 3;

-- ─── RPC pública: recalcular score de una interacción ────────────
CREATE OR REPLACE FUNCTION recalcular_score(p_interaccion_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  -- Solo auditores o service_role
  IF auth.role() NOT IN ('service_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM socios WHERE usuario_id = auth.uid() AND es_auditor = TRUE
    ) THEN
      RAISE EXCEPTION 'auth_required';
    END IF;
  END IF;

  -- Forzar re-trigger actualizando la transcripcion
  UPDATE interacciones_privado
  SET transcripcion = transcripcion
  WHERE interaccion_id = p_interaccion_id
  RETURNING score_cumplimiento INTO v_score;

  RETURN v_score;
END;
$$;
