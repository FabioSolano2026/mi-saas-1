# Guía de Pruebas de Datos — SaaS Multi-Nicho
**Versión:** 1.0 | **Fecha:** Abril 2026  
**Proyecto:** SaaS Multi-Nicho — Nicho MLM Bienestar  
**Destinatario:** Cualquier persona que necesite validar el sistema sin conocimientos técnicos

---

## ¿Qué se está probando?

El sistema tiene un **agente conversacional con inteligencia artificial** que guía a prospectos (posibles clientes) a través de 7 momentos clave. Cada momento mueve automáticamente al prospecto en un tablero Kanban (como un tablero de tareas) dentro de la base de datos.

Esta guía cubre **tres áreas de prueba**:

1. **Prueba del Flujo Completo del Agente** (M1 → M7) — automatizada con script
2. **Prueba Manual del Dashboard** — navegación por la interfaz web
3. **Verificación de Datos en Supabase** — confirmación directa en base de datos

---

## Requisitos Previos

| Requisito | Detalle |
|-----------|---------|
| Servidor corriendo | Ejecutar `npm run dev` en la carpeta del proyecto |
| URL del sistema | `http://localhost:3000` (desarrollo) |
| Credenciales admin | `costaricapuravida@gmail.com` / `PuraVida2026$` |
| Node.js instalado | Para ejecutar el script de prueba automática |
| Acceso Supabase | `https://supabase.com/dashboard/project/rgcntceelzttponmehte` |

---

## ÁREA 1 — Prueba Automática del Flujo del Agente (M1 → M7)

### ¿Qué hace esta prueba?

Simula una conversación completa entre un prospecto y el agente de IA, verificando que:
- El agente responde correctamente en cada etapa
- Las señales internas del sistema se emiten en el momento correcto
- El prospecto queda registrado en la base de datos con la columna Kanban correcta

### Paso a Paso

**Paso 1 — Abrir una terminal en la carpeta del proyecto**
```
c:\saasmultinicho\mi-nuevo-saas
```

**Paso 2 — Asegurarse de que el servidor está corriendo**
```bash
npm run dev
```
Esperar a que aparezca: `✓ Ready on http://localhost:3000`

**Paso 3 — Abrir UNA SEGUNDA terminal y ejecutar el script**
```bash
node scripts/test-flujo-agente.mjs
```

**Paso 4 — Leer los resultados**

El script muestra cada turno de la conversación con íconos de color:
- `✅` — La prueba pasó correctamente
- `⚠️` — Advertencia (el agente puede emitir señales en turnos adyacentes — es normal)
- `❌` — Error crítico que debe investigarse

---

### Qué verificar en cada Momento

| Momento | Descripción | Señal esperada | Columna Kanban resultante |
|---------|-------------|----------------|--------------------------|
| **M1** | El agente da bienvenida | ninguna todavía | nuevo_prospecto |
| **M2** | 3 preguntas de calificación (una por turno) | `[M2_PREGUNTAS_COMPLETADAS]` al final del turno 3 | nuevo_prospecto |
| **M3** | Agente entrega recomendación de productos | `[M3_RECOMENDACION_ENTREGADA]` | en_seguimiento |
| **M3-contacto** | Prospecto da nombre, correo y teléfono | `[DATOS_COMPLETOS]` y `[LISTO_CIERRE]` | listo_para_cerrar |
| **M5a** | Agente inyecta prueba social (socios en tu área) | `[M5A_PRUEBA_SOCIAL_INYECTADA]` | listo_para_cerrar |
| **M5b** | Prospecto pregunta sobre ganar dinero | `[INTERES_NEGOCIO]` | propuesta_enviada |
| **M6** | Agente muestra potencial financiero ($200–$500) | `[M6_POTENCIAL_MOSTRADO]` + `[INTERES_NEGOCIO]` | propuesta_enviada |
| **M7** | Prospecto pide el enlace de registro | `[AFILIACION_LISTA]` + `[DATOS_COMPLETOS]` | **cliente_activo** |

### Resultado Final Esperado

Al terminar el script, la sección `── Verificar Kanban en Supabase ──` debe mostrar:
```
✅ Prospecto encontrado en BD
ℹ  Columna:  cliente_activo
✅ Kanban en columna correcta: "cliente_activo"
```

### Mensajes que el Script Envía al Agente

El script simula a un prospecto real con estos mensajes (no cambiarlos):

