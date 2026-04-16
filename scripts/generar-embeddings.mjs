/**
 * scripts/generar-embeddings.mjs
 *
 * Aplica la migración de pgvector y genera embeddings iniciales para
 * todas las knowledge_bases e ingredientes existentes.
 *
 * Uso:
 *   node scripts/generar-embeddings.mjs
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_PAT               ← Personal Access Token de supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF       ← rgcntceelzttponmehte
 *   OPENROUTER_API_KEY         ← usar OpenRouter (más barato, sin tarjeta US)
 *   OPENAI_API_KEY             ← alternativa directa a OpenAI
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Cargar .env.local ────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY
const PAT               = process.env.SUPABASE_PAT
const PROJECT_REF       = process.env.SUPABASE_PROJECT_REF ?? 'rgcntceelzttponmehte'
const OPENROUTER_KEY    = process.env.OPENROUTER_API_KEY
const OPENAI_KEY        = process.env.OPENAI_API_KEY

// Usar OpenRouter si está disponible, sino OpenAI directo
const EMBEDDING_API_URL = OPENROUTER_KEY
  ? 'https://openrouter.ai/api/v1/embeddings'
  : 'https://api.openai.com/v1/embeddings'
const EMBEDDING_API_KEY = OPENROUTER_KEY ?? OPENAI_KEY
const EMBEDDING_MODEL   = OPENROUTER_KEY
  ? 'openai/text-embedding-3-small'
  : 'text-embedding-3-small'

// ─── Validaciones ─────────────────────────────────────────────────────────────
function validar() {
  const errores = []
  if (!SUPABASE_URL)                              errores.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SERVICE_KEY)                               errores.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!PAT || PAT === 'sbp_TU_TOKEN_AQUI')        errores.push('SUPABASE_PAT (obtener en supabase.com/dashboard/account/tokens)')
  const sinKey = (!OPENROUTER_KEY) && (!OPENAI_KEY || OPENAI_KEY.includes('REEMPLAZAR'))
  if (sinKey) errores.push('OPENROUTER_API_KEY o OPENAI_API_KEY (al menos una requerida)')

  if (errores.length) {
    console.error('\n❌ Faltan credenciales en .env.local:\n')
    errores.forEach(e => console.error(`  - ${e}`))
    console.error('\nAgrega estas variables y vuelve a ejecutar el script.\n')
    process.exit(1)
  }
}

// ─── Ejecutar SQL via Management API ─────────────────────────────────────────
async function runSQL(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SQL error [${res.status}]: ${body}`)
  }
  return res.json()
}

// ─── PostgREST query ──────────────────────────────────────────────────────────
async function pgrest(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`REST ${method} ${path} [${res.status}]: ${err}`)
  }
  return res.json()
}

// ─── Generar embedding con OpenAI ────────────────────────────────────────────
async function generarEmbedding(texto) {
  const res = await fetch(EMBEDDING_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texto.slice(0, 8000),  // límite de seguridad
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI embedding error [${res.status}]: ${err}`)
  }
  const data = await res.json()
  return data.data[0].embedding  // array de 1536 floats
}

// ─── Paso 1: Aplicar migración pgvector ──────────────────────────────────────
async function aplicarMigracion() {
  console.log('\n📦 PASO 1 — Aplicando migración pgvector...')

  const migPath = join(__dirname, '..', 'supabase', 'migrations', '20260412_pgvector_embeddings.sql')
  const sql = readFileSync(migPath, 'utf8')

  // Ejecutar en bloques separados por ;
  // La Management API acepta un bloque completo
  await runSQL(sql)
  console.log('  ✅ Migración aplicada.')
}

// ─── Paso 2: Embeddings de knowledge_bases ─────────────────────────────────
async function generarEmbeddingsKB() {
  console.log('\n🧠 PASO 2 — Generando embeddings de knowledge_bases...')

  const kbs = await pgrest('/knowledge_bases?select=kb_id,condicion,sintomas_json,protocolo_derivacion,embedding')

  const sinEmbedding = kbs.filter(k => !k.embedding)
  console.log(`  Encontradas: ${kbs.length} KBs | Sin embedding: ${sinEmbedding.length}`)

  if (sinEmbedding.length === 0) {
    console.log('  ✅ Todas las KBs ya tienen embedding.')
    return
  }

  let ok = 0, err = 0
  for (const kb of sinEmbedding) {
    const texto =
      `Condición: ${kb.condicion ?? ''}\n` +
      `Síntomas: ${JSON.stringify(kb.sintomas_json) ?? ''}\n` +
      `Protocolo: ${kb.protocolo_derivacion ?? ''}`

    try {
      const embedding = await generarEmbedding(texto)

      await pgrest(
        `/knowledge_bases?kb_id=eq.${kb.kb_id}`,
        'PATCH',
        { embedding: `[${embedding.join(',')}]` }
      )
      ok++
      process.stdout.write(`  ✅ KB ${ok}/${sinEmbedding.length}: ${kb.condicion}\n`)
    } catch (e) {
      err++
      console.error(`  ❌ KB ${kb.kb_id}: ${e.message}`)
    }

    // Rate limit: ~3 req/s a OpenAI en tier 1
    await new Promise(r => setTimeout(r, 350))
  }

  console.log(`  Resultado KBs: ${ok} exitosos, ${err} errores`)
}

// ─── Paso 3: Embeddings de ingredientes ──────────────────────────────────────
async function generarEmbeddingsIngredientes() {
  console.log('\n🌿 PASO 3 — Generando embeddings de ingredientes...')

  const ingredientes = await pgrest('/ingredientes?select=ingrediente_id,nombre,descripcion,usos_json,embedding')

  const sinEmbedding = ingredientes.filter(i => !i.embedding)
  console.log(`  Encontrados: ${ingredientes.length} ingredientes | Sin embedding: ${sinEmbedding.length}`)

  if (sinEmbedding.length === 0) {
    console.log('  ✅ Todos los ingredientes ya tienen embedding.')
    return
  }

  let ok = 0, err = 0
  for (const ing of sinEmbedding) {
    const texto =
      `Ingrediente: ${ing.nombre ?? ''}\n` +
      `Descripción: ${ing.descripcion ?? ''}\n` +
      `Usos: ${JSON.stringify(ing.usos_json) ?? ''}`

    try {
      const embedding = await generarEmbedding(texto)

      await pgrest(
        `/ingredientes?ingrediente_id=eq.${ing.ingrediente_id}`,
        'PATCH',
        { embedding: `[${embedding.join(',')}]` }
      )
      ok++
      process.stdout.write(`  ✅ Ingrediente ${ok}/${sinEmbedding.length}: ${ing.nombre}\n`)
    } catch (e) {
      err++
      console.error(`  ❌ Ingrediente ${ing.ingrediente_id}: ${e.message}`)
    }

    await new Promise(r => setTimeout(r, 350))
  }

  console.log(`  Resultado ingredientes: ${ok} exitosos, ${err} errores`)
}

// ─── Paso 4: Verificar búsqueda semántica ─────────────────────────────────────
async function verificarBusqueda() {
  console.log('\n🔍 PASO 4 — Verificando búsqueda semántica...')

  const textoTest = 'energía fatiga cansancio hombre'
  const embTest   = await generarEmbedding(textoTest)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_knowledge_base`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: embTest,
      match_threshold: 0.3,
      match_count:     3,
    }),
  })

  if (!res.ok) {
    console.error(`  ❌ RPC match_knowledge_base falló: ${await res.text()}`)
    return
  }

  const resultados = await res.json()
  if (resultados.length === 0) {
    console.log('  ⚠️  Búsqueda funcionó pero no hay resultados (KBs sin embeddings o sin datos).')
  } else {
    console.log(`  ✅ Búsqueda semántica OK — ${resultados.length} resultado(s):`)
    resultados.forEach(r => {
      console.log(`    • ${r.condicion} (similitud: ${(r.similarity * 100).toFixed(1)}%)`)
    })
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Sprint 4 — Setup pgvector + Embeddings')
  console.log('═══════════════════════════════════════════════')

  validar()

  try {
    await aplicarMigracion()
  } catch (e) {
    // Si la migración ya fue aplicada (extensión ya existe), continuar
    if (e.message.includes('already exists') || e.message.includes('ya existe')) {
      console.log('  ℹ️  La migración ya fue aplicada previamente, continuando...')
    } else {
      console.error(`\n❌ Error en migración: ${e.message}`)
      console.log('\nSi el error es de permisos, verifica que el SUPABASE_PAT tenga acceso a este proyecto.')
      process.exit(1)
    }
  }

  await generarEmbeddingsKB()
  await generarEmbeddingsIngredientes()
  await verificarBusqueda()

  console.log('\n═══════════════════════════════════════════════')
  console.log('  ✅ Sprint 4 Setup completo')
  console.log('  El agente ahora tiene búsqueda semántica activa.')
  console.log('═══════════════════════════════════════════════\n')
}

main().catch(e => {
  console.error('\n❌ Error inesperado:', e.message)
  process.exit(1)
})
