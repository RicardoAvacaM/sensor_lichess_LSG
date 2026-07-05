import axios from "axios";
import SensorStackOverflowService from "../Services/SensorStackOverflowService.js";

class SensorStackOverflowController {
  constructor() {
    this.sensorStackOverflowService = new SensorStackOverflowService;
  }

  async getReputation(req, res) {
    const { id_stackoverflow } = req.body;
    console.log('id_stackoverflow:', id_stackoverflow);
    try {
      const reputation = await this.sensorStackOverflowService.getStackOverflowReputation(id_stackoverflow);
      return res.status(200).json({ reputation });
    } catch (error) {
      console.error('Error interno del servidor:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  async checkUserStackOverflowDB(req, res) {
    try {
      const userStackOverflow = await this.sensorStackOverflowService.checkUserStackOverflowDB();
      if (userStackOverflow) {
        // Usuario encontrado
        return res.status(200).json({ userCreated: true, message: 'Usuario creado' });
      } else {
        // Usuario no encontrado
        return res.status(200).json({ userCreated: false, message: 'Usuario no creado aún' });
      }
    } catch (error) {
      console.error('Error interno del servidor:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  async checkUserStackOverflow(req, res) {
    const { code, state } = req.query;
    console.log('code:', code);

    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }
    try {
      // Intercambiar el código por un access_token
      const response = await axios.post(
        'https://stackoverflow.com/oauth/access_token/json',
        new URLSearchParams({
          client_id: '30672',
          client_secret: 'OUwkTtNCT4nzRTE2yOfrlQ((',
          code: code,
          redirect_uri: 'http://localhost:8080/users/callback-stack-overflow',
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      console.log('Token response:', response.data);

      if (!response.data.access_token) {
        return res.status(400).json({ error: 'Failed to retrieve access token' });
      }
      const accessToken = response.data.access_token;
      console.log('Access token:', accessToken);

      // Realizar solicitud para obtener información del usuario
      const userInfo = await axios.get('https://api.stackexchange.com/2.3/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          site: 'stackoverflow',
        },
      });

      console.log('User info:', userInfo.data);
      if (userInfo.data.items) {
        console.log('[User info:]', userInfo.data.items[0].display_name);
        console.log('[User info:]', userInfo.data.items[0].user_id);
        this.sensorStackOverflowService.createStackOverflowUser(
          userInfo.data.items[0].user_id, userInfo.data.items[0].display_name);
      }

      return res.status(200).json({
        message: 'Access token received successfully',
        user: userInfo.data,
      });

    } catch (error) {
      console.error('Error interno del servidor:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  async saveSensorPointStackOverflowt(req, res) {
    try {
      const response = await this.sensorStackOverflowService.saveSensorPointStackOverflow();
      res.status(200).json({
        message: 'Punto de sensor guardado exitosamente.',
        data: response
      });
    } catch (error) {
      console.error('Error al guardar el punto de sensor:', error.message);
      res.status(500).json({
        message: 'Error interno del servidor al guardar el punto de sensor.',
        error: error.message
      });
    }
  }

}

export default SensorStackOverflowController;