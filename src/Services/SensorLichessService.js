import axios from 'axios';
import crypto from 'crypto';
import {
  LICHESS_API_URL,
  LICHESS_PAT,
  LICHESS_POLL_INTERVAL_MS,
  LICHESS_SCORING,
  LICHESS_UNSUPPORTED_LEARN,
} from '../config/api.js';
import UserRepository from '../Repositories/UserRepository.js';
import SensorPointRepository from '../Repositories/SensorPointRepository.js';
import SensorPointModel from '../Models/SensorPointModel.js';
import LsgApiService from './LsgApiService.js';

const GAME_PERFS = ['blitz', 'bullet', 'rapid'];

class SensorLichessService {
  constructor() {
    this.httpClient = axios.create();
    this.lsgApiService = new LsgApiService();
    this.pollTimer = null;
    this.isPolling = false;
    this.startPollingLoop();
    this.tryAutoLinkFromEnv();
  }

  async tryAutoLinkFromEnv() {
    if (!LICHESS_PAT) return;
    try {
      const linked = await this.checkLichessLinked();
      if (!linked) {
        await this.linkPersonalToken(LICHESS_PAT);
        console.log('Lichess vinculado automáticamente desde LICHESS_PAT.');
      }
    } catch (error) {
      console.error('No se pudo auto-vincular LICHESS_PAT:', error.message);
    }
  }

