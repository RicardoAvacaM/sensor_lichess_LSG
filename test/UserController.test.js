import { expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import sqlite3 from 'sqlite3';
import UserController from '../src/Controllers/UserController.js';
import UserService from '../src/Services/UserService.js';
import UserRepository from '../src/Repositories/UserRepository.js';
import axios from 'axios';

describe('UserController - Pruebas de Integración', () => {
  let app, userController, userService, userRepository, db;

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
    userController = new UserController(userService);

    app.post('/users/create', (req, res) => userController.createUser(req, res));
    app.get('/users/all', (req, res) => userController.getAllUsers(req, res));
    app.get('/users/check', (req, res) => userController.userCheckDB(req, res));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    try {
        await UserRepository.deleteAllUsers(); // Borra todos los usuarios antes de cerrar la DB
        await new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    console.error('Error al cerrar la base de datos:', err.message);
                    reject(err);
                } else {
                    console.log('Base de datos cerrada correctamente.');
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error('Error al limpiar la base de datos:', error.message);
    }
});

  /*** Prueba integral al controller 'userCheckDB' ****/
  /*** Prueba 1: Verificar no existe un usuario en la base de datos ***/
  test('Debe devolver un status 404 si no existen usuarios en la base de datos', async () => {
    const response = await request(app).get('/users/check').send({});

    expect(response.status).toBe(404);
  });

  /*** Prueba integral al controller 'createUser' ***/
  /*** Prueba 2: Crear usuario llamando a la API ***/
  test('Debe crear un usuario llamando a la API y guardarlo en la base de datos', async () => {
    const response = await request(app)
      .post('/users/create')
      .send({ email: 'test@test.cl', password: 'asd123' });

    expect(response.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Verifica que el usuario se haya guardado en la base de datos
    const userInDb = await UserRepository.findUserById(0);

    console.log("Usuario encontrado en BD (en test):", userInDb);
    expect(userInDb).not.toBeUndefined();
    expect(userInDb.email).toBe('test@test.cl');
  }); // Timeout de 15 segundos

  /*** Prueba integral al controller 'userCheckDB' ****/
  /*** Prueba 3: Verificar si existe un usuario en la base de datos ***/
  test('Debe devolver un status 200 si existe un usuario en la base de datos', async () => {
    const response = await request(app).get('/users/check').send({});

    expect(response.status).toBe(200);
  });

  /*** Prueba integral al controller 'createUser' ***/
  /*** Prueba 4: No debe crear un usario si faltan datos ***/
  test('Debe devolver error 400 si no se envían datos', async () => {
    const response = await request(app).post('/users/create').send({});

    expect(response.status).toBe(400);
  });

  /*** Prueba integral al controller 'createUser' ***/
  /*** Prueba 5: No debe crear un usario si la contraseña es erronea ***/
  test('Debe devolver error 400 si se ingresa mal la contraseña', async () => {
    const response = await request(app).post('/users/create').send({ email: 'test@test.cl', password: 'asd1234' });

    expect(response.status).toBe(400);
  });

  /*** Prueba integral al controller 'getAllUsers' ***/
  /*** Prueba 6: Entregar usuario existente en la base ***/
  test('Debe entregar un status 201 y la infomracion del usuario', async () => {
    const response = await request(app).get('/users/all').send({});

    expect(response.status).toBe(201);
    const data = response.body[0];
    const user = await UserRepository.findUserById(data.id_players);
    console.log("Usuarios encontrados en BD (en test):", user);
  });
});

