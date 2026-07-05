import UserService from '../Services/UserService.js';
import UserRepository from '../Repositories/UserRepository.js';

class UserController {
  constructor() {
    this.userService = new UserService(new UserRepository());
  }

  async createUser(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'El email y la contraseña son obligatorios.' });
    }

    try {
      const created = await this.userService.createUser(email, password);
      if (created) {
        return res.status(201).json({ message: 'Usuario creado exitosamente.' });
      }
      return res.status(400).json({ error: 'Credenciales LSG inválidas.' });
    } catch (error) {
      console.error('Error al crear usuario:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'El email y la contraseña son obligatorios.' });
    }

    try {
      const user = await this.userService.loginUser(email, password);
      if (user) {
        return res.status(200).json({
          message: 'Sesión iniciada.',
          user: { id_players: user.id_players, name: user.name, email: user.email },
        });
      }
      return res.status(401).json({ error: 'Credenciales LSG inválidas.' });
    } catch (error) {
      console.error('Error al iniciar sesión:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await this.userService.getAllUsers();
      if (users.length) {
        const safe = users.map(({ password, lichess_access_token, lsg_access_token, ...rest }) => rest);
        return res.status(201).json(safe);
      }
      return res.status(404).json({ error: 'No se encontraron usuarios.' });
    } catch (error) {
      console.error('Error al obtener usuarios:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  async userCheckDB(req, res) {
    try {
      const users = await this.userService.getAllUsers();
      if (users.length > 0) {
        return res.status(200).json({ message: 'Ya existe un usuario.' });
      }
      return res.status(404).json({ error: 'No existen usuarios.' });
    } catch (error) {
      console.error('Error al verificar usuarios:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
}

export default UserController;
