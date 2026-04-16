# Arquitectura Maestra — SaaS Multi-Nicho
**Última actualización:** Sprint 11 completado · 2026-04-11

---

## Resumen Ejecutivo

Sistema **multi-tenant, multi-nicho** con un núcleo CRM universal al que se conectan módulos especializados por industria. El agente conversacional califica prospectos siguiendo los **5 Momentos de la Constitución del Agente** (`MISION_AGENTE.md`), recomienda productos con lenguaje legal exacto, activa el flujo MLM de afiliación, y deposita la tarjeta automáticamente en el Kanban del socio.

**Primer nicho:** MLM Bienestar — validación de ingredientes, cumplimiento regulatorio por país, ciclos de recompra de 6 meses, voz clonada del socio con fallback a TTS.

**Stack fijo:**
| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 + React 19 + TypeScript |
| Estilos | Tailwind CSS 3.4 + framer-motion |
| Backend / BD | Supabase (Auth + PostgreSQL + RLS + Storage) |
| AI Engine | Vercel AI SDK v5 + OpenAI `gpt-4o-mini` |
| Validación | Zod |
| Estado | Zustand |
| Audio | Web Audio API (client-side, sin deps externas) |

---

## Mapa de Rutas

```
/                       → Landing pública (en construcción)
/login                  → Auth Supabase
/dashboard              → Kanban leads + Catálogo campañas
/perfil                 → Motor de Identidad + Estudio de Voz (tabs)
/auditoria              → Ciclo de vida de prospectos (solo auditores)
/admin                  → Validar Identidades + Calidad de Audio (tabs, solo auditores)
/admin/perfil/[id]      → Aprobación individual de assets de un socio
/api/agente             → Endpoint público de streaming AI
/api/socio/*            → APIs del socio autenticado
/api/admin/*            → APIs de auditoría (requieren es_auditor=true)
/api/dashboard/*        → APIs del dashboard (requieren sesión)
/api/auditoria/*        → APIs del ciclo de vida
```

---

## Diagrama ERD (actualizado)

```mermaid
erDiagram

    tenants {
        uuid tenant_id PK
        varchar nombre
        varchar plan
        varchar industria
        boolean activo
    }

    socios {
        uuid usuario_id PK
        uuid tenant_id FK
        varchar nombre_completo
        varchar correo
        varchar foto_url
        varchar avatar_url
        varchar voz_url
        varchar id_afiliado UK
        boolean es_auditor
        text estado
        timestamptz creado_en
    }

    perfiles_socio {
        uuid socio_id PK_FK
        uuid tenant_id FK
        varchar voz_clonada_id
        varchar voz_proveedor
        boolean voz_aprobada
        boolean avatar_aprobado
        text estilo_comunicacion
        text tipo_cierre
        varchar callcenter_url
        varchar callcenter_telefono
        varchar portal_registro_url
        text mensaje_cierre_custom
        uuid validado_por FK
        timestamptz validado_en
        text nota_validacion
        timestamptz creado_en
        timestamptz actualizado_en
    }

    audios_socio {
        uuid id PK
        uuid socio_id FK
        uuid tenant_id FK
        varchar clave
        text guion
        varchar audio_url
        text estado
        double lufs_estimado
        double snr_estimado
        double pico_db
        double duracion_segundos
        integer sample_rate_original
        boolean requiere_regrabacion
        uuid validado_por FK
        timestamptz validado_en
        text nota_admin
        timestamptz creado_en
        timestamptz actualizado_en
    }

    campanas {
        uuid campana_id PK
        uuid tenant_id FK
        uuid socio_id FK
        uuid pais_id FK
        uuid condicion_salud_id FK
        uuid knowledge_base_id FK
        varchar nombre
        varchar tipo
        varchar estado
        varchar agente_tipo
        varchar landing_url
        boolean requiere_cita
        timestamptz creado_en
    }

    prospectos {
        uuid prospecto_id PK
        uuid tenant_id FK
        uuid socio_id FK
        uuid campana_id FK
        varchar nombre
        varchar telefono
        varchar correo
        varchar columna_kanban
        text estado_temperatura
        boolean resumen_validado
        text transcripcion_texto
        integer dias_sin_contacto
        timestamptz creado_en
        timestamptz actualizado_en
    }

    interacciones_leads {
        uuid id PK
        uuid prospecto_id FK
        uuid tenant_id FK
        text tipo
        text contenido
        text rol
        boolean es_historia
        boolean es_resumen
        jsonb metadata_json
        timestamptz creado_en
    }

    eventos_lead {
        uuid id PK
        uuid prospecto_id FK
        uuid socio_id FK
        uuid tenant_id FK
        text tipo
        boolean procesado
        jsonb payload
        timestamptz creado_en
    }

    notificaciones_leads {
        uuid id PK
        uuid prospecto_id FK
        uuid socio_id FK
        uuid tenant_id FK
        text canal
        text estado
        text mensaje
        timestamptz creado_en
    }

    afiliaciones {
        uuid id PK
        uuid prospecto_id FK
        uuid socio_id FK
        uuid tenant_id FK
        text tipo_cierre
        text script_entregado
        text estado
        timestamptz creado_en
    }

    socios ||--|| perfiles_socio : "tiene perfil"
    socios ||--o{ audios_socio : "graba frases"
    socios ||--o{ campanas : "crea"
    prospectos ||--o{ interacciones_leads : "tiene historial"
    prospectos ||--o{ eventos_lead : "genera eventos"
    prospectos ||--o{ notificaciones_leads : "notifica"
    prospectos ||--o{ afiliaciones : "inicia afiliación"
    campanas }o--o| prospectos : "entra por"
```

