import axios from 'axios';
import { LSG_AUTH_URL } from '../config/api.js';

class LsgAuthService {
  constructor() {
    this.httpClient = axios.create();
  }

  async login(email, password) {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const response = await this.httpClient.post(`${LSG_AUTH_URL}/login`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data;
  }

  async refreshToken(accessToken) {
    const response = await this.httpClient.post(
      `${LSG_AUTH_URL}/token/refresh`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  }

  async getValidToken(user) {
    if (!user.lsg_access_token) {
      throw new Error('No hay token LSG. Inicia sesión de nuevo.');
    }

    const expiresAt = user.lsg_token_expires_at
      ? new Date(user.lsg_token_expires_at).getTime()
      : 0;
    const now = Date.now();

    if (expiresAt - now > 5 * 60 * 1000) {
      return user.lsg_access_token;
    }

    const refreshed = await this.refreshToken(user.lsg_access_token);
    return refreshed.access_token || user.lsg_access_token;
  }
}

export default LsgAuthService;
