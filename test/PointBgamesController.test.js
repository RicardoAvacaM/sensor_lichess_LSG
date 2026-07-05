import { expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import sqlite3 from 'sqlite3';
import PointsBgamesController from '../src/Controllers/PointsBgamesController.js';
import PointsBgamesService from '../src/Services/PointsBgamesService.js';
import UserService from '../src/Services/UserService.js';
import UserRepository from '../src/Repositories/UserRepository.js';
import UserController from '../src/Controllers/UserController.js';
import PointsBgamesModel from '../src/Models/PointsBgamesModel.js';
import axios from 'axios';

describe('PointBgamesController - Pruebas de Integración', () => {
  let app, pointsBgamesController, pointsBgamesService, userService, userRepository, userController, db;

  beforeAll((done) => {
    // Crea la base de datos en memoria para usarla en `UserRepository`
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('Error al abrir la base de datos en memoria:', err.message);
      } else {
        console.log('Base de datos en memoria creada correctamente.');
      }
      done();
    });

    db.serialize(() => {
      db.run(`
        CREATE TABLE users (
          id_players TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          key_steam TEXT,
          id_user_steam TEXT,
          id_reddit TEXT,
          id_player_stack TEXT,
          name_stack TEXT
        )
      `);
    });
  });
  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Se envia la BD en memoria al `UserRepository`
    userRepository = new UserRepository(db);
    userService = new UserService(userRepository);
    pointsBgamesService = new PointsBgamesService();
    pointsBgamesController = new PointsBgamesController(pointsBgamesService);
    userController = new UserController(userService);

    /*
    // Insertar un usuario de prueba antes de cada test
    new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id_players, name, email, password) VALUES (?, ?, ?, ?)`,
        ['0', 'PENE', 'test@test.cl', 'asd123'],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    */
    app.get('/users/points', (req, res) => pointsBgamesController.savePointsBgames(req, res));
    app.post('/users/create', (req, res) => userController.createUser(req, res));
    
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    try {
        await UserRepository.deleteAllUsers(); // ✅ Borra todos los usuarios antes de cerrar la DB
        await new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    console.error('❌ Error al cerrar la base de datos:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Base de datos cerrada correctamente.');
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error('❌ Error al limpiar la base de datos:', error.message);
    }
});


    /*** Prueba integral al controller 'createUser' ***/
    /*** Prueba 1: Crear usuario llamando a la API real ***/
    test('Debe crear un usuario llamando a la API real y guardarlo en la base de datos', async () => {
      const response = await request(app)
        .post('/users/create')
        .send({ email: 'test@test.cl', password: 'asd123' });
  
      expect(response.status).toBe(201);});
  
  
  /*** Prueba integral al controller 'savePointsBgames' ***/
  /*** Prueba 1: Guardar puntos bGames de la cuenta en el objeto 'PointsBgamesModel'  ***/
  test('debería guardar puntos bGames de la cuenta en el objeto PointsBgamesModel', async () => {
    const response = await request(app)
    .get('/users/points');

    expect(response.status).toBe(200);
    
  });
});

