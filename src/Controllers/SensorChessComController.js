import SensorChessComService from '../Services/SensorChessComService.js';

class SensorChessComController {
  constructor() {
    this.sensorChessComService = new SensorChessComService();
  }

  async linkUsername(req, res) {
    const { username } = req.body;
    if (!username?.trim()) {
      return res.status(400).json({ error: 'El username de Chess.com es obligatorio.' });
    }
    try {
      const linkedUsername = await this.sensorChessComService.linkUsername(username);
      return res.status(200).json({ message: 'Chess.com vinculado.', username: linkedUsername });
    } catch (error) {
      console.error('Error al vincular Chess.com:', error.response?.data || error.message);
      return res.status(400).json({ error: error.message || 'Error al vincular Chess.com.' });
    }
  }

  async checkChessComUser(req, res) {
    try {
      const linked = await this.sensorChessComService.checkChessComLinked();
      return res.status(200).json({ userCreated: linked, message: linked ? 'Vinculado' : 'No vinculado' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const data = await this.sensorChessComService.getSensorStatus();
      return res.status(200).json({ message: 'OK', data });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async transferPoints(req, res) {
    try {
      const data = await this.sensorChessComService.transferAccumulatedPoints();
      return res.status(200).json({ message: 'Puntos enviados al perfil', data });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async pollNow(req, res) {
    try {
      const result = await this.sensorChessComService.manualPoll();
      return res.status(200).json({ message: 'Poll completado', data: result });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export default SensorChessComController;
