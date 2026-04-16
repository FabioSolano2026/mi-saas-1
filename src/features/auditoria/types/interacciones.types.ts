export type TipoInteraccion  = 'texto' | 'voz'
export type EmisorInteraccion = 'agente' | 'socio' | 'lead'

export interface InteraccionPublica {
  id:          string
  prospecto_id: string
  campana_id:  string | null
  tipo:        TipoInteraccion
  contenido:   string | null
  emisor:      EmisorInteraccion
  creado_en:   string
}

export interface InteraccionPrivada extends InteraccionPublica {
  audio_url:          string | null
  transcripcion:      string | null
  score_cumplimiento: number | null
  score_detalle_json: ScoreDetalle | null
}

export interface ScoreDetalle {
  score:       number
  secciones:   Array<{ clave: string; peso: number; ok: boolean }>
  calculado_en: string
}

export interface ScriptMaestro {
  id:        string
  tenant_id: string
  nombre:    string
  secciones: Array<{
    clave:       string
    descripcion: string
    peso:        number
  }>
  activo:    boolean
  creado_en: string
}

// Payload para crear una interacción (desde el agente)
export interface CrearInteraccionPayload {
  prospecto_id: string
  campana_id?:  string
  tipo:         TipoInteraccion
  contenido?:   string
  emisor:       EmisorInteraccion
  // Campos privados opcionales (solo el agente los envía)
  audio_url?:     string
  transcripcion?: string
}
