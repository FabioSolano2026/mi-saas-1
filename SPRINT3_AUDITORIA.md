# Checklist de Auditoría — Sprint 3: Dashboard Kanban
**Auditor:** _______________  
**Fecha de revisión:** _______________  
**Sprint:** 3 · Dashboard Kanban (Frontend)

---

## FASE 1 — Integridad de Datos (Backend)

### 1.1 Protección RLS por tenant_id

| # | Verificación | Archivo | Estado |
|---|---|---|---|
| 1.1.1 | `GET /api/kanban/prospectos` filtra solo por `socio_id` del user autenticado (RLS automático) | `src/app/api/kanban/prospectos/route.ts` | ⬜ |
| 1.1.2 | `POST /api/kanban/mover` verifica `auth.getUser()` antes de llamar `mover_kanban()` | `src/app/api/kanban/mover/route.ts` | ⬜ |
| 1.1.3 | `GET /api/campanas` filtra por `socio_id = user.id` + RLS de tenant | `src/app/api/campanas/route.ts` | ⬜ |
| 1.1.4 | `PATCH /api/notificaciones` verifica `.eq('socio_id', user.id)` explícito | `src/app/api/notificaciones/route.ts` | ⬜ |
| 1.1.5 | Ningún componente React llama a Supabase directamente (solo via API Routes) | `src/features/kanban/**` | ⬜ |
| 1.1.6 | Auth Hook activado en Supabase Dashboard → `tenant_id` presente en JWT | Supabase Dashboard · Auth · Hooks | ⬜ |

**Resultado Fase 1.1:** ___/6 checks aprobados

---

### 1.2 Convención de nombres (tablas y columnas)

| # | Verificación | Referencia | Estado |
|---|---|---|---|
| 1.2.1 | Tipos TypeScript usan nombres exactos de columnas de BD (`correo`, no `email`; `notif_id`, no `id`) | `src/lib/supabase/types.ts` | ⬜ |
| 1.2.2 | Columna `columna_kanban` (no `status`, no `stage`) usada en filtros y agrupación | `kanban.types.ts` | ⬜ |
| 1.2.3 | Campo `intencion` (sin tilde, no `intención`) en `ProspectoCard` | `ProspectoCard.tsx` | ⬜ |
| 1.2.4 | Campo `dias_sin_contacto` (snake_case) mapeado correctamente en la tarjeta | `ProspectoCard.tsx` | ⬜ |
| 1.2.5 | Las 9 columnas del Kanban usan los valores exactos de `columna_kanban` de la BD | `kanban.types.ts` | ⬜ |

**Valores válidos de `columna_kanban`:**
```
nuevo_prospecto · contactado · calificado · interesado ·
propuesta_enviada · negociacion · cliente_activo · perdido · descartado
```

**Resultado Fase 1.2:** ___/5 checks aprobados

---

### 1.3 Índices en columnas de búsqueda frecuente

| # | Verificación | Índice en BD | Estado |
|---|---|---|---|
| 1.3.1 | `prospectos(tenant_id)` indexado (creado en Sprint 1) | `idx_prospectos_tenant` | ⬜ |
| 1.3.2 | `prospectos(columna_kanban)` tiene índice parcial WHERE activo | `idx_prospectos_kanban` | ⬜ |
| 1.3.3 | `notificaciones(socio_id, enviada)` indexado para polling | Verificar en Supabase | ⬜ |
| 1.3.4 | `campanas(socio_id, estado)` indexado para listado | Verificar en Supabase | ⬜ |

**Resultado Fase 1.3:** ___/4 checks aprobados

---

**TOTAL FASE 1:** ___/15 · Umbral mínimo: 13/15

---

## FASE 2 — Seguridad de Acceso (Frontend)

### 2.1 Uso correcto del cliente Supabase

| # | Verificación | Archivo | Estado |
|---|---|---|---|
| 2.1.1 | Los hooks usan `fetch('/api/...')` en vez de llamar Supabase directamente | `useKanban.ts`, `useMoverProspecto.ts` | ⬜ |
| 2.1.2 | `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo `src/features/` | `grep -r SERVICE_ROLE src/features/` = vacío | ⬜ |
| 2.1.3 | `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún componente `.tsx` del dashboard | `grep -r SERVICE_ROLE src/app/(main)/` = vacío | ⬜ |
| 2.1.4 | Si se usa Supabase Realtime en el cliente, usa `createBrowserClient` con `anon key` | `useKanban.ts` (si aplica) | ⬜ |

**Resultado Fase 2.1:** ___/4 checks aprobados

---

### 2.2 Validación de sesión antes de renderizar

| # | Verificación | Archivo | Estado |
|---|---|---|---|
| 2.2.1 | `src/middleware.ts` redirige a `/login` si no hay sesión en rutas `/dashboard/*` | `src/middleware.ts` | ⬜ |
| 2.2.2 | `layout.tsx` del grupo `(main)` verifica sesión server-side antes de renderizar | `src/app/(main)/layout.tsx` | ⬜ |
| 2.2.3 | El componente `KanbanBoard` muestra estado de carga mientras `useKanban` resuelve | `KanbanBoard.tsx` | ⬜ |
| 2.2.4 | Si la API devuelve 401, el frontend redirige a `/login` (no queda pantalla en blanco) | `kanban.service.ts` | ⬜ |
| 2.2.5 | No se renderizan datos de prospecto antes de que `user` esté definido | `useKanban.ts` | ⬜ |

**Resultado Fase 2.2:** ___/5 checks aprobados

---

### 2.3 Validaciones de permisos por rol

