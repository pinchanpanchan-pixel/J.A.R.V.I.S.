# J.A.R.V.I.S. — tu hermano mayor

PWA iOS-first (Next.js 14 + Supabase). Protector, leal, directo y siempre sincronizado entre todos tus dispositivos.

## Arranque rápido (modo simulado, sin claves)

```bash
npm install
cp .env.example .env.local   # ya viene en MODO SIMULADO
npm run dev                  # http://localhost:3000
```

Con las claves de ejemplo de `.env.example` la app funciona **entera en local**:
- La "nube" se simula en IndexedDB y el tiempo real va por `BroadcastChannel`:
  abre **dos pestañas con el mismo email** y verás la sincronización al instante.
- Entra con `pinchan.panchan@gmail.com` para verte como **OWNER · Lifetime**.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo |
| `npm run build && npm start` | Producción (activa el Service Worker) |
| `npm run check` | typecheck + lint + tests unitarios |
| `bash supabase/tests/run.sh` | Aplica las migraciones en un Postgres 16 temporal y prueba RLS, last-write-wins y canje de códigos |
| `bash scripts/e2e/run.sh phase1` | Compila, arranca y ejecuta el E2E en Chromium |

## Arquitectura de sincronización (Fase 1)

```
UI ──escribe──> caché local (IndexedDB) ──> outbox "pending" ──(online)──> Supabase
                     ^                                                     │
                     └──── applyRemote (last-write-wins) <── Realtime ─────┘
```

- **Offline-first**: toda escritura va primero a IndexedDB (localForage) y a una cola ordenada.
  Sin red, la app pasa a *modo grabadora* y muestra: «Sin internet, hermano, pero lo estoy guardando todo en local».
- **Background Sync API**: el Service Worker (`worker/index.js`) sube la cola aunque cierres la app
  (Chrome/Android/escritorio; en iOS se sube al volver a abrirla).
- **Last-write-wins** en cliente *y* en servidor (trigger SQL): un dispositivo que vuelve tras horas offline no pisa datos más nuevos.
- **Cursor incremental** `server_updated_at` para no perder cambios hechos mientras un dispositivo estaba desconectado.
- **Nada se pierde**: los rechazos definitivos del servidor van a una *dead letter* local.
- **Plan Free** = solo este dispositivo: los datos se quedan en cola y se suben al pasar a un plan de pago.

## Seguridad

- RLS en todas las tablas (`user_id = auth.uid()`).
- `is_owner`, `subscription`… solo los puede cambiar el backend (trigger `protect_user_billing_fields`).
- Los códigos de descuento no se pueden listar (solo el propietario) y se canjean de forma atómica (`redeem_discount_code`).
- Tokens OAuth, claves de IA y diario: se cifran con AES-256-GCM (`ENCRYPTION_KEY`) antes de guardarse.

## Estructura

```
app/                 rutas (App Router) y API
components/          UI + providers (Auth, Sync, Service Worker)
hooks/               useTable, useProfile, useAudioRecorder…
lib/sync/            motor offline-first (engine, outbox, remotes Supabase/simulado)
lib/supabase/        clientes navegador / servidor / admin
lib/offline/         cola de grabaciones sin conexión
supabase/migrations  esquema + RLS + Realtime + seeds
worker/              código propio del Service Worker
```

## Limitaciones de iOS (decisión tomada: PWA + Atajos ahora, app nativa después)

Una PWA en iOS no puede leer Notas/Recordatorios/Contactos/Contraseñas de Apple ni HomeKit,
no puede flotar sobre otras apps ni escuchar la palmada o la palabra de activación con la app cerrada.
Las apps de Apple se conectarán mediante **Atajos de iOS**; la arquitectura de adaptadores queda lista para una app nativa.

## Planes

| Plan | Precio | |
|---|---|---|
| Free | 0 $ | círculo que respira, 1 voz, 3 skills, sin permisos totales, solo este dispositivo |
| Pro Lite | 19 $/mes (190 $/año) | todo lo del onboarding con límites |
| **Pro** | **29 $/mes (290 $/año)** | todo ilimitado |
| Founder | 199 $ de por vida | solo los primeros 500 |

## Estado por fases

- [x] **Fase 1** — base, Supabase, esquema, auth, sincronización y modo sin conexión
- [ ] Fase 2 — onboarding y UI
- [ ] Fase 3 — voz
- [ ] Fase 4 — skills y WorldMonitor
- [ ] Fase 5 — pagos, códigos y panel de propietario
