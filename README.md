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
| `bash scripts/e2e/run.sh phase1 phase2 phase3 phase4 phase5` | Compila, arranca y ejecuta los E2E en Chromium (la fase 3 usa un micrófono falso con WAV de palmadas y voz) |

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

## UI (Fase 2)

- **Onboarding** en una tarjeta centrada (máx. 420 px, `#0F2440` al 95 %, radio 32 px) sobre fondo azul marino
  desenfocado con la app visible detrás. 9 pasos: identidad → voz → apps → hogar → ubicación → pago → diario →
  tutorial → atajos. El **propietario salta el pago** (paso 5 → 7). El progreso se sincroniza entre dispositivos.
- **Ubicación**: automática (GPS + geocodificación inversa), cascada manual País → Estado → Ciudad → Dirección
  (datos incluidos de 9 países + API externa para el resto) o enlace de Google Maps (9 formatos + enlaces cortos).
- **Cerebro**: punto líquido en canvas (respira 1→1,05 cada 3 s, mercurio al escuchar, late al hablar),
  píldora de transcripción, botón rojo de mantener para hablar, chat.
- **Memorias** (bloques estilo Notion + notas rápidas, búsqueda sin acentos, etiquetas), **Diario** (cifrado
  AES-256-GCM, línea de tiempo, filtros), **Hogar** (por habitaciones), **Ajustes** (insignia dorada OWNER - Lifetime).
- **Modo flotante**: punto arrastrable de 80 px; Document Picture-in-Picture donde exista (Chrome/Edge escritorio);
  notificación persistente con acciones en Android.

## Voz (Fase 3)

- **TTS**: ElevenLabs en *streaming* (`/api/tts`, modelo `eleven_flash_v2_5`). La respuesta se trocea en frases:
  la primera suena en cuanto llegan los primeros bytes (<400 ms) y la siguiente se precarga. Sin clave o en plan
  Free → Web Speech API. Voces por `.env`: `VOICE_BRITISH_ORIGINAL`, `VOICE_YOUNG_BROTHER`, `VOICE_DEEP_CALM`, `VOICE_SPANISH_BROTHER`.
- **STT**: Whisper (`/api/stt`) con WAV de 16 kHz; transcripción en vivo en la píldora con el reconocimiento del navegador.
- **Activación** (cada una se activa/desactiva en Ajustes):
  1. **Doble palmada**: Web Audio, 2 transitorios en <800 ms sobre un ruido de fondo adaptativo (sensibilidad ajustable).
  2. **Botón rojo** de mantener pulsado.
  3. **Palabra de activación**: el nombre elegido en el paso 1 («Hey Friday» si le llamas Friday), con tolerancia a errores.
- **Sonido de activación** «bup bup» original (`/sounds/activate.mp3`), y 5 alertas originales en `/sounds/alerts/`.
- **Interrupciones**: tú le cortas mientras habla (botón, palmada o su nombre); él te interrumpe si hay algo urgente (`interrupt()`).
- **Sin conexión**: el botón graba en local y, al volver la red, se transcribe y se guarda como memoria.
- Límite de iOS: la escucha continua solo funciona con la app abierta y en primer plano.

## Skills y WorldMonitor (Fase 4)

- **Cerebro** (`services/aiRouter.ts`): primero las claves del usuario (rotación), luego Claude (`claude-opus-5-5`)
  con la clave del propietario; si un proveedor da 429/5xx/red, salta al siguiente. Ajustes → Avanzado → Proveedores
  de IA: claves ilimitadas (OpenAI, Anthropic, Gemini, Groq, OpenRouter), cifradas y sincronizadas, con el proveedor activo.
- **Skills** (`skills/<nombre>/index.ts`, cada una con `triggerKeywords` y `execute`): nota rápida, memoria,
  navegación, resúmenes («¿qué hicimos ayer?»), diario, hogar, música, agenda, correo, contactos, Notion,
  memoria visual, importación y WorldMonitor. Orden: atajo → skill → cerebro.
- **Atajos** (`config/shortcuts.json` + Ajustes → Atajos, sincronizados).
- **Hogar** (`services/homeController.ts` + `connectors/home/*`): «apaga todas las luces», «pon luz roja al 50 %»,
  «apaga todo a las 11pm» (crea una automatización cron). Govee y Hue con API real; HomeKit por Atajo; resto simulado.
