# Conexiones: credenciales de desarrollador (una vez, las crea el propietario)

Para todas: la **URL de retorno** (redirect URI) es

```
https://jarvis-ashen-iota.vercel.app/api/connectors/<id>/callback
```

y tras añadir las variables en Vercel hay que hacer **Redeploy**. Mientras falte la variable de un
proveedor, su ficha dice «estará disponible muy pronto» (no se rompe nada).

| App(s) | Dónde se crea | Variables en Vercel | URLs de retorno (id) |
|---|---|---|---|
| Google Calendar, Gmail, Drive, Docs, Sheets, Slides, YouTube | console.cloud.google.com | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `google_calendar`, `gmail`, `google_drive`, `google_docs`, `google_sheets`, `google_slides`, `youtube` |
| Spotify | developer.spotify.com/dashboard | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | `spotify` |
| Notion | notion.so/profile/integrations → *Public integration* | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` | `notion` |
| Canva | canva.com/developers → *Integrations* | `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` | `canva` |
| Outlook, OneDrive | portal.azure.com → *App registrations* | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `outlook`, `onedrive` |
| Todoist | developer.todoist.com/appconsole.html | `TODOIST_CLIENT_ID`, `TODOIST_CLIENT_SECRET` | `todoist` |
| Strava | strava.com/settings/api | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | `strava` (Strava pide solo el dominio: `jarvis-ashen-iota.vercel.app`) |
| Philips Hue | developers.meethue.com → *Remote Hue API apps* | `HUE_CLIENT_ID`, `HUE_CLIENT_SECRET` | `hue` |
| Govee, Tuya | — (cada usuario pone su clave en la app) | — | — |
| Google Maps, YouTube sin cuenta | — | — | — |
| Calendario, Recordatorios, Notas, Contactos (Apple) | Atajo de iOS (ver `docs/IOS_SHORTCUT.md`) | `NEXT_PUBLIC_IOS_SHORTCUT_URL` | — |

## Detalle por proveedor

**Google** (el mismo proyecto que el login con Google sirve):
1. *APIs y servicios → Biblioteca*: activa Google Calendar API, Gmail API, Google Drive API,
   Google Docs API, Google Sheets API, Google Slides API y YouTube Data API v3 (todas gratis).
2. *Pantalla de consentimiento*: añade los permisos `calendar`, `gmail.readonly`, `drive.readonly`,
   `documents.readonly`, `spreadsheets.readonly`, `presentations.readonly`, `youtube.readonly`.
3. *Credenciales → ID de cliente OAuth (Aplicación web)*: añade las 7 URLs de retorno de la tabla.
4. ⚠️ Mientras la app esté «en pruebas», solo entran los usuarios de prueba que añadas (hasta 100) y
   Google enseña un aviso. Para abrirla a todo el mundo hay que pedir la verificación de Google;
   Gmail y Drive son permisos «restringidos» y su verificación exige una auditoría de seguridad de pago.
   Calendar, Docs, Sheets, Slides y YouTube solo necesitan la verificación normal (gratis).

**Spotify**: crea la app, marca *Web API*, añade la URL de retorno. En modo desarrollo solo funciona con
las cuentas que añadas en *User Management* (hasta 25); para abrirla hay que pedir la ampliación.
Para «pon mi música» hace falta Spotify Premium y tener Spotify abierto en algún dispositivo.

**Notion**: integración *pública*, permisos de lectura de contenido; URL de retorno; copia
OAuth client ID y secret.

**Canva**: crea una integración, activa los permisos `design:meta:read` y `profile:read`, añade la URL de
retorno. Canva usa PKCE (ya está hecho en el código).

**Microsoft** (Outlook y OneDrive): *App registrations → New registration*, «Accounts in any organizational
directory and personal Microsoft accounts», plataforma *Web* con las 2 URLs de retorno. En
*Certificates & secrets* crea el secreto. En *API permissions* (Microsoft Graph, delegados): `User.Read`,
`Mail.Read`, `Calendars.Read`, `Files.Read`, `offline_access`, `openid`, `email`.

**Todoist**: crea la app, *OAuth redirect URL* = la de la tabla.

**Strava**: «Authorization Callback Domain» = `jarvis-ashen-iota.vercel.app`. Las apps nuevas de Strava solo
admiten 1 atleta (tú) hasta que Strava aprueba la ampliación.

**Philips Hue**: en developers.meethue.com crea una app de *Remote Hue API* con la URL de retorno. Al
conectar, J.A.R.V.I.S. enlaza tu puente solo (no hace falta pulsar el botón físico).

**Govee**: cada usuario pide su clave en la app Govee Home → Perfil → ⚙ → *Apply for API Key*.

**Tuya / Smart Life**: cada usuario crea un proyecto *Cloud* gratis en iot.tuya.com, vincula su app
Smart Life en *Devices → Link App Account* y copia Access ID, Access Secret y el UID.

## Lo que no se puede (y por qué)

- **Alexa y Google Home**: Amazon y Google no permiten que una app web controle sus dispositivos.
  Si las luces/enchufes son Hue, Govee o Smart Life, se conectan aquí directamente.
- **HomeKit y Contraseñas de Apple**: solo desde una app nativa de iOS.