---

## Estado de Sprints

### Sprint 1 — Base de Datos ✅ COMPLETADO
**21 tablas · RLS 100% · 8 triggers · 3 funciones · 15 índices parciales**

Tablas: `tenants`, `paises`, `socios`, `socio_assets`, `knowledge_bases`, `condiciones_salud`, `campanas`, `ingredientes`, `productos`, `producto_ingredientes`, `productos_por_pais`, `condicion_productos_por_pais`, `prospectos`, `movimientos_kanban`, `notificaciones`, `pedidos`, `ciclos_consumo`, `servicios`, `recursos`, `disponibilidad`, `citas`, `modulos_crm`

Funciones: `set_actualizado_en()`, `mover_kanban()`, `agendar_cita()`, `custom_access_token_hook()`

---

### Sprint 2 — Auth + API Base ✅ COMPLETADO

| Archivo | Descripción |
|---------|-------------|
| `src/lib/supabase/types.ts` | Tipos generados del schema real |
| `src/lib/supabase/client|server|middleware.ts` | Clientes tipados |
| `src/middleware.ts` | Protege `/dashboard/*` |
| `src/app/api/kanban/` | `prospectos`, `mover`, `archivar` |
| `src/app/api/campanas/route.ts` | GET + POST campañas |
| `src/app/api/agente/route.ts` | POST streaming AI (v inicial) |

---

### Sprint 3 — Dashboard Kanban ✅ COMPLETADO
**Auditoría 11/11 checks aprobada · 2026-04-05**

| Componente | Descripción |
|-----------|-------------|
| `KanbanBoard`, `KanbanColumn`, `ProspectoCard`, `MoverModal` | Tablero completo con audit trail |
| `CatalogoCampanas` | Sidebar de campañas activas |
| `tests/audit-kanban.test.ts` | Guard permanente de integridad |

---

### Sprint 4 — Agente Conversacional IA ✅ COMPLETADO

| Archivo | Descripción |
|---------|-------------|
| `src/app/api/agente/route.ts` | Streaming con `gpt-4o-mini`, system prompt dinámico |
| `src/features/agente/services/contextual-data.service.ts` | Carga campaña + KB + productos en una query |
| `src/features/agente/services/identity.service.ts` | `cargarIdentidadSocio()`, `buildIdentityInstructions()` — 3 fases (calificacion/cierre/afiliacion) |
| `src/features/agente/services/contexto-historico.service.ts` | `ingestarContextoHistorico()`, `leerContextoAgente()` — resumen ejecutivo con AI |
| `src/features/agente/types/agente.types.ts` | `ContextualData` interface |

**Señales del agente (en texto generado):**
- `[DATOS_COMPLETOS]` → capturó nombre + email + teléfono
- `[LISTO_CIERRE]` → activa Switch de Cierre → mueve Kanban → notifica socio
- `[AFILIACION_LISTA]` → activa flujo MLM → entrega ID afiliado + script
- `[SCRIPT_LLAMADA_ENTREGADO]` → script callcenter entregado al lead
- `[AFILIACION_EN_PROCESO]` → lead en proceso de registro online

---

### Sprint 5 — Dashboard Mejorado ✅ COMPLETADO

| Componente | Descripción |
|-----------|-------------|
| `KanbanLeads` | Kanban rediseñado con botón WhatsApp en tarjetas |
| `LeadQuickAdd` | Floating button para captura rápida (con contexto previo opcional) |
| `BulkImport` | Importación masiva CSV (con `historial_contexto` opcional) |
| `AlertaTimbre` | SSE en tiempo real — suena cuando `[LISTO_CIERRE]` detectado |

---

### Sprint 6 — Motor de Auditoría ✅ COMPLETADO

**Tablas creadas:**
- `interacciones_leads` — historial completo de conversaciones (RLS: socio ve texto, auditor ve todo)
- `interacciones_privado` — notas internas del equipo
- `scripts_maestros` — guiones de venta editables por admin
- Bucket privado `audios_leads` en Supabase Storage

**APIs:**
- `GET/POST /api/auditoria/interacciones`
- `GET /api/auditoria/logs`
- `GET /api/auditoria/resumen`
- `POST /api/auditoria/restaurar`
- `GET /api/auditoria/dataset-export` → exporta a `.claude/memory/dataset_cierre/` para fine-tuning

---

### Sprint 7 — Ingesta de Contexto Histórico ✅ COMPLETADO

Pipeline de contexto:
```
Lead creado con historial previo
  → ingestarContextoHistorico() — guarda original + AI genera resumen ejecutivo
  → se almacena en interacciones_leads con es_historia=true, es_resumen=true
  → leerContextoAgente(prospecto_id) — agente lo carga en cada conversación
  → si resumen_validado=true → agente lo usa con total confianza
  → si resumen_validado=false → agente lo usa con precaución
```

---

### Sprint 8 — Control de Calidad de Contexto ✅ COMPLETADO

| Archivo | Descripción |
|---------|-------------|
| `src/app/api/admin/leads/resumen/[id_lead]/route.ts` | GET resumen + PUT para editar y validar |
| `prospectos.resumen_validado` | Flag booleano — cambia comportamiento del agente |

---

### Sprint 9 — Embudo de Fuerza + Switch de Cierre ✅ COMPLETADO

**Tablas creadas:** `eventos_lead`, `notificaciones_leads`  
**Campo nuevo:** `prospectos.estado_temperatura` (`frio` | `templado` | `listo_cierre`)

| Archivo | Descripción |
|---------|-------------|
| `src/features/embudo/services/embudo.service.ts` | `dispararLeadIniciadoLote()`, `activarSwitchCierre()` (idempotente) |
| `src/features/embudo/services/afiliacion.service.ts` | `iniciarFlujoAfiliacion()`, scripts CallCenter y automático |
| `src/app/api/dashboard/alertas/stream/route.ts` | SSE — polling cada 8s, cierre stream a 5min |
| `AlertaTimbre.tsx` | Bell animado, `document.title` flash, link "Ver conversación" |

**Blindaje:** agente NUNCA comparte WhatsApp/teléfono del socio hasta señal `[LISTO_CIERRE]`.

---

### Sprint 10 — Motor de Identidad ✅ COMPLETADO

**Tabla creada:** `perfiles_socio` (voz_clonada_id, estilo_comunicacion, tipo_cierre, voz_aprobada, avatar_aprobado, etc.)  
**Campo nuevo:** `socios.id_afiliado` (auto-generado, único, usado en flujo MLM)

| Archivo | Descripción |
|---------|-------------|
| `src/features/dashboard/components/PerfilIdentidad.tsx` | ID de afiliado (read-only), estilo, voz ElevenLabs, tipo cierre, URLs, mensaje custom |
| `src/features/dashboard/components/NavBar.tsx` | Top-bar sticky, role-aware (Admin link solo para auditores), responsive |
| `src/app/(main)/layout.tsx` | Monta NavBar en todas las rutas principales |
| `src/app/(main)/perfil/page.tsx` | Tabs: Motor de Identidad + Estudio de Voz |
| `src/app/api/socio/perfil/route.ts` | GET/PUT — devuelve `es_auditor` para NavBar |

---

### Sprint 11 — Estudio de Voz + Validador de Identidad ✅ COMPLETADO

**Tabla creada:** `audios_socio` (7 frases maestras por socio, con métricas de calidad)  
**Bucket privado:** `audios_socio` en Supabase Storage  
**Migración pendiente de ejecución manual:** `20260409_audio_calidad.sql` (columnas SNR/LUFS/peak)

**Pipeline de normalización de audio (100% client-side, Web Audio API):**
```
Archivo subido → decodeAudioData
  → High-pass filter 80Hz  (elimina ruido HVAC/fondo)
  → DynamicsCompressor     (ecualiza dinámica de voz)
  → Gain → target -14 LUFS (EBU R128 / estándar streaming)
  → Limiter -1dBTP         (previene clipping)
  → Resample 44.1kHz mono
  → Export WAV 16-bit PCM
  → Análisis: LUFS, SNR, peak, duración
  → Si SNR < 10dB → requiere_regrabacion = true + aviso al socio
```

**Fallback en cascada (voice-middleware.service.ts):**
```
Voz clonada ElevenLabs [si voz_aprobada=true]
  → Audio grabado del socio  [si estado='validado']
    → TTS genérico           [siempre disponible — venta nunca se detiene]
```

| Archivo | Descripción |
|---------|-------------|
| `src/features/agente/services/voice-middleware.service.ts` | Cascading fallback, `resolverVoiceAsset()`, `FRASES_MAESTRAS` |
| `src/features/dashboard/services/audio-processor.service.ts` | Web Audio pipeline completo |
| `src/features/dashboard/components/EstudioVoz.tsx` | Teleprompter, upload normalizado, reproductor, SNR warnings, delete |
| `src/features/dashboard/components/AdminIdentidades.tsx` | Lista socios con estado de aprobación, enlace a detalle |
| `src/features/dashboard/components/AdminAudiosCalidad.tsx` | Tabla SNR/LUFS/peak por frase, filtro "Solo con problemas" |
| `src/features/dashboard/components/AdminPerfilSocio.tsx` | Escuchar + Aprobar/Rechazar/Pendiente por frase + aprobación global |
| `src/app/(main)/admin/page.tsx` | Tabs: Validar Identidades + Calidad de Audio |
| `src/app/(main)/admin/perfil/[socio_id]/page.tsx` | Aprobación individual por socio |
| `src/app/api/socio/audios/route.ts` | GET frases + POST guion |
| `src/app/api/socio/audios/upload/route.ts` | Multipart upload + métricas de calidad |
| `src/app/api/socio/audios/[clave]/route.ts` | DELETE — borra Storage + resetea a pendiente |
| `src/app/api/socio/audios/signed-url/route.ts` | URL firmada 1h para reproductor |
| `src/app/api/admin/identidades/route.ts` | Lista socios + estado aprobación + conteo audios pendientes |
| `src/app/api/admin/audios-calidad/route.ts` | Métricas de calidad por socio (solo auditores) |
| `src/app/api/admin/perfil-identidad/[socio_id]/route.ts` | GET/PUT — aprobación de assets individuales |

---

### Sprint 12 — LiveFlowWidget + MISIÓN AGENTE ✅ COMPLETADO

| Archivo | Descripción |
|---------|-------------|
| `.claude/PRPs/MISION_AGENTE.md` | **Constitución del Agente** — 5 Momentos del flujo de ventas, inmutable |
| `src/features/landing/components/LiveFlowWidget.tsx` | Kanban Ghost animado con framer-motion |
| `src/app/api/admin/actividad-global/route.ts` | Conteos agregados sin PII para el widget |
| `NEXT_PUBLIC_ACTIVITY_MODE` en `.env.local` | `'simulated'` \| `'real'` — interruptor de actividad |

**LiveFlowWidget — Modos:**
- `simulated`: strings predefinidos + intervalos aleatorios 1.8s–4.5s (para landing sin tráfico)
- `real`: fetch a `/api/admin/actividad-global` cada 30s — solo conteos por país, nunca PII

---

## Constitución del Agente — Los 5 Momentos

Definida en `.claude/PRPs/MISION_AGENTE.md`. Resumen de cumplimiento obligatorio:

| # | Momento | Trigger | Acción |
|---|---------|---------|--------|
| 1 | Gancho de entrada | 5s después de landing | Mensaje automático de calificación |
| 2 | 3 preguntas de filtro | Secuencial, una a la vez | Rutas Sí/No con lógica propia |
| 3 | Entrega calificada | Tras las 3 preguntas | Recomendación personalizada + botón a compra |
| 4 | Rescate frío | Exit-intent (no completó flujo) | Captura nombre + número → Kanban automático |
| 5 | Bifurcación MLM | Post-conversión | Social proof `[X] socios` → pregunta de reclutamiento |

**Regla absoluta:** El agente **no vende, filtra**. Todo texto legal usa `lenguaje_agente` de la BD. Nunca improvisa.

---

## Flujo de Cierre Completo (end-to-end)

```
Lead en landing
  ↓ [5 segundos]
Gancho de entrada (Momento 1)
  ↓
3 preguntas de filtro (Momento 2)
  ↓ calificado
Recomendación personalizada (Momento 3)
  ↓ interés alto
[LISTO_CIERRE] en texto del agente
  ↓
activarSwitchCierre()
  ├─ prospectos.estado_temperatura = 'listo_cierre'
  ├─ prospectos.columna_kanban = 'propuesta_enviada'
  ├─ INSERT eventos_lead (tipo='listo_cierre')
  └─ Email al socio con datos del lead + resumen
  ↓
AlertaTimbre en dashboard del socio (SSE)
  ↓ lead pide registrarse
[AFILIACION_LISTA] en texto del agente
  ↓
iniciarFlujoAfiliacion()
  ├─ INSERT afiliaciones
  ├─ Entrega ID afiliado + script callcenter o link portal
  └─ Notificación al socio
  ↓ post-conversión
Snippet social proof (Momento 5a) + pregunta reclutamiento (Momento 5b)
  ↓ si interesado en negocio
columna_kanban = 'Interesado en Negocio'
```

---

## API Routes — Inventario Completo

### Públicas (sin auth)
| Método | Ruta | Función |
|--------|------|---------|
| POST | `/api/agente` | Streaming AI — agente conversacional |
| GET | `/api/leads/ref` | Captura lead por referido |
| GET | `/api/admin/actividad-global` | Conteos para LiveFlowWidget (sin PII) |

### Socio autenticado
| Método | Ruta | Función |
|--------|------|---------|
| GET/PUT | `/api/socio/perfil` | Perfil de identidad |
| GET/POST | `/api/socio/audios` | Frases maestras |
| POST | `/api/socio/audios/upload` | Upload audio normalizado |
| DELETE | `/api/socio/audios/[clave]` | Eliminar audio |
| GET | `/api/socio/audios/signed-url` | URL firmada reproducción |
| GET | `/api/socio/afiliaciones` | Historial de afiliaciones |
| GET/POST | `/api/dashboard/leads` | CRUD leads |
| POST | `/api/dashboard/leads/bulk` | Importación masiva |
| POST | `/api/dashboard/leads/mover` | Mover columna kanban |
| GET | `/api/dashboard/alertas/stream` | SSE cierre en tiempo real |
| GET | `/api/dashboard/campanas` | Campañas del socio |

### Admin / Auditor (`es_auditor=true`)
| Método | Ruta | Función |
|--------|------|---------|
| GET | `/api/admin/identidades` | Lista socios + estado aprobación |
| GET | `/api/admin/audios-calidad` | Métricas SNR/LUFS por socio |
| GET/PUT | `/api/admin/perfil-identidad/[socio_id]` | Aprobar/rechazar assets |
| GET/PUT | `/api/admin/leads/resumen/[id_lead]` | Editar + validar resumen ejecutivo |
| GET | `/api/auditoria/resumen` | Métricas de ciclo de vida |
| GET | `/api/auditoria/logs` | Audit trail paginado |
| POST | `/api/auditoria/restaurar` | Restaurar prospecto archivado |
| GET | `/api/auditoria/dataset-export` | Export para fine-tuning |

---

## Tablas de BD — Estado Actual

| Tabla | Sprint | Filas clave |
|-------|--------|------------|
| `tenants` | 1 | tenant_id, plan, activo |
| `paises` | 1 | codigo, nombre, moneda |
| `socios` | 1+10 | usuario_id, id_afiliado, es_auditor |
| `perfiles_socio` | 10 | voz_clonada_id, voz_aprobada, estilo_comunicacion, tipo_cierre |
| `audios_socio` | 11 | clave, audio_url, estado, snr_estimado, lufs_estimado |
| `socio_assets` | 1 | tipo, url, orden |
| `knowledge_bases` | 1 | sintomas_json, preguntas_json, objeciones_json |
| `condiciones_salud` | 1 | nombre, knowledge_base_id |
| `campanas` | 1 | socio_id, condicion_salud_id, agente_tipo |
| `ingredientes` | 1 | usos_json, estudios_json, nivel_evidencia |
| `productos` | 1 | nombre, activo |
| `producto_ingredientes` | 1 | cantidad_mg, rol |
| `productos_por_pais` | 1 | precio_local, registro_sanitario |
| `condicion_productos_por_pais` | 1 | lenguaje_agente (inmutable) |
| `prospectos` | 1+7+8+9 | columna_kanban, estado_temperatura, resumen_validado |
| `interacciones_leads` | 6+7 | es_historia, es_resumen, contenido |
| `eventos_lead` | 9 | tipo, procesado, payload |
| `notificaciones_leads` | 9 | canal, estado, mensaje |
| `afiliaciones` | 9 | tipo_cierre, script_entregado, estado |
| `movimientos_kanban` | 1 | inmutable (solo INSERT) |
| `pedidos` | 1 | precio_pagado, estado_envio |
| `ciclos_consumo` | 1 | mes_actual, fecha_proximo_contacto |
| `citas` | 1 | estado, recordatorio_24h_enviado |
| `disponibilidad` | 1 | estado (bloqueo FOR UPDATE NOWAIT) |

