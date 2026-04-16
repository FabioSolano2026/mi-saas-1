// ─── Tipos del contexto que el agente necesita para una campaña ──────────────

export interface ContextualData {
  campana: {
    campana_id: string
    tenant_id:  string
    pais_id:    string
    nombre: string
    tipo: string
    agente_tipo: string
    requiere_cita: boolean
    pais: { nombre: string; codigo: string }
    condicion: { nombre: string; descripcion: string | null } | null
  }
  socio: {
    usuario_id: string
    nombre_completo: string
    foto_url: string | null
    avatar_url: string | null
    voz_url: string | null
    assets: Array<{
      tipo: string
      url: string
      alt_text: string | null
      orden: number
    }>
  } | null
  knowledge_base: {
    condicion: string
    tipo_kb: string
    sintomas_json: unknown
    preguntas_json: unknown
    objeciones_json: unknown
    lenguaje_prohibido_json: unknown
    protocolo_derivacion: string | null
  } | null
  productos: Array<{
    nombre: string
    prioridad: number
    lenguaje_agente: string
    razon_recomendacion: string | null
  }>
}
