import sqlite3 from 'sqlite3';
import UserModel from '../Models/UserModel.js';

const db = new sqlite3.Database('./sensor-steam-db.db');

const NEW_COLUMNS = [
  'lsg_access_token TEXT',
  'lsg_token_expires_at TEXT',
  'lichess_username TEXT',
  'lichess_access_token TEXT',
  'lichess_last_sync_at TEXT',
  'lsg_sensor_endpoint_id TEXT',
  'lsg_players_sensor_endpoint_id TEXT',
  'lichess_activity_snapshot TEXT',
  'lichess_last_status TEXT',
  'htb_academy_session TEXT',
  'htb_last_sync_at TEXT',
  'htb_progress_snapshot TEXT',
  'htb_last_status TEXT',
  'htb_lsg_sensor_endpoint_id TEXT',
  'htb_lsg_players_sensor_endpoint_id TEXT',
];

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id_players TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      lsg_access_token TEXT,
      lsg_token_expires_at TEXT,
      lichess_username TEXT,
      lichess_access_token TEXT,
      lichess_last_sync_at TEXT,
      lsg_sensor_endpoint_id TEXT,
      lsg_players_sensor_endpoint_id TEXT,
      lichess_activity_snapshot TEXT,
      lichess_last_status TEXT,
      htb_academy_session TEXT,
      htb_last_sync_at TEXT,
      htb_progress_snapshot TEXT,
      htb_last_status TEXT,
      htb_lsg_sensor_endpoint_id TEXT,
      htb_lsg_players_sensor_endpoint_id TEXT
    )
  `);

  for (const col of NEW_COLUMNS) {
    const colName = col.split(' ')[0];
    db.run(`ALTER TABLE users ADD COLUMN ${col}`, () => {});
  }
});

function rowToUser(row) {
  return new UserModel(
    row.id_players,
    row.name,
    row.email,
    row.password,
    row.lsg_access_token,
    row.lsg_token_expires_at,
    row.lichess_username,
    row.lichess_access_token,
    row.lichess_last_sync_at,
    row.lsg_sensor_endpoint_id,
    row.lsg_players_sensor_endpoint_id,
    row.lichess_activity_snapshot,
    row.lichess_last_status,
    row.htb_academy_session,
    row.htb_last_sync_at,
    row.htb_progress_snapshot,
    row.htb_last_status,
    row.htb_lsg_sensor_endpoint_id,
    row.htb_lsg_players_sensor_endpoint_id
  );
}

class UserRepository {
  static createUser(user) {
    if (!(user instanceof UserModel)) {
      throw new Error('El usuario debe ser una instancia de UserModel');
    }

    const query = `
      INSERT INTO users (
        id_players, name, email, password,
        lsg_access_token, lsg_token_expires_at,
        lichess_username, lichess_access_token, lichess_last_sync_at,
        lsg_sensor_endpoint_id, lsg_players_sensor_endpoint_id,
        lichess_activity_snapshot, lichess_last_status,
        htb_academy_session, htb_last_sync_at, htb_progress_snapshot, htb_last_status,
        htb_lsg_sensor_endpoint_id, htb_lsg_players_sensor_endpoint_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      db.run(
        query,
        [
          user.id_players,
          user.name,
          user.email,
          user.password,
          user.lsg_access_token,
          user.lsg_token_expires_at,
          user.lichess_username,
          user.lichess_access_token,
          user.lichess_last_sync_at,
          user.lsg_sensor_endpoint_id,
          user.lsg_players_sensor_endpoint_id,
          user.lichess_activity_snapshot,
          user.lichess_last_status,
          user.htb_academy_session,
          user.htb_last_sync_at,
          user.htb_progress_snapshot,
          user.htb_last_status,
          user.htb_lsg_sensor_endpoint_id,
          user.htb_lsg_players_sensor_endpoint_id,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static getUsers() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(rowToUser));
      });
    });
  }

  static findUserById(id_players) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id_players = ?', [id_players], (err, row) => {
        if (err) reject(err);
        else resolve(row ? rowToUser(row) : null);
      });
    });
  }

  static updateUser(user) {
    if (!(user instanceof UserModel)) {
      throw new Error('El usuario debe ser una instancia de UserModel');
    }

    const query = `
      UPDATE users SET
        name = ?, email = ?, password = ?,
        lsg_access_token = ?, lsg_token_expires_at = ?,
        lichess_username = ?, lichess_access_token = ?, lichess_last_sync_at = ?,
        lsg_sensor_endpoint_id = ?, lsg_players_sensor_endpoint_id = ?,
        lichess_activity_snapshot = ?, lichess_last_status = ?,
        htb_academy_session = ?, htb_last_sync_at = ?, htb_progress_snapshot = ?, htb_last_status = ?,
        htb_lsg_sensor_endpoint_id = ?, htb_lsg_players_sensor_endpoint_id = ?
      WHERE id_players = ?
    `;

    return new Promise((resolve, reject) => {
      db.run(
        query,
        [
          user.name,
          user.email,
          user.password,
          user.lsg_access_token,
          user.lsg_token_expires_at,
          user.lichess_username,
          user.lichess_access_token,
          user.lichess_last_sync_at,
          user.lsg_sensor_endpoint_id,
          user.lsg_players_sensor_endpoint_id,
          user.lichess_activity_snapshot,
          user.lichess_last_status,
          user.htb_academy_session,
          user.htb_last_sync_at,
          user.htb_progress_snapshot,
          user.htb_last_status,
          user.htb_lsg_sensor_endpoint_id,
          user.htb_lsg_players_sensor_endpoint_id,
          user.id_players,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }
}

export default UserRepository;
