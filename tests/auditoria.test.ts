/**
 * tests/auditoria.test.ts
 *
 * Unit tests del servicio de auditoría — sin BD real.
 * Usan vi.spyOn para mockear el singleton `supabase` e inyectar
 * comportamientos controlados (éxito, error, fallo de transacción).
 *
 * NO hacen fetch a API Routes (requieren servidor corriendo).
 * Para tests de integración con BD real → audit-kanban.test.ts
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import * as supabaseModule from '@/lib/supabase'
import { archivarProspectos } from '@/features/auditoria/services/archiver.service'

// ─── Helpers de mock ──────────────────────────────────────────────────────────
//
// archivarProspectos tiene tres llamadas a supabase con patrones distintos:
//
//   1. Lectura:  supabase.from('prospectos').select('*').eq(...).maybeSingle()
//      Terminal: maybeSingle() → Promise
//
//   2. Insert:   (supabase as any).from('prospectos_historico').insert({...})
//      Terminal: insert() → Promise directamente (sin método extra)
//
//   3. Delete:   supabase.from('prospectos').delete().eq(...)
//      Terminal: eq() después de delete() → Promise

/** Mock para SELECT: el terminal es .maybeSingle() */
function mockSelect(result: { data: unknown; error: unknown }) {
  const m = {
    select:      vi.fn(),
    eq:          vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  m.select.mockReturnValue(m)
  m.eq.mockReturnValue(m)
  return m
}

/** Mock para INSERT: .insert() es el terminal que devuelve la Promise */
function mockInsert(result: { data: unknown; error: unknown }) {
  return { insert: vi.fn().mockResolvedValue(result) }
}

/** Mock para DELETE: .delete().eq() es el terminal */
function mockDelete(result: { data: unknown; error: unknown }) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(result),
    }),
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('archivarProspectos — integridad y manejo de errores', () => {

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ── 1. Prospecto inexistente ──────────────────────────────────────────────

  test('lanza PROSPECTO_NO_ENCONTRADO si el registro no existe en BD', async () => {
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      from: () => mockSelect({ data: null, error: null }),
    } as unknown as typeof supabaseModule.supabase)

    await expect(
      archivarProspectos({ id: 'uuid-inexistente' })
    ).rejects.toThrow('PROSPECTO_NO_ENCONTRADO')
  })

  // ── 2. Error de BD en lectura ─────────────────────────────────────────────

  test('lanza FALLO_EN_LECTURA si la BD devuelve error al leer', async () => {
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      from: () => mockSelect({ data: null, error: { message: 'connection timeout' } }),
    } as unknown as typeof supabaseModule.supabase)

    await expect(
      archivarProspectos({ id: 'cualquier-uuid' })
    ).rejects.toThrow('FALLO_EN_LECTURA')
  })

  // ── 3. Falla en INSERT de histórico ───────────────────────────────────────

  test('lanza FALLO_EN_TRANSACCION si el INSERT en prospectos_historico falla', async () => {
    const prospectoFake = { prospecto_id: 'uuid-real', nombre: 'Test' }

    // from() se llama 3 veces: SELECT prospectos, INSERT historico, DELETE prospectos
    // Solo la primera (lectura) tiene éxito — la segunda (insert) falla.
    let llamada = 0
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      from: () => {
        llamada++
        if (llamada === 1) return mockSelect({ data: prospectoFake, error: null })
        if (llamada === 2) return mockInsert({ data: null, error: { message: 'unique constraint' } })
        return mockDelete({ data: null, error: null })
      },
    } as unknown as typeof supabaseModule.supabase)

    await expect(
      archivarProspectos({ id: 'uuid-real' })
    ).rejects.toThrow('FALLO_EN_TRANSACCION')
  })

  // ── 4. Flujo exitoso completo ─────────────────────────────────────────────

  test('resuelve sin error cuando todos los pasos de BD tienen éxito', async () => {
    const prospectoFake = {
      prospecto_id:         'uuid-ok',
      tenant_id:            'tenant-uuid',
      nombre:               'Prospecto OK',
      columna_kanban:       'sin_respuesta',
      temperatura:          'fria',
      intencion:            'no_definida',
      canal_agente:         'web',
      respuestas_json:      {},
      dias_sin_contacto:    30,
      compartido_por_admin: false,
      visible_para_socio:   true,
      ultimo_contacto:      new Date().toISOString(),
      creado_en:            new Date().toISOString(),
      actualizado_en:       new Date().toISOString(),
    }

    let llamada = 0
    vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue({
      from: () => {
        llamada++
        if (llamada === 1) return mockSelect({ data: prospectoFake, error: null })
        if (llamada === 2) return mockInsert({ data: prospectoFake, error: null })
        return mockDelete({ data: null, error: null })
      },
    } as unknown as typeof supabaseModule.supabase)

    await expect(
      archivarProspectos({ id: 'uuid-ok' })
    ).resolves.toBeUndefined()
  })

})