| # | Verificación | Archivo | Estado |
|---|---|---|---|
| 2.3.1 | El botón "Mover prospecto" solo aparece si `user.id === prospecto.socio_id` o rol `admin` | `ProspectoCard.tsx` / `MoverModal.tsx` | ⬜ |
| 2.3.2 | El botón "Crear campaña" solo aparece para roles `socio` o `admin` (no solo autenticado) | `CampanaForm.tsx` | ⬜ |
| 2.3.3 | No hay acción de "Eliminar prospecto" en el UI — `movimientos_kanban` es inmutable | `KanbanBoard.tsx`, `ProspectoCard.tsx` | ⬜ |
| 2.3.4 | El campo `temperatura` (frío/tibio/caliente) es solo lectura en el frontend (lo calcula el agente) | `ProspectoCard.tsx` | ⬜ |

**Resultado Fase 2.3:** ___/4 checks aprobados

---

**TOTAL FASE 2:** ___/13 · Umbral mínimo: 12/13

---

## FASE 3 — Calidad de Proceso (Auditoría)

### 3.1 Arquitectura modular (feature-first)

| # | Verificación | Ruta esperada | Estado |
|---|---|---|---|
| 3.1.1 | Todos los componentes del Kanban están bajo `src/features/kanban/components/` | No en `src/app/` ni `src/components/` | ⬜ |
| 3.1.2 | Los hooks del Kanban están bajo `src/features/kanban/hooks/` | `useKanban.ts`, `useMoverProspecto.ts` | ⬜ |
| 3.1.3 | El servicio fetch está bajo `src/features/kanban/services/` | `kanban.service.ts` | ⬜ |
| 3.1.4 | Los tipos del Kanban están bajo `src/features/kanban/types/` | `kanban.types.ts` | ⬜ |
| 3.1.5 | Feature Campañas sigue la misma estructura en `src/features/campanas/` | components + hooks | ⬜ |
| 3.1.6 | Feature Notificaciones sigue la misma estructura en `src/features/notificaciones/` | components + hooks | ⬜ |
| 3.1.7 | No se crearon archivos fuera de `src/` ni archivos de configuración nuevos innecesarios | `ls raíz del proyecto` | ⬜ |

**Resultado Fase 3.1:** ___/7 checks aprobados

---

### 3.2 Calidad del código

| # | Verificación | Criterio | Estado |
|---|---|---|---|
| 3.2.1 | Ningún archivo supera 500 líneas | `wc -l src/features/**/*.tsx` | ⬜ |
| 3.2.2 | No se usa `any` — se usa `unknown` o tipos de `Database` | `grep -r ": any" src/features/` = vacío | ⬜ |
| 3.2.3 | Los tipos del Kanban derivan de `Database['public']['Tables']['prospectos']['Row']` | `kanban.types.ts` | ⬜ |
| 3.2.4 | Las funciones tienen máximo 50 líneas | Revisión visual | ⬜ |
| 3.2.5 | `npm run build` completa sin errores de TypeScript | Terminal | ⬜ |
| 3.2.6 | Variables y funciones en `camelCase`, componentes en `PascalCase`, archivos en `kebab-case` | Revisión visual | ⬜ |

**Resultado Fase 3.2:** ___/6 checks aprobados

---

### 3.3 Actualización de documentación

| # | Verificación | Archivo | Estado |
|---|---|---|---|
| 3.3.1 | `ARQUITECTURA_MAESTRA.md` tiene Sprint 3 marcado como ✅ COMPLETADO | `ARQUITECTURA_MAESTRA.md` | ⬜ |
| 3.3.2 | Se listaron los nuevos archivos creados en la tabla del Sprint 3 | `ARQUITECTURA_MAESTRA.md` | ⬜ |
| 3.3.3 | `PLAN_EJECUCION.md` refleja el estado actual del sprint | `PLAN_EJECUCION.md` | ⬜ |
| 3.3.4 | Si se tomó alguna decisión de arquitectura nueva, se documentó en la tabla de decisiones | `ARQUITECTURA_MAESTRA.md` | ⬜ |
| 3.3.5 | La fecha de última actualización de `ARQUITECTURA_MAESTRA.md` fue actualizada | Línea 2 del archivo | ⬜ |

**Resultado Fase 3.3:** ___/5 checks aprobados

---

**TOTAL FASE 3:** ___/18 · Umbral mínimo: 16/18

---

## Resumen de Auditoría

| Fase | Obtenido | Máximo | Umbral | Estado |
|------|----------|--------|--------|--------|
| Fase 1 — Integridad de Datos | ___ | 15 | 13 | ⬜ |
| Fase 2 — Seguridad de Acceso | ___ | 13 | 12 | ⬜ |
| Fase 3 — Calidad de Proceso | ___ | 18 | 16 | ⬜ |
| **TOTAL** | **___** | **46** | **41** | ⬜ |

### Resultado Final
- ✅ **Sprint aprobado:** 41/46 o más checks aprobados, sin ningún check crítico fallido
- ⚠️ **Revisión requerida:** Entre 35-40 — corregir antes de iniciar Sprint 4
- ❌ **Sprint bloqueado:** Menos de 35 — no iniciar Sprint 4

### Checks críticos (bloquean el Sprint aunque todo lo demás pase)
- [ ] **1.1.6** — Auth Hook activado en Supabase (sin esto RLS no funciona)
- [ ] **2.1.2** — `SERVICE_ROLE_KEY` no expuesta en frontend
- [ ] **2.2.1** — Middleware protege `/dashboard/*`
- [ ] **3.2.5** — Build sin errores TypeScript

---

*Checklist generado para el proyecto SaaS Multi-Nicho · Sprint 3 · 2026-04-04*  
*Actualizar este archivo al finalizar el Sprint.*