- **Diario**: análisis con Claude (salida estructurada) o heurístico, cifrado, dictado por voz, recordatorio en la app y por push.
- **Importa tu pasado**: .zip de WhatsApp (iOS/Android), por días, con fechas, participantes y adjuntos; barra de progreso.
- **Memoria visual**: foto → EXIF → Claude Vision (descripción, OCR, objetos, caras) → recuerdo con miniatura.
- **WorldMonitor**: sismos USGS (magnitud 3–8, radio 50–2000 km, cada 2 min), clima severo y aire (OpenWeather);
  alerta a pantalla completa con sirena, voz «Ey hermano, hay un sismo de magnitud X a Y km de ti, ¿estás bien?» y qué hacer.
- **Apps de Apple**: token personal + endpoint `/api/ios/ingest` para enviar Notas, Recordatorios, Contactos y Calendario desde Atajos.
- **Edge Functions** (`supabase/functions`): `world-monitor`, `diary-reminders`, `home-automations`.
  Programación en `supabase/cron.sql`. El código compartido se genera con `node scripts/sync_edge_shared.mjs`.

## Pagos, códigos y propietario (Fase 5)

- **Pantalla de pago** (onboarding paso 6 y Ajustes → Suscripción): «Desbloquea a tu hermano completo», beneficios,
  mensual/anual, planes Pro Lite / Pro / Founder (plazas restantes de 500) y botones apilados:
  **Apple Pay** (negro, arriba, si el dispositivo lo admite), **PayPal** (amarillo), **tarjeta** (Stripe Elements) y Google Pay si existe.
- **Stripe**: suscripciones (precios y cupones se crean solos si no pones `STRIPE_PRICE_*`) y pago único Founder.
  El plan SOLO se activa desde el webhook firmado (`/api/payments/stripe/webhook`), de forma idempotente.
- **PayPal**: pedido con importe calculado en el servidor; la captura se verifica (usuario e importe) antes de activar.
- **Códigos** (`¿Tienes código?`): validación atómica en SQL; 100 % activa sin pasarela («Código aplicado, bienvenido hermano»);
  <100 % se aplica al cobro y se consume al pagar. Semilla: PANCHAN100, BROTHER50, FRIENDS20, LAUNCH30.
- **Propietario**: solo por email (`lib/owner.ts` + `OWNER_EMAILS`, y tabla `app_owner_emails`) ⇒ `is_owner`, `pro_lifetime`, salta el pago. PANCHAN100 solo lo pueden canjear propietarios. Ver `docs/ADMIN.md`.
- **Login**: código de 6 dígitos por email + Google. Configuración en `docs/AUTH_SETUP.md`.
  (paso 5 → 7), insignia dorada **OWNER - Lifetime**, sin pantalla de pago y panel **Códigos de descuento** (crear, activar, borrar).

## Puesta en producción (cuando tengas las claves)

1. **Supabase**: crea el proyecto, `supabase db push` (migraciones), activa Google y Apple en Auth y pon las claves en `.env.local`.
2. **Edge Functions**: `supabase functions deploy world-monitor diary-reminders home-automations`,
   secretos `ENCRYPTION_KEY`, `VAPID_*`, `CRON_SECRET`; después ejecuta `supabase/cron.sql`.
3. **Stripe**: claves + webhook a `https://TU_DOMINIO/api/payments/stripe/webhook` con los eventos
   `invoice.paid`, `payment_intent.succeeded`, `customer.subscription.deleted`. Para Apple Pay, verifica tu dominio en Stripe.
4. **PayPal**: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV=live`.
5. **Voz y cerebro**: `GEMINI_API_KEY` (cerebro y voz de respaldo), `GOOGLE_TTS_API_KEY` (voces Chirp 3 HD), opcional `OPENAI_API_KEY` (Whisper).
6. **Opcional**: `OPENWEATHER_API_KEY`, OAuth de Google / Spotify / Notion, `npx web-push generate-vapid-keys`.
7. `NEXT_PUBLIC_MOCK_MODE=false` y despliega (p. ej. Vercel) con HTTPS (obligatorio para PWA, micrófono y Apple Pay).

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
- [x] **Fase 2** — onboarding y UI
- [x] **Fase 3** — voz
- [x] **Fase 4** — skills y WorldMonitor
- [x] **Fase 5** — pagos, códigos y panel de propietario
