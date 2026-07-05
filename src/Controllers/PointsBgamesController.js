import PointsBgamesService from "../Services/PointsBgamesService.js";
import PointsBgamesModel from "../Models/PointsBgamesModel.js";
import axios from 'axios';

class PointsBgamesController {
  constructor() {
    this.httpClient = axios.create();
    this.pointsBgamesService = new PointsBgamesService();
    this.pointsBgamesModel = new PointsBgamesModel();
  }
  savePointsBgames = async (req, res) => {
    try {
      // Llamar al servicio para obtener los puntos desde la API
      const pointsBgamesFromApi = await this.pointsBgamesService.savePointsBgames();

      if (pointsBgamesFromApi.length > 0) {
        // Transformar los datos en instancias de PointsBgamesModel
        const pointsBgames = pointsBgamesFromApi.map((points) => {
          return new PointsBgamesModel(
            points.id_attributes,
            points.name,
            points.data
          );
        });

        return res.status(200).json(pointsBgames); // Responder con los datos transformados
      } else {
        return res.status(404).json({ message: 'No se encontraron puntos.' });
      }
    } catch (error) {
      console.error('Error interno del servidor:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  };
}

export default PointsBgamesController;