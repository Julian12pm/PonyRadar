# PonyRadar

PWA de objetos perdidos y encontrados del **Instituto Tecnológico de Morelia**. La comunidad marca sobre un croquis del campus lo que perdió (pin rojo) o encontró (pin verde), y un sistema de reporte ciego, clave de liberación y strikes asegura que solo el dueño real recupere su objeto.

## Tecnologías

React + Vite + Tailwind CSS v4 (JavaScript) · Supabase (Postgres, Auth, Storage, Realtime) · Vitest · GitHub Actions · Vercel. Todo en planes gratuitos.

## Requisitos

- [Node.js](https://nodejs.org/) 22 o superior (el CI usa Node 24).
- Git.

## Instalar y correr

```bash
git clone https://github.com/Julian12pm/PonyRadar.git
cd PonyRadar
npm install
cp .env.example .env.local   # luego llena las variables de Supabase
npm run dev                  # abre http://localhost:5173
```

## Comandos

| Comando                 | Qué hace                                          |
| ----------------------- | ------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo con recarga automática     |
| `npm run build`         | Genera la versión de producción en `dist/`        |
| `npm run preview`       | Sirve `dist/` para probar el build                |
| `npm run lint`          | Revisa el código con ESLint                       |
| `npm run format`        | Da formato a todo con Prettier                    |
| `npm run format:check`  | Verifica el formato sin cambiar nada (lo usa CI)  |
| `npm test`              | Corre las pruebas una vez                         |
| `npm run test:watch`    | Corre las pruebas cada vez que guardas            |
| `npm run coverage`      | Pruebas + reporte de cobertura en `coverage/`     |
| `npm run osm:descargar` | Baja de OpenStreetMap los datos crudos del campus |
| `npm run osm:convertir` | Genera `src/mapa/campus-osm.json` para el croquis |

## Datos del mapa

El croquis se dibuja con la geometría real de **OpenStreetMap** (© OpenStreetMap contributors, licencia [ODbL](https://www.openstreetmap.org/copyright); el crédito aparece en la app). Los nombres de edificios, estacionamientos y accesos salen del plano oficial del ITM (Campus N° 1).

Para actualizarlo: `npm run osm:descargar` y luego `npm run osm:convertir`. Los nombres que OSM no trae (leyenda del plano, números de estacionamiento, accesos) están en `src/mapa/leyenda.js` y al inicio de `scripts/osm/convertir.mjs`.

## Pruebas

Las pruebas usan **Vitest** y **Testing Library**, y viven junto al archivo que prueban (`correo.js` → `correo.test.js`). La lógica importante (detección de zona, strikes, caducidad, enlace de Teams, validación de correo) se escribe como funciones puras en `src/lib/` o `src/mapa/` para poder probarla sin navegador ni base de datos.

Después de `npm run coverage`, abre `coverage/index.html` para ver el reporte de cobertura.

## Estructura de carpetas

```
.
├── .github/workflows/ci.yml   # CI: lint, formato, pruebas y build
├── public/                    # Archivos estáticos (íconos)
├── scripts/osm/               # Descarga y conversión de los datos de OpenStreetMap
├── src/
│   ├── componentes/           # Piezas de interfaz (filtros, hojas, botones de salto…)
│   ├── paginas/               # Pantallas completas (una por ruta)
│   ├── mapa/                  # Croquis SVG, zonas.js, detección de zona, agrupación de pines
│   ├── lib/                   # Funciones puras (categorías, filtros, tiempo…) y cliente de Supabase
│   ├── test/setup.js          # Configuración común de las pruebas
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css              # Tailwind y colores del tema
├── supabase/
│   ├── migrations/            # Migraciones SQL numeradas
│   └── seed.sql               # Datos de demo
├── .env.example               # Variables necesarias (sin valores)
└── vite.config.js             # Vite + configuración de Vitest
```

## Ramas y flujo de trabajo

- `main`: solo lo que funciona. Vercel la publica en producción.
- `dev`: rama de integración.
- `feat/<nombre>`: una rama por funcionalidad, creada desde `dev`. Se integra con un pull request hacia `dev`; cuando `dev` está estable se hace PR de `dev` a `main`.

Cada push y PR hacia `dev` o `main` corre el CI. Vercel crea una vista previa por cada PR.

## Convenciones

- **Ramas:** `feat/<nombre-corto>` para funcionalidades, `fix/<nombre-corto>` para correcciones (en minúsculas y con guiones, p. ej. `feat/mapa-croquis`).
- **Commits:** pequeños, en español y en imperativo (p. ej. `Agrega detección de zona en el mapa`).
- **Código:** JavaScript, nombres y comentarios en español. Componentes en `PascalCase.jsx`, funciones y variables en `camelCase`, constantes en `MAYUSCULAS`.
- **Base de datos:** tablas y columnas en `snake_case` y en español; migraciones numeradas (`0001_inicial.sql`, `0002_...`).

## Variables de entorno

Se guardan en `.env.local` (git lo ignora). Nunca subas llaves al repositorio.

| Variable                        | Dónde se obtiene                  |
| ------------------------------- | --------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API |

## Base de datos (Supabase)

Las migraciones están numeradas en `supabase/migrations/` y se aplican en orden:

| Migración                          | Qué hace                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `0001_esquema_inicial.sql`         | Tablas, tipos, RLS en todas las tablas, perfil automático y hook de correo          |
| `0002_zonas.sql`                   | Zonas del mapa (se genera con `npm run zonas:sql`)                                  |
| `0003_crear_pines.sql`             | Funciones RPC `crear_pin` y `adjuntar_fotos`                                        |
| `0004_fotos_y_tiempo_real.sql`     | Bucket privado `fotos`, sus políticas y tiempo real para `pines`                    |
| `0005_ajustes_rendimiento.sql`     | Índice faltante y políticas del admin separadas por acción                          |
| `0006_reclamos_y_entrega.sql`      | Es mío, Lo encontré, aceptar/rechazar/impostor, clave, contacto y avisos            |
| `0007_puntos_seguros_y_reglas.sql` | Puntos seguros, strikes y suspensión, caducidad (pg_cron), renovar, no reclamado    |
| `0008_paneles.sql`                 | Funciones del admin: roles, personal de puntos seguros, quitar strikes, desbloquear |

`supabase/seed.sql` agrega los datos de demo (semestre vigente y el punto seguro de la Biblioteca).

**Seguridad:** el cliente no escribe directo en las tablas importantes; usa funciones RPC que revisan la sesión. El dato ciego y la foto nítida solo los ve quien encontró el objeto. Para comprobarlo, pega `supabase/tests/seguridad.sql` en el SQL Editor: crea dos usuarios de prueba dentro de una transacción que se revierte y muestra el resultado de cada regla.

Las reglas de puntos seguros, strikes y caducidad se prueban con `supabase/tests/reglas.sql`. Los paneles y los correos con "+" se prueban con `supabase/tests/paneles.sql`. Las reglas de reclamos y entrega se prueban igual con `supabase/tests/reclamos.sql` (tres usuarios: quien encontró, el dueño y alguien más que reclama).

**Inicio de sesión:** código de 6 dígitos por correo (OTP). Solo se aceptan correos `@morelia.tecnm.mx`: lo valida la app, el hook "Before User Created" y un trigger en la base de datos.

## Configuración del panel de Supabase

Pasos que se hacen a mano en el panel del proyecto (no hay contraseñas en este repositorio):

1. **SMTP propio** (Authentication → Emails → SMTP Settings): activar "Custom SMTP" con la cuenta de Microsoft 365 del Tec.
   - Host: `smtp.office365.com` · Puerto: `587`
   - Usuario y contraseña: los de la cuenta que envía los correos (se escriben solo en el panel).
   - Remitente: esa misma cuenta institucional.
2. **Plantillas de correo** (Authentication → Emails → Templates): en **Magic link** y en **Confirm sign up**, poner el código con `{{ .Token }}`:
   - Asunto: `Tu código de PonyRadar`
   - Cuerpo:
     ```html
     <h2>Tu código para entrar a PonyRadar</h2>
     <p>Escribe este código en la app:</p>
     <p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
     <p>Si no lo pediste, ignora este correo.</p>
     ```
3. **Hook de registro** (Authentication → Hooks → Before User Created): tipo "Postgres", esquema `public`, función `hook_solo_correo_institucional`.
4. **Código de 6 dígitos** (Authentication → Sign In / Providers → Email): _Email OTP Length_ = `6`.
5. **Límite de correos** (Authentication → Rate Limits): envío de correos en `100` por hora.
6. **Migraciones y datos de demo:** aplicar `supabase/migrations/` en orden y luego `supabase/seed.sql` (SQL Editor o Supabase CLI).

## Reclamos y entrega

Todo pasa en funciones RPC de `0006_reclamos_y_entrega.sql`; la app solo las llama (`src/lib/casos.js`).

1. **Es mío** (pin verde ajeno): el reclamante escribe lo que solo el dueño sabría. Puede haber varias solicitudes a la vez; el pin pasa a `con_solicitud`.
2. Quien encontró compara la respuesta con su dato ciego en **Mis casos** y elige **Aceptar**, **Rechazar** o **Impostor** (+1 strike, pide confirmación). Al aceptar, las demás solicitudes se cancelan sin strike.
3. Tras aceptar, cada parte ve la **tarjeta de contacto** de la otra (nombre, correo y botón **Escribir en Teams**). El dueño también ve la foto nítida.
4. El dueño pulsa **Ver mi clave de entrega**: el servidor genera 4 dígitos, los muestra una sola vez y guarda solo su hash (nadie puede leer el hash por la API). Si la olvida, pide otra.
5. En persona, quien tiene el objeto escribe la clave. Correcta: el pin queda `entregado`. Con 5 fallos la aceptación se cancela y el pin vuelve a estar disponible.

**Lo encontré** (pin rojo ajeno) crea un pin verde vinculado en el mismo lugar con el dato ciego de quien lo encontró, y avisa al dueño, que lo reclama con "Es mío". Al entregarlo, el pin rojo también se cierra.

**Avisos:** se crean en el servidor (reclamos, respuestas, "Lo encontré" y pines verdes de la misma categoría y zona que un rojo tuyo), llegan en tiempo real y se cuentan en el botón **Mis casos**. Abrir `/?pin=<id>` abre ese pin en el mapa.

## Puntos seguros y reglas

Todo lo aplica el servidor (`0007_puntos_seguros_y_reglas.sql`); la app lo muestra (`src/lib/reglas.js`).

- **Punto seguro:** quien encontró elige "Dejar en un punto seguro" → `en_camino`. El personal confirma la recepción → `en_resguardo` y quien lo encontró queda deslindado. Si en 24 h nadie confirma, se le avisa (una vez) y sigue `en_camino`; solo el admin puede regresarlo a `activo`.
- **Reclamar en resguardo:** el dueño pulsa "Es mío" desde la lista "En resguardo". Responde y escribe la clave el personal del punto seguro; el dueño ve dónde recogerlo (sin correo personal).
- **Strikes** (solo los del semestre vigente que el admin no haya quitado): 1–2 aviso, 3 suspensión de 7 días, 4 de 30 días, 5+ bloqueo. Suspendido = ve el mapa, no publica ni reclama. "Mis casos" muestra cuántos tiene y qué pasa con el siguiente.
- **Caducidad** (tarea de pg_cron cada 10 minutos): `activo` → `caducado` a las 72 h; una aceptación sin entrega en 72 h se cancela sin strike. Un pin verde vencido pide llevarlo a un punto seguro.
- **Listas** (`/listas`): "Se busca" (rojos caducados, 30 días; ahí también se puede marcar "Lo encontré") y "En resguardo" (por punto seguro). El dueño puede **renovar** un pin rojo una sola vez (72 h más en el mapa).
- **No reclamado:** al terminar el semestre en que se recibió, el personal lo marca `no_reclamado` (su pantalla llega en la Fase 5).

## Paneles

El botón **Panel** del mapa aparece para el personal de puntos seguros y para el admin.

- **Punto seguro** (`/punto`): objetos por recibir ("Ya lo recibí"), reclamos para comparar con el dato ciego (aceptar, rechazar o impostor), entregas (el personal escribe la clave que dicta el dueño) y lo guardado, que al terminar el semestre se puede marcar "no reclamado".
- **Admin** (`/admin`): usuarios (rol, strikes con "Quitar", desbloquear o levantar suspensión), puntos seguros (crear, activar y asignar personal por correo, incluido "Asignarme a mí"), semestres y objetos en camino ("Regresar al mapa").
- **Roles:** el primer admin se asigna por SQL (`update public.perfiles set rol = 'admin' where correo = '…';`). Desde la app solo un admin cambia roles y nadie puede quitarse a sí mismo el rol de admin. Asignar a alguien a un punto seguro lo pasa a "punto seguro" (un admin conserva su rol); quitarlo de todos lo regresa a "comunidad".
- **Correos con "+":** se aceptan alias como `l23121115+admin@morelia.tecnm.mx` (Microsoft 365 los entrega en la misma bandeja). Lo validan la app, el hook y el trigger, y siempre exigen `@morelia.tecnm.mx` al final.

## Si Supabase no responde

La app está pensada para sobrevivir a caídas de red o del servidor (`src/lib/conexion.js` y `src/lib/useDatosDelMapa.js`):

- Muestra "No hay conexión con el servidor, reintentando…" y reintenta con espera creciente (1 s, 2 s, 4 s… hasta 30 s), o al momento con "Reintentar ahora" o cuando el dispositivo recupera internet.
- El mapa sigue mostrando los últimos pines guardados en el navegador (sin los que ya caducaron) en modo solo lectura: publicar se desactiva con un mensaje.
- Si el tiempo real se desconecta, se vuelve a suscribir solo y recarga los pines al volver.
- Las copias locales se borran al cerrar sesión. El dato ciego nunca se guarda localmente.
