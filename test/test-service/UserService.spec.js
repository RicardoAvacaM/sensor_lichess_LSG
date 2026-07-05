import { jest } from '@jest/globals';
import UserService from '../src/Services/UserService.js';
import UserRepository from '../src/Repositories/UserRepository.js';
import UserModel from '../src/Models/UserModel.js';
import axios from 'axios';

jest.mock('../src/Repositories/UserRepository.js'); // Mock del repositorio
jest.mock('axios'); // Mock de axios

describe('UserService - Pruebas Unitarias', () => {
  let userService;
  let mockAxios;

  beforeEach(() => {
    mockAxios = {
      get: jest.fn()
    };
    axios.create = jest.fn(() => mockAxios);

    userService = new UserService(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /*** Prueba 1: Usuario encontrado y guardado correctamente ***/
  test('Debe crear un usuario cuando la API devuelve datos válidos', async () => {
    const mockUserData = {
      id_players: 1,
      name: 'Juan Pérez',
      email: 'juan@example.com',
      password: 'secure123',
      key_steam: '12345',
      id_user_steam: '67890',
      id_reddit: 'abcde'
    };

    // Simular que la API responde con el usuario
    mockAxios.get.mockResolvedValue({ status: 200, data: mockUserData });

    // Simular que UserRepository.createUser() se ejecuta correctamente
    UserRepository.createUser = jest.fn().mockResolvedValue();

    const result = await userService.createUser('juan@example.com', 'secure123');

    expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:3010/player_by_email/juan@example.com');
    expect(UserRepository.createUser).toHaveBeenCalledWith(expect.any(UserModel));
    expect(result).toBe(1);
  });

  /*** Prueba 2: Usuario no encontrado en la API ***/
  test('Debe devolver 0 cuando la API responde con un usuario inexistente', async () => {
    mockAxios.get.mockResolvedValue({ status: 200, data: null });

    const result = await userService.createUser('noexiste@example.com', 'password');

    expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:3010/player_by_email/noexiste@example.com');
    expect(UserRepository.createUser).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  /*** Prueba 3: Contraseña incorrecta ***/
  test('Debe devolver 0 si la contraseña no coincide', async () => {
    mockAxios.get.mockResolvedValue({ status: 200, data: { email: 'juan@example.com', password: 'otraClave' } });

    const result = await userService.createUser('juan@example.com', 'secure123');

    expect(result).toBe(0);
  });

  /*** Prueba 4: Error en la API ***/
  test('Debe devolver 0 si la API falla', async () => {
    mockAxios.get.mockRejectedValue(new Error('Error en la API'));

    const result = await userService.createUser('juan@example.com', 'secure123');

    expect(result).toBe(0);
  });

  /*** Prueba 5: Obtener todos los usuarios correctamente ***/
  test('Debe obtener todos los usuarios del repositorio', async () => {
    const mockUsers = [
      { id: 1, name: 'Juan' },
      { id: 2, name: 'María' }
    ];

    UserRepository.getUsers = jest.fn().mockResolvedValue(mockUsers);

    const result = await userService.getAllUsers();

    expect(UserRepository.getUsers).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockUsers);
  });

  /*** Prueba 6: Error al obtener usuarios ***/
  test('Debe lanzar un error cuando getUsers falla', async () => {
    UserRepository.getUsers = jest.fn().mockRejectedValue(new Error('DB Error'));

    await expect(userService.getAllUsers()).rejects.toThrow('No se pudieron obtener los usuarios.');
  });
});
