import axios from 'axios';
import crypto from 'crypto';
import {
  HTB_ACADEMY_API_URL,
  HTB_POLL_INTERVAL_MS,
  HTB_SCORING,
} from '../config/api.js';
import UserRepository from '../Repositories/UserRepository.js';
import SensorPointRepository from '../Repositories/SensorPointRepository.js';
import SensorPointModel from '../Models/SensorPointModel.js';
import LsgApiService from './LsgApiService.js';

function nestedTitle(value, key) {
  if (value && typeof value === 'object') {
    return String(value[key] ?? '');
  }
  return value != null ? String(value) : '';
}

function normalizeModule(raw) {
  const progress = Number(raw.progress ?? 0);
  const completed = Boolean(raw.completed) || progress >= 100;
  return {
    id: String(raw.id),
    name: raw.name || `Módulo ${raw.id}`,
    progress: completed ? 100 : Math.min(100, Math.max(0, progress)),
    completed,
    difficulty: nestedTitle(raw.difficulty, 'title') || nestedTitle(raw.difficulty, 'text'),
    tier: nestedTitle(raw.tier, 'name'),
    state: raw.state || (completed ? 'completed' : progress > 0 ? 'in_progress' : 'locked'),
    sectionsCount: raw.sections_count ?? raw.sectionsCount ?? null,
  };
}

function readCookieValue(cookieHeader, name) {
  const match = String(cookieHeader).match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

class SensorHtbAcademyService {
  constructor() {
    this.httpClient = axios.create();
    this.lsgApiService = new LsgApiService();
    this.pollTimer = null;
    this.isPolling = false;
    this.startPollingLoop();
  }

  startPollingLoop() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollAllUsers(), HTB_POLL_INTERVAL_MS);
    setTimeout(() => this.pollAllUsers(), 8000);
  }

  academyHeaders(sessionOrCookies) {
    const cookie = String(sessionOrCookies).includes('htb_academy_session=')
      ? String(sessionOrCookies)
      : `htb_academy_session=${sessionOrCookies}`;
    const headers = {
      Cookie: cookie,
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://academy.hackthebox.com/app/dashboard',
      Origin: 'https://academy.hackthebox.com',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    const xsrf = readCookieValue(cookie, 'XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    return headers;
  }

  parseModulesResponse(body) {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body?.modules)) return body.modules;
    if (typeof body === 'string' && body.includes('<html')) {
      throw new Error('Sesión HTB inválida. Inicia sesión de nuevo en Academy.');
    }
    return null;
  }

  async fetchModules(session, { onlyWithProgress = true } = {}) {
    let response;
    try {
      response = await this.httpClient.get(`${HTB_ACADEMY_API_URL}/modules`, {
        headers: this.academyHeaders(session),
        validateStatus: (status) => status < 500,
      });
    } catch (error) {
      throw new Error(
        error.response?.data?.message || error.message || 'No se pudo contactar HTB Academy.'
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('Sesión HTB inválida o expirada. Inicia sesión de nuevo.');
    }

    if (response.status >= 400) {
      const detail =
        response.data?.message || response.data?.error || JSON.stringify(response.data);
      throw new Error(`HTB Academy respondió ${response.status}: ${detail}`);
    }

    const list = this.parseModulesResponse(response.data);
    if (!list) {
      throw new Error('Sesión inválida o respuesta inesperada de HTB Academy.');
    }

    const normalized = list.map(normalizeModule);
    return onlyWithProgress
      ? normalized.filter((m) => m.progress > 0 || m.completed)
      : normalized;
  }

  async validateAndLinkSession(session) {
    const allModules = await this.fetchModules(session, { onlyWithProgress: false });
    const modules = allModules.filter((m) => m.progress > 0 || m.completed);
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user) {
      throw new Error('No hay usuario LSG registrado. Inicia sesión en LSG primero.');
    }

    user.htb_academy_session = session;
    user.htb_progress_snapshot = JSON.stringify(this.buildSnapshotFromModules(modules));
    user.htb_last_sync_at = String(Date.now());
    await UserRepository.updateUser(user);

    const inProgress = modules.filter((m) => !m.completed && m.progress > 0).length;
    const completed = modules.filter((m) => m.completed).length;

    return {
      linked: true,
      modulesTracked: modules.length,
      inProgress,
      completed,
    };
  }

  async checkHtbLinked() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    return Boolean(user?.htb_academy_session);
  }

  buildSnapshotFromModules(modules) {
    const modulesMap = {};
    for (const mod of modules) {
      modulesMap[mod.id] = {
        progress: mod.progress,
        completed: mod.completed,
        name: mod.name,
      };
    }
    return { modules: modulesMap };
  }

  parseSnapshot(user) {
    try {
      return JSON.parse(user.htb_progress_snapshot || '{"modules":{}}');
    } catch {
      return { modules: {} };
    }
  }

  parseLastStatus(user) {
    try {
      return JSON.parse(user.htb_last_status || '{}');
    } catch {
      return {};
    }
  }

  async saveLastStatus(user, status) {
    user.htb_last_status = JSON.stringify(status);
    await UserRepository.updateUser(user);
  }

  computeDelta(prevSnapshot, currentModules) {
    const prev = prevSnapshot.modules || {};
    const breakdown = {
      progressGain: 0,
      modulesCompleted: 0,
    };
    const moduleDeltas = [];
    const pointsPerPercent = HTB_SCORING.progressPercent.pointsPerUnit;
    const completedBonus = HTB_SCORING.moduleCompleted.pointsPerUnit;

    for (const mod of currentModules) {
      const prevMod = prev[mod.id] || { progress: 0, completed: false, name: mod.name };
      const prevProgress = Number(prevMod.progress ?? 0);
      const prevCompleted = Boolean(prevMod.completed);

      let progressGain = 0;
      let completedNow = false;

      if (!prevCompleted && mod.completed) {
        progressGain = Math.max(0, 100 - prevProgress);
        completedNow = true;
        breakdown.modulesCompleted += 1;
      } else if (mod.progress > prevProgress) {
        progressGain = mod.progress - prevProgress;
      }

      if (progressGain <= 0 && !completedNow) continue;

      const progressPoints = Math.round(progressGain * pointsPerPercent);
      const bonusPoints = completedNow ? completedBonus : 0;
      const points = progressPoints + bonusPoints;

      breakdown.progressGain += progressGain;

      moduleDeltas.push({
        id: mod.id,
        name: mod.name,
        difficulty: mod.difficulty,
        tier: mod.tier,
        progressFrom: prevProgress,
        progressTo: mod.progress,
        progressGain,
        completed: mod.completed,
        completedNow,
        points,
        progressPoints,
        bonusPoints,
      });
    }

    const total = moduleDeltas.reduce((sum, d) => sum + d.points, 0);
    return { total, breakdown, moduleDeltas };
  }

  buildSections(moduleDeltas, accumulatedSections = []) {
    const byId = {};
    for (const section of accumulatedSections) {
      byId[section.id] = { ...section };
    }

    for (const delta of moduleDeltas) {
      const key = `module-${delta.id}`;
      const prev = byId[key] || {
        id: key,
        moduleId: delta.id,
        label: delta.name,
        count: 0,
        points: 0,
        pointsPerUnit: HTB_SCORING.progressPercent.pointsPerUnit,
      };
      byId[key] = {
        ...prev,
        label: delta.name,
        count: (prev.count ?? 0) + Math.round(delta.progressGain * 10) / 10,
        points: (prev.points ?? 0) + delta.points,
        lastProgress: delta.progressTo,
        completed: delta.completed,
        difficulty: delta.difficulty,
        tier: delta.tier,
      };
    }

    return Object.values(byId).sort((a, b) => a.label.localeCompare(b.label));
  }

  buildScoringRules() {
    return Object.entries(HTB_SCORING).map(([id, rule]) => ({
      id,
      label: rule.label,
      pointsPerUnit: rule.pointsPerUnit,
    }));
  }

  buildEmptySections() {
    return [];
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

  async pollAllUsers() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const users = await UserRepository.getUsers();
      const user = users[0];
      if (!user?.htb_academy_session) return;
      await this.pollProgress(user);
    } catch (error) {
      console.error('HTB poll error:', error.message);
    } finally {
      this.isPolling = false;
    }
  }

  async pollProgress(user) {
    let currentModules;
    try {
      currentModules = await this.fetchModules(user.htb_academy_session);
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        await this.saveLastStatus(user, {
          ...this.parseLastStatus(user),
          message: 'Sesión HTB Academy expirada. Vuelve a iniciar sesión.',
        });
        throw new Error('Sesión HTB Academy expirada. Vuelve a iniciar sesión.');
      }
      throw error;
    }

    const prevSnapshot = this.parseSnapshot(user);
    const { total, breakdown, moduleDeltas } = this.computeDelta(prevSnapshot, currentModules);
    const lastStatus = this.parseLastStatus(user);
    const prevAccumulated = lastStatus.accumulatedSections ?? [];

    const newSnapshot = this.buildSnapshotFromModules(currentModules);
    user.htb_progress_snapshot = JSON.stringify(newSnapshot);
    user.htb_last_sync_at = String(Date.now());

    if (total <= 0) {
      await UserRepository.updateUser(user);
      await this.saveLastStatus(user, {
        ...lastStatus,
        updatedAt: new Date().toISOString(),
        lastCyclePoints: 0,
        accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
        accumulatedSections: prevAccumulated,
        modulesInProgress: currentModules.filter((m) => !m.completed).length,
        message: 'Sin avance nuevo en módulos Academy.',
      });
      return {
        points: 0,
        moduleDeltas: [],
        sections: prevAccumulated,
        accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
        modules: currentModules,
      };
    }

    const accumulatedSections = this.buildSections(moduleDeltas, prevAccumulated);
    const accumulatedPoints = (lastStatus.accumulatedPoints ?? 0) + total;

    let ingestEventId = null;
    const endpointId = await this.lsgApiService.resolveHtbSensorEndpointId(user);

    if (endpointId) {
      const payload = {
        player_id: parseInt(user.id_players, 10),
        sensor_endpoint_id: parseInt(endpointId, 10),
        players_sensor_endpoint_id: user.htb_lsg_players_sensor_endpoint_id
          ? parseInt(user.htb_lsg_players_sensor_endpoint_id, 10)
          : null,
        parsed_value: total,
        status: 'OK',
        occurred_at: new Date().toISOString(),
        raw_payload: {
          platform: 'HTB Academy',
          trigger: 'module_progress_poll',
          moduleDeltas,
          breakdown,
          client_ref: crypto.randomUUID(),
        },
      };

      try {
        const ingestResult = await this.lsgApiService.ingestSensorEvent(user, payload);
        ingestEventId = ingestResult?.id_sensor_ingest_event ?? null;
      } catch (error) {
        console.error('HTB ingest error:', error.response?.data || error.message);
        await UserRepository.updateUser(user);
        await this.saveLastStatus(user, {
          updatedAt: new Date().toISOString(),
          lastCyclePoints: total,
          accumulatedPoints,
          accumulatedSections,
          ingested: false,
          modulesInProgress: currentModules.filter((m) => !m.completed).length,
          message: 'Puntos acumulados; no se pudo registrar el evento en LSG.',
        });
        return {
          points: total,
          moduleDeltas,
          sections: accumulatedSections,
          accumulatedPoints,
          ingested: false,
          modules: currentModules,
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
      modulesInProgress: currentModules.filter((m) => !m.completed).length,
      message: `+${total} pts acumulados por avance en Academy. Canjea para enviarlos a tu perfil.`,
    });

    console.log(`HTB Academy: +${total} pts acumulados (total pendiente: ${accumulatedPoints}).`);
    return {
      points: total,
      moduleDeltas,
      sections: accumulatedSections,
      accumulatedPoints,
      ingested: Boolean(ingestEventId),
      modules: currentModules,
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
      'HTB Academy'
    );
    await SensorPointRepository.createSensorPoint(point);
  }

  async getSensorStatus() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    if (!user?.htb_academy_session) {
      throw new Error('HTB Academy no vinculado.');
    }

    let mentalBalance = 0;
    try {
      mentalBalance = await this.lsgApiService.getMentalBalance(user);
    } catch (error) {
      console.error('No se pudo obtener saldo Mental LSG:', error.message);
    }

    const lastStatus = this.parseLastStatus(user);
    const snapshot = this.parseSnapshot(user);
    const lastSyncAt = user.htb_last_sync_at
      ? new Date(parseInt(user.htb_last_sync_at, 10)).toISOString()
      : null;

    let liveModules = [];
    try {
      liveModules = await this.fetchModules(user.htb_academy_session);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          linked: true,
          sessionExpired: true,
          mentalBalance,
          lastSyncAt,
          syncIntervalMs: HTB_POLL_INTERVAL_MS,
          lastCyclePoints: lastStatus.lastCyclePoints ?? 0,
          accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
          sections: lastStatus.accumulatedSections ?? [],
          modules: Object.entries(snapshot.modules || {}).map(([id, m]) => ({
            id,
            name: m.name,
            progress: m.progress,
            completed: m.completed,
          })),
          scoringRules: this.buildScoringRules(),
          message: 'Sesión HTB Academy expirada. Vuelve a iniciar sesión.',
        };
      }
    }

    const accumulatedSections = lastStatus.accumulatedSections ?? [];

    return {
      linked: true,
      sessionExpired: false,
      mentalBalance,
      lastSyncAt,
      syncIntervalMs: HTB_POLL_INTERVAL_MS,
      lastCyclePoints: lastStatus.lastCyclePoints ?? 0,
      accumulatedPoints: lastStatus.accumulatedPoints ?? 0,
      sections: accumulatedSections.length
        ? accumulatedSections
        : liveModules.map((m) => ({
            id: `module-${m.id}`,
            moduleId: m.id,
            label: m.name,
            count: m.progress,
            points: 0,
            pointsPerUnit: HTB_SCORING.progressPercent.pointsPerUnit,
            lastProgress: m.progress,
            completed: m.completed,
            difficulty: m.difficulty,
            tier: m.tier,
          })),
      modules: liveModules,
      modulesInProgress: liveModules.filter((m) => !m.completed && m.progress > 0).length,
      modulesCompleted: liveModules.filter((m) => m.completed).length,
      ingested: lastStatus.ingested ?? false,
      scoringRules: this.buildScoringRules(),
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

    const reason = `Sensor HTB Academy - ${amount} pts`;
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
    if (!user?.htb_academy_session) {
      throw new Error('HTB Academy no vinculado.');
    }
    return this.pollProgress(user);
  }
}

export default SensorHtbAcademyService;
