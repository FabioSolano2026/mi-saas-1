# Plan de Ejecución — SaaS Multi-Nicho
**Última actualización:** 2026-04-04
**Estado actual:** Sprint 1 completado ✅

---

## Visión General

Sistema multi-tenant multi-nicho con un núcleo universal (el aeropuerto) al que se conectan módulos CRM especializados por industria. El agente conversacional califica prospectos, recomienda productos con lenguaje legal exacto, agenda citas si el nicho lo requiere, y deposita la tarjeta en el Kanban del socio.

**Stack fijo:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4 + Supabase + Vercel AI SDK v5 + Zod + Zustand

---

## Estado por Sprint

| Sprint | Enfoque | Estado |
|--------|---------|--------|
| Sprint 1 | Base de datos completa (21 tablas) | ✅ Completado |
| Sprint 2 | Auth + API + Tipos TypeScript | 🔲 Pendiente |
| Sprint 3 | Dashboard Kanban (frontend) | 🔲 Pendiente |
| Sprint 4 | Agente conversacional con IA | 🔲 Pendiente |
| Sprint 5 | Landing pages personalizadas | 🔲 Pendiente |
| Sprint 6 | Notificaciones + Crons | 🔲 Pendiente |
| Sprint 7 | Módulo MLM Bienestar (primer nicho) | 🔲 Pendiente |

---

## Sprint 1 — Base de Datos ✅ COMPLETADO

**21 tablas en Supabase · RLS 100% · 8 triggers · 3 funciones · 15 índices parciales**

### Prompts ejecutados
- [x] **1.1** — `tenants`, `paises`, `socios` + RLS + seed (6 países + tenant demo)
- [x] **1.2** — `knowledge_bases`, `condiciones_salud` + 3 KBs reales del dominio MLM
- [x] **1.3** — `campanas` + función `mover_kanban()` atómica
- [x] **1.4** — `ingredientes`, `productos`, `producto_ingredientes`, `productos_por_pais`, `condicion_productos_por_pais` + matriz de recomendación completa
- [x] **1.5** — `prospectos`, `movimientos_kanban` + 3 prospectos seed en Kanban
- [x] **1.6** — `notificaciones`, `pedidos` (vacía), `ciclos_consumo` (vacía)
- [x] **1.7** — `servicios`, `recursos`, `disponibilidad`, `citas`, `modulos_crm` + función `agendar_cita()` atómica
- [x] **Extra** — `socio_assets` para landing pages personalizadas (N fotos por tipo)

### Artefactos generados
- `schema.dbml` — 21 tablas completas para dbdiagram.io
- `PLAN_EJECUCION.md` — este archivo

---

## Sprint 2 — Auth + API + Tipos TypeScript

**Objetivo:** Conectar el frontend con la base de datos. Sin este sprint el dashboard no puede leer nada.

### Prerequisito crítico — Auth Hook (Prompt 2.1)
Sin esto, las políticas RLS no funcionan. El `tenant_id` no existe en los JWT.

```sql
-- Hook en Supabase Auth → custom_access_token_hook
-- Inyecta tenant_id en el JWT al hacer login
SELECT tenant_id FROM socios WHERE usuario_id = auth.uid()
→ jwt.claims.tenant_id = resultado
```

**Archivos a crear:**
- `supabase/migrations/auth_hook.sql`
- Activar el hook en Supabase Dashboard → Auth → Hooks

### Prompt 2.1 — Auth Hook + Tipos TypeScript
- [ ] Crear función `auth.custom_access_token_hook()`
- [ ] Activar hook en Supabase Dashboard
- [ ] Generar `src/lib/supabase/types.ts` (21 tablas tipadas)
- [ ] Actualizar `src/lib/supabase/client.ts` → `createBrowserClient<Database>`
- [ ] Actualizar `src/lib/supabase/server.ts` → `createServerClient<Database>`
- [ ] Crear `src/lib/supabase/middleware.ts` para refresh de sesión

### Prompt 2.2 — API Routes del Kanban
```
src/app/api/
├── kanban/
│   ├── prospectos/route.ts     GET  → tablero agrupado por columna
│   └── mover/route.ts          POST → llama mover_kanban() + Zod validation
├── campanas/
│   └── route.ts                GET / POST
├── notificaciones/
│   └── route.ts                GET / PATCH (marcar leída)
└── disponibilidad/
    └── route.ts                GET → slots disponibles por fecha
```

### Prompt 2.3 — API Route del Agente (endpoint público)
```
src/app/api/agente/
└── route.ts    POST (sin auth) → recibe campana_id + mensaje
                                → carga KB + productos + lenguaje_agente
                                → devuelve respuesta del agente
                                → inserta prospecto al cerrar conversación
```

### Prompt 2.4 — Middleware de autenticación
```
src/middleware.ts   → protege /dashboard/* con session check
                   → redirige a /login si no hay sesión
```

---

## Sprint 3 — Dashboard Kanban (Frontend)

**Objetivo:** El socio puede ver y gestionar sus prospectos en tiempo real.

