import SensorHtbAcademyService from '../Services/SensorHtbAcademyService.js';

class SensorHtbController {
  constructor() {
    this.sensorHtbService = new SensorHtbAcademyService();
  }

  async linkSession(req, res) {
    const { session } = req.body;
    if (!session?.trim()) {
      return res.status(400).json({ error: 'La sesión de Academy es obligatoria.' });
    }
    try {
      const result = await this.sensorHtbService.validateAndLinkSession(session.trim());
      return res.status(200).json({ message: 'HTB Academy vinculado.', ...result });
    } catch (error) {
      console.error('Error al vincular HTB:', error.response?.data || error.message);
      const htbStatus = error.response?.status;
      const htbBody = error.response?.data;
      let msg = error.message || 'Error al vincular HTB Academy.';
      if (htbStatus === 401 || htbStatus === 403) {
        msg = 'Sesión inválida o expirada. Inicia sesión de nuevo.';
      } else if (htbBody?.message) {
        msg = htbBody.message;
      }
      return res.status(400).json({ error: msg });
    }
  }

  async checkHtbUser(req, res) {
    try {
      const linked = await this.sensorHtbService.checkHtbLinked();
      return res.status(200).json({ userCreated: linked, message: linked ? 'Vinculado' : 'No vinculado' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const data = await this.sensorHtbService.getSensorStatus();
      return res.status(200).json({ message: 'OK', data });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async transferPoints(req, res) {
    try {
      const data = await this.sensorHtbService.transferAccumulatedPoints();
      return res.status(200).json({ message: 'Puntos enviados al perfil', data });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async pollNow(req, res) {
    try {
      const result = await this.sensorHtbService.manualPoll();
      return res.status(200).json({ message: 'Poll completado', data: result });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export default SensorHtbController;
