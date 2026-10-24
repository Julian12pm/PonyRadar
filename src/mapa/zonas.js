// Zonas del campus: cada edificio y área exterior es un polígono con un id.
// Las coordenadas usan el mismo sistema que el plano oficial (referencia/prototipo/public/mapa-itm.png,
// 846 × 647 px), así que se pueden comparar encimando el croquis sobre el plano.
// El norte queda hacia arriba, igual que en el plano.

/** Convierte un rectángulo (esquina superior izquierda y esquina inferior derecha) en polígono. */
function rect(x1, y1, x2, y2) {
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]
}

// Área visible del mapa (viewBox del SVG)
export const LIMITES = { x: 20, y: 20, ancho: 680, alto: 600 }

// ─── Unidades: el terreno de cada parte del campus ───
// Si un toque cae dentro de una unidad pero fuera de cualquier zona, cuenta como "jardines".
export const UNIDADES = [
  {
    id: 'unidad-central',
    nombre: 'Unidad Central',
    puntos: [
      [302, 56],
      [606, 56],
      [624, 100],
      [612, 330],
      [590, 410],
      [560, 460],
      [524, 588],
      [400, 536],
      [240, 484],
      [200, 464],
      [86, 395],
    ],
  },
  {
    id: 'unidad-metal-mecanica',
    nombre: 'Unidad Metal Mecánica',
    puntos: [
      [48, 45],
      [173, 36],
      [226, 69],
      [68, 294],
      [54, 294],
    ],
  },
  {
    id: 'unidad-posgrado',
    nombre: 'Unidad Posgrado en Eléctrica',
    puntos: [
      [618, 476],
      [690, 600],
      [548, 602],
    ],
  },
]

