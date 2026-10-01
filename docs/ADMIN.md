# App de propietario (preparada, sin interfaz todavía)

La idea: una app aparte (o una sección `/admin`) solo para las cuentas propietarias
(`pinchan.panchan@gmail.com`, `mateolabandayt@gmail.com`) con usuarios, estadísticas,
pagos, cambios y operaciones.

## Lo que ya está hecho

| Pieza | Dónde | Qué hace |
|---|---|---|
| Lista de propietarios | `lib/owner.ts` (`DEFAULT_OWNER_EMAILS` + `OWNER_EMAILS`) y tabla `public.app_owner_emails` | Única fuente de verdad: propietario = email de la lista. |
| Guardia de servidor | `lib/auth/requireOwner.ts` | Úsala en cualquier `app/api/admin/*`: 401 sin sesión, 403 si no es propietario. |
| Guardia de base de datos | `public.is_owner()`, `public.admin_stats()` | Aunque alguien llamara a Supabase directamente, solo responde a propietarios. |
| Métricas | `GET /api/admin/stats` | Usuarios (total, últimos 7 días, onboarding), por plan, suscripciones activas, ingresos, códigos canjeados, mensajes en 24 h. Sin datos personales. |

## Para añadir un propietario

1. Supabase → SQL Editor: `insert into public.app_owner_emails (email) values ('nuevo@correo.com');`
2. Vercel: añadir el email a `OWNER_EMAILS` (separados por comas) y redeploy.

## Siguiente paso (cuando toque)

- Interfaz en `app/(admin)/…` o proyecto aparte que llame a `/api/admin/*`.
- Nuevas rutas: `/api/admin/users` (listado paginado con service role), `/api/admin/payments`,
  `/api/admin/codes` (ya existe el CRUD en Ajustes → Códigos de descuento).
- Toda ruta nueva empieza con `const guard = await requireOwner(req)`.