| Turno | Quién | Mensaje |
|-------|-------|---------|
| T1 | Prospecto | "Sí, tengo 43 años." |
| T2 | Prospecto | "Sí, he notado menos energía y tengo que levantarme varias veces en la noche." |
| T3 | Prospecto | "He probado algunas vitaminas pero no vi resultados, lo dejé después de un mes." |
| T4 | Prospecto | "Entiendo, ¿cuál sería el protocolo adecuado para mí?" |
| T5 | Prospecto | "Perfecto, me interesa. Me llamo Carlos Méndez, mi correo es carlos@gmail.com y mi número es 8888-1234." |
| T6 | Prospecto | "Sí, quiero comprarlo. ¿Cuál es el siguiente paso?" |
| T7 | Prospecto | "¿Ustedes tienen algún plan para que yo también pueda recomendar los productos y ganar dinero?" |
| T8 | Prospecto | "Me interesa. ¿Cuánto puedo ganar aproximadamente?" |
| T9 | Prospecto | "Sí, envíame el enlace de registro. Quiero empezar." |

---

## ÁREA 2 — Prueba Manual del Dashboard (Interfaz Web)

### Acceso al Sistema

1. Abrir el navegador en `http://localhost:3000`
2. Iniciar sesión con:
   - **Email:** `costaricapuravida@gmail.com`
   - **Contraseña:** `PuraVida2026$`

---

### Prueba 2.1 — Carga del Dashboard Principal

**Pasos:**
1. Iniciar sesión
2. Verificar que aparece el Dashboard sin errores

**Qué verificar:**

| Elemento | Resultado esperado |
|----------|--------------------|
| Página carga sin mensaje de error rojo | ✅ |
| Pestaña "Campañas" muestra lista (puede estar vacía) | ✅ |
| NO aparece el mensaje `invalid input syntax for type uuid` | ✅ |
| NO aparece pantalla en blanco | ✅ |

> **Nota:** Si antes aparecía el error `invalid input syntax for type uuid: ""`, ese bug fue corregido. Ya NO debe aparecer.

---

### Prueba 2.2 — Catálogo de Campañas

**Pasos:**
1. En el dashboard, ir a la sección de Campañas (panel izquierdo)
2. Verificar que la lista carga correctamente

**Qué verificar:**

| Elemento | Resultado esperado |
|----------|--------------------|
| La lista carga (puede estar vacía si no hay campañas activas asignadas) | ✅ |
| Si hay campañas, se muestra nombre, tipo y estado | ✅ |
| El botón de activar/pausar campaña responde sin error | ✅ |

---

### Prueba 2.3 — Kanban de Prospectos

**Pasos:**
1. Ejecutar primero el script de prueba automática (Área 1) para tener datos
2. Ir al Dashboard → sección Kanban o Leads
3. Buscar al prospecto "Carlos Méndez"

**Qué verificar:**

| Elemento | Resultado esperado |
|----------|--------------------|
| El prospecto "Carlos Méndez" aparece en el tablero | ✅ |
| La columna donde aparece es `cliente_activo` | ✅ |
| Se pueden ver los datos: nombre, correo, teléfono | ✅ |
| Se puede mover la tarjeta a otra columna manualmente | ✅ |

---

### Prueba 2.4 — Otras Pestañas del Dashboard

Verificar que las demás secciones cargan sin errores:

| Sección | Qué verificar |
|---------|---------------|
| **Mi Perfil** | Muestra datos del usuario admin, sin errores |
| **Auditoría** | Carga historial de interacciones (puede estar vacío) |
| **Admin** | Visible solo si `rol = admin`; muestra opciones de gestión |

---

## ÁREA 3 — Verificación Directa en Supabase

### Acceso a Supabase

1. Ir a: `https://supabase.com/dashboard/project/rgcntceelzttponmehte`
2. Iniciar sesión con la cuenta de Supabase del proyecto

---

### Prueba 3.1 — Verificar Prospectos Creados por el Agente

**Pasos:**
1. En Supabase, ir a **Table Editor → prospectos**
2. Buscar registros con `origen = 'landing_agente'`

**Qué verificar en cada prospecto:**

| Campo | Valor esperado después del flujo completo |
|-------|-------------------------------------------|
| `nombre` | Carlos Méndez (o el nombre que dio el prospecto) |
| `correo` | carlos@gmail.com |
| `telefono` | 8888-1234 |
| `columna_kanban` | `cliente_activo` |
| `origen` | `landing_agente` |
| `canal_agente` | `texto` |
| `temperatura` | `tibio` |

---

### Prueba 3.2 — Verificar Columnas Kanban Válidas

Las columnas del Kanban tienen valores restringidos por la base de datos. Solo se aceptan estos valores:

| Columna | Cuando se asigna |
|---------|-----------------|
| `nuevo_prospecto` | Al primer mensaje del prospecto |
| `en_seguimiento` | Cuando el agente entrega la recomendación (M3) |
| `propuesta_enviada` | Cuando el prospecto muestra interés en el negocio (M5b/M6) |
| `listo_para_cerrar` | Cuando el prospecto confirma que quiere comprar |
| `cliente_activo` | Cuando el prospecto se afilia como socio (M7) |
| `contactado` | Asignado manualmente por el socio |
| `no_interesado` | Prospecto descartado |
| `sin_respuesta` | Sin respuesta después de contacto |
| `reagendar` | Se necesita reprogramar el contacto |

