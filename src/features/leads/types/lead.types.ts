// ─── Contexto del afiliado (get_socio_by_slug / get_contexto_afiliado) ───────

export interface AfiliadoContexto {
  link_id:             string
  id_corto:            string
  slug:                string
  // Socio
  nombre_socio:        string
  foto_socio:          string | null
  avatar_socio:        string | null
  socio_id:            string
  // Campaña
  campana_id:          string
  campana_nombre:      string
  campana_tipo:        string
  agente_tipo:         string
  requiere_cita:       boolean
  url_campana:         string | null
  descripcion_campana: string | null
  multimedia_url:      string | null
  tenant_id:           string
}

// ─── Lead capturado desde la landing ─────────────────────────────────────────

export interface LeadCapturado {
  nombre:     string
  email:      string
  telefono:   string
  socio_id:   string
  campana_id: string
  tenant_id:  string
  ref_slug:   string
}
