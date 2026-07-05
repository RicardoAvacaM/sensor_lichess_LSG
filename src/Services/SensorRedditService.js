import axios from "axios";
import UserModel from '../Models/UserModel.js'; // Modelo del usuario
import UserRepository from '../Repositories/UserRepository.js'; // Repositorio del usuario
import SensorPointService from "../Services/SensorPointService.js";
import SensorPointRepository from "../Repositories/SensorPointRepository.js";
import UserService from "../Services/UserService.js";
import SensorPointModel from "../Models/SensorPointModel.js";
import cron from "node-cron";

class SensorRedditService {
  constructor(userRepository) {
    this.sensorPointService = new SensorPointService(new SensorPointRepository());
    this.userService = new UserService(new UserRepository());
    this.httpClient = axios.create();

    
    // Tarea programada para ejecutarse a las 10 PM todos los días
    /**
   * Funcion encargada de ejecutar de forma automatica la funcion de generar puntos bGames. 
   * Ejecuta el metodo 'saveSensorPoint()' a las 22:01, hora del equipo local.
   *
   * @returns {} Se ejecutade forma correcta los servicios bGames esten online y el usuario tenga el sensor Reddit vinculado.
   * @throws {Error} Si no se puede conectar a los servidores o si el usuario no tiene una cuenta vinculada.
   */
    cron.schedule(
      '01 22 * * *',
      async () => {
        console.log("Verificando conexión con servidores...");
        let conectado = await this.sensorPointService.checkServerStatus();

        if (!conectado) {
          console.log("No hay conexión con los servidores, reintentando cada minuto...");
          const retryInterval = setInterval(async () => {
            let reintento = await this.sensorPointService.checkServerStatus();
            if (reintento) {
              clearInterval(retryInterval);
              console.log("Conexión restablecida. Ejecutando el proceso...");
              await this.ejecutarProceso();
            }
          }, 60000); // Reintenta cada 1 minuto
        } else {
          await this.ejecutarProceso();
        }
      },
      {
        scheduled: true
      }
    );
    
  }

  /**
 * Ejecuta el proceso principal de sensor de Reddit.
 *
 * 1. Verifica si el usuario tiene una cuenta de Reddit vinculada llamando a `checkUserRedditDB`.
 * 2. Si tiene una cuenta, procede a guardar el punto con `saveSensorPointReddit`.
 * 3. Si no tiene una cuenta, aborta el proceso.
 *
 * Maneja errores que puedan ocurrir durante el proceso.
 *
 * @async
 * @returns {Promise<void>} No retorna ningún valor.
 */

  async ejecutarProceso() {
    try {
      if (!await this.checkUserRedditDB()) {
        console.log("No existe una cuenta vinculada...");
        return;
      }
      await this.saveSensorPointReddit();
      console.log("Usuario válido. Creando nuevo punto...");
    } catch (error) {
      console.error("Error en el proceso de Stack Overflow:", error.message);
    }
  }

  /**
 * Obtiene el karma total de un usuario de Reddit utilizando la API pública.
 *
 * Realiza una petición HTTP a `https://www.reddit.com/user/{username}/about.json`
 * para obtener la información del usuario y extraer su `total_karma`.
 *
 * Si el usuario no tiene karma o no existe, retorna 0.
 * Maneja errores de conexión o respuestas inválidas.
 *
 * @async
 * @param {string} username - Nombre de usuario de Reddit.
 * @returns {Promise<number>} El karma total del usuario o 0 si hay un error o no se encuentra.
 */

  async getRedditKarma(username) {
    const apiUrl = `https://www.reddit.com/user/${username}/about.json`;
    try {
      const response = await this.httpClient.get(apiUrl);
      if (response.status === 200) {
        const dataUser = response.data.total_karma;
        console.log("Karma del usuario:", dataUser);
        if (!dataUser) {
          console.log("No se encontro informacion del usuario en Reddit");
          return 0;
        }
        console.log("Karma del usuario:", dataUser);
        return dataUser;
      } else {
        console.error("Error al obtener los datos de Reddit:", response.status);
        return 0;
      }
    } catch (error) {
      console.error("Error al comunicarse con la API de Reddit:", error.message);
      return 0;
    }
  }

  /**
 * Verifica si existe un usuario en la base de datos y si tiene una cuenta de Reddit vinculada.
 *
 * @returns {Promise<boolean>} Retorna true si tiene cuenta de Reddit, false si no tiene o no hay usuarios.
 */

