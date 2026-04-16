# PRP-10-11: Motor de Identidad + Estudio de Grabación

> **Estado**: COMPLETADO
> **Fecha**: 2026-04-10
> **Proyecto**: SaaS Multi-Nicho (AgenteVoz)

---

## Objetivo

Permitir que cada socio configure su identidad completa (voz clonada, estilo de comunicación, tipo de cierre, URLs de afiliación) y grabe sus frases maestras para que el agente las use en llamadas de voz. Un equipo auditor puede revisar, aprobar o rechazar cada asset antes de que el agente los active.

---

## Por Qué

El agente representa al socio frente a leads reales. Un audio de mala calidad o una voz no aprobada puede destruir la conversión. El validador asegura que **ningún asset defectuoso llega a producción**. El agente siempre tiene un fallback (TTS genérico con el estilo del socio) para que **la venta nunca se detenga**.

---

## Qué (Comportamiento)

### Motor de Identidad (`/perfil → Tab 1`)
- Socio configura: `id_afiliado` (solo lectura), `voz_clonada_id` (ElevenLabs), `estilo_comunicacion`, `tipo_cierre`, URLs de callcenter/portal, mensaje de cierre custom
- API: `GET/PUT /api/socio/perfil`
- Tabla: `perfiles_socio`

### Estudio de Voz (`/perfil → Tab 2`)
- 7 frases maestras predefinidas: `saludo_inicial`, `presentacion_producto`, `manejo_objecion`, `cierre_afiliacion`, `mencion_id`, `cierre_llamada`, `seguimiento`
- Pipeline de normalización **100% cliente** (Web Audio API, sin deps):
  - High-pass filter 80 Hz → elimina ruido de fondo
  - DynamicsCompressor → ecualiza dinámica de voz
  - Gain normalization → target **-14 LUFS** (EBU R128)
  - Limiter -1 dBTP → previene clipping
  - Resample → 44 100 Hz WAV 16-bit PCM
- Métricas calculadas: `lufs_estimado`, `snr_estimado`, `pico_db`, `duracion_segundos`
- Si `SNR < 10 dB` → `requiere_regrabacion = true` + aviso al socio
- APIs: `GET/POST /api/socio/audios`, `POST /api/socio/audios/upload`, `DELETE /api/socio/audios/[clave]`, `GET /api/socio/audios/signed-url`
- Tabla: `audios_socio`

### Fallback en Cascada (Voice Middleware)
```
Voz clonada (ElevenLabs) [si voz_aprobada=true]
  → Audio grabado del socio  [si estado='validado']
    → TTS genérico           [siempre disponible]
```
Nunca lanza excepción. La venta nunca se detiene.

### Validador de Identidad — Admin (`/admin → Tab 1`)
- Lista socios con estado de aprobación: `voz_aprobada`, `avatar_aprobado`, audios pendientes
- Enlace a detalle `/admin/perfil/[socio_id]` para aprobar/rechazar individualmente
- API: `GET /api/admin/identidades`

### Dashboard de Calidad de Audio (`/admin → Tab 2`)
- SNR, LUFS, peak, duración por frase por socio
- Filtro "Solo con problemas" (`requiere_regrabacion=true`)
- API: `GET /api/admin/audios-calidad`

### Aprobación Individual (`/admin/perfil/[socio_id]`)
- Auditor puede escuchar el audio con URL firmada (1h)
- Aprobar / Rechazar / Devolver a pendiente por frase
- Aprobar voz clonada y avatar globalmente
- Nota de feedback visible al socio
- API: `GET/PUT /api/admin/perfil-identidad/[socio_id]`

### Navegación Global (`NavBar`)
- Sticky top-bar en todas las rutas `(main)/`
- Links: Dashboard · Mi Perfil · Auditoría · **Admin** (solo auditores)
- Detecta `es_auditor` via `/api/socio/perfil`
- Responsive: horizontal en desktop, dropdown en mobile
- Sign-out integrado

---

## Contexto Técnico

### Archivos de servicio
| Archivo | Rol |
|---------|-----|
| `src/features/agente/services/voice-middleware.service.ts` | Cascading fallback, `resolverVoiceAsset()`, `cargarFrasesSocio()` |
| `src/features/agente/services/identity.service.ts` | `cargarIdentidadSocio()`, `buildIdentityInstructions()`, `voz_aprobada` check |
| `src/features/dashboard/services/audio-processor.service.ts` | Web Audio pipeline, `procesarAudio()`, análisis SNR/LUFS |

### Componentes UI
| Componente | Ruta |
|-----------|------|
| `NavBar` | `src/features/dashboard/components/NavBar.tsx` |
| `PerfilIdentidad` | `src/features/dashboard/components/PerfilIdentidad.tsx` |
| `EstudioVoz` | `src/features/dashboard/components/EstudioVoz.tsx` |
| `AdminIdentidades` | `src/features/dashboard/components/AdminIdentidades.tsx` |
| `AdminAudiosCalidad` | `src/features/dashboard/components/AdminAudiosCalidad.tsx` |
| `AdminPerfilSocio` | `src/features/dashboard/components/AdminPerfilSocio.tsx` |

