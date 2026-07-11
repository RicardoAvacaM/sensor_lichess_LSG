/** LSG + Lichess API configuration */
export const LSG_AUTH_URL = 'https://lsg.diinf.usach.cl/lsg-auth';
export const LSG_CORE_URL = 'https://lsg.diinf.usach.cl/lsg-core-api';

export const LICHESS_API_URL = 'https://lichess.org';

/** Token personal opcional vía variable de entorno LICHESS_PAT (no commitear) */
export const LICHESS_PAT = process.env.LICHESS_PAT || null;

/** Mental attribute (dimension 4) */
export const LSG_MENTAL_ATTRIBUTE_ID = 4;

/**
 * ID del endpoint de ingestión en LSG (POST /sensors/{id}/endpoints).
 * Si es null, el sensor intentará resolverlo automáticamente vía GET /sensors.
 */
export const LSG_SENSOR_ENDPOINT_ID = null;

/** Intervalo de polling en ms (3 minutos) */
export const LICHESS_POLL_INTERVAL_MS = 3 * 60 * 1000;

/** Reglas de puntuación visibles en la UI (campos de GET /api/user/{username}/activity) */
export const LICHESS_SCORING = {
  gamePlayed: { label: 'Partidas jugadas (blitz, bullet, rapid)', pointsPerUnit: 8 },
  gameWon: { label: 'Partidas ganadas', pointsPerUnit: 4 },
  puzzle: { label: 'Puzzles resueltos', pointsPerUnit: 10 },
  practice: { label: 'Practice (lichess.org/practice)', pointsPerUnit: 5 },
  studies: { label: 'Estudios (lichess.org/study)', pointsPerUnit: 6 },
  puzzleStreak: { label: 'Puzzle Streak', pointsPerUnit: 12 },
  eloGain: { label: 'Subida de ELO', pointsPerUnit: 2, cap: 30 },
  storm: { label: 'Puzzle Storm / Racer', pointsPerUnit: 15 },
};

/**
 * No disponible en la API pública de Lichess (sin endpoint oficial):
 * - Chess basics (lichess.org/learn)
 * - Entrenamiento de coordenadas (lichess.org/training/coordinate)
 */
export const LICHESS_UNSUPPORTED_LEARN = ['Chess basics (/learn)', 'Coordenadas (/training/coordinate)'];

/** HTB Academy */
export const HTB_ACADEMY_URL = 'https://academy.hackthebox.com';
export const HTB_ACADEMY_API_URL = `${HTB_ACADEMY_URL}/api/v2`;

/**
 * ID del endpoint de ingestión LSG para HTB (si null, auto-detect por nombre).
 */
export const HTB_LSG_SENSOR_ENDPOINT_ID = null;

export const HTB_POLL_INTERVAL_MS = 3 * 60 * 1000;

/** Puntos por avance en módulos Academy (progreso % y completado) */
export const HTB_SCORING = {
  progressPercent: {
    label: 'Avance en módulo (% completado)',
    pointsPerUnit: 2,
  },
  moduleCompleted: {
    label: 'Módulo completado (100%)',
    pointsPerUnit: 30,
  },
};
