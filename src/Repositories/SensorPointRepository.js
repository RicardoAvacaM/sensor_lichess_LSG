import sqlite3 from 'sqlite3';
import SensorPointModel from '../Models/SensorPointModel.js';

// Inicializar conexión con la base de datos
const db = new sqlite3.Database('./sensor-steam-db.db');

// Crear la tabla si no existe
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS sensor_points (
            id_point_sensor INTEGER PRIMARY KEY AUTOINCREMENT,
            id_sensor TEXT NOT NULL,
            id_players TEXT NOT NULL,
            data_point TEXT NOT NULL,
            date_time TEXT NOT NULL CHECK(length(date_time) = 10 AND date_time GLOB '????-??-??'),
            hours_played TEXT,
            karma_player TEXT,
            reputation_player TEXT,
            tipe_sensor TEXT NOT NULL
        )
    `);
});

class SensorPointRepository {
    constructor(db) {
        this.db = db; // 🔥 Usamos la misma base de datos en memoria
      }
    // Crear un punto de sensor
    static createSensorPoint(sensorPoint) {
        if (!(sensorPoint instanceof SensorPointModel)) {
            throw new Error(
                'El punto de sensor debe ser una instancia de SensorPointModel'
            );
        }

        const query = `
            INSERT INTO sensor_points (id_sensor, id_players, data_point, date_time, hours_played, karma_player, reputation_player, tipe_sensor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            db.run(
                query,
                [
                    sensorPoint.id_sensor,
                    sensorPoint.id_players,
                    sensorPoint.data_point,
                    sensorPoint.date_time,
                    sensorPoint.hours_played,
                    sensorPoint.karma_player,
                    sensorPoint.reputation_player,
                    sensorPoint.tipe_sensor,
                ],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID); // Retorna el ID del último registro insertado
                    }
                }
            );
        });
    }

    // Obtener todos los puntos de sensor
    // Obtener todos los puntos de sensor filtrados por tipe_sensor
    static getAllSensorPoints(tipe_sensor) {
        const query = 'SELECT * FROM sensor_points WHERE tipe_sensor = ?';

        return new Promise((resolve, reject) => {
            db.all(query, [tipe_sensor], (err, rows) => { // Pasar el parámetro en el array
                if (err) {
                    reject(err);
                } else {
                    // Mapear filas a instancias de SensorPointModel
                    const sensorPoints = rows.map(
                        (row) =>
                            new SensorPointModel(
                                row.id_point_sensor,
                                row.id_sensor,
                                row.id_players,
                                row.data_point,
                                row.date_time,
                                row.hours_played,
                                row.karma_player,
                                row.reputation_player,
                                row.tipe_sensor
                            )
                    );
                    resolve(sensorPoints);
                }
            });
        });
    }
}

export default SensorPointRepository;