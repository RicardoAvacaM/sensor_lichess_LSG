import express from 'express';
import UserController from '../Controllers/UserController.js';
import PointsBgamesController from '../Controllers/PointsBgamesController.js';
import SensorLichessController from '../Controllers/SensorLichessController.js';
import SensorHtbController from '../Controllers/SensorHtbController.js';
import SensorChessComController from '../Controllers/SensorChessComController.js';

const router = express.Router();
const userController = new UserController();
const pointsBgamesController = new PointsBgamesController();
const sensorLichessController = new SensorLichessController();
const sensorHtbController = new SensorHtbController();
const sensorChessComController = new SensorChessComController();

router.post('/create', (req, res) => userController.createUser(req, res));
router.post('/login', (req, res) => userController.login(req, res));
router.get('/all', (req, res) => userController.getAllUsers(req, res));
router.get('/check', (req, res) => userController.userCheckDB(req, res));
router.get('/points', (req, res) => pointsBgamesController.savePointsBgames(req, res));

router.post('/lichess/link', (req, res) => sensorLichessController.linkToken(req, res));
router.post('/lichess/unlink', (req, res) => sensorLichessController.unlink(req, res));
router.get('/check-lichess-user', (req, res) => sensorLichessController.checkLichessUser(req, res));
router.get('/lichess/points', (req, res) => sensorLichessController.getRecentPoints(req, res));
router.get('/lichess/status', (req, res) => sensorLichessController.getStatus(req, res));
router.get('/lichess/poll', (req, res) => sensorLichessController.pollNow(req, res));
router.post('/lichess/transfer', (req, res) => sensorLichessController.transferPoints(req, res));

router.post('/htb/link', (req, res) => sensorHtbController.linkSession(req, res));
router.post('/htb/unlink', (req, res) => sensorHtbController.unlink(req, res));
router.get('/check-htb-user', (req, res) => sensorHtbController.checkHtbUser(req, res));
router.get('/htb/status', (req, res) => sensorHtbController.getStatus(req, res));
router.get('/htb/poll', (req, res) => sensorHtbController.pollNow(req, res));
router.post('/htb/transfer', (req, res) => sensorHtbController.transferPoints(req, res));

router.post('/chesscom/link', (req, res) => sensorChessComController.linkUsername(req, res));
router.post('/chesscom/unlink', (req, res) => sensorChessComController.unlink(req, res));
router.get('/check-chesscom-user', (req, res) => sensorChessComController.checkChessComUser(req, res));
router.get('/chesscom/status', (req, res) => sensorChessComController.getStatus(req, res));
router.get('/chesscom/poll', (req, res) => sensorChessComController.pollNow(req, res));
router.post('/chesscom/transfer', (req, res) => sensorChessComController.transferPoints(req, res));

export default router;
