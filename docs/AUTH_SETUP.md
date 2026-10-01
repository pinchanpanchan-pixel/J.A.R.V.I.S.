# Login de J.A.R.V.I.S.: código de 6 dígitos + Google

## 1. Código de 6 dígitos (Supabase)

1. **Supabase → Authentication → Sign In / Providers → Email**
   - *Enable Email provider*: activado.
   - *Email OTP Length*: **6**.
   - *Email OTP Expiration*: **600** segundos (10 minutos).
2. **Supabase → Authentication → Emails → Templates → «Magic Link»**
   - Asunto: `Tu código de J.A.R.V.I.S.: {{ .Token }}`
   - Cuerpo: pega `supabase/templates/codigo-acceso.html`.
   - Haz lo mismo en **«Confirm signup»** (la primera vez que entra alguien nuevo).
3. **Supabase → Authentication → URL Configuration**
   - *Site URL*: `https://jarvis-ashen-iota.vercel.app`
   - *Redirect URLs*: añade `https://jarvis-ashen-iota.vercel.app/auth/callback`
     (y `http://localhost:3000/auth/callback` si pruebas en local).

Sin SMTP propio, Supabase solo deja mandar unos pocos correos por hora y el remitente es
«Supabase Auth». Para producción, punto 3.

## 2. Continuar con Google

**Google Cloud** (console.cloud.google.com):
1. Crea un proyecto (o usa el de la voz) → **APIs y servicios → Pantalla de consentimiento de OAuth**:
   tipo *Externo*, nombre «J.A.R.V.I.S.», tu email de soporte, dominio autorizado `supabase.co`
   (y `vercel.app`). Ámbitos: `email`, `profile`, `openid`. Publica la app (o añade usuarios de prueba).
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**:
   - *Orígenes de JavaScript autorizados*: `https://jarvis-ashen-iota.vercel.app`
   - *URI de redireccionamiento autorizados*: `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`
     (lo copias de Supabase en el paso siguiente).
3. Copia el **ID de cliente** y el **Secreto de cliente**.

**Supabase → Authentication → Sign In / Providers → Google**: actívalo, pega ID y secreto, guarda.
Ahí mismo verás la *Callback URL* exacta para el punto 2.

No hace falta ninguna variable nueva en Vercel para el login con Google (lo gestiona Supabase).

## 3. Correos desde «J.A.R.V.I.S.» (cuando tengas dominio)

El remitente solo puede ser «J.A.R.V.I.S. <hola@tudominio.com>» con un dominio propio verificado.
Pasos con **Resend** (gratis hasta 3.000 correos/mes, 100/día):
1. Compra el dominio (p. ej. en Cloudflare o Namecheap).
2. resend.com → **Domains → Add domain** → añade en tu DNS los registros que te da (SPF, DKIM y
   MX de rebote). Espera a que salga *Verified*.
3. resend.com → **API Keys → Create** (permiso *Sending access*). Guárdala.
4. **Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - Sender email: `hola@tudominio.com` · Sender name: `J.A.R.V.I.S.`
   - Host `smtp.resend.com` · Port `465` · Username `resend` · Password: la API key de Resend.
5. **Supabase → Authentication → Rate Limits**: sube «Emails sent per hour» (p. ej. 100).

Las variables `RESEND_API_KEY` y `EMAIL_FROM` del `.env.example` quedan listas por si en el futuro la
app manda otros correos (avisos, recibos); el login no las necesita porque lo envía Supabase.
