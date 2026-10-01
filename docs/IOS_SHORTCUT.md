# Atajo «J.A.R.V.I.S.» para las apps de Apple (se crea una vez)

Una web no puede leer Calendario, Recordatorios, Notas ni Contactos del iPhone. Un Atajo sí: los
lee en el propio iPhone y los manda a J.A.R.V.I.S. Lo creas **una vez**, lo compartes por iCloud y
todos los usuarios lo instalan con un toque desde la app («Añadir atajo»).

## 1. Crear el atajo (en tu iPhone, app Atajos)

Nombre: **J.A.R.V.I.S.**

1. **Texto** → escribe `CODIGO` y renombra la variable a *Código*.
   (En *Configurar atajo → Preguntas de importación* añade esta acción con la pregunta
   «Pega tu código de J.A.R.V.I.S. (ya está copiado)». Así cada usuario pega el suyo al instalarlo.)
2. **Buscar eventos del calendario** donde *Fecha de inicio* está en los próximos 7 días.
   **Repetir con cada** → **Diccionario** `title` = Título, `content` = Notas, `date` = Fecha de inicio
   → fuera del bucle, **Obtener contenido de URL**:
   - URL `https://jarvis-ashen-iota.vercel.app/api/ios/ingest`, método **POST**
   - Cabecera `Authorization` = `Bearer ` + *Código*
   - Cuerpo **JSON**: `type` = `event`, `items` = *Resultado de repetir*
3. Igual con **Buscar recordatorios** (no completados) → `type` = `reminder`.
4. Igual con **Buscar notas** (modificadas en el último día) → `type` = `note` (`content` = Cuerpo).
5. Igual con **Buscar contactos** → `type` = `contact` (`title` = Nombre, `content` = Teléfono y Email).

## 2. Publicarlo

Compartir → **Copiar enlace de iCloud**. Pégalo en Vercel como
`NEXT_PUBLIC_IOS_SHORTCUT_URL` y haz Redeploy.

## 3. Lo que hace cada usuario

En la app: Conexiones → Calendario (o Recordatorios, Notas, Contactos) → **Añadir atajo** → *Añadir*
→ pegar el código. Para que se sincronice solo: Atajos → Automatización → *Hora del día* (p. ej. 23:00)
→ Ejecutar «J.A.R.V.I.S.» sin preguntar. Cuando llegan los primeros datos, la app marca esa app de
Apple como «Conectado».
