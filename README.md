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

| Migración                      | Qué hace                                                                   |
| ------------------------------ | -------------------------------------------------------------------------- |
| `0001_esquema_inicial.sql`     | Tablas, tipos, RLS en todas las tablas, perfil automático y hook de correo |
| `0002_zonas.sql`               | Zonas del mapa (se genera con `npm run zonas:sql`)                         |
| `0003_crear_pines.sql`         | Funciones RPC `crear_pin` y `adjuntar_fotos`                               |
| `0004_fotos_y_tiempo_real.sql` | Bucket privado `fotos`, sus políticas y tiempo real para `pines`           |
| `0005_ajustes_rendimiento.sql` | Índice faltante y políticas del admin separadas por acción                 |

`supabase/seed.sql` agrega los datos de demo (semestre vigente y el punto seguro de la Biblioteca).

**Seguridad:** el cliente no escribe directo en las tablas importantes; usa funciones RPC que revisan la sesión. El dato ciego y la foto nítida solo los ve quien encontró el objeto. Para comprobarlo, pega `supabase/tests/seguridad.sql` en el SQL Editor: crea dos usuarios de prueba dentro de una transacción que se revierte y muestra el resultado de cada regla.

**Inicio de sesión:** código de 6 dígitos por correo (OTP). Solo se aceptan correos `@morelia.tecnm.mx`: lo valida la app, el hook "Before User Created" y un trigger en la base de datos.
