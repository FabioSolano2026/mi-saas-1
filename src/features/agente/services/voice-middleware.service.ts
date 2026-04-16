/**
 * Voice Middleware — Motor de Voz Híbrida
 *
 * Antes de que el agente use voz/avatar del socio, verifica:
 *  1. ¿Existe un audio grabado para esta frase (clave)?
 *  2. ¿Está aprobado por el admin (estado = 'validado')?
 *  3. ¿El perfil del socio tiene voz_aprobada = true?
 *
 * Si cualquier condición falla → Fallback automático a TTS genérico.
 * La venta NUNCA se detiene por un error de asset.
 *
 * Fallback en cascada:
 *  Voz clonada (ElevenLabs) → Audio grabado del socio → TTS genérico
 */

import { createClient } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VoiceMode = 'clonada' | 'grabada' | 'tts_generico'

export interface VoiceAsset {
  modo:       VoiceMode
  audio_url:  string | null   // URL firmada del audio (si existe)
  texto:      string           // Guion / texto de fallback para TTS
  clave:      string
  fallback:   boolean          // true si se usó fallback
  razon?:     string           // razón del fallback (para logs)
}

export interface AudioFrase {
  id:       string
  clave:    string
  guion:    string
  audio_url: string | null
  estado:   'pendiente' | 'validado' | 'rechazado'
}

// Frases maestras predefinidas del sistema
export const FRASES_MAESTRAS: Array<{ clave: string; label: string; guion_default: string }> = [
  {
    clave:        'saludo_inicial',
    label:        'Saludo Inicial',
    guion_default: 'Hola, ¿cómo estás? Me da mucho gusto hablar contigo. Soy [Nombre] y estoy aquí para ayudarte.',
  },
  {
    clave:        'presentacion_producto',
    label:        'Presentación de Producto',
    guion_default: 'Déjame contarte sobre la solución que tenemos para ti. Ha cambiado la vida de miles de personas.',
  },
  {
    clave:        'manejo_objecion',
    label:        'Manejo de Objeción',
    guion_default: 'Entiendo perfectamente tu preocupación. Es completamente normal tener dudas antes de tomar una decisión.',
  },
  {
    clave:        'cierre_afiliacion',
    label:        'Cierre de Afiliación',
    guion_default: 'Estás a un paso de tomar la mejor decisión para tu salud. Te voy a guiar en el proceso de registro.',
  },
  {
    clave:        'mencion_id',
    label:        'Mención de ID de Afiliado',
    guion_default: 'Para que quedes registrado conmigo como tu patrocinador, necesitarás este código.',
  },
  {
    clave:        'cierre_llamada',
    label:        'Cierre de Llamada / CallCenter',
    guion_default: 'Cuando llames, menciona mi nombre y mi código de patrocinador para que quedes directamente conmigo.',
  },
  {
    clave:        'seguimiento',
    label:        'Seguimiento',
    guion_default: 'Quería escribirte para saber cómo te has sentido y si tienes alguna pregunta adicional.',
  },
]

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Resuelve qué asset de voz usar para una frase dada.
 * Siempre devuelve un resultado válido (nunca lanza excepción).
 */
export async function resolverVoiceAsset(
  socio_id:        string,
  clave:           string,
  texto_fallback:  string,
  voz_clonada_id:  string | null,
  voz_aprobada:    boolean,
): Promise<VoiceAsset> {
  // ── Intento 1: Voz clonada (ElevenLabs) ──────────────────────────────────
  if (voz_clonada_id && voz_aprobada) {
    const okClon = await _verificarVozClonada(voz_clonada_id).catch(() => false)
    if (okClon) {
      return {
        modo:      'clonada',
        audio_url: null,               // el cliente llama a ElevenLabs en tiempo real
        texto:     texto_fallback,
        clave,
        fallback:  false,
      }
    }
    // Fallo silencioso → siguiente nivel
  }

  // ── Intento 2: Audio grabado del socio ────────────────────────────────────
  const audio = await _buscarAudioValidado(socio_id, clave).catch(() => null)
  if (audio?.audio_url) {
    const urlFirmada = await _firmarUrl(audio.audio_url).catch(() => null)
    if (urlFirmada) {
      return {
        modo:      'grabada',
        audio_url: urlFirmada,
        texto:     texto_fallback,
        clave,
        fallback:  false,
      }
    }
  }

  // ── Fallback final: TTS genérico ──────────────────────────────────────────
  const razon = voz_clonada_id && !voz_aprobada
    ? 'voz_clonada_pendiente_aprobacion'
    : !voz_clonada_id && !audio
      ? 'sin_assets_configurados'
      : 'audio_no_disponible'

  return {
    modo:      'tts_generico',
    audio_url: null,
    texto:     texto_fallback,
    clave,
    fallback:  true,
    razon,
  }
}

/**
 * Carga todos los audios del socio (para el Estudio de Voz).
 * Combina frases maestras del sistema con lo grabado en BD.
 */
export async function cargarFrasesSocio(socio_id: string): Promise<AudioFrase[]> {
  const admin = _adminDb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: grabados } = await db
    .from('audios_socio')
    .select('id, clave, guion, audio_url, estado')
    .eq('socio_id', socio_id)

  const grabadosMap = new Map<string, AudioFrase>(
    ((grabados ?? []) as AudioFrase[]).map((a) => [a.clave, a]),
  )

  // Merge: frases maestras + grabaciones existentes
  return FRASES_MAESTRAS.map((f) => {
    const existente = grabadosMap.get(f.clave)
    return existente ?? {
      id:        '',
      clave:     f.clave,
      guion:     f.guion_default,
      audio_url: null,
      estado:    'pendiente' as const,
    }
  })
}

/**
 * Genera una URL firmada (válida 1h) para reproducir un audio privado.
 */
export async function generarUrlFirmada(path: string): Promise<string | null> {
  return _firmarUrl(path).catch(() => null)
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function _adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function _buscarAudioValidado(
  socio_id: string,
  clave:    string,
): Promise<AudioFrase | null> {
  const admin = _adminDb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('audios_socio')
    .select('id, clave, guion, audio_url, estado')
    .eq('socio_id', socio_id)
    .eq('clave', clave)
    .eq('estado', 'validado')
    .not('audio_url', 'is', null)
    .single()

  return (data as AudioFrase | null)
}

async function _firmarUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null
  // Si ya es URL completa (http), devolver tal cual
  if (storagePath.startsWith('http')) return storagePath

  const admin = _adminDb()
  const { data, error } = await admin.storage
    .from('audios_socio')
    .createSignedUrl(storagePath, 3600)   // 1 hora

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

async function _verificarVozClonada(voiceId: string): Promise<boolean> {
  // Si no hay API key de ElevenLabs configurada → fallback inmediato
  if (!process.env.ELEVENLABS_API_KEY) return false
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    })
    return res.ok
  } catch {
    return false
  }
}
