import axios from "axios";
import UserModel from '../Models/UserModel.js'; // Modelo del usuario
import UserRepository from '../Repositories/UserRepository.js'; // Repositorio del usuario
import UserService from "../Services/UserService.js";
import SensorPointModel from "../Models/SensorPointModel.js";
import SensorPointService from "../Services/SensorPointService.js";
import SensorPointRepository from "../Repositories/SensorPointRepository.js";
import cron from "node-cron";

class SensorStackOverflowService {
  constructor(userRepository) {
    this.userService = new UserService(new UserRepository());
    this.sensorPointService = new SensorPointService(new SensorPointRepository());
    this.httpClient = axios.create();

    
    // Tarea programada para ejecutarse a las 10 PM todos los días
    /**
   * Funcion encargada de ejecutar de forma automatica la funcion de generar puntos bGames. 
   * Ejecuta el metodo 'saveSensorPoint()' a las 22:02, hora del equipo local.
   *
   * @returns {} Se ejecutade forma correcta los servicios bGames esten online y el usuario tenga el sensor Stack Overflow vinculado.
   * @throws {Error} Si no se puede conectar a los servidores o si el usuario no tiene una cuenta vinculada.
   */
    cron.schedule(
      '02 22 * * *',
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
 * Ejecuta el proceso principal de sensor de Stack Overflow.
 *
 * 1. Verifica si el usuario tiene una cuenta de Stack Overflow vinculada llamando a `checkUserStackOverflowDB`.
 * 2. Si tiene una cuenta, procede a guardar el punto con `saveSensorPointStackOverflow`.
 * 3. Si no tiene una cuenta, aborta el proceso.
 *
 * Maneja errores que puedan ocurrir durante el proceso.
 *
 * @async
 * @returns {Promise<void>} No retorna ningún valor.
 */

  async ejecutarProceso() {
    try {
      if (!await this.checkUserStackOverflowDB()) {
        console.log("No existe una cuenta vinculada...");
        return;
      }
      await this.saveSensorPointStackOverflow();
      console.log("Usuario válido. Creando nuevo punto...");
    } catch (error) {
      console.error("Error en el proceso de Stack Overflow:", error.message);
    }
  }

  /**
 * Obtiene la reputacion total de un usuario de Steack Overflow utilizando la API pública.
 *
 * Realiza una petición HTTP a `https://api.stackexchange.com/2.3/users/${id_stackO}?site=stackoverflow`
 * para obtener la información del usuario y extraer su `reputation`.
 *
 * Si el usuario no tiene reputacion o no existe, retorna 0.
 * Maneja errores de conexión o respuestas inválidas.
 *
 * @async
 * @param {string} username - Nombre de usuario de Stack Overflow.
 * @returns {Promise<number>} El reputacion total del usuario o 0 si hay un error o no se encuentra.
 */

  async getStackOverflowReputation(id_stackO) {
    console.log("ID de usuario en StackOverflow:", id_stackO);
    const apiUrl = `https://api.stackexchange.com/2.3/users/${id_stackO}?site=stackoverflow`;
    try {
      const response = await this.httpClient.get(apiUrl);
      if (response.status === 200) {
        const dataUser = response.data.items[0].reputation;
        if (!dataUser) {
          console.log("No se encontro informacion del usuario en StackOverflow.es");
          return 0;
        }
        console.log("Reputacion del usuario:", dataUser);
        return dataUser;
      } else {
        console.error("Error al obtener los datos de Stack Overflow:", response.status);
        return 0;
      }
    } catch (error) {
      console.error("Error al comunicarse con la API de Stack Overflow:", error.message);
      return 0;
    }
  }

  /**
 * Verifica si existe un usuario en la base de datos y si tiene una cuenta de StackOverflow vinculada.
 *
 * @returns {Promise<boolean>} Retorna true si tiene cuenta de StackOverflow, false si no tiene o no hay usuarios.
 */

  async checkUserStackOverflowDB() {
    const users = await UserRepository.getUsers();
    const user = users[0];
    const tieneStack = user.id_player_stack && user.id_player_stack !== 'null' && user.id_player_stack.trim() !== '';
    if (tieneStack) {
      console.log('El usuario tiene cuenta de StackOverflow');
      return true;
    }
    console.log('El usuario NO tiene cuenta de StackOverflow');
    return false;
  }

  /**
 * Guarda un nuevo punto de sensor para la plataforma "StackOverflow".
 * 
 * Esta función verifica si ya existe un punto registrado para el día actual.
 * Si no existe, calcula la diferencia de Karma que ha generado en el dia y crea un nuevo punto
 * con los datos actualizados. Este punto se asocia con el primer usuario
 * encontrado en la base de datos y se registra en el repositorio.
 * 
 * También se encarga de enviar los puntos al servidor de bGames.
 */

  async saveSensorPointStackOverflow() {
    console.log("=== Guardando punto de sensor de StackOverflow... ===");
    try {
      // Obtener usuarios y verificar existencia
      const users = await this.userService.getAllUsers();
      if (!users || users.length === 0) {
        console.error("No se encontró ningún usuario registrado.");
        return;
      }
      // Obtener usuario y reputación de StackOverflow
      const user = users[0];
      console.log("Usuario de StackOverflow:", user);
      const reputation = await this.getStackOverflowReputation(user.id_player_stack);
      console.log("Reputación de StackOverflow obtenida:", reputation);

      // Obtener todos los puntos de sensor para StackOverflow
      const points = await SensorPointRepository.getAllSensorPoints("StackOverflow");

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
          null, // Horas jugadas no aplican en StackOverflow
          null, // Karma
          reputation, // Reputación al momento de la creación
          "StackOverflow"
        );

        await SensorPointRepository.createSensorPoint(firstPoint);
        await this.sensorPointService.sendPointsToServerStackAndReddit(25, 3, user.id_players);
        console.log("=== Primer punto de sensor creado: ===", firstPoint);
        return;
      }
      // Obtener el último punto registrado
      const lastPoint = points[points.length - 1];

      // Convertir `lastPoint.date_time` a una fecha válida
      const lastPointDate = new Date(lastPoint.date_time + "T00:00:00");
      console.log("Última fecha registrada:", lastPointDate.toISOString().split("T")[0]);

      if (lastPointDate.toISOString().split("T")[0] < todayFormatted) {
        // Si la última fecha registrada es anterior a la fecha actual, crear un nuevo punto
        console.log("El último punto es de una fecha anterior, creando un nuevo punto...");
        console.log("Reputación obtenida hoy:", reputation);

        // Calcular los puntos basados en la reputación ganada hoy
        const reputationDiferencial = Math.max(0, reputation - (lastPoint.reputation_player || 0));
        const updatedPoints = this.generatePointsStackOverflow(reputationDiferencial);
        const nextPoint = new SensorPointModel(
          null,
          1,
          user.id_players,
          updatedPoints,
          todayFormatted, // Fecha actual en formato YYYY-MM-DD
          null, // Horas jugadas no aplican en StackOverflow
          null, // Karma
          reputation, // Reputación obtenida
          "StackOverflow"
        );
        await SensorPointRepository.createSensorPoint(nextPoint);
        await this.sensorPointService.sendPointsToServerStackAndReddit(updatedPoints, 3, user.id_players);
        console.log("=== Nuevo punto de sensor creado para StackOverflow: ===", nextPoint);
      } else {
        console.log("No se necesita crear un nuevo punto de sensor para hoy.");
      }
    } catch (error) {
      console.error("Error al guardar el punto de sensor de StackOverflow:", error.message);
    }
  }