### Prompt 3.1 — Layout principal + navegación
```
src/app/(main)/
├── layout.tsx          → sidebar + header + notif badge
└── dashboard/
    └── page.tsx        → entry point del Kanban
```

### Prompt 3.2 — Feature Kanban
```
src/features/kanban/
├── components/
│   ├── KanbanBoard.tsx        → 9 columnas drag-and-drop
│   ├── KanbanColumn.tsx       → columna individual con contador
│   ├── ProspectoCard.tsx      → tarjeta con temperatura + días sin contacto
│   └── MoverModal.tsx         → modal para mover + nota
├── hooks/
│   ├── useKanban.ts           → carga y agrupa prospectos por columna
│   └── useMoverProspecto.ts   → llama /api/kanban/mover
├── services/
│   └── kanban.service.ts      → fetch wrapper con tipos
└── types/
    └── kanban.types.ts        → ProspectoCard, KanbanColumn, etc.
```

### Prompt 3.3 — Feature Campañas
```
src/features/campanas/
├── components/
│   ├── CampanasList.tsx       → listado con estado + país + condición
│   ├── CampanaForm.tsx        → crear/editar campaña
│   └── CampanaStats.tsx       → prospectos por columna de esta campaña
└── hooks/
    └── useCampanas.ts
```

### Prompt 3.4 — Feature Notificaciones
```
src/features/notificaciones/
├── components/
│   ├── NotifBadge.tsx         → contador en el header
│   └── NotifPanel.tsx         → panel lateral con alertas
└── hooks/
    └── useNotificaciones.ts   → polling cada 30s o realtime
```

---

## Sprint 4 — Agente Conversacional con IA

**Objetivo:** El agente califica prospectos, recomienda con lenguaje legal exacto, y deposita en el Kanban.

### Prompt 4.1 — Setup base Vercel AI SDK v5
```
src/features/agente/
├── services/
│   └── agente.service.ts      → carga KB + productos + lenguaje_agente por campana_id
├── prompts/
│   └── sistema.prompt.ts      → prompt maestro con KB inyectado
└── tools/
    └── agente.tools.ts        → guardar_prospecto() | agendar_cita() | escalar_socio()
```

### Prompt 4.2 — Motor de calificación
- [ ] Cargar KB de la condición de la campaña
- [ ] Ejecutar las 3 preguntas en orden
- [ ] Calcular temperatura (frío/tibio/caliente) según respuestas
- [ ] Detectar intención (producto/negocio/ambos/ninguno)
- [ ] Aplicar lenguaje prohibido → reemplazos legales automáticos
- [ ] Activar protocolo de derivación médica si detecta señales de alerta

### Prompt 4.3 — Motor de recomendación
- [ ] Query a `condicion_productos_por_pais` por condición + país de la campaña
- [ ] Presentar producto con `lenguaje_agente` exacto
- [ ] Citar ingredientes con `nivel_evidencia` correcto
- [ ] Mencionar `registro_sanitario` + `ente_regulador`

### Prompt 4.4 — Flujo de agendamiento (si `requiere_cita = TRUE`)
- [ ] Consultar `disponibilidad` en tiempo real
- [ ] Presentar slots disponibles al prospecto
- [ ] Llamar `agendar_cita()` al confirmar
- [ ] Mover prospecto a `cliente_activo` en el Kanban

### Prompt 4.5 — Landing pública del agente
```
src/app/(public)/
└── [landing_url]/
    └── page.tsx    → carga datos del socio (foto, nombre, campana_id)
                   → inicializa el chat del agente
```

---

## Sprint 5 — Landing Pages Personalizadas

**Objetivo:** Cada socio tiene una landing pública con su foto, assets y el agente embebido.

### Prompt 5.1 — Generador de landing
```
src/features/landing/
├── components/
│   ├── LandingHero.tsx         → foto_banner + título + CTA
│   ├── LandingPerfil.tsx       → foto_perfil + nombre + condición
│   ├── LandingTestimonios.tsx  → foto_testimonio + texto
│   ├── LandingAntesDespues.tsx → pares foto_antes/foto_despues
│   └── LandingAgente.tsx       → chat embebido del agente
└── hooks/
    └── useLandingAssets.ts     → carga socio_assets agrupados por tipo
```

### Prompt 5.2 — Gestión de assets del socio
```
src/features/perfil/
├── components/
│   ├── AssetUploader.tsx       → upload a Supabase Storage + INSERT en socio_assets
│   ├── AssetReorder.tsx        → drag-and-drop para orden_display
│   └── AssetGallery.tsx        → galería por tipo con preview
└── hooks/
    └── useSocioAssets.ts
```

### Prompt 5.3 — Supabase Storage buckets
- [ ] Crear bucket `fotos-socios` (foto_perfil, foto_banner)
- [ ] Crear bucket `testimonios` (foto_testimonio, antes/después)
- [ ] Crear bucket `videos` (video_presentacion)
- [ ] Políticas de acceso público para lectura, privado para escritura

---

## Sprint 6 — Notificaciones + Crons

