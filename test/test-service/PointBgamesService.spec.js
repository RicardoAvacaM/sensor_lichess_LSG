import { jest } from '@jest/globals';
import PointsBgamesService from '../src/Services/PointsBgamesService.js';
import UserService from '../src/Services/UserService.js';
import axios from 'axios';

jest.mock('../src/Services/UserService.js'); // Mock de UserService
jest.mock('axios'); // Mock de axios

describe('PointsBgamesService - Pruebas Unitarias', () => {
  let pointsBgamesService;
  let mockAxios;

  beforeEach(() => {
    // Simular una instancia de axios con `create()`
    mockAxios = {
      get: jest.fn() // Mock de la función GET de axios
    };

    // Sobrescribir directamente `axios.create`
    axios.create = jest.fn(() => mockAxios);

    pointsBgamesService = new PointsBgamesService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Debe obtener los puntos correctamente cuando la API responde con estado 200', async () => {
    UserService.prototype.getAllUsers = jest.fn().mockResolvedValue([{ id_players: 123 }]);

    mockAxios.get.mockResolvedValue({
      status: 200,
      data: [
        { id_attributes: 1, name: 'Fuerza', data: 50 },
        { id_attributes: 2, name: 'Velocidad', data: 80 },
      ]
    });

    const result = await pointsBgamesService.savePointsBgames();

    expect(UserService.prototype.getAllUsers).toHaveBeenCalledTimes(1);
    expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:3001/player_all_attributes/123');
    expect(result).toEqual([
      { id_attributes: 1, name: 'Fuerza', data: 50 },
      { id_attributes: 2, name: 'Velocidad', data: 80 }
    ]);
  });
});