// ─── Edificios ───
// clave: letra que aparece en el plano. nombre: lo que dice la leyenda oficial.
const EDIFICIOS = [
  // Unidad Central
  [
    'A',
    'Edificio Administrativo',
    [
      [268, 143],
      [300, 143],
      [300, 176],
      [303, 176],
      [303, 205],
      [257, 205],
      [257, 176],
      [268, 176],
    ],
  ],
  ['B', 'Laboratorio de Química Analítica', rect(316, 132, 340, 143)],
  ['C', 'Coordinación de Inglés', rect(366, 130, 402, 141)],
  ['CH', 'Deptos. Ing. Industrial e Ing. Bioquímica', rect(341, 100, 392, 120)],
  ['D', 'Laboratorio de Ingeniería Bioquímica', rect(344, 157, 395, 170)],
  ['E', 'Aulas y Taller de Dibujo', rect(332, 193, 376, 204)],
  ['F', 'Sala Audiovisual N° 1 y Aulas', rect(315, 224, 358, 235)],
  ['G', 'Laboratorios Ing. Mecánica 1 e Ing. Eléctrica', rect(384, 207, 414, 254)],
  ['H', 'Unidad Deportiva y Tribunas', rect(470, 180, 486, 276)],
  ['I', 'Depto. de Sistemas y Cómputo', rect(320, 248, 359, 283)],
  ['J', 'Aulas de Titulación y PADHIE', rect(258, 252, 286, 267)],
  ['K', 'Aulas y Delegación Sindical', rect(308, 293, 366, 301)],
  ['L', 'Aulas Licenciatura Administración', rect(186, 284, 222, 295)],
  ['LL', 'Centro de Negocios', rect(279, 349, 311, 375)],
  ['M', 'Depto. Económico Administrativo', rect(136, 329, 164, 367)],
  ['N', 'Laboratorios de Ingeniería Bioquímica', rect(186, 329, 212, 367)],
  ['Ñ', 'Laboratorio de Instrumentación Analítica', rect(234, 325, 250, 341)],
  ['O', 'Laboratorio Químico Biológicas', rect(270, 324, 316, 335)],
  ['P', 'Laboratorio de Física', rect(254, 341, 274, 353)],
  ['Q', 'Aulas Electrónica', rect(438, 330, 484, 341)],
  ['R', 'Cafetería', rect(322, 360, 340, 383)],
  ['S', 'Depto. de Recursos Materiales y Servicios', rect(148, 369, 196, 377)],
  ['S1', 'Consejo Estudiantil', rect(180, 395, 188, 403)],
  ['S2', 'Comedor para trabajadores', rect(123, 401, 131, 411)],
  ['S3', 'Caldera Demostrativa (laboratorio)', rect(420, 207, 429, 218)],
  ['T', 'Laboratorio de Ingeniería Mecánica II', rect(194, 405, 228, 431)],
  [
    'U',
    'Gimnasio Auditorio',
    [
      [240, 395],
      [256, 395],
      [256, 393],
      [302, 393],
      [302, 445],
      [256, 445],
      [256, 440],
      [240, 440],
    ],
  ],
  ['V', 'Depto. de Actividades Extraescolares', rect(353, 361, 362, 387)],
  ['W', 'Editorial', rect(364, 357, 376, 369)],
  ['X', 'Comedor estudiantil', rect(352, 399, 381, 410)],
  ['Y', 'Departamento de Electrónica', rect(460, 375, 485, 401)],
  ['Z', 'Aulas de Eléctrica', rect(378, 363, 394, 388)],
  ['AA', 'Depto. de Ing. Eléctrica', rect(398, 363, 422, 375)],
  ['AB', 'Cubículos de Ing. Electrónica', rect(390, 408, 413, 419)],
  ['AC', 'Depto. de Ciencias Básicas', rect(361, 438, 384, 448)],
  ['AD', 'Cubículos para Prof. de Ciencias Básicas', rect(361, 461, 383, 472)],
  ['AE', 'Laboratorios de Maestría en Electrónica', rect(496, 359, 516, 413)],
  ['AF', 'Centro de Información 600 lectores', rect(524, 366, 564, 420)],
  ['AG', 'Educ. a Distancia, C. Cómputo, Posg. Mecánica', rect(463, 101, 482, 151)],
  ['AH', 'Depto. de Bioquímica y Laboratorios', rect(400, 442, 435, 468)],

  // Unidad Metal Mecánica
  [
    '2A',
    'Depto. Ing. Mecánica y Posg. en Materiales',
    [
      [64, 185],
      [111, 185],
      [111, 199],
      [96, 199],
      [96, 216],
      [111, 216],
      [111, 230],
      [64, 230],
      [64, 216],
      [82, 216],
      [82, 199],
      [64, 199],
    ],
  ],
  ['2B', 'Laboratorio de Fusión al Vacío', rect(122, 166, 136, 180)],
  ['2C', 'Almacén de Materias Primas', rect(103, 162, 118, 172)],
  ['2D', 'Laboratorio de Fundición y Trat. Térmicos', rect(103, 143, 141, 157)],
  [
    '2E',
    'Aula',
    [
      [161, 135],
      [172, 141],
      [168, 147],
      [157, 141],
    ],
  ],
  ['2F', 'Depto. de Ing. en Materiales', rect(165, 94, 192, 105)],
  ['2G', 'Lab. de Análisis Químicos y Fisicoquímica', rect(133, 87, 146, 129)],
  ['2H', 'Laboratorio de Materiales', rect(90, 110, 119, 121)],
  ['2J', 'Laboratorio de Rayos X', rect(90, 82, 119, 93)],
  ['2K', 'Aulas', rect(54, 50, 68, 62)],

  // Unidad Posgrado en Eléctrica
  ['3A', 'Laboratorio Posgrado en Eléctrica', rect(563, 540, 591, 574)],
  ['3B', 'Cubículos Doctorado en Eléctrica', rect(604, 508, 634, 534)],
]

