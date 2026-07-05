import UserModel from '../Models/UserModel.js';
import UserRepository from '../Repositories/UserRepository.js';
import LsgAuthService from './LsgAuthService.js';

class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
    this.lsgAuthService = new LsgAuthService();
  }

  async createUser(email, password) {
    const user = await this.loginUser(email, password);
    return user ? 1 : 0;
  }

  async loginUser(email, password) {
    try {
      const authData = await this.lsgAuthService.login(email, password);
      const player = authData.player;

      if (!player?.id_players) {
        return null;
      }

      const expiresAt = authData.expires_at
        || new Date(Date.now() + (authData.expires_in_seconds || 7200) * 1000).toISOString();

      const playerId = String(player.id_players);
      const existing = await UserRepository.findUserById(playerId);

      if (existing) {
        existing.name = player.name;
        existing.email = player.email || email;
        existing.password = password;
        existing.lsg_access_token = authData.access_token;
        existing.lsg_token_expires_at = expiresAt;
        await UserRepository.updateUser(existing);
        console.log('Sesión LSG actualizada:', existing.name);
        return existing;
      }

      const user = new UserModel(
        playerId,
        player.name,
        player.email || email,
        password,
        authData.access_token,
        expiresAt
      );

      await UserRepository.createUser(user);
      console.log('Usuario LSG guardado localmente:', user.name);
      return user;
    } catch (error) {
      console.error('Error al autenticar con LSG:', error.response?.data || error.message);
      return null;
    }
  }

  async getAllUsers() {
    try {
      return await UserRepository.getUsers();
    } catch (error) {
      console.error('Error al obtener usuarios:', error.message);
      throw new Error('No se pudieron obtener los usuarios.');
    }
  }
}

export default UserService;