> **Importante:** Cualquier otro valor causará un error silencioso en la base de datos. Nunca escribir valores como `interesado_producto`, `interesado_negocio` u otros que no estén en esta lista.

---

### Prueba 3.3 — Verificar el Usuario Admin

**Pasos:**
1. En Supabase, ir a **Table Editor → socios**
2. Filtrar por `correo = 'costaricapuravida@gmail.com'`

**Qué verificar:**

| Campo | Valor esperado |
|-------|----------------|
| `correo` | costaricapuravida@gmail.com |
| `tenant_id` | 20d529bf-6a5c-4c82-8cc1-1e1de1e2ebff |
| `tier` | premium_texto |
| `rol` | admin |
| `estado` | activo |

---

### Prueba 3.4 — Verificar el Hook de Autenticación

Este hook inyecta el `tenant_id` en el token JWT al iniciar sesión. Es crítico para que el dashboard funcione.

**Pasos:**
1. En Supabase, ir a **Authentication → Hooks**
2. Verificar que el hook `custom_access_token_hook` está **habilitado** (toggle en verde)

Si el hook está deshabilitado, el dashboard cargará sin campañas y puede mostrar errores de UUID.

---

## Checklist de Prueba Completa

Usar este checklist para documentar los resultados:

```
ÁREA 1 — Flujo Automático del Agente
[ ] Script ejecutado sin errores de red (errores ❌ = 0)
[ ] M2: señal [M2_PREGUNTAS_COMPLETADAS] detectada en turno 3
[ ] M3: señal [M3_RECOMENDACION_ENTREGADA] detectada
[ ] M3-contacto: señal [DATOS_COMPLETOS] detectada
[ ] M5a: señal [M5A_PRUEBA_SOCIAL_INYECTADA] detectada
[ ] M5b: señal [INTERES_NEGOCIO] detectada
[ ] M6: señal [M6_POTENCIAL_MOSTRADO] detectada
[ ] M7: señal [AFILIACION_LISTA] detectada
[ ] Kanban final = "cliente_activo" ✅

ÁREA 2 — Dashboard Web
[ ] Login funciona sin errores
[ ] Dashboard carga sin mensaje de error UUID
[ ] Catálogo de campañas carga (vacío o con datos)
[ ] Prospecto "Carlos Méndez" visible en Kanban
[ ] Columna del prospecto = "cliente_activo"
[ ] Pestaña Mi Perfil carga sin errores
[ ] Pestaña Auditoría carga sin errores

ÁREA 3 — Supabase
[ ] Prospecto creado con datos correctos (nombre, correo, teléfono)
[ ] columna_kanban = "cliente_activo"
[ ] Usuario admin: tier=premium_texto, rol=admin, estado=activo
[ ] Hook de autenticación habilitado
```

---

## Errores Comunes y Soluciones

| Error | Causa probable | Solución |
|-------|---------------|----------|
| `invalid input syntax for type uuid: ""` | El usuario no tiene `tenant_id` en su JWT | Verificar que el hook de auth está habilitado en Supabase |
| `Campaña no encontrada o inactiva` | La campaña de prueba no existe o está pausada | Ir a Supabase → tabla `campanas` → verificar que la campaña `00000000-0000-0000-0000-200000000001` existe y tiene `estado = 'activa'` |
| Script termina sin `prospecto_id` | El servidor no está corriendo | Ejecutar `npm run dev` y esperar a que esté listo |
| Kanban queda en `en_seguimiento` en vez de `cliente_activo` | El LLM no emitió alguna señal intermedia | Es comportamiento esperado ocasionalmente; ejecutar el script una vez más |
| `HTTP 401: No autorizado` | Sesión expirada | Volver a iniciar sesión en el dashboard |
| `HTTP 404: Campaña no encontrada` | `campana_id` del script no existe | Verificar en Supabase que existe la campaña con ese ID exacto |

---

## Datos de Referencia del Proyecto

| Elemento | Valor |
|----------|-------|
| URL Supabase | https://rgcntceelzttponmehte.supabase.co |
| ID de campaña de prueba | `00000000-0000-0000-0000-200000000001` |
| Nombre de campaña de prueba | Pack Salud Masculina Total — CR |
| Tenant del admin | `20d529bf-6a5c-4c82-8cc1-1e1de1e2ebff` |
| Tenant demo principal | `00000000-0000-0000-0000-000000000001` |

---

*Documento generado para el equipo de pruebas del proyecto SaaS Multi-Nicho.*
