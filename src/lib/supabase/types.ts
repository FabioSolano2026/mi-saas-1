export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campanas: {
        Row: {
          agente_tipo: string
          campana_id: string
          condicion_salud_id: string | null
          creado_en: string
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          knowledge_base_id: string | null
          landing_url: string | null
          modulo_destino: string
          nombre: string
          pais_id: string
          requiere_cita: boolean
          socio_id: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          agente_tipo?: string
          campana_id?: string
          condicion_salud_id?: string | null
          creado_en?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          knowledge_base_id?: string | null
          landing_url?: string | null
          modulo_destino?: string
          nombre: string
          pais_id: string
          requiere_cita?: boolean
          socio_id?: string | null
          tenant_id: string
          tipo?: string
        }
        Update: {
          agente_tipo?: string
          campana_id?: string
          condicion_salud_id?: string | null
          creado_en?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          knowledge_base_id?: string | null
          landing_url?: string | null
          modulo_destino?: string
          nombre?: string
          pais_id?: string
          requiere_cita?: boolean
          socio_id?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanas_condicion_salud_id_fkey"
            columns: ["condicion_salud_id"]
            isOneToOne: false
            referencedRelation: "condiciones_salud"
            referencedColumns: ["condicion_id"]
          },
          {
            foreignKeyName: "campanas_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["kb_id"]
          },
          {
            foreignKeyName: "campanas_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["pais_id"]
          },
          {
            foreignKeyName: "campanas_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "campanas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      ciclos_consumo: {
        Row: {
          ciclo_id: string
          estado: string
          fecha_inicio_ciclo: string
          fecha_proximo_contacto: string
          mes_actual: number
          pedido_inicial_id: string
          prospecto_id: string
          tenant_id: string
          total_meses_completados: number
        }
        Insert: {
          ciclo_id?: string
          estado?: string
          fecha_inicio_ciclo?: string
          fecha_proximo_contacto: string
          mes_actual?: number
          pedido_inicial_id: string
          prospecto_id: string
          tenant_id: string
          total_meses_completados?: number
        }
        Update: {
          ciclo_id?: string
          estado?: string
          fecha_inicio_ciclo?: string
          fecha_proximo_contacto?: string
          mes_actual?: number
          pedido_inicial_id?: string
          prospecto_id?: string
          tenant_id?: string
          total_meses_completados?: number
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_consumo_pedido_inicial_id_fkey"
            columns: ["pedido_inicial_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "ciclos_consumo_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos"
            referencedColumns: ["prospecto_id"]
          },
          {
            foreignKeyName: "ciclos_consumo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      citas: {
        Row: {
          actualizado_en: string
          canal_origen: string
          cita_id: string
          creado_en: string
          disponibilidad_id: string
          estado: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          notas_agente: string | null
          prospecto_id: string
          recordatorio_24h_enviado: boolean
          recordatorio_2h_enviado: boolean
          recurso_id: string
          servicio_id: string
          tenant_id: string
        }
        Insert: {
          actualizado_en?: string
          canal_origen?: string
          cita_id?: string
          creado_en?: string
          disponibilidad_id: string
          estado?: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          notas_agente?: string | null
          prospecto_id: string
          recordatorio_24h_enviado?: boolean
          recordatorio_2h_enviado?: boolean
          recurso_id: string
          servicio_id: string
          tenant_id: string
        }
        Update: {
          actualizado_en?: string
          canal_origen?: string
          cita_id?: string
          creado_en?: string
          disponibilidad_id?: string
          estado?: string
          fecha?: string
          hora_fin?: string
          hora_inicio?: string
          notas_agente?: string | null
          prospecto_id?: string
          recordatorio_24h_enviado?: boolean
          recordatorio_2h_enviado?: boolean
          recurso_id?: string
          servicio_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "citas_disponibilidad_id_fkey"
            columns: ["disponibilidad_id"]
            isOneToOne: false
            referencedRelation: "disponibilidad"
            referencedColumns: ["disponibilidad_id"]
          },
          {
            foreignKeyName: "citas_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos"
            referencedColumns: ["prospecto_id"]
          },
          {
            foreignKeyName: "citas_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos"
            referencedColumns: ["recurso_id"]
          },
          {
            foreignKeyName: "citas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "citas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      condicion_productos_por_pais: {
        Row: {
          activo: boolean
          condicion_id: string
          creado_en: string
          id: string
          lenguaje_agente: string
          pais_id: string
          prioridad: number
          producto_id: string
          razon_recomendacion: string | null
        }
        Insert: {
          activo?: boolean
          condicion_id: string
          creado_en?: string
          id?: string
          lenguaje_agente: string
          pais_id: string
          prioridad?: number
          producto_id: string
          razon_recomendacion?: string | null
        }
        Update: {
          activo?: boolean
          condicion_id?: string
          creado_en?: string
          id?: string
          lenguaje_agente?: string
          pais_id?: string
          prioridad?: number
          producto_id?: string
          razon_recomendacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "condicion_productos_por_pais_condicion_id_fkey"
            columns: ["condicion_id"]
            isOneToOne: false
            referencedRelation: "condiciones_salud"
            referencedColumns: ["condicion_id"]
          },
          {
            foreignKeyName: "condicion_productos_por_pais_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["pais_id"]
          },
          {
            foreignKeyName: "condicion_productos_por_pais_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      condiciones_salud: {
        Row: {
          activa: boolean
          actualizado_en: string
          condicion_id: string
          creado_en: string
          descripcion: string | null
          icono_url: string | null
          knowledge_base_id: string | null
          nombre: string
          orden_display: number
          solo_admin: boolean
          tenant_id: string
        }
        Insert: {
          activa?: boolean
          actualizado_en?: string
          condicion_id?: string
          creado_en?: string
          descripcion?: string | null
          icono_url?: string | null
          knowledge_base_id?: string | null
          nombre: string
          orden_display?: number
          solo_admin?: boolean
          tenant_id: string
        }
        Update: {
          activa?: boolean
          actualizado_en?: string
          condicion_id?: string
          creado_en?: string
          descripcion?: string | null
          icono_url?: string | null
          knowledge_base_id?: string | null
          nombre?: string
          orden_display?: number
          solo_admin?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "condiciones_salud_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["kb_id"]
          },
          {
            foreignKeyName: "condiciones_salud_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      disponibilidad: {
        Row: {
          creado_en: string
          disponibilidad_id: string
          estado: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          recurso_id: string
          servicio_id: string
          tenant_id: string
        }
        Insert: {
          creado_en?: string
          disponibilidad_id?: string
          estado?: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          recurso_id: string
          servicio_id: string
          tenant_id: string
        }
        Update: {
          creado_en?: string
          disponibilidad_id?: string
          estado?: string
          fecha?: string
          hora_fin?: string
          hora_inicio?: string
          recurso_id?: string
          servicio_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidad_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "recursos"
            referencedColumns: ["recurso_id"]
          },
          {
            foreignKeyName: "disponibilidad_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "disponibilidad_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      ingredientes: {
        Row: {
          actualizado_en: string
          creado_en: string
          descripcion: string | null
          estudios_json: Json
          ingrediente_id: string
          nivel_evidencia: string
          nombre: string
          puede_citar: boolean
          tenant_id: string
          usos_json: Json
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          estudios_json?: Json
          ingrediente_id?: string
          nivel_evidencia?: string
          nombre: string
          puede_citar?: boolean
          tenant_id: string
          usos_json?: Json
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          estudios_json?: Json
          ingrediente_id?: string
          nivel_evidencia?: string
          nombre?: string
          puede_citar?: boolean
          tenant_id?: string
          usos_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ingredientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      knowledge_bases: {
        Row: {
          actualizado_en: string
          condicion: string
          creado_en: string
          kb_id: string
          lenguaje_prohibido_json: Json
          objeciones_json: Json
          preguntas_json: Json
          protocolo_derivacion: string | null
          sintomas_json: Json
          solo_admin: boolean
          tenant_id: string
          tipo_kb: string
          version: string
          visible_para_socios: boolean
        }
        Insert: {
          actualizado_en?: string
          condicion: string
          creado_en?: string
          kb_id?: string
          lenguaje_prohibido_json?: Json
          objeciones_json?: Json
          preguntas_json?: Json
          protocolo_derivacion?: string | null
          sintomas_json?: Json
          solo_admin?: boolean
          tenant_id: string
          tipo_kb?: string
          version?: string
          visible_para_socios?: boolean
        }
        Update: {
          actualizado_en?: string
          condicion?: string
          creado_en?: string
          kb_id?: string
          lenguaje_prohibido_json?: Json
          objeciones_json?: Json
          preguntas_json?: Json
          protocolo_derivacion?: string | null
          sintomas_json?: Json
          solo_admin?: boolean
          tenant_id?: string
          tipo_kb?: string
          version?: string
          visible_para_socios?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_bases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      modulos_crm: {
        Row: {
          activo: boolean
          config_json: Json
          instalado_en: string
          modulo: string
          modulo_id: string
          tenant_id: string
          version: string
        }
        Insert: {
          activo?: boolean
          config_json?: Json
          instalado_en?: string
          modulo: string
          modulo_id?: string
          tenant_id: string
          version?: string
        }
        Update: {
          activo?: boolean
          config_json?: Json
          instalado_en?: string
          modulo?: string
          modulo_id?: string
          tenant_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_crm_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      movimientos_kanban: {
        Row: {
          columna_destino: string
          columna_origen: string
          creado_en: string
          movimiento_id: string
          nota: string | null
          prospecto_id: string
          socio_id: string | null
        }
        Insert: {
          columna_destino: string
          columna_origen: string
          creado_en?: string
          movimiento_id?: string
          nota?: string | null
          prospecto_id: string
          socio_id?: string | null
        }
        Update: {
          columna_destino?: string
          columna_origen?: string
          creado_en?: string
          movimiento_id?: string
          nota?: string | null
          prospecto_id?: string
          socio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_kanban_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos"
            referencedColumns: ["prospecto_id"]
          },
          {
            foreignKeyName: "movimientos_kanban_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["usuario_id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          canal: string
          creado_en: string
          enviada: boolean
          enviada_en: string | null
          mensaje: string
          notif_id: string
          prospecto_id: string | null
          socio_id: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          canal: string
          creado_en?: string
          enviada?: boolean
          enviada_en?: string | null
          mensaje: string
          notif_id?: string
          prospecto_id?: string | null
          socio_id?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          canal?: string
          creado_en?: string
          enviada?: boolean
          enviada_en?: string | null
          mensaje?: string
          notif_id?: string
          prospecto_id?: string | null
          socio_id?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos"
            referencedColumns: ["prospecto_id"]
          },
          {
            foreignKeyName: "notificaciones_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "notificaciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      paises: {
        Row: {
          activo: boolean
          codigo: string
          creado_en: string
          moneda: string
          nombre: string
          pais_id: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          creado_en?: string
          moneda: string
          nombre: string
          pais_id?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          creado_en?: string
          moneda?: string
          nombre?: string
          pais_id?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          courier: string | null
          estado_envio: string
          fecha_compra: string
          fecha_estimada_entrega: string | null
          moneda: string
          notas: string | null
          numero_tracking: string | null
          pais_id: string
          pedido_id: string
          precio_pagado: number
          producto_id: string
          prospecto_id: string
          socio_id: string | null
          tenant_id: string
        }
        Insert: {
          courier?: string | null
          estado_envio?: string
          fecha_compra?: string
          fecha_estimada_entrega?: string | null
          moneda: string
          notas?: string | null
          numero_tracking?: string | null
          pais_id: string
          pedido_id?: string
          precio_pagado: number
          producto_id: string
          prospecto_id: string
          socio_id?: string | null
          tenant_id: string
        }
        Update: {
          courier?: string | null
          estado_envio?: string
          fecha_compra?: string
          fecha_estimada_entrega?: string | null
          moneda?: string
          notas?: string | null
          numero_tracking?: string | null
          pais_id?: string
          pedido_id?: string
          precio_pagado?: number
          producto_id?: string
          prospecto_id?: string
          socio_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["pais_id"]
          },
          {
            foreignKeyName: "pedidos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["producto_id"]
          },
          {
            foreignKeyName: "pedidos_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos"
            referencedColumns: ["prospecto_id"]
          },
          {
            foreignKeyName: "pedidos_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "pedidos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      producto_ingredientes: {
        Row: {
          cantidad_mg: number | null
          id: string
          ingrediente_id: string
          orden_display: number
          producto_id: string
          rol: string
        }
        Insert: {
          cantidad_mg?: number | null
          id?: string
          ingrediente_id: string
          orden_display?: number
          producto_id: string
          rol: string
        }
        Update: {
          cantidad_mg?: number | null
          id?: string
          ingrediente_id?: string
          orden_display?: number
          producto_id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_ingredientes_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes"
            referencedColumns: ["ingrediente_id"]
          },
          {
            foreignKeyName: "producto_ingredientes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          actualizado_en: string
          creado_en: string
          descripcion: string | null
          imagen_url: string | null
          nombre: string
          producto_id: string
          tenant_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          imagen_url?: string | null
          nombre: string
          producto_id?: string
          tenant_id: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          imagen_url?: string | null
          nombre?: string
          producto_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      productos_por_pais: {
        Row: {
          actualizado_en: string
          creado_en: string
          disponible: boolean
          ente_regulador: string | null
          id: string
          moneda_local: string
          nombre_local: string | null
          pais_id: string
          precio_local: number
          producto_id: string
          registro_sanitario: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          disponible?: boolean
          ente_regulador?: string | null
          id?: string
          moneda_local: string
          nombre_local?: string | null
          pais_id: string
          precio_local: number
          producto_id: string
          registro_sanitario?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          disponible?: boolean
          ente_regulador?: string | null
          id?: string
          moneda_local?: string
          nombre_local?: string | null
          pais_id?: string
          precio_local?: number
          producto_id?: string
          registro_sanitario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_por_pais_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["pais_id"]
          },
          {
            foreignKeyName: "productos_por_pais_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["producto_id"]
          },
        ]
      }
      prospectos: {
        Row: {
          actualizado_en: string
          campana_id: string | null
          canal_agente: string
          cita_id: string | null
          columna_kanban: string
          compartido_por_admin: boolean
          correo: string | null
          creado_en: string
          dias_sin_contacto: number
          intencion: string
          nombre: string | null
          nota_agente: string | null
          nota_socio: string | null
          origen: string | null
          pais_id: string | null
          prospecto_id: string
          respuestas_json: Json
          socio_id: string | null
          telefono: string | null
          temperatura: string
          tenant_id: string
          transcripcion_texto: string | null
          transcripcion_voz_url: string | null
          ultimo_contacto: string
          ultimo_pedido_id: string | null
          visible_para_socio: boolean
        }
        Insert: {
          actualizado_en?: string
          campana_id?: string | null
          canal_agente?: string
          cita_id?: string | null
          columna_kanban?: string
          compartido_por_admin?: boolean
          correo?: string | null
          creado_en?: string
          dias_sin_contacto?: number
          intencion?: string
          nombre?: string | null
          nota_agente?: string | null
          nota_socio?: string | null
          origen?: string | null
          pais_id?: string | null
          prospecto_id?: string
          respuestas_json?: Json
          socio_id?: string | null
          telefono?: string | null
          temperatura?: string
          tenant_id: string
          transcripcion_texto?: string | null
          transcripcion_voz_url?: string | null
          ultimo_contacto?: string
          ultimo_pedido_id?: string | null
          visible_para_socio?: boolean
        }
        Update: {
          actualizado_en?: string
          campana_id?: string | null
          canal_agente?: string
          cita_id?: string | null
          columna_kanban?: string
          compartido_por_admin?: boolean
          correo?: string | null
          creado_en?: string
          dias_sin_contacto?: number
          intencion?: string
          nombre?: string | null
          nota_agente?: string | null
          nota_socio?: string | null
          origen?: string | null
          pais_id?: string | null
          prospecto_id?: string
          respuestas_json?: Json
          socio_id?: string | null
          telefono?: string | null
          temperatura?: string
          tenant_id?: string
          transcripcion_texto?: string | null
          transcripcion_voz_url?: string | null
          ultimo_contacto?: string
          ultimo_pedido_id?: string | null
          visible_para_socio?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "prospectos_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["campana_id"]
          },
          {
            foreignKeyName: "prospectos_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["pais_id"]
          },
          {
            foreignKeyName: "prospectos_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "prospectos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      recursos: {
        Row: {
          activo: boolean
          capacidad: number
          creado_en: string
          nombre: string
          recurso_id: string
          tenant_id: string
          tipo: string
        }
        Insert: {
          activo?: boolean
          capacidad?: number
          creado_en?: string
          nombre: string
          recurso_id?: string
          tenant_id: string
          tipo?: string
        }
        Update: {
          activo?: boolean
          capacidad?: number
          creado_en?: string
          nombre?: string
          recurso_id?: string
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "recursos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      servicios: {
        Row: {
          activo: boolean
          color_calendario: string | null
          creado_en: string
          descripcion: string | null
          duracion_minutos: number
          moneda: string | null
          nombre: string
          precio: number | null
          servicio_id: string
          tenant_id: string
        }
        Insert: {
          activo?: boolean
          color_calendario?: string | null
          creado_en?: string
          descripcion?: string | null
          duracion_minutos: number
          moneda?: string | null
          nombre: string
          precio?: number | null
          servicio_id?: string
          tenant_id: string
        }
        Update: {
          activo?: boolean
          color_calendario?: string | null
          creado_en?: string
          descripcion?: string | null
          duracion_minutos?: number
          moneda?: string | null
          nombre?: string
          precio?: number | null
          servicio_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      socio_assets: {
        Row: {
          activo: boolean
          alt_text: string | null
          asset_id: string
          creado_en: string
          orden: number
          socio_id: string
          tenant_id: string
          tipo: string
          url: string
        }
        Insert: {
          activo?: boolean
          alt_text?: string | null
          asset_id?: string
          creado_en?: string
          orden?: number
          socio_id: string
          tenant_id: string
          tipo: string
          url: string
        }
        Update: {
          activo?: boolean
          alt_text?: string | null
          asset_id?: string
          creado_en?: string
          orden?: number
          socio_id?: string
          tenant_id?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "socio_assets_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["usuario_id"]
          },
          {
            foreignKeyName: "socio_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      socios: {
        Row: {
          actualizado_en: string
          avatar_url: string | null
          correo: string
          creado_en: string
          estado: string
          fecha_fin_campana: string | null
          fecha_ingreso: string
          fecha_inicio_pago: string | null
          foto_url: string | null
          nombre_completo: string
          pais_registro: string | null
          telefono: string | null
          tenant_id: string
          tier: string
          usuario_id: string
          voz_url: string | null
        }
        Insert: {
          actualizado_en?: string
          avatar_url?: string | null
          correo: string
          creado_en?: string
          estado?: string
          fecha_fin_campana?: string | null
          fecha_ingreso?: string
          fecha_inicio_pago?: string | null
          foto_url?: string | null
          nombre_completo: string
          pais_registro?: string | null
          telefono?: string | null
          tenant_id: string
          tier?: string
          usuario_id: string
          voz_url?: string | null
        }
        Update: {
          actualizado_en?: string
          avatar_url?: string | null
          correo?: string
          creado_en?: string
          estado?: string
          fecha_fin_campana?: string | null
          fecha_ingreso?: string
          fecha_inicio_pago?: string | null
          foto_url?: string | null
          nombre_completo?: string
          pais_registro?: string | null
          telefono?: string | null
          tenant_id?: string
          tier?: string
          usuario_id?: string
          voz_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "socios_pais_registro_fkey"
            columns: ["pais_registro"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "socios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenants: {
        Row: {
          activo: boolean
          creado_en: string
          dominio_custom: string | null
          industria: string | null
          modulo_activo: string | null
          nombre: string
          plan: string
          requiere_cita: boolean
          tenant_id: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          dominio_custom?: string | null
          industria?: string | null
          modulo_activo?: string | null
          nombre: string
          plan?: string
          requiere_cita?: boolean
          tenant_id?: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          dominio_custom?: string | null
          industria?: string | null
          modulo_activo?: string | null
          nombre?: string
          plan?: string
          requiere_cita?: boolean
          tenant_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
      prospectos_historico: {
        Row: any
        Insert: any
        Update: any
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agendar_cita: {
        Args: {
          p_canal_origen?: string
          p_disponibilidad_id: string
          p_notas_agente?: string
          p_prospecto_id: string
          p_recurso_id: string
          p_servicio_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      mover_kanban: {
        Args: {
          p_destino: string
          p_nota?: string
          p_prospecto_id: string
          p_socio_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