### Páginas
| URL | Componentes montados |
|-----|---------------------|
| `/perfil` | `PerfilIdentidad` + `EstudioVoz` (tabs) |
| `/admin` | `AdminIdentidades` + `AdminAudiosCalidad` (tabs) |
| `/admin/perfil/[socio_id]` | `AdminPerfilSocio` |

### APIs
| Método | Ruta | Auth |
|--------|------|------|
| GET/PUT | `/api/socio/perfil` | Socio autenticado |
| GET/POST | `/api/socio/audios` | Socio autenticado |
| POST | `/api/socio/audios/upload` | Socio autenticado |
| DELETE | `/api/socio/audios/[clave]` | Socio autenticado |
| GET | `/api/socio/audios/signed-url` | Socio autenticado (verifica owner) |
| GET | `/api/admin/identidades` | `es_auditor = true` |
| GET | `/api/admin/audios-calidad` | `es_auditor = true` |
| GET/PUT | `/api/admin/perfil-identidad/[socio_id]` | `es_auditor = true` |

### DB Migrations aplicadas
```sql
-- 20260409_audios_socio.sql
-- audios_socio table + RLS (socio_own, auditor_read, auditor_update)
-- perfiles_socio: voz_aprobada, avatar_aprobado, validado_por, validado_en, nota_validacion

-- 20260409_audio_calidad.sql  ← PENDIENTE EJECUCIÓN MANUAL EN SUPABASE SQL EDITOR
ALTER TABLE audios_socio
  ADD COLUMN IF NOT EXISTS lufs_estimado         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS snr_estimado          DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pico_db               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS duracion_segundos     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sample_rate_original  INTEGER,
  ADD COLUMN IF NOT EXISTS requiere_regrabacion  BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## Blueprint de Implementación

### Fase 1 — Servicios y Middleware ✅
- [x] `voice-middleware.service.ts` — cascading fallback completo
- [x] `audio-processor.service.ts` — Web Audio pipeline (HPF + compresión + normalización + WAV export)
- [x] `identity.service.ts` — añadir `voz_aprobada` + `avatar_aprobado`

### Fase 2 — APIs Socio ✅
- [x] `GET/POST /api/socio/audios`
- [x] `POST /api/socio/audios/upload` (multipart + métricas de calidad)
- [x] `DELETE /api/socio/audios/[clave]`
- [x] `GET /api/socio/audios/signed-url`
- [x] `GET/PUT /api/socio/perfil` (añadir `es_auditor`)

### Fase 3 — APIs Admin ✅
- [x] `GET /api/admin/identidades`
- [x] `GET /api/admin/audios-calidad`
- [x] `GET/PUT /api/admin/perfil-identidad/[socio_id]`

### Fase 4 — Componentes UI ✅
- [x] `NavBar` — sticky, role-aware, responsive
- [x] `PerfilIdentidad` — identidad completa del socio
- [x] `EstudioVoz` — teleprompter + upload + normalización + reproductor + SNR warnings
- [x] `AdminIdentidades` — lista socios con estado aprobación
- [x] `AdminAudiosCalidad` — tabla SNR/LUFS por frase
- [x] `AdminPerfilSocio` — panel de aprobación individual

### Fase 5 — Routing y Layout ✅
- [x] `(main)/layout.tsx` — monta `NavBar`
- [x] `(main)/perfil/page.tsx` — tabs Identidad + Estudio de Voz
- [x] `(main)/admin/page.tsx` — tabs Identidades + Calidad de Audio
- [x] `(main)/admin/perfil/[socio_id]/page.tsx` — detalle de aprobación

### Fase 6 — Limpieza ✅
- [x] Eliminar botón "Salir" duplicado de `AuditorDashboard` (lo maneja NavBar)
- [x] Eliminar bloque de debug `console.log` de `AuditorDashboard`

---

## Aprendizajes (Self-Annealing)

| # | Error | Fix | Aplicar en |
|---|-------|-----|-----------|
| 1 | `Waveform` no existe en lucide-react | Verificar imports antes de usar | Todos los nuevos componentes |
| 2 | `NavBar` usa `createClient` del browser (no server) | Import de `@/lib/supabase/client`, no `server` | Cualquier componente Client con auth |
| 3 | `AuditorDashboard` tenía sign-out propio | Con NavBar global, eliminarlo para evitar duplicación | Refactor de componentes que predatan el layout |
| 4 | Migración `audio_calidad` no pudo aplicarse automáticamente (no hay SUPABASE_PAT en `.env.local`) | Ejecutar SQL manualmente en Dashboard de Supabase | Siempre verificar credenciales antes de intentar migrations vía Management API |