**Buckets Storage:** `audios_leads` (privado), `audios_socio` (privado)

---

## Decisiones de Arquitectura

| Decisión | Razón |
|---|---|
| `pais_id` vive en `campanas`, no en `socios` | Un socio puede operar en N países simultáneamente |
| `movimientos_kanban` es inmutable (solo INSERT) | Audit trail legal del pipeline |
| `lenguaje_agente` se escribe una vez en BD | El agente nunca improvisa texto legal |
| `registro_sanitario` en `productos_por_pais` | Escudo legal por país — sin él el agente no menciona el producto |
| `agendar_cita()` usa `FOR UPDATE NOWAIT` | Doble-booking imposible bajo concurrencia |
| Señales en texto del LLM (`[LISTO_CIERRE]`, etc.) | El agente no llama APIs directamente — las señales activan servicios en `onFinish` |
| `activarSwitchCierre()` es idempotente | Puede llamarse N veces sin efectos secundarios duplicados |
| Normalización de audio en el cliente (Web Audio API) | Sin límites de timeout de Vercel, sin deps externas, funciona en cualquier browser moderno |
| `voz_aprobada` en `perfiles_socio` | Ningún asset de voz llega a producción sin aprobación del auditor |
| `NEXT_PUBLIC_ACTIVITY_MODE` como interruptor | LiveFlowWidget funciona en landing sin tráfico real (simulated) y escala a datos reales |
| Sin PII en `/api/admin/actividad-global` | El widget de landing es público — solo conteos por país, nunca datos personales |
| Frases maestras predefinidas (7 claves fijas) | El agente siempre tiene un fallback TTS para cada momento del guion |

---

## Reglas de Negocio y Seguridad

### Aislamiento Multi-Tenant
```sql
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```
El `tenant_id` llega vía `custom_access_token_hook` — sin él ninguna política RLS funciona.

### Kanban Inmutable
`movimientos_kanban`: solo INSERT permitido por RLS. El trail es legal e irreversible.

### Blindaje del Agente
1. El agente nunca comparte WhatsApp/teléfono del socio hasta señal `[LISTO_CIERRE]`
2. El agente nunca improvisa texto legal — usa `lenguaje_agente` de la BD
3. Síntomas graves → protocolo de emergencia médica inmediata
4. Voz clonada requiere `voz_aprobada=true` — fallback automático si no

### Privacidad en LiveFlowWidget
- Modo `real`: solo conteos aggregados + país (nivel país, no ciudad)
- Endpoint público sin auth — nunca expone stack trace, falla silenciosamente

---

## Credenciales del Proyecto

| Recurso | Valor |
|---|---|
| Supabase Project Ref | `rgcntceelzttponmehte` |
| Supabase URL | `https://rgcntceelzttponmehte.supabase.co` |
| tenant_id demo | `00000000-0000-0000-0000-000000000001` |

---

## Instrucción de Mantenimiento

> **Este archivo debe actualizarse al finalizar cada Sprint.**
>
> 1. Cambiar estado de `🔲 Pendiente` a `✅ COMPLETADO`
> 2. Agregar tabla de archivos creados
> 3. Documentar nuevas decisiones de arquitectura
> 4. Actualizar fecha en el encabezado
>
> El objetivo: cualquier desarrollador nuevo lee este archivo y entiende el sistema completo en menos de 10 minutos.

---

## PRPs Activos

| Archivo | Descripción |
|---------|-------------|
| `.claude/PRPs/sprint-10-11.md` | Motor de Identidad + Estudio de Voz — COMPLETADO |
| `.claude/PRPs/MISION_AGENTE.md` | **Constitución del Agente** — 5 Momentos del flujo de ventas |