  /**
  * Almacena las credenciales de la cuenta StackOverflow en el objeto 'User'. En caso de que el usuario no exista, lanza un error, 
  * caso contrasrio, actualiza el usuario con las credenciales de StackOverflow.
  * para verificar que las credenciales son válidas.
  */

  async createStackOverflowUser(id_player_stack, name_stack) {
    console.log('Creando usuario de Stack Overflow...');
    console.log('ID de usuario en Stack Overflow:', id_player_stack);
    console.log('Nombre de usuario en Stack Overflow:', name_stack);
    try {
      const users = await UserRepository.getUsers();
      const user = users[0];
      if (!user) {
        throw new Error('No se encontró el usuario en la base de datos.');
      }
      user.id_player_stack = id_player_stack;
      user.name_stack = name_stack;

      console.log('Usuario:', user);
      await UserRepository.updateUser(user); // guarda el id y el nombre del usuario de StackOverflow
      await this.saveSensorPointStackOverflow();
      console.log('Creación de usuario de Stack Overflow exitosa.');
    } catch (error) {
      console.error('Error al obtener los datos del usuario:', error.message);
      throw new Error('Error al actualizar los datos de Steam para el usuario.');
    }
  }

  /**
 * Genera puntos basados en la reputación diaria ganada en StackOverflow.
 * 
 * La lógica premia más a los usuarios que están ganando reputación de forma activa,
 * otorgando distintos rangos de puntos dependiendo de la cantidad de reputación obtenida.
 * También contempla escenarios donde no se gana reputación o esta disminuye.
 * 
 * @param {number} reputation - Reputación ganada en el día.
 * @returns {number} Puntos generados.
 */
  generatePointsStackOverflow(reputation) {
    console.log("Reputation:", reputation);
    let puntos = 0;
    if (reputation >= 1 && reputation <= 50) {
      puntos = reputation * 2;
      console.log("187 Puntos obtenidos:", puntos);
      return puntos;
    }
    else if (reputation >= 51) { // recompensa por ganar más de 50 puntos de reputacion en StackOverflow
      puntos = 110;
      console.log("192 Puntos obtenidos:", puntos);
      return puntos;
    }
    else if (reputation == 0) {
      puntos = 10;
      console.log("197 Puntos obtenidos:", puntos);
      return puntos;
    }
    else { //Caso en que la reputacion disminuya respecto al dia anterior
      puntos = 5;
      console.log("202 Puntos obtenidos:", puntos);
      puntos = 10;
    }
  }
}

export default SensorStackOverflowService;