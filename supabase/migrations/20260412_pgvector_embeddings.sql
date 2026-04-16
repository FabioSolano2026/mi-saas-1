-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4 — Búsqueda semántica (pgvector) para KBs e ingredientes
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extensión pgvector (disponible en Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Columnas de embedding (1536 dims = text-embedding-3-small)
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS embedding        vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_texto  text;

ALTER TABLE ingredientes
  ADD COLUMN IF NOT EXISTS embedding        vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_texto  text;

-- 3. Índices HNSW para cosine similarity (rápido en búsquedas)
CREATE INDEX IF NOT EXISTS idx_kb_embedding_hnsw
  ON knowledge_bases USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_ingredientes_embedding_hnsw
  ON ingredientes USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. RPC: Buscar KBs relevantes por similitud coseno
DROP FUNCTION IF EXISTS match_knowledge_base(vector,double precision,integer,uuid);

CREATE FUNCTION match_knowledge_base(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.5,
  match_count      int     DEFAULT 3,
  p_tenant_id      uuid    DEFAULT NULL
)
RETURNS TABLE (
  kb_id                   uuid,
  condicion               text,
  tipo_kb                 text,
  sintomas_json           jsonb,
  preguntas_json          jsonb,
  objeciones_json         jsonb,
  protocolo_derivacion    text,
  similarity              float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.kb_id,
    b.condicion::text,
    b.tipo_kb::text,
    b.sintomas_json::jsonb,
    b.preguntas_json::jsonb,
    b.objeciones_json::jsonb,
    b.protocolo_derivacion::text,
    (1 - (b.embedding <=> query_embedding))::float AS similarity
  FROM knowledge_bases b
  WHERE
    b.embedding IS NOT NULL
    AND (p_tenant_id IS NULL OR b.tenant_id = p_tenant_id)
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. RPC: Buscar ingredientes relevantes por similitud coseno
CREATE OR REPLACE FUNCTION match_ingredientes(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.5,
  match_count      int     DEFAULT 4,
  p_tenant_id      uuid    DEFAULT NULL
)
RETURNS TABLE (
  ingrediente_id    uuid,
  nombre            text,
  descripcion       text,
  usos_json         jsonb,
  nivel_evidencia   text,
  puede_citar       boolean,
  similarity        float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.ingrediente_id,
    i.nombre,
    i.descripcion,
    i.usos_json::jsonb,
    i.nivel_evidencia,
    i.puede_citar,
    (1 - (i.embedding <=> query_embedding))::float AS similarity
  FROM ingredientes i
  WHERE
    i.embedding IS NOT NULL
    AND (p_tenant_id IS NULL OR i.tenant_id = p_tenant_id)
    AND 1 - (i.embedding <=> query_embedding) > match_threshold
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Trigger: actualizar embedding_texto automáticamente al insertar/actualizar KB
-- (el embedding real se genera desde la API — aquí solo mantenemos el texto fuente)
CREATE OR REPLACE FUNCTION fn_kb_set_embedding_texto()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.embedding_texto := 'Condición: ' || COALESCE(NEW.condicion, '') ||
    E'\nSíntomas: ' || COALESCE(NEW.sintomas_json::text, '') ||
    E'\nProtocolo: ' || COALESCE(NEW.protocolo_derivacion, '');
  -- embedding se genera externamente via /api/admin/kb/generar-embedding
  NEW.embedding := NULL; -- forzar re-generación si cambió el contenido
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_kb_embedding_texto
  BEFORE INSERT OR UPDATE OF condicion, sintomas_json, protocolo_derivacion
  ON knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION fn_kb_set_embedding_texto();

CREATE OR REPLACE FUNCTION fn_ingrediente_set_embedding_texto()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.embedding_texto := 'Ingrediente: ' || COALESCE(NEW.nombre, '') ||
    E'\nDescripción: ' || COALESCE(NEW.descripcion, '') ||
    E'\nUsos: '        || COALESCE(NEW.usos_json::text, '');
  NEW.embedding := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_ingrediente_embedding_texto
  BEFORE INSERT OR UPDATE OF nombre, descripcion, usos_json
  ON ingredientes
  FOR EACH ROW EXECUTE FUNCTION fn_ingrediente_set_embedding_texto();
