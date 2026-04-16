/**
 * Audio Processor — Normalización y Análisis de Calidad
 *
 * Corre 100% en el navegador usando Web Audio API (OfflineAudioContext).
 * No requiere dependencias externas ni servidor.
 *
 * Pipeline:
 *  1. Decodificar audio (cualquier formato: MP3, WebM, WAV, OGG, M4A)
 *  2. Análisis pre-proceso: LUFS, SNR, peak, duración
 *  3. Procesamiento:
 *     a) High-pass filter 80 Hz  → elimina ruido de fondo (zumbido, HVAC)
 *     b) Compresor suave         → ecualiza dinámica de voz
 *     c) Ganancia de normalización → target -14 LUFS (estándar streaming)
 *     d) Limiter -1 dBTP         → evita clipping post-normalización
 *  4. Resamplear a 44 100 Hz mono (tamaño reducido, compatibilidad máxima)
 *  5. Exportar como WAV 16-bit PCM
 *  6. Análisis post-proceso: métricas finales + flag de calidad
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

const TARGET_LUFS        = -14      // EBU R128 / estándar streaming
const SNR_MINIMO_DB      = 10       // por debajo → requiere_regrabacion = true
const TARGET_SAMPLE_RATE = 44_100
const FRAME_SIZE         = 1_024    // muestras por ventana de análisis

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface AudioMetadata {
  lufs_estimado:        number   // LUFS simplificado (sin K-weighting)
  snr_estimado:         number   // dB — ratio señal/ruido estimado
  pico_db:              number   // peak en dBFS
  duracion_segundos:    number
  sample_rate_original: number
  requiere_regrabacion: boolean  // true si snr < SNR_MINIMO_DB
}

export interface AudioProcessResult {
  blob:     Blob            // WAV 16-bit 44 100 Hz normalizado
  filename: string
  metadata: AudioMetadata
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Normaliza y analiza un archivo de audio.
 * Siempre devuelve un resultado (si el procesamiento falla, devuelve el original).
 */
export async function procesarAudio(file: File): Promise<AudioProcessResult> {
  try {
    return await _procesarConWebAudio(file)
  } catch {
    // Fallback: devolver el archivo original sin procesar
    const metadata = _metadataVacia(file)
    return { blob: file, filename: file.name, metadata }
  }
}

// ─── Implementación ───────────────────────────────────────────────────────────

async function _procesarConWebAudio(file: File): Promise<AudioProcessResult> {
  const arrayBuffer = await file.arrayBuffer()

  // Decodificar (soporta MP3, WebM, WAV, OGG, M4A según el navegador)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtxClass = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext
  const tmpCtx = new AudioCtxClass()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await tmpCtx.close().catch(() => {})
  }

  // ── Análisis pre-proceso ─────────────────────────────────────────────────
  const ch0         = audioBuffer.getChannelData(0)
  const preMeta     = _analizarMuestras(ch0, audioBuffer.sampleRate)

  // ── Calcular ganancia hacia TARGET_LUFS ───────────────────────────────────
  const gainDB      = TARGET_LUFS - preMeta.lufs_estimado
  // Limitar boost a +20 dB para no amplificar ruido excesivamente
  const gainLinear  = Math.min(Math.pow(10, gainDB / 20), Math.pow(10, 20 / 20))

  // ── Procesar con OfflineAudioContext ──────────────────────────────────────
  const targetLength = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE)
  const offlineCtx   = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE)

  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer

  // a) High-pass 80 Hz — elimina ruido de fondo (zumbido, HVAC, vibraciones)
  const hpf = offlineCtx.createBiquadFilter()
  hpf.type            = 'highpass'
  hpf.frequency.value = 80
  hpf.Q.value         = 0.7

  // b) Compresor suave — ecualiza dinámica de voz
  const comp = offlineCtx.createDynamicsCompressor()
  comp.threshold.value = -24
  comp.knee.value      = 12
  comp.ratio.value     = 4
  comp.attack.value    = 0.005
  comp.release.value   = 0.15

  // c) Ganancia de normalización
  const gain = offlineCtx.createGain()
  gain.gain.value = gainLinear

  // d) Limiter -1 dBTP — evita clipping
  const limiter = offlineCtx.createDynamicsCompressor()
  limiter.threshold.value = -1
  limiter.knee.value      = 0
  limiter.ratio.value     = 20
  limiter.attack.value    = 0.001
  limiter.release.value   = 0.05

  // Cadena de señal
  source.connect(hpf)
  hpf.connect(comp)
  comp.connect(gain)
  gain.connect(limiter)
  limiter.connect(offlineCtx.destination)
  source.start()

  const processed   = await offlineCtx.startRendering()
  const processedCh = processed.getChannelData(0)

  // ── Análisis post-proceso ─────────────────────────────────────────────────
  const postMeta = _analizarMuestras(processedCh, TARGET_SAMPLE_RATE)

  // ── Exportar WAV ──────────────────────────────────────────────────────────
  const wavBlob  = _audioBufferToWav(processed)
  const filename = file.name.replace(/\.[^/.]+$/, '') + '_norm.wav'

  return {
    blob: wavBlob,
    filename,
    metadata: {
      ...postMeta,
      sample_rate_original: audioBuffer.sampleRate,
      requiere_regrabacion: postMeta.snr_estimado < SNR_MINIMO_DB,
    },
  }
}

