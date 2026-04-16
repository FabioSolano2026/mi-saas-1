// ─── Campaña con estado del socio ────────────────────────────────────────────

export interface CampanaConEstado {
  campana_id:     string
  nombre:         string
  descripcion:    string | null
  multimedia_url: string | null
  tipo:           string
  agente_tipo:    string
  requiere_cita:  boolean
  condicion:      string | null   // nombre de condicion_salud
  // Estado del socio en esta campaña
  estado_socio:   'activo' | 'pausado' | null  // null = no activada aún
  sc_id:          string | null               // id en socio_campanas
}

// ─── Lead (prospecto) resumido para el Kanban ─────────────────────────────────

export type ColumnaKanban =
  | 'nuevo_prospecto'
  | 'contactado'
  | 'calificado'
  | 'interesado'
  | 'propuesta_enviada'
  | 'negociacion'
  | 'cliente_activo'
  | 'perdido'
  | 'descartado'

export const COLUMNAS: ColumnaKanban[] = [
  'nuevo_prospecto',
  'contactado',
  'calificado',
  'interesado',
  'propuesta_enviada',
  'negociacion',
  'cliente_activo',
  'perdido',
  'descartado',
]

export const COLUMNA_LABEL: Record<ColumnaKanban, string> = {
  nuevo_prospecto:  'Nuevo',
  contactado:       'Contactado',
  calificado:       'Calificado',
  interesado:       'Interesado',
  propuesta_enviada:'Propuesta',
  negociacion:      'Negociación',
  cliente_activo:   'Cliente',
  perdido:          'Perdido',
  descartado:       'Descartado',
}

export const TEMPERATURA_COLOR: Record<string, string> = {
  frio:    'bg-blue-100 text-blue-700',
  tibio:   'bg-amber-100 text-amber-700',
  caliente:'bg-red-100 text-red-700',
}

export interface LeadResumen {
  prospecto_id:      string
  nombre:            string
  correo:            string | null
  telefono:          string | null
  columna_kanban:    ColumnaKanban
  temperatura:       string
  origen:            string | null
  dias_sin_contacto: number
  creado_en:         string
  campana_id:        string
}
