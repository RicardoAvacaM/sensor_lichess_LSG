import { jest } from '@jest/globals';
import SensorPointService from '../src/Services/SensorPointService.js';
import SensorPointRepository from '../src/Repositories/SensorPointRepository.js';
import UserService from '../src/Services/UserService.js';
import UserRepository from '../src/Repositories/UserRepository.js';
import SensorPointModel from '../src/Models/SensorPointModel.js';
import axios from 'axios';

jest.mock('../src/Repositories/SensorPointRepository.js'); // Mock del repositorio de puntos
jest.mock('../src/Services/UserService.js'); // Mock del servicio de usuario
jest.mock('axios'); // Mock de axios

describe('SensorPointService - Pruebas Unitarias', () => {
  let sensorPointService;
  let mockAxios;

  beforeEach(() => {
    mockAxios = { get: jest.fn() };
    axios.create = jest.fn(() => mockAxios);

    sensorPointService = new SensorPointService(SensorPointRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /*** Prueba 1: Crear el punto por primera vez ***/
  test('Debe crear el primer punto de sensor cuando si no hay puntos previos', async () => {
    jest.spyOn(sensorPointService, 'getHoursPlayed').mockResolvedValue(1000);

    UserService.prototype.getAllUsers = jest.fn().mockResolvedValue([{ id_players: 1 }]);
    SensorPointRepository.getAllSensorPoints = jest.fn().mockResolvedValue([]); // No hay puntos previos
    SensorPointRepository.createSensorPoint = jest.fn().mockResolvedValue();

    await sensorPointService.saveSensorPoint();

    await expect(SensorPointRepository.createSensorPoint).toHaveBeenCalledTimes(1);
  });

  /*** 🔹 Prueba 2: Crear un nuevo punto al día siguiente ***/
  test('Debe crear un nuevo punto de sensor si el último punto es de un día anterior', async () => {
    jest.spyOn(sensorPointService, 'getHoursPlayed').mockResolvedValue(1001);

    UserService.prototype.getAllUsers = jest.fn().mockResolvedValue([{ id_players: 1 }]);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1); // Fecha de ayer
    yesterday.setHours(0, 0, 0, 0);

    SensorPointRepository.getAllSensorPoints = jest.fn().mockResolvedValue([
      { date_time: yesterday.toISOString(), hours_played: 10 }
    ]);

    SensorPointRepository.createSensorPoint = jest.fn().mockResolvedValue();

    await sensorPointService.saveSensorPoint();

    expect(SensorPointRepository.createSensorPoint).toHaveBeenCalledTimes(1);
  });

  /*** Prueba 3: No crear un nuevo punto si ya existe uno hoy ***/
  test('No debe crear un nuevo punto si ya existe uno con la misma fecha', async () => {
    jest.spyOn(sensorPointService, 'getHoursPlayed').mockResolvedValue(12);

    UserService.prototype.getAllUsers = jest.fn().mockResolvedValue([{ id_players: 1 }]);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Fecha de hoy sin hora

    SensorPointRepository.getAllSensorPoints = jest.fn().mockResolvedValue([
      { date_time: today.toISOString(), hours_played: 10 }
    ]);

    SensorPointRepository.createSensorPoint = jest.fn().mockResolvedValue();

    await sensorPointService.saveSensorPoint();

    expect(SensorPointRepository.createSensorPoint).not.toHaveBeenCalled();
  });

  /*** 🔹 Prueba 4: Calcular puntos para menos de 60 minutos ***/
  test('Debe calcular correctamente los puntos para menos de 60 minutos de juego', () => {
    const puntos = sensorPointService.calcularPuntos(30); // 30 minutos
    expect(puntos).toBe(10 + (30 / 60) * 140); // Fórmula aplicada
    console.log("--- 30 minutos puntos ", puntos);
  });

  /*** 🔹 Prueba 5: Calcular puntos para entre 61 y 120 minutos ***/
  test('Debe calcular correctamente los puntos para entre 61 y 120 minutos de juego', () => {
    const puntos = sensorPointService.calcularPuntos(90); // 90 minutos (1.5 horas)
    expect(puntos).toBe(150 - ((1.5 - 1) * 100)); // Fórmula aplicada
    console.log("--- 90 minutos puntos ", puntos);
  });

  /*** 🔹 Prueba 6: Calcular puntos para más de 120 minutos ***/
  test('Debe asignar 10 puntos cuando se juegan más de 120 minutos', () => {
    const puntos = sensorPointService.calcularPuntos(150); // 150 minutos
    expect(puntos).toBe(10);
  });

  /*** 🔹 Prueba 7: Obtener los puntos del sensor cuando hay más de dos registros ***/
  test('Debe devolver los últimos dos puntos si hay más de dos registros', async () => {
    SensorPointRepository.getAllSensorPoints.mockResolvedValue([
      { data_point: 5 },
      { data_point: 10 },
      { data_point: 15 } // Último punto
    ]);

    const result = await sensorPointService.getAllSensorPoints('Steam');

    expect(result).toEqual([15, 10]); // Debe devolver los últimos dos puntos
  });

});
