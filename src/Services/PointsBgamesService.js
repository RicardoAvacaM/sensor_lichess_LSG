import UserRepository from '../Repositories/UserRepository.js';
import UserService from './UserService.js';
import LsgApiService from './LsgApiService.js';

const ATTRIBUTE_UI_MAP = {
  Social: 'social',
  Fisico: 'fisica',
  Físico: 'fisica',
  Afectivo: 'afectivo',
  Mental: 'mental',
  Cognitivo: 'mental',
  Linguistico: 'linguistico',
  Lingüístico: 'linguistico',
};

class PointsBgamesService {
  constructor() {
    this.userService = new UserService(new UserRepository());
    this.lsgApiService = new LsgApiService();
  }

  async savePointsBgames() {
    try {
      const users = await this.userService.getAllUsers();
      if (!users.length) return [];

      const user = users[0];
      const attributes = await this.lsgApiService.getAttributePoints(user);

      const pointsBgames = (Array.isArray(attributes) ? attributes : []).map((attr) => ({
        id_attributes: attr.id_attributes,
        name: attr.attribute_name,
        data: attr.balance_ledger ?? 0,
      }));

      return pointsBgames.map((p) => ({
        ...p,
        uiKey: ATTRIBUTE_UI_MAP[p.name] || p.name?.toLowerCase(),
      }));
    } catch (error) {
      console.error('Error al obtener puntos LSG:', error.response?.data || error.message);
      return [];
    }
  }
}

export default PointsBgamesService;
