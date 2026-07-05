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

/** Reglas de puntuación visibles en la UI */
export const LICHESS_SCORING = {
  gamePlayed: { label: 'Partidas jugadas (blitz, bullet, rapid)', pointsPerUnit: 8 },
  gameWon: { label: 'Partidas ganadas', pointsPerUnit: 4 },
  puzzle: { label: 'Puzzles resueltos', pointsPerUnit: 10 },
  practice: { label: 'Rutas de aprendizaje', pointsPerUnit: 5 },
  eloGain: { label: 'Subida de ELO', pointsPerUnit: 2, cap: 30 },
  storm: { label: 'Puzzle Storm / Racer', pointsPerUnit: 15 },
};
