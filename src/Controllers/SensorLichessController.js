import SensorLichessService from '../Services/SensorLichessService.js';

class SensorLichessController {
  constructor() {
    this.sensorLichessService = new SensorLichessService();
  }

  async linkToken(req, res) {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'El token personal es obligatorio.' });
    }
    try {
      const username = await this.sensorLichessService.linkPersonalToken(token);
      return res.status(200).json({ message: 'Lichess vinculado.', username });
    } catch (error) {
      console.error('Error al vincular token Lichess:', error.response?.data || error.message);
      return res.status(400).json({ error: 'Token inválido o error al vincular Lichess.' });
    }
  }

  async checkLichessUser(req, res) {
    try {
      const linked = await this.sensorLichessService.checkLichessLinked();
      return res.status(200).json({ userCreated: linked, message: linked ? 'Vinculado' : 'No vinculado' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getRecentPoints(req, res) {
    try {
      const data = await this.sensorLichessService.getRecentPoints();
      return res.status(200).json({ message: 'OK', data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const data = await this.sensorLichessService.getSensorStatus();
      return res.status(200).json({ message: 'OK', data });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async transferPoints(req, res) {
    try {
      const data = await this.sensorLichessService.transferAccumulatedPoints();
      return res.status(200).json({ message: 'Puntos enviados al perfil', data });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async pollNow(req, res) {
    try {
      const result = await this.sensorLichessService.manualPoll();
      return res.status(200).json({ message: 'Poll completado', data: result });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export default SensorLichessController;