  startPollingLoop() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollAllUsers(), LICHESS_POLL_INTERVAL_MS);
    setTimeout(() => this.pollAllUsers(), 5000);
  }

  async pollAllUsers() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const users = await UserRepository.getUsers();
      const user = users[0];
      if (user?.lichess_username && user?.lichess_access_token) {
        await this.pollProgress(user);
      }
    } catch (error) {
      console.error('Error en polling Lichess:', error.message);
    } finally {
      this.isPolling = false;
    }
  }

  async linkPersonalToken(accessToken) {
    if (!accessToken?.trim()) {
      throw new Error('El token personal es obligatorio.');
    }

    const token = accessToken.trim();
    const accountRes = await this.httpClient.get(`${LICHESS_API_URL}/api/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user) throw new Error('No hay usuario LSG registrado. Inicia sesión primero.');

    user.lichess_username = accountRes.data.username || accountRes.data.id;
    user.lichess_access_token = token;
    user.lichess_last_sync_at = String(Date.now());
    user.lichess_activity_snapshot = '{}';
    user.lichess_last_status = JSON.stringify({
      accumulatedPoints: 0,
      accumulatedSections: this.buildEmptySections(),
      lastCyclePoints: 0,
    });
    await UserRepository.updateUser(user);

    await this.lsgApiService.resolveSensorEndpointId(user);
    return user.lichess_username;
  }

  async checkLichessLinked() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    return Boolean(user?.lichess_username && user?.lichess_access_token);
  }

  async fetchNewGames(username, token, sinceMs) {
    const stats = {
      blitz: { games: 0, wins: 0, eloGain: 0 },
      bullet: { games: 0, wins: 0, eloGain: 0 },
      rapid: { games: 0, wins: 0, eloGain: 0 },
    };

    try {
      const response = await this.httpClient.get(
        `${LICHESS_API_URL}/api/games/user/${username}`,
        {
          params: {
            since: sinceMs,
            max: 100,
            rated: true,
            perfType: GAME_PERFS.join(','),
          },
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/x-ndjson',
          },
          responseType: 'text',
          timeout: 30000,
        }
      );

      const lines = (response.data || '').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const game = JSON.parse(line);
        const speed = game.speed;
        if (!GAME_PERFS.includes(speed)) continue;

        stats[speed].games += 1;
        const userColor = game.players?.white?.user?.name?.toLowerCase() === username.toLowerCase()
          ? 'white'
          : 'black';
        if (game.winner === userColor) stats[speed].wins += 1;
        const ratingDiff = game.players?.[userColor]?.ratingDiff;
        if (typeof ratingDiff === 'number' && ratingDiff > 0) {
          stats[speed].eloGain += ratingDiff;
        }
      }
    } catch (error) {
      console.error('Error al obtener partidas Lichess:', error.message);
    }

    return stats;
  }

  emptyActivitySnapshotEntry() {
    return {
      puzzlesWon: 0,
      puzzleRpAfter: 0,
      practicePositions: 0,
      studiesCount: 0,
      stormRuns: 0,
      streakRuns: 0,
    };
  }

  parseActivityEntry(entry) {
    let puzzlesWon = 0;
    let puzzleRpAfter = 0;
    let puzzleRpBefore = 0;
    let practicePositions = 0;
    let studiesCount = 0;
    let stormRuns = 0;
    let streakRuns = 0;

    if (entry.puzzles?.score) {
      puzzlesWon = entry.puzzles.score.win || 0;
      puzzleRpBefore = entry.puzzles.score.rp?.before ?? 0;
      puzzleRpAfter = entry.puzzles.score.rp?.after ?? puzzleRpBefore;
    }

    if (entry.practice?.length) {
      practicePositions = entry.practice.reduce((sum, p) => sum + (p.nbPositions || 0), 0);
    }

    if (entry.studies?.length) {
      studiesCount = entry.studies.length;
    }

    stormRuns = (entry.storm?.runs || 0) + (entry.racer?.runs || 0);
    streakRuns = entry.streak?.runs || 0;

    if (entry.games) {
      for (const perf of GAME_PERFS) {
        if (entry.games[perf]?.rp) {
          puzzleRpBefore += entry.games[perf].rp.before || 0;
          puzzleRpAfter += entry.games[perf].rp.after || 0;
        }
      }
    }

    return {
      puzzlesWon,
      puzzleRpBefore,
      puzzleRpAfter,
      practicePositions,
      studiesCount,
      stormRuns,
      streakRuns,
    };
  }

  async fetchActivityExtras(username, user) {
    const result = {
      puzzlesWon: 0,
      puzzleEloGain: 0,
      practicePositions: 0,
      studiesCount: 0,
      stormRuns: 0,
      streakRuns: 0,
    };

    let snapshot = {};
    try {
      snapshot = JSON.parse(user.lichess_activity_snapshot || '{}');
    } catch {
      snapshot = {};
    }

    try {
      const headers = user.lichess_access_token
        ? { Authorization: `Bearer ${user.lichess_access_token}` }
        : {};
      const response = await this.httpClient.get(
        `${LICHESS_API_URL}/api/user/${username}/activity`,
        { headers }
      );
      const activities = response.data || [];

      for (const entry of activities) {
        const key = String(entry.interval?.start || '');
        if (!key) continue;

        const current = this.parseActivityEntry(entry);
        const prev = {
          ...this.emptyActivitySnapshotEntry(),
          ...snapshot[key],
        };

        result.puzzlesWon += Math.max(0, current.puzzlesWon - prev.puzzlesWon);
        result.practicePositions += Math.max(0, current.practicePositions - prev.practicePositions);
        result.studiesCount += Math.max(0, current.studiesCount - prev.studiesCount);
        result.stormRuns += Math.max(0, current.stormRuns - prev.stormRuns);
        result.streakRuns += Math.max(0, current.streakRuns - prev.streakRuns);
        result.puzzleEloGain += Math.max(0, current.puzzleRpAfter - (prev.puzzleRpAfter || 0));

        snapshot[key] = {
          puzzlesWon: current.puzzlesWon,
          puzzleRpAfter: current.puzzleRpAfter,
          practicePositions: current.practicePositions,
          studiesCount: current.studiesCount,
          stormRuns: current.stormRuns,
          streakRuns: current.streakRuns,
        };
      }

      user.lichess_activity_snapshot = JSON.stringify(snapshot);
    } catch (error) {
      console.error('Error al obtener activity Lichess:', error.message);
    }

    return result;
  }

  computePoints(delta) {
    const GAME_POINTS = LICHESS_SCORING.gamePlayed.pointsPerUnit;
    const WIN_BONUS = LICHESS_SCORING.gameWon.pointsPerUnit;
    const PUZZLE_POINTS = LICHESS_SCORING.puzzle.pointsPerUnit;
    const PRACTICE_POINTS = LICHESS_SCORING.practice.pointsPerUnit;
    const STUDIES_POINTS = LICHESS_SCORING.studies.pointsPerUnit;
    const STREAK_POINTS = LICHESS_SCORING.puzzleStreak.pointsPerUnit;
    const ELO_POINTS = LICHESS_SCORING.eloGain.pointsPerUnit;
    const ELO_CAP = LICHESS_SCORING.eloGain.cap;
    const STORM_POINTS = LICHESS_SCORING.storm.pointsPerUnit;

    let total = 0;
    const breakdown = {
      games: 0,
      wins: 0,
      puzzles: 0,
      practice: 0,
      studies: 0,
      puzzleStreak: 0,
      elo: 0,
      storm: 0,
    };

    for (const perf of GAME_PERFS) {
      const g = delta.games[perf];
      breakdown.games += g.games * GAME_POINTS;
      breakdown.wins += g.wins * WIN_BONUS;
      const eloBonus = Math.min(g.eloGain * ELO_POINTS, ELO_CAP);
      breakdown.elo += eloBonus;
      total += g.games * GAME_POINTS + g.wins * WIN_BONUS + eloBonus;
    }

    breakdown.puzzles = delta.puzzlesWon * PUZZLE_POINTS;
    breakdown.practice = delta.practicePositions * PRACTICE_POINTS;
    breakdown.studies = delta.studiesCount * STUDIES_POINTS;
    breakdown.puzzleStreak = delta.streakRuns * STREAK_POINTS;
    breakdown.storm = delta.stormRuns * STORM_POINTS;
    breakdown.elo += Math.min(delta.puzzleEloGain * ELO_POINTS, ELO_CAP);

    total += breakdown.puzzles + breakdown.practice + breakdown.studies;
    total += breakdown.puzzleStreak + breakdown.storm;
    total += Math.min(delta.puzzleEloGain * ELO_POINTS, ELO_CAP);

    return { total: Math.round(total), breakdown };
  }

  buildSections(delta, breakdown) {
    let gamesPlayed = 0;
    let gamesWon = 0;
    for (const perf of GAME_PERFS) {
      gamesPlayed += delta.games[perf].games;
      gamesWon += delta.games[perf].wins;
    }

    return [
      {
        id: 'games',
        label: LICHESS_SCORING.gamePlayed.label,
        count: gamesPlayed,
        pointsPerUnit: LICHESS_SCORING.gamePlayed.pointsPerUnit,
        points: breakdown.games,
      },
      {
        id: 'wins',
        label: LICHESS_SCORING.gameWon.label,
        count: gamesWon,
        pointsPerUnit: LICHESS_SCORING.gameWon.pointsPerUnit,
        points: breakdown.wins,
      },
      {
        id: 'puzzles',
        label: LICHESS_SCORING.puzzle.label,
        count: delta.puzzlesWon,
        pointsPerUnit: LICHESS_SCORING.puzzle.pointsPerUnit,
        points: breakdown.puzzles,
      },
      {
        id: 'practice',
        label: LICHESS_SCORING.practice.label,
        count: delta.practicePositions,
        pointsPerUnit: LICHESS_SCORING.practice.pointsPerUnit,
        points: breakdown.practice,
      },
      {
        id: 'studies',
        label: LICHESS_SCORING.studies.label,
        count: delta.studiesCount,
        pointsPerUnit: LICHESS_SCORING.studies.pointsPerUnit,
        points: breakdown.studies,
      },
      {
        id: 'puzzleStreak',
        label: LICHESS_SCORING.puzzleStreak.label,
        count: delta.streakRuns,
        pointsPerUnit: LICHESS_SCORING.puzzleStreak.pointsPerUnit,
        points: breakdown.puzzleStreak,
      },
      {
        id: 'elo',
        label: LICHESS_SCORING.eloGain.label,
        count: null,
        pointsPerUnit: LICHESS_SCORING.eloGain.pointsPerUnit,
        points: breakdown.elo,
        cap: LICHESS_SCORING.eloGain.cap,
      },
      {
        id: 'storm',
        label: LICHESS_SCORING.storm.label,
        count: delta.stormRuns,
        pointsPerUnit: LICHESS_SCORING.storm.pointsPerUnit,
        points: breakdown.storm,
      },
    ];
  }

  buildScoringRules() {
    return Object.entries(LICHESS_SCORING).map(([id, rule]) => ({
      id,
      label: rule.label,
      pointsPerUnit: rule.pointsPerUnit,
      cap: rule.cap ?? null,
    }));
  }

  emptyDelta() {
    return {
      games: {
        blitz: { games: 0, wins: 0, eloGain: 0 },
        bullet: { games: 0, wins: 0, eloGain: 0 },
        rapid: { games: 0, wins: 0, eloGain: 0 },
      },
      puzzlesWon: 0,
      practicePositions: 0,
      studiesCount: 0,
      stormRuns: 0,
      streakRuns: 0,
      puzzleEloGain: 0,
    };
  }

  buildEmptySections() {
    const breakdown = {
      games: 0,
      wins: 0,
      puzzles: 0,
      practice: 0,
      studies: 0,
      puzzleStreak: 0,
      elo: 0,
      storm: 0,
    };
    return this.buildSections(this.emptyDelta(), breakdown);
  }

  mergeAccumulatedSections(existing = [], incoming = []) {
    const byId = {};
    for (const section of existing) {
      byId[section.id] = { ...section };
    }
    for (const section of incoming) {
      const prev = byId[section.id];
      if (!prev) {
        byId[section.id] = {
          ...section,
          count: section.count ?? 0,
          points: section.points ?? 0,
        };
        continue;
      }
      byId[section.id] = {
        ...prev,
        count:
          section.count != null
            ? (prev.count ?? 0) + section.count
            : prev.count ?? null,
        points: (prev.points ?? 0) + (section.points ?? 0),
      };
    }

    const order = [
      'games',
      'wins',
      'puzzles',
      'practice',
      'studies',
      'puzzleStreak',
      'elo',
      'storm',
    ];
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
    user.lichess_last_status = JSON.stringify(status);
    await UserRepository.updateUser(user);
  }

  parseLastStatus(user) {
    try {
      return JSON.parse(user.lichess_last_status || '{}');
    } catch {
      return {};
    }
  }

  async getSensorStatus() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user?.lichess_username) {
      throw new Error('Lichess no vinculado.');
    }

    let mentalBalance = 0;
    try {
      mentalBalance = await this.lsgApiService.getMentalBalance(user);
    } catch (error) {
      console.error('No se pudo obtener saldo Mental LSG:', error.message);
    }

    const lastStatus = this.parseLastStatus(user);
    const lastSyncAt = user.lichess_last_sync_at
      ? new Date(parseInt(user.lichess_last_sync_at, 10)).toISOString()
      : null;

    const accumulatedSections =
      lastStatus.accumulatedSections ?? lastStatus.sections ?? [];

    return {
      username: user.lichess_username,
      mentalBalance,
      lastSyncAt,
      syncIntervalMs: LICHESS_POLL_INTERVAL_MS,
      lastCyclePoints: lastStatus.lastCyclePoints ?? 0,
      accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
      sections: accumulatedSections,
      ingested: lastStatus.ingested ?? false,
      scoringRules: this.buildScoringRules(),
      unsupportedLearn: LICHESS_UNSUPPORTED_LEARN,
      message: lastStatus.message ?? null,
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

    const reason = `Sensor Lichess (${user.lichess_username}) - ${amount} pts`;
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

  async pollProgress(user) {
    const sinceMs = parseInt(user.lichess_last_sync_at || '0', 10) || Date.now();
    const username = user.lichess_username;
    const token = user.lichess_access_token;

    const games = await this.fetchNewGames(username, token, sinceMs);
    const extras = await this.fetchActivityExtras(username, user);

    const delta = { games, ...extras };
    const { total, breakdown } = this.computePoints(delta);
    const cycleSections = this.buildSections(delta, breakdown);
    const lastStatus = this.parseLastStatus(user);
    const prevAccumulated = lastStatus.accumulatedSections ?? lastStatus.sections ?? [];

    user.lichess_last_sync_at = String(Date.now());

    if (total <= 0) {
      await this.saveLastStatus(user, {
        ...lastStatus,
        updatedAt: new Date().toISOString(),
        lastCyclePoints: 0,
        accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
        accumulatedSections: prevAccumulated,
        ingested: lastStatus.ingested ?? false,
        message: 'Sin avance nuevo desde la última sincronización.',
      });
      console.log('Lichess: sin avance nuevo desde última sync.');
      return {
        points: 0,
        delta,
        breakdown,
        sections: prevAccumulated,
        accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
      };
    }

    const accumulatedSections = this.mergeAccumulatedSections(prevAccumulated, cycleSections);
    const accumulatedPoints = (lastStatus.accumulatedPoints ?? 0) + total;

    let ingestEventId = null;
    const endpointId = await this.lsgApiService.resolveSensorEndpointId(user);

    if (endpointId) {
      const payload = {
        player_id: parseInt(user.id_players, 10),
        sensor_endpoint_id: parseInt(endpointId, 10),
        players_sensor_endpoint_id: user.lsg_players_sensor_endpoint_id
          ? parseInt(user.lsg_players_sensor_endpoint_id, 10)
          : null,
        parsed_value: total,
        status: 'OK',
        occurred_at: new Date().toISOString(),
        raw_payload: {
          platform: 'Lichess',
          trigger: 'progress_poll',
          lichess_username: username,
          delta,
          breakdown,
          cycleSections,
          client_ref: crypto.randomUUID(),
        },
      };

      try {
        const ingestResult = await this.lsgApiService.ingestSensorEvent(user, payload);
        ingestEventId = ingestResult?.id_sensor_ingest_event ?? null;
      } catch (error) {
        console.error('Error al registrar evento LSG:', error.response?.data || error.message);
        await this.saveLastStatus(user, {
          updatedAt: new Date().toISOString(),
          lastCyclePoints: total,
          accumulatedPoints,
          accumulatedSections,
          ingested: false,
          message: 'Puntos acumulados; no se pudo registrar el evento en LSG.',
        });
        return {
          points: total,
          delta,
          breakdown,
          sections: accumulatedSections,
          accumulatedPoints,
          ingested: false,
        };
      }
    } else {
      console.warn('LSG sensor_endpoint_id no configurado. Puntos acumulados sin evento de ingestión.');
    }

    await this.saveLocalPoint(user, total);
    const pendingEventIds = [
      ...(lastStatus.pendingIngestEventIds ?? []),
      ...(ingestEventId ? [ingestEventId] : []),
    ];
    await this.saveLastStatus(user, {
      updatedAt: new Date().toISOString(),
      lastCyclePoints: total,
      accumulatedPoints,
      accumulatedSections,
      pendingIngestEventIds: pendingEventIds,
      ingested: Boolean(ingestEventId),
      message: endpointId
        ? `+${total} pts acumulados. Evento registrado. Canjea para enviarlos a tu perfil.`
        : `+${total} pts acumulados. Canjea para enviarlos a tu perfil LSG.`,
    });
    console.log(`Lichess: +${total} pts acumulados (total pendiente: ${accumulatedPoints}).`, breakdown);
    return {
      points: total,
      delta,
      breakdown,
      sections: accumulatedSections,
      accumulatedPoints,
      ingested: Boolean(ingestEventId),
      ingestEventId,
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
      'Lichess'
    );
    await SensorPointRepository.createSensorPoint(point);
  }

  async getRecentPoints() {
    const points = await SensorPointRepository.getAllSensorPoints('Lichess');
    if (!points.length) return [];
    const last = points[points.length - 1].data_point;
    const prev = points.length >= 2 ? points[points.length - 2].data_point : 0;
    return [last, prev];
  }

  async manualPoll() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user?.lichess_username) {
      throw new Error('Lichess no vinculado.');
    }
    return this.pollProgress(user);
  }
}

export default SensorLichessService;