// ─── Áreas exteriores ───
// subtipo: sirve para dibujarlas distinto (estacionamiento, cancha, pasto, plaza, agua, acceso)
const EXTERIORES = [
  [
    'estacionamiento-1',
    'Estacionamiento 1',
    'estacionamiento',
    [
      [238, 172],
      [254, 172],
      [254, 262],
      [174, 262],
    ],
  ],
  [
    'estacionamiento-2',
    'Estacionamiento 2',
    'estacionamiento',
    [
      [66, 52],
      [168, 46],
      [214, 70],
      [84, 72],
      [84, 180],
      [66, 180],
    ],
  ],
  [
    'estacionamiento-3',
    'Estacionamiento 3',
    'estacionamiento',
    [
      [640, 557],
      [684, 596],
      [626, 598],
      [626, 570],
    ],
  ],
  [
    'estacionamiento-4',
    'Estacionamiento 4',
    'estacionamiento',
    [
      [240, 452],
      [335, 452],
      [338, 472],
      [398, 472],
      [400, 532],
      [240, 481],
    ],
  ],
  [
    'estacionamiento-5',
    'Estacionamiento 5',
    'estacionamiento',
    [
      [328, 60],
      [482, 60],
      [482, 98],
      [446, 98],
      [446, 224],
      [402, 224],
      [402, 98],
      [328, 98],
      [300, 116],
    ],
  ],
  [
    'pista',
    'Pista de atletismo',
    'pista',
    [
      [546, 122],
      [578, 130],
      [594, 160],
      [594, 280],
      [578, 306],
      [546, 314],
      [514, 306],
      [498, 280],
      [498, 160],
      [514, 130],
    ],
  ],
  [
    'campo-pista',
    'Campo de fútbol de la pista',
    'pasto',
    [
      [528, 140],
      [564, 140],
      [578, 160],
      [578, 280],
      [564, 296],
      [528, 296],
      [514, 280],
      [514, 160],
    ],
  ],
  [
    'canchas-basquet',
    'Canchas de básquet',
    'cancha',
    [
      [447, 184],
      [470, 184],
      [470, 222],
      [447, 222],
    ],
  ],
  ['canchas-basquet-sur', 'Canchas de básquet (junto a Q)', 'cancha', rect(400, 282, 476, 326)],
  ['alberca', 'Alberca', 'agua', rect(448, 229, 469, 267)],
  ['campo-futbol-ah', 'Campo de fútbol (junto a AH)', 'pasto', rect(440, 437, 547, 500)],
  ['cancha-ptar', 'Cancha junto a la PTAR', 'pasto', rect(461, 527, 503, 549)],
  ['explanada', 'Explanada del Gimnasio Auditorio', 'plaza', rect(304, 393, 332, 453)],
  ['plaza-electronica', 'Plaza de Electrónica', 'plaza', rect(430, 375, 455, 423)],
  ['acceso-raza-maya', 'Acceso Calle Raza Maya', 'acceso', rect(442, 56, 466, 70)],
  [
    'acceso-libramiento',
    'Acceso Libramiento Norte',
    'acceso',
    [
      [196, 446],
      [214, 452],
      [210, 464],
      [192, 458],
    ],
  ],
  [
    'acceso-metal-mecanica',
    'Accesos Metal Mecánica',
    'acceso',
    [
      [208, 64],
      [226, 70],
      [218, 82],
      [200, 76],
    ],
  ],
  ['acceso-posgrado', 'Accesos Posgrado', 'acceso', rect(578, 590, 600, 602)],
]

// Arma la lista final con ids como edificio-K, estacionamiento-5, cancha, etc.
export const ZONAS = [
  ...EDIFICIOS.map(([clave, nombre, puntos]) => ({
    id: `edificio-${clave}`,
    tipo: 'edificio',
    clave,
    nombre,
    puntos,
  })),
  ...EXTERIORES.map(([id, nombre, subtipo, puntos]) => ({
    id,
    tipo: 'exterior',
    subtipo,
    nombre,
    puntos,
  })),
]