  async checkUserRedditDB() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    const tieneReddit = user.id_reddit !== 'null' && user.id_reddit && user.id_reddit.trim() !== '';
    if (tieneReddit) {
      console.log('El usuario tiene cuenta de Reddit');
      return true;
    }
    console.log('El usuario NO tiene cuenta de Reddit');
    return false;
  }

   /**
 * Guarda un nuevo punto de sensor para la plataforma "Reddit".
 * 
 * Esta función verifica si ya existe un punto registrado para el día actual.
 * Si no existe, calcula la diferencia de Reputacion que ha generado en el dia y crea un nuevo punto
 * con los datos actualizados. Este punto se asocia con el primer usuario
 * encontrado en la base de datos y se registra en el repositorio.
 * 
 * También se encarga de enviar los puntos al servidor de bGames.
 */

  async saveSensorPointReddit() {
    try {
      console.log("=== Guardando punto de sensor de Reddit... ===");

      // Obtener usuarios y verificar existencia
      const users = await this.userService.getAllUsers();
      if (!users || users.length === 0) {
        console.error("No se encontró ningún usuario registrado.");
        return;
      }

      const user = users[0];
      console.log("Usuario obtenido:", user);

      // Obtener karma actual de Reddit
      const karma = await this.getRedditKarma(user.id_reddit);
      console.log("Karma actual de Reddit:", karma);

      // Obtener todos los puntos de sensor para Reddit
      const points = await SensorPointRepository.getAllSensorPoints("Reddit");

      // Definir la fecha actual en formato YYYY-MM-DD
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayFormatted = todayDate.toISOString().split("T")[0];
      console.log("Fecha de hoy:", todayFormatted);

      if (points.length === 0) {
        // Si no hay puntos registrados, crear el primero
        console.log("No se encontraron puntos de sensor, creando el primero...");

        const firstPoint = new SensorPointModel(
          null,
          1,
          user.id_players,
          25,  // Puntos iniciales
          todayFormatted, // Fecha YYYY-MM-DD
          null, // Horas jugadas no aplican en Reddit
          karma, // Karma al momento de la creación
          null, // Reputación
          "Reddit"
        );
        await SensorPointRepository.createSensorPoint(firstPoint);
        await this.sensorPointService.sendPointsToServerStackAndReddit(25, 0, user.id_players);
        console.log("=== Primer punto de sensor creado: ===", firstPoint);
        return;
      }

      // Obtener el último punto registrado
      const lastPoint = points[points.length - 1];

      // Convertir `lastPoint.date_time` a fecha válida
      const lastPointDate = new Date(lastPoint.date_time + "T00:00:00");
      console.log("Última fecha registrada:", lastPointDate.toISOString().split("T")[0]);

      if (lastPointDate.toISOString().split("T")[0] < todayFormatted) {
        // Si la última fecha registrada es anterior a la fecha actual, creamos un nuevo punto
        console.log("Creando un nuevo punto para Reddit...");

        // Calcular los puntos basados en el karma ganado hoy
        const karmaDiferencial = Math.max(0, karma - (lastPoint.karma_player || 0));
        const updatedPoints = this.generatePointsReddit(karmaDiferencial);

        const nextPoint = new SensorPointModel(
          null,
          1,
          user.id_players,
          updatedPoints,
          todayFormatted, // Fecha actual YYYY-MM-DD
          null, // Horas jugadas no aplican en Reddit
          karma, // Karma obtenido
          null, // Reputación
          "Reddit"
        );

        await SensorPointRepository.createSensorPoint(nextPoint);
        await this.sensorPointService.sendPointsToServerStackAndReddit(updatedPoints, 0, user.id_players);
        console.log("=== Nuevo punto de sensor creado para Reddit: ===", nextPoint);
      } else {
        console.log("No se necesita crear un nuevo punto de sensor para hoy.");
      }
    } catch (error) {
      console.error("Error al guardar el punto de sensor de Reddit:", error.message);
    }
  }

  /**
  * Almacena las credenciales de la cuenta Reddit en el objeto 'User'. En caso de que el usuario no exista, lanza un error, 
  * caso contrasrio, actualiza el usuario con las credenciales de Reddit.
  * para verificar que las credenciales son válidas.
  */

  async createRedditUser(id_reddit) {
    try {
      const users = await UserRepository.getUsers();
      const user = users[0];
      if (!user) {
        throw new Error('No se encontró el usuario en la base de datos.');
      }
      user.id_reddit = id_reddit;
      await UserRepository.updateUser(user); // guarda el id del usuario de reddit
      await this.saveSensorPointReddit();
      console.log('Creación de usuario de Reddit exitosa.');
    } catch (error) {
      console.error('Error al obtener los datos del usuario:', error.message);
      throw new Error('Error al actualizar los datos de Steam para el usuario.');
    }
  }

  /**
 * Genera puntos basados en el karma ganado en Reddit durante el día.
 * 
 * Este sistema de puntuación premia a los usuarios según el karma obtenido:
 * más karma significa más puntos. También se otorgan puntos incluso si no se gana karma,
 * para mantener la participación incentivada.
 * 
 * @param {number} karma_earned - Karma ganado en el día.
 * @returns {number} Puntos generados.
 */

  generatePointsReddit(karma_earned) {
    let points;

    if (karma_earned >= 1 && karma_earned <= 10) {
      points = karma_earned * 10;
    } else if (karma_earned >= 11) {
      points = 110; // recompensa por ganar más de 10 puntos de karma en el día 
    } else if (karma_earned == 0) {
      points = 10; // puntos de compensación por no ganar karma
    } else {
      points = 5; // puntos mínimos si no cae en los rangos anteriores
    }
    return points;
  }
}

export default SensorRedditService;