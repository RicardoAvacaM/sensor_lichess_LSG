import axios from 'axios';
import { LSG_CORE_URL, LSG_SENSOR_ENDPOINT_ID, LSG_MENTAL_ATTRIBUTE_ID } from '../config/api.js';
import LsgAuthService from './LsgAuthService.js';
import UserRepository from '../Repositories/UserRepository.js';

class LsgApiService {
  constructor() {
    this.httpClient = axios.create();
    this.lsgAuthService = new LsgAuthService();
  }

  async authHeaders(user) {
    const token = await this.lsgAuthService.getValidToken(user);
    if (token !== user.lsg_access_token) {
      user.lsg_access_token = token;
      user.lsg_token_expires_at = new Date(Date.now() + 7200 * 1000).toISOString();
      await UserRepository.updateUser(user);
    }
    return { Authorization: `Bearer ${token}` };
  }

  async getAttributePoints(user) {
    const headers = await this.authHeaders(user);
    const response = await this.httpClient.get(
      `${LSG_CORE_URL}/players/${user.id_players}/attributes/points`,
      { headers }
    );
    return response.data;
  }

  async ingestSensorEvent(user, payload) {
    const headers = await this.authHeaders(user);
    const response = await this.httpClient.post(
      `${LSG_CORE_URL}/sensors/ingest/webhook`,
      payload,
      { headers }
    );
    return response.data;
  }

  async listSensors(user) {
    const headers = await this.authHeaders(user);
    const response = await this.httpClient.get(`${LSG_CORE_URL}/sensors`, { headers });
    return response.data;
  }

  async listSensorEndpoints(user, sensorId) {
    const headers = await this.authHeaders(user);
    const response = await this.httpClient.get(
      `${LSG_CORE_URL}/sensors/${sensorId}/endpoints`,
      { headers }
    );
    return response.data;
  }

  async linkSensorToPlayer(user, sensorId) {
    const headers = await this.authHeaders(user);
    const response = await this.httpClient.post(
      `${LSG_CORE_URL}/sensors/players/${user.id_players}/link`,
      { sensor_id: sensorId },
      { headers }
    );
    return response.data;
  }

  async linkEndpointToPlayer(user, sensorEndpointId) {
    const headers = await this.authHeaders(user);
    const response = await this.httpClient.post(
      `${LSG_CORE_URL}/sensors/players/${user.id_players}/link-endpoint`,
      { sensor_endpoint_id: sensorEndpointId },
      { headers }
    );
    return response.data;
  }

  async resolveSensorEndpointId(user) {
    if (user.lsg_sensor_endpoint_id) {
      return user.lsg_sensor_endpoint_id;
    }
    if (LSG_SENSOR_ENDPOINT_ID) {
      return LSG_SENSOR_ENDPOINT_ID;
    }

    try {
      const sensors = await this.listSensors(user);
      const list = Array.isArray(sensors) ? sensors : sensors?.items || [];
      const lichessSensor = list.find((s) =>
        (s.name || '').toLowerCase().includes('lichess')
      );
      if (!lichessSensor) return null;

      const sensorId = lichessSensor.id_online_sensor ?? lichessSensor.id;
      try {
        await this.linkSensorToPlayer(user, sensorId);
      } catch {
        // Ya vinculado o sin permisos
      }

      const endpoints = await this.listSensorEndpoints(user, sensorId);
      const epList = Array.isArray(endpoints) ? endpoints : endpoints?.items || [];
      const endpoint = epList.find((e) =>
        (e.name || '').toLowerCase().includes('lichess')
      ) || epList[0];

      if (endpoint?.id_sensor_endpoint) {
        try {
          const linked = await this.linkEndpointToPlayer(user, endpoint.id_sensor_endpoint);
          user.lsg_players_sensor_endpoint_id =
            linked?.id_players_sensor_endpoint ?? user.lsg_players_sensor_endpoint_id;
        } catch {
          // Sin permisos de link-endpoint
        }
        user.lsg_sensor_endpoint_id = endpoint.id_sensor_endpoint;
        await UserRepository.updateUser(user);
        return endpoint.id_sensor_endpoint;
      }
    } catch (error) {
      console.error('No se pudo resolver sensor endpoint LSG:', error.message);
    }
    return null;
  }

  async getMentalBalance(user) {
    const attributes = await this.getAttributePoints(user);
    const list = Array.isArray(attributes) ? attributes : [];
    const mental = list.find((a) =>
      ['Mental', 'Cognitivo'].includes(a.attribute_name)
    );
    return mental?.balance_ledger ?? 0;
  }

  async adjustPlayerPoints(user, amount, reason) {
    const headers = await this.authHeaders(user);
    const parsedAmount = Math.max(1, Math.round(Number(amount)));
    const response = await this.httpClient.post(
      `${LSG_CORE_URL}/players/${user.id_players}/points/adjust`,
      {
        attribute_id: LSG_MENTAL_ATTRIBUTE_ID,
        direction: 'CREDIT',
        amount: parsedAmount,
        reason: reason || 'Sensor Lichess',
      },
      { headers }
    );
    return response.data;
  }

  static formatApiError(error) {
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg || JSON.stringify(item)).join('; ');
    }
    if (typeof detail === 'string') {
      return detail;
    }
    return error.response?.data?.error || error.message;
  }
}

export default LsgApiService;