// ─── Análisis de muestras ─────────────────────────────────────────────────────

function _analizarMuestras(
  samples:    Float32Array,
  sampleRate: number,
): Omit<AudioMetadata, 'sample_rate_original' | 'requiere_regrabacion'> {
  // Energía por frames (RMS por ventana)
  const frames: number[] = []
  for (let i = 0; i < samples.length; i += FRAME_SIZE) {
    let sumSq = 0
    const end = Math.min(i + FRAME_SIZE, samples.length)
    for (let j = i; j < end; j++) sumSq += samples[j] * samples[j]
    frames.push(Math.sqrt(sumSq / (end - i)))
  }
  frames.sort((a, b) => a - b)

  // SNR estimado: P90 (señal) / P10 (ruido)
  const noiseFloor = (frames[Math.floor(frames.length * 0.10)] ?? 0) + 1e-10
  const signalRms  = (frames[Math.floor(frames.length * 0.90)] ?? 0) + 1e-10
  const snr        = 20 * Math.log10(signalRms / noiseFloor)

  // Peak en dBFS
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > peak) peak = abs
  }

  // RMS total → LUFS simplificado (sin K-weighting de ITU-R BS.1770)
  let sumSq = 0
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i]
  const rms  = Math.sqrt(sumSq / samples.length)
  const lufs = rms > 1e-10 ? -0.691 + 10 * Math.log10(rms * rms) : -70

  return {
    lufs_estimado:     _r1(lufs),
    snr_estimado:      _r1(snr),
    pico_db:           _r1(20 * Math.log10(peak + 1e-10)),
    duracion_segundos: _r1(samples.length / sampleRate),
  }
}

// ─── Codificador WAV 16-bit PCM ───────────────────────────────────────────────

function _audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels    = Math.min(buffer.numberOfChannels, 2)
  const rate        = buffer.sampleRate
  const numSamples  = buffer.length
  const bps         = 2 // bytes por muestra (16-bit)
  const dataSize    = channels * numSamples * bps
  const ab          = new ArrayBuffer(44 + dataSize)
  const v           = new DataView(ab)
  const ws          = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }

  ws(0,  'RIFF'); v.setUint32(4,  36 + dataSize, true)
  ws(8,  'WAVE'); ws(12, 'fmt ')
  v.setUint32(16, 16, true)               // tamaño del chunk fmt
  v.setUint16(20, 1,  true)               // PCM
  v.setUint16(22, channels, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * channels * bps, true)
  v.setUint16(32, channels * bps, true)
  v.setUint16(34, 16, true)               // bits por muestra
  ws(36, 'data'); v.setUint32(40, dataSize, true)

  let off = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      off += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _r1 = (n: number) => Math.round(n * 10) / 10

function _metadataVacia(file: File): AudioMetadata {
  return {
    lufs_estimado:        -70,
    snr_estimado:         0,
    pico_db:              -70,
    duracion_segundos:    0,
    sample_rate_original: 0,
    requiere_regrabacion: false,
  }
}
// suppress unused warning — used as fallback
void _metadataVacia
