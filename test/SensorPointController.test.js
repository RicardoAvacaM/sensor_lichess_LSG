import { expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import sqlite3 from 'sqlite3';
import SensorPointController from '../src/Controllers/SensorPointController.js';
import SensorPointService from '../src/Services/SensorPointService.js';
import SensorPointRepository from '../src/Repositories/SensorPointRepository.js';
import SensorPointModel from '../src/Models/SensorPointModel.js';
import UserRepository from '../src/Repositories/UserRepository.js';
import UserService from '../src/Services/UserService.js';
import UserController from '../src/Controllers/UserController.js';

describe('SensorPointController - Pruebas de Integración', () => {
    let app, sensorPointController, sensorPointService, sensorPointRepository;
    let userRepository, userService, userController, db;

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

        // Crear tablas necesarias
        db.serialize(() => {
            db.run(
                `CREATE TABLE users (
                    id_players TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    key_steam TEXT,
                    id_user_steam TEXT,
                    id_reddit TEXT,
                    id_player_stack TEXT,
                    name_stack TEXT
                )`,
            );

            db.run(
                `CREATE TABLE sensor_points (
                    id_point_sensor INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_sensor TEXT NOT NULL,
                    id_players TEXT NOT NULL,
                    data_point TEXT NOT NULL,
                    date_time TEXT NOT NULL CHECK(length(date_time) = 10 AND date_time GLOB '????-??-??'),
                    hours_played TEXT,
                    karma_player TEXT,
                    reputation_player TEXT,
                    tipe_sensor TEXT NOT NULL
                )`,
            );
        });
    });

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Se envia la BD en memoria al `UserRepository` y `SensorPointRepository`
        userRepository = new UserRepository(db);
        userService = new UserService(userRepository);
        sensorPointRepository = new SensorPointRepository(db);
        sensorPointService = new SensorPointService(sensorPointRepository);
        sensorPointController = new SensorPointController(sensorPointService);
        userController = new UserController(userService);

        app.post('/users/create', (req, res) => userController.createUser(req, res));
        app.get('/users/savePoint', (req, res) => sensorPointController.saveSensorPoint(req, res));
        app.post('/users/allPoints', (req, res) => sensorPointController.getAllSensorPoints(req, res));
        app.post('/users/steam', (req, res) => sensorPointController.setDataSteam(req, res));
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

    /*** Prueba 0: `createUser` debe crear un usuario llamando a la API***/
    test('Debe crear un usuario llamando a la API bGames y guardarlo en la base de datos', async () => {
        const response = await request(app)
            .post('/users/create')
            .send({ email: 'test@test.cl', password: 'asd123' });

        expect(response.status).toBe(201);
        console.log('Usuario creado:', response.body);
    });

    /*** Prueba integral al controller 'setDataSteam' ***/
    /*** Prueba 1: No debe vincular la cuenta Steam al sensor si hya datos erroneos***/
    test('No debe vincular la cuenta Steam al sensor si hya datos erroneos', async () => {
        const response = await request(app)
            .post('/users/steam')
            .send({
                key_steam: '7158612F11E17E',
                id_user_steam: '756'
            });
        expect(response.status).toBe(500);
        console.log('Respuesta de la API:', response.body);
    },);

    /*** Prueba integral al controller 'setDataSteam' ***/
    /*** Prueba 2: Vincular credenciales de Steam a una cuenta***/
    test('Debe vincular credenciales de Steam a una cuenta', async () => {
        const response = await request(app)
            .post('/users/steam')
            .send({
                key_steam: '7158612F11E17E31E90A2C998533B2EF',
                id_user_steam: '76561198795636654'
            });
        expect(response.status).toBe(200);
        console.log('Respuesta de la API:', response.body);
    },);

    /*** Prueba 3: `sensorPointService` debe crear un punto del sensor Steam en el servidor***/
    test(
        'sensorPointService - Debe crear un punto del sensor Steam',
        async () => {
            const response = await request(app)
                .get('/users/savePoint')

            expect(response.status).toBe(200);
            console.log('Respuesta de la API:', response.body);
        }, 10000);

    /*** Prueba 5: `sensorPointService` No debe crear un punto del sensor Steam si hay otro con la misma fecha***/
    test(
        'sensorPointService - Debe crer un punto si no hay otro con la misma fecha',
        async () => {
            const response = await request(app)
                .get('/users/savePoint')

            expect(response.status).toBe(200);
            console.log('Respuesta de la API:', response.body);
        }, 10000);

    /*** Prueba 6: `sensorPointService` Crear un punto del sensor Steam si no hay otro con la misma fecha***/
    test(
        'sensorPointService - Simula la ejecución un día después',
        async () => {
            // Obtener la fecha actual y sumarle un día
            const fakeDate = new Date();
            fakeDate.setDate(fakeDate.getDate() + 1);

            // Mock de `Date` para que el código piense que es otro día
            jest.useFakeTimers().setSystemTime(fakeDate);

            const response = await request(app).get('/users/savePoint');
            expect(response.status).toBe(200);
            console.log('Respuesta de la API:', response.body);

            // Restaurar el comportamiento original de `Date`
            jest.useRealTimers();
        },10000);

    /*** Prueba 7: `getAllSensorPoints` debe devolver los últimos 2 registros de la BD ***/
    test(
        'getAllSensorPoints - Debe devolver los últimos 2 registros de sensor_points',
        async () => {
            const response = await request(app)
                .post('/users/allPoints')
                .send({ tipe_sensor: 'Steam' });

            expect(response.status).toBe(200);
            console.log('Respuesta de la API:', response.body);
        },);

    /*** Prueba 8: `getAllSensorPoints` No debe devolver nada si no se especifica el sensor ***/
    test(
        'getAllSensorPoints - No debe devolver nada si no se especifica el tipe_sensor',
        async () => {
            const response = await request(app)
                .post('/users/allPoints')
                .send({ tipe_sensor: '' });

            expect(response.status).toBe(400);
            console.log('Respuesta de la API:', response.body);
        },);
});
