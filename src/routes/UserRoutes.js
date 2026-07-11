import express from 'express';
import UserController from '../Controllers/UserController.js';
import PointsBgamesController from '../Controllers/PointsBgamesController.js';
import SensorLichessController from '../Controllers/SensorLichessController.js';
import SensorHtbController from '../Controllers/SensorHtbController.js';

const router = express.Router();
const userController = new UserController();
const pointsBgamesController = new PointsBgamesController();
const sensorLichessController = new SensorLichessController();
const sensorHtbController = new SensorHtbController();

router.post('/create', (req, res) => userController.createUser(req, res));
router.post('/login', (req, res) => userController.login(req, res));
router.get('/all', (req, res) => userController.getAllUsers(req, res));
router.get('/check', (req, res) => userController.userCheckDB(req, res));
router.get('/points', (req, res) => pointsBgamesController.savePointsBgames(req, res));

router.post('/lichess/link', (req, res) => sensorLichessController.linkToken(req, res));
router.get('/check-lichess-user', (req, res) => sensorLichessController.checkLichessUser(req, res));
router.get('/lichess/points', (req, res) => sensorLichessController.getRecentPoints(req, res));
router.get('/lichess/status', (req, res) => sensorLichessController.getStatus(req, res));
router.get('/lichess/poll', (req, res) => sensorLichessController.pollNow(req, res));
router.post('/lichess/transfer', (req, res) => sensorLichessController.transferPoints(req, res));

router.post('/htb/link', (req, res) => sensorHtbController.linkSession(req, res));
router.get('/check-htb-user', (req, res) => sensorHtbController.checkHtbUser(req, res));
router.get('/htb/status', (req, res) => sensorHtbController.getStatus(req, res));
router.get('/htb/poll', (req, res) => sensorHtbController.pollNow(req, res));
router.post('/htb/transfer', (req, res) => sensorHtbController.transferPoints(req, res));

export default router;
