import axios from 'axios';
import crypto from 'crypto';
import {
  CHESSCOM_API_URL,
  CHESSCOM_POLL_INTERVAL_MS,
  CHESSCOM_SCORING,
  CHESSCOM_USER_AGENT,
} from '../config/api.js';
import UserRepository from '../Repositories/UserRepository.js';
import SensorPointRepository from '../Repositories/SensorPointRepository.js';
import SensorPointModel from '../Models/SensorPointModel.js';
import LsgApiService from './LsgApiService.js';

const GAME_CLASSES = ['blitz', 'bullet', 'rapid'];

class SensorChessComService {
  constructor() {
    this.httpClient = axios.create({
      headers: {
        Accept: 'application/json',
        'User-Agent': CHESSCOM_USER_AGENT,
      },
      timeout: 30000,
    });
    this.lsgApiService = new LsgApiService();
    this.pollTimer = null;
    this.isPolling = false;
    this.startPollingLoop();
  }

  startPollingLoop() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollAllUsers(), CHESSCOM_POLL_INTERVAL_MS);
    setTimeout(() => this.pollAllUsers(), 10000);
  }

  async pollAllUsers() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const users = await UserRepository.getUsers();
      const user = users[0];
      if (user?.chesscom_username) {
        await this.pollProgress(user);
      }
    } catch (error) {
      console.error('Error en polling Chess.com:', error.message);
    } finally {
      this.isPolling = false;
    }
  }

  async linkUsername(username) {
    const clean = String(username || '').trim().replace(/^@/, '');
    if (!clean) throw new Error('El username de Chess.com es obligatorio.');

    let profile;
    try {
      const response = await this.httpClient.get(
        `${CHESSCOM_API_URL}/player/${encodeURIComponent(clean.toLowerCase())}`
      );
      profile = response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Usuario de Chess.com no encontrado.');
      }
      throw new Error(error.response?.data?.message || error.message || 'No se pudo validar Chess.com.');
    }

    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user) throw new Error('No hay usuario LSG registrado. Inicia sesión primero.');

    const resolvedUsername = profile.username || clean;
    const stats = await this.fetchStats(resolvedUsername);
    const snapshot = this.buildStatsSnapshot(stats);

    user.chesscom_username = resolvedUsername;
    user.chesscom_last_sync_at = String(Date.now());
    user.chesscom_stats_snapshot = JSON.stringify(snapshot);
    user.chesscom_last_status = JSON.stringify({
      updatedAt: new Date().toISOString(),
      accumulatedPoints: 0,
      accumulatedSections: this.buildEmptySections(),
      lastCyclePoints: 0,
      baselineSavedAt: new Date().toISOString(),
      message:
        'Línea base Chess.com guardada. Solo contarás partidas y avance nuevos desde ahora.',
    });
    await UserRepository.updateUser(user);

    await this.lsgApiService.resolveChessComSensorEndpointId(user);
    return resolvedUsername;
  }

  async checkChessComLinked() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    return Boolean(user?.chesscom_username);
  }

  async unlinkAccount() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user) throw new Error('No hay usuario LSG registrado.');

    user.chesscom_username = null;
    user.chesscom_last_sync_at = null;
    user.chesscom_stats_snapshot = null;
    user.chesscom_last_status = null;
    await UserRepository.updateUser(user);
    return true;
  }

  async fetchStats(username) {
    const response = await this.httpClient.get(
      `${CHESSCOM_API_URL}/player/${encodeURIComponent(username.toLowerCase())}/stats`
    );
    return response.data || {};
  }

  buildStatsSnapshot(stats) {
    return {
      savedAt: new Date().toISOString(),
      ratings: {
        blitz: stats.chess_blitz?.last?.rating ?? null,
        bullet: stats.chess_bullet?.last?.rating ?? null,
        rapid: stats.chess_rapid?.last?.rating ?? null,
      },
      tacticsHighest: stats.tactics?.highest?.rating ?? null,
      puzzleRushBest: stats.puzzle_rush?.best?.score ?? null,
      puzzleRushDaily: stats.puzzle_rush?.daily?.score ?? null,
    };
  }

  parseStatsSnapshot(user) {
    try {
      return JSON.parse(user.chesscom_stats_snapshot || '{}');
    } catch {
      return {};
    }
  }

  async fetchNewGames(username, sinceMs) {
    const stats = {
      blitz: { games: 0, wins: 0 },
      bullet: { games: 0, wins: 0 },
      rapid: { games: 0, wins: 0 },
    };

    const now = new Date();
    const months = [
      { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 },
    ];
    if (now.getUTCDate() <= 2 || now.getUTCMonth() === 0) {
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      months.push({ y: prev.getUTCFullYear(), m: prev.getUTCMonth() + 1 });
    } else {
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      months.push({ y: prev.getUTCFullYear(), m: prev.getUTCMonth() + 1 });
    }

    const seen = new Set();
    for (const { y, m } of months) {
      const mm = String(m).padStart(2, '0');
      try {
        const response = await this.httpClient.get(
          `${CHESSCOM_API_URL}/player/${encodeURIComponent(username.toLowerCase())}/games/${y}/${mm}`
        );
        const games = response.data?.games || [];
        for (const game of games) {
          const endMs = (game.end_time || 0) * 1000;
          if (!endMs || endMs <= sinceMs) continue;
          const url = game.url || `${endMs}-${game.fen || ''}`;
          if (seen.has(url)) continue;
          seen.add(url);

          const timeClass = game.time_class;
          if (!GAME_CLASSES.includes(timeClass)) continue;
          if (game.rules && game.rules !== 'chess') continue;

          stats[timeClass].games += 1;
          const isWhite =
            (game.white?.username || '').toLowerCase() === username.toLowerCase();
          const side = isWhite ? game.white : game.black;
          if (side?.result === 'win') {
            stats[timeClass].wins += 1;
          }
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error(`Chess.com archive ${y}/${mm}:`, error.message);
        }
      }
    }

    return stats;
  }

  computeStatsDelta(prevSnapshot, currentStats) {
    const current = this.buildStatsSnapshot(currentStats);
    const prevRatings = prevSnapshot.ratings || {};
    const currRatings = current.ratings || {};

    let eloGain = 0;
    for (const perf of GAME_CLASSES) {
      const prev = Number(prevRatings[perf]);
      const curr = Number(currRatings[perf]);
      if (Number.isFinite(prev) && Number.isFinite(curr) && curr > prev) {
        eloGain += curr - prev;
      }
    }

    const prevTactics = Number(prevSnapshot.tacticsHighest);
    const currTactics = Number(current.tacticsHighest);
    const tacticsGain =
      Number.isFinite(prevTactics) && Number.isFinite(currTactics) && currTactics > prevTactics
        ? currTactics - prevTactics
        : 0;

    const prevRush = Number(prevSnapshot.puzzleRushBest);
    const currRush = Number(current.puzzleRushBest);
    const puzzleRushGain =
      Number.isFinite(prevRush) && Number.isFinite(currRush) && currRush > prevRush
        ? currRush - prevRush
        : 0;

    return {
      eloGain,
      tacticsGain,
      puzzleRushGain,
      snapshot: current,
    };
  }

  computePoints(gamesStats, extras) {
    const GAME_POINTS = CHESSCOM_SCORING.gamePlayed.pointsPerUnit;
    const WIN_BONUS = CHESSCOM_SCORING.gameWon.pointsPerUnit;
    const ELO_POINTS = CHESSCOM_SCORING.eloGain.pointsPerUnit;
    const ELO_CAP = CHESSCOM_SCORING.eloGain.cap;
    const RUSH_POINTS = CHESSCOM_SCORING.puzzleRush.pointsPerUnit;
    const RUSH_CAP = CHESSCOM_SCORING.puzzleRush.cap;
    const TACTICS_POINTS = CHESSCOM_SCORING.tactics.pointsPerUnit;
    const TACTICS_CAP = CHESSCOM_SCORING.tactics.cap;

    const breakdown = {
      games: 0,
      wins: 0,
      elo: 0,
      puzzleRush: 0,
      tactics: 0,
    };

    let gamesPlayed = 0;
    let gamesWon = 0;
    for (const perf of GAME_CLASSES) {
      const g = gameStats[perf];
      gamesPlayed += g.games;
      gamesWon += g.wins;
      breakdown.games += g.games * GAME_POINTS;
      breakdown.wins += g.wins * WIN_BONUS;
    }

    breakdown.elo = Math.min(extras.eloGain * ELO_POINTS, ELO_CAP);
    breakdown.puzzleRush = Math.min(extras.puzzleRushGain * RUSH_POINTS, RUSH_CAP);
    breakdown.tactics = Math.min(extras.tacticsGain * TACTICS_POINTS, TACTICS_CAP);

    const total = Math.round(
      breakdown.games + breakdown.wins + breakdown.elo + breakdown.puzzleRush + breakdown.tactics
    );

    return {
      total,
      breakdown,
      counts: {
        gamesPlayed,
        gamesWon,
        eloGain: extras.eloGain,
        puzzleRushGain: extras.puzzleRushGain,
        tacticsGain: extras.tacticsGain,
      },
    };
  }

  buildSections(counts, breakdown) {
    return [
      {
        id: 'games',
        label: CHESSCOM_SCORING.gamePlayed.label,
        count: counts.gamesPlayed,
        pointsPerUnit: CHESSCOM_SCORING.gamePlayed.pointsPerUnit,
        points: breakdown.games,
      },
      {
        id: 'wins',
        label: CHESSCOM_SCORING.gameWon.label,
        count: counts.gamesWon,
        pointsPerUnit: CHESSCOM_SCORING.gameWon.pointsPerUnit,
        points: breakdown.wins,
      },
      {
        id: 'elo',
        label: CHESSCOM_SCORING.eloGain.label,
        count: counts.eloGain,
        pointsPerUnit: CHESSCOM_SCORING.eloGain.pointsPerUnit,
        points: breakdown.elo,
        cap: CHESSCOM_SCORING.eloGain.cap,
      },
      {
        id: 'puzzleRush',
        label: CHESSCOM_SCORING.puzzleRush.label,
        count: counts.puzzleRushGain,
        pointsPerUnit: CHESSCOM_SCORING.puzzleRush.pointsPerUnit,
        points: breakdown.puzzleRush,
        cap: CHESSCOM_SCORING.puzzleRush.cap,
      },
      {
        id: 'tactics',
        label: CHESSCOM_SCORING.tactics.label,
        count: counts.tacticsGain,
        pointsPerUnit: CHESSCOM_SCORING.tactics.pointsPerUnit,
        points: breakdown.tactics,
        cap: CHESSCOM_SCORING.tactics.cap,
      },
    ];
  }

  buildScoringRules() {
    return Object.entries(CHESSCOM_SCORING).map(([id, rule]) => ({
      id,
      label: rule.label,
      pointsPerUnit: rule.pointsPerUnit,
      cap: rule.cap ?? null,
    }));
  }

  buildEmptySections() {
    return this.buildSections(
      { gamesPlayed: 0, gamesWon: 0, eloGain: 0, puzzleRushGain: 0, tacticsGain: 0 },
      { games: 0, wins: 0, elo: 0, puzzleRush: 0, tactics: 0 }
    );
  }

  mergeAccumulatedSections(prevSections, cycleSections) {
    const byId = {};
    for (const section of prevSections || []) {
      byId[section.id] = { ...section };
    }
    for (const section of cycleSections || []) {
      const prev = byId[section.id] || {
        id: section.id,
        label: section.label,
        count: 0,
        points: 0,
        pointsPerUnit: section.pointsPerUnit,
        cap: section.cap,
      };
      byId[section.id] = {
        ...prev,
        label: section.label,
        count:
          section.count != null
            ? (prev.count ?? 0) + section.count
            : prev.count ?? null,
        points: (prev.points ?? 0) + (section.points ?? 0),
        pointsPerUnit: section.pointsPerUnit,
        cap: section.cap ?? prev.cap,
      };
    }
    const order = ['games', 'wins', 'elo', 'puzzleRush', 'tactics'];
    return order.map((id) => byId[id]).filter(Boolean);
  }

  async resetAccumulatedStatus(user, message) {
    await this.saveLastStatus(user, {
      updatedAt: new Date().toISOString(),
      lastCyclePoints: 0,
      accumulatedPoints: 0,
      accumulatedSections: this.buildEmptySections(),
      pendingIngestEventIds: [],
      ingested: false,
      message,
    });
  }

  async saveLastStatus(user, status) {
    user.chesscom_last_status = JSON.stringify(status);
    await UserRepository.updateUser(user);
  }

  parseLastStatus(user) {
    try {
      return JSON.parse(user.chesscom_last_status || '{}');
    } catch {
      return {};
    }
  }

  async pollProgress(user) {
    const sinceMs = parseInt(user.chesscom_last_sync_at || '0', 10) || Date.now();
    const username = user.chesscom_username;
    const prevSnapshot = this.parseStatsSnapshot(user);

    const games = await this.fetchNewGames(username, sinceMs);
    let stats = {};
    try {
      stats = await this.fetchStats(username);
    } catch (error) {
      console.error('Chess.com stats error:', error.message);
    }

    const extras = this.computeStatsDelta(prevSnapshot, stats);
    const { total, breakdown, counts } = this.computePoints(gameStatsOrEmpty(games), extras);
    const cycleSections = this.buildSections(counts, breakdown);
    const lastStatus = this.parseLastStatus(user);
    const prevAccumulated = lastStatus.accumulatedSections ?? lastStatus.sections ?? [];

    user.chesscom_last_sync_at = String(Date.now());
    user.chesscom_stats_snapshot = JSON.stringify(extras.snapshot);

    if (total <= 0) {
      await UserRepository.updateUser(user);
      await this.saveLastStatus(user, {
        ...lastStatus,
        updatedAt: new Date().toISOString(),
        lastCyclePoints: 0,
        accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
        accumulatedSections: prevAccumulated,
        baselineSavedAt: extras.snapshot.savedAt,
        message: 'Sin avance nuevo en Chess.com. Último estado guardado.',
      });
      console.log('Chess.com: sin avance nuevo desde última sync.');
      return {
        points: 0,
        games,
        extras,
        sections: prevAccumulated,
        accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
      };
    }

    const accumulatedSections = this.mergeAccumulatedSections(prevAccumulated, cycleSections);
    const accumulatedPoints = (lastStatus.accumulatedPoints ?? 0) + total;

    let ingestEventId = null;
    const endpointId = await this.lsgApiService.resolveChessComSensorEndpointId(user);

    if (endpointId) {
      const payload = {
        player_id: parseInt(user.id_players, 10),
        sensor_endpoint_id: parseInt(endpointId, 10),
        players_sensor_endpoint_id: user.chesscom_lsg_players_sensor_endpoint_id
          ? parseInt(user.chesscom_lsg_players_sensor_endpoint_id, 10)
          : null,
        parsed_value: total,
        status: 'OK',
        occurred_at: new Date().toISOString(),
        raw_payload: {
          platform: 'Chess.com',
          trigger: 'progress_poll',
          chesscom_username: username,
          games,
          extras: {
            eloGain: extras.eloGain,
            tacticsGain: extras.tacticsGain,
            puzzleRushGain: extras.puzzleRushGain,
          },
          breakdown,
          cycleSections,
          client_ref: crypto.randomUUID(),
        },
      };

      try {
        const ingestResult = await this.lsgApiService.ingestSensorEvent(user, payload);
        ingestEventId = ingestResult?.id_sensor_ingest_event ?? null;
      } catch (error) {
        console.error('Chess.com ingest error:', error.response?.data || error.message);
        await UserRepository.updateUser(user);
        await this.saveLastStatus(user, {
          updatedAt: new Date().toISOString(),
          lastCyclePoints: total,
          accumulatedPoints,
          accumulatedSections,
          ingested: false,
          baselineSavedAt: extras.snapshot.savedAt,
          message: 'Puntos acumulados; no se pudo registrar el evento en LSG.',
        });
        return {
          points: total,
          games,
          extras,
          sections: accumulatedSections,
          accumulatedPoints,
          ingested: false,
        };
      }
    }

    await this.saveLocalPoint(user, total);
    await UserRepository.updateUser(user);
    await this.saveLastStatus(user, {
      updatedAt: new Date().toISOString(),
      lastCyclePoints: total,
      accumulatedPoints,
      accumulatedSections,
      pendingIngestEventIds: [
        ...(lastStatus.pendingIngestEventIds ?? []),
        ...(ingestEventId ? [ingestEventId] : []),
      ],
      ingested: Boolean(ingestEventId),
      baselineSavedAt: extras.snapshot.savedAt,
      message: `+${total} pts acumulados por actividad Chess.com. Canjea para enviarlos a tu perfil.`,
    });

    console.log(`Chess.com: +${total} pts acumulados (pendiente: ${accumulatedPoints}).`, breakdown);
    return {
      points: total,
      games,
      extras,
      sections: accumulatedSections,
      accumulatedPoints,
      ingested: Boolean(ingestEventId),
    };
  }

  async saveLocalPoint(user, points) {
    const today = new Date().toISOString().split('T')[0];
    const point = new SensorPointModel(
      null,
      1,
      user.id_players,
      points,
      today,
      null,
      null,
      null,
      'Chess.com'
    );
    await SensorPointRepository.createSensorPoint(point);
  }

  async getSensorStatus() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user?.chesscom_username) {
      throw new Error('Chess.com no vinculado.');
    }

    let mentalBalance = 0;
    try {
      mentalBalance = await this.lsgApiService.getMentalBalance(user);
    } catch (error) {
      console.error('No se pudo obtener saldo Mental LSG:', error.message);
    }

    const lastStatus = this.parseLastStatus(user);
    const snapshot = this.parseStatsSnapshot(user);
    const lastSyncAt = user.chesscom_last_sync_at
      ? new Date(parseInt(user.chesscom_last_sync_at, 10)).toISOString()
      : null;

    return {
      username: user.chesscom_username,
      mentalBalance,
      lastSyncAt,
      syncIntervalMs: CHESSCOM_POLL_INTERVAL_MS,
      lastCyclePoints: lastStatus.lastCyclePoints ?? 0,
      accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
      sections: lastStatus.accumulatedSections ?? this.buildEmptySections(),
      ratings: snapshot.ratings || {},
      tacticsHighest: snapshot.tacticsHighest ?? null,
      puzzleRushBest: snapshot.puzzleRushBest ?? null,
      baselineSavedAt: snapshot.savedAt || lastStatus.baselineSavedAt || null,
      scoringRules: this.buildScoringRules(),
      ingested: lastStatus.ingested ?? false,
      message: lastStatus.message ?? null,
      apiNote:
        'La API pública de Chess.com puede demorar en refrescar partidas recientes (caché).',
    };
  }

  async transferAccumulatedPoints() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user) throw new Error('No hay usuario LSG registrado.');

    const lastStatus = this.parseLastStatus(user);
    const amount = Math.round(lastStatus.accumulatedPoints ?? 0);
    if (amount <= 0) {
      throw new Error('No hay puntos acumulados para enviar al perfil.');
    }

    const reason = `Sensor Chess.com (${user.chesscom_username}) - ${amount} pts`;
    try {
      const result = await this.lsgApiService.adjustPlayerPoints(user, amount, reason);
      await this.resetAccumulatedStatus(
        user,
        `${amount} puntos Mental enviados a tu perfil LSG.`
      );
      return { amount, ...result };
    } catch (error) {
      throw new Error(LsgApiService.formatApiError(error));
    }
  }

  async manualPoll() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user?.chesscom_username) {
      throw new Error('Chess.com no vinculado.');
    }
    return this.pollProgress(user);
  }
}

function gameStatsOrEmpty(games) {
  return {
    blitz: games?.blitz || { games: 0, wins: 0 },
    bullet: games?.bullet || { games: 0, wins: 0 },
    rapid: games?.rapid || { games: 0, wins: 0 },
  };
}

export default SensorChessComService;