**Objetivo:** El sistema alerta automáticamente al socio en los 3 momentos críticos.

### Prompt 6.1 — Cron: prospecto caliente
- [ ] Supabase Edge Function (cron cada hora)
- [ ] Query: prospectos con `temperatura = 'caliente'` sin notificación enviada
- [ ] Insertar en `notificaciones` + enviar WhatsApp via Twilio/Meta API

### Prompt 6.2 — Cron: tarjeta en riesgo (72h)
- [ ] Supabase Edge Function (cron cada noche)
- [ ] Query: prospectos con `dias_sin_contacto >= 3` fuera de columnas finales
- [ ] Actualizar `dias_sin_contacto` de todos los prospectos activos
- [ ] Insertar alertas de riesgo en `notificaciones`

### Prompt 6.3 — Cron: resumen diario
- [ ] Supabase Edge Function (cron 8am)
- [ ] Generar resumen: total prospectos, calientes, en riesgo, cerrados en semana
- [ ] Enviar por email vía Resend

### Prompt 6.4 — Recordatorios de citas
- [ ] Edge Function (cron cada hora)
- [ ] Query: citas `confirmadas` con `fecha` en próximas 24h sin `recordatorio_24h_enviado`
- [ ] Query: citas `confirmadas` con `fecha` en próximas 2h sin `recordatorio_2h_enviado`
- [ ] Enviar WhatsApp + marcar flags

---

## Sprint 7 — Módulo MLM Bienestar (Primer Nicho)

**Objetivo:** El primer módulo especializado completo. Define el patrón para todos los nichos siguientes.

### Prompt 7.1 — Tablas del módulo
```sql
-- Tablas independientes del núcleo, con tenant_id
CREATE TABLE mlm_ciclos_recompra   -- seguimiento mes a mes
CREATE TABLE mlm_red_socios        -- estructura de red de reclutamiento
CREATE TABLE mlm_comisiones        -- comisiones por nivel
```

### Prompt 7.2 — Flujo de recompra automatizado
- [ ] Activar `pedidos` y `ciclos_consumo` (tablas del Sprint 1 que están vacías)
- [ ] Al crear un pedido → crear ciclo 6 meses → calcular `fecha_proximo_contacto`
- [ ] Cron mensual: detectar ciclos que vencen → activar agente posventa
- [ ] El agente posventa usa KB de tipo `posventa` para la recompra

### Prompt 7.3 — Feature Ciclos en el dashboard
```
src/features/ciclos/
├── components/
│   ├── CiclosList.tsx          → clientes activos con mes actual
│   ├── CicloTimeline.tsx       → línea de tiempo 6 meses con estado
│   └── RecompraAlert.tsx       → alertas de próxima recompra
```

### Prompt 7.4 — Reporte de reclutamiento
- [ ] Query sobre `movimientos_kanban` para conversión por campaña
- [ ] Métricas: tasa de calificación, tiempo promedio de cierre, tasa de retención mes 1→6

---

## Sprints Futuros (Post MVP)

| Sprint | Módulo | Trigger |
|--------|--------|---------|
| Sprint 8 | Módulo Salón de Belleza | Primer cliente salón |
| Sprint 9 | Módulo Clínica Dental | Primer cliente dental |
| Sprint 10 | Módulo Escuela de Manejo | Primer cliente escuela |
| Sprint 11 | Agente de Voz (tier premium_voz) | Demanda suficiente |
| Sprint 12 | Agente Avatar (tier premium_avatar) | Demanda suficiente |
| Sprint 13 | Panel Admin multi-tenant | Segundo cliente en plataforma |
| Sprint 14 | Dominio personalizado por tenant | Primer cliente enterprise |

---

## Decisiones de Arquitectura Clave (No Cambiar)

| Decisión | Razón |
|---|---|
| `pais_id` vive en `campanas`, no en `socios` | Un socio puede operar en N países simultáneamente |
| `condiciones_salud.nombre` es VARCHAR libre | Admin agrega condiciones sin deploy |
| `modulo_destino` es VARCHAR libre | Extensible a cualquier nicho sin migration |
| `movimientos_kanban` es inmutable (solo INSERT) | Audit trail legal del pipeline |
| `lenguaje_agente` se escribe una vez en DB | El agente nunca improvisa texto legal |
| `registro_sanitario` en `productos_por_pais` | Escudo legal por país sin el cual el agente no opera |
| `agendar_cita()` usa `FOR UPDATE NOWAIT` | Doble-booking imposible bajo concurrencia |
| `foto_url` en socios + tabla `socio_assets` | `foto_url` para compatibilidad, `socio_assets` para landing |

---

## Credenciales del Proyecto

| Recurso | Valor |
|---|---|
| Supabase Project Ref | `rgcntceelzttponmehte` |
| Supabase URL | En `.env.local` como `NEXT_PUBLIC_SUPABASE_URL` |
| tenant_id demo | `00000000-0000-0000-0000-000000000001` |
| Stack | Next.js 16 + React 19 + TypeScript + Tailwind 3.4 |
