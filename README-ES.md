# Sensor bGames - Steam, StackOverflow & Reddit

bGames es una tecnología diseñada para crear un equilibrio entre las actividades diarias y los videojuegos. ¡Tus tareas diarias te ayudan a mejorar en los juegos! Con bGames, puedes ganar puntos en función de tus actividades diarias. Mediante sensores, se recopilan tus datos y se transforman en puntos, que se pueden utilizar para mejorar tu personaje en el juego.

La aplicación cuenta con tres sensores, cada uno recopila información y transforma los datos en puntos bGames:
- **Sensor Steam:** Recopila las horas de juego durante el día. Cuantas más horas se juegue, menor será la cantidad de puntos otorgados.
- **Sensor Reddit:** Captura el karma obtenido en el día.
- **Sensor StackOverflow:** Recopila la reputación obtenida en la cuenta durante el día.

## [Download [Sensor bGames](https://github.com/MoisesGodoy17/sensor-steam-react/releases/tag/sensor-bGames-v.1.1)]  

# Funcionalidades del sensor:

### **Inicio de sesión con cuenta bGames dentro del sensor.**
![PT-Sen-07-Nuevo login](https://github.com/user-attachments/assets/fd27b1da-3eeb-418b-b26e-c1ec11287632)

---

### **Ventana principal del sensor, muestra los datos de la cuenta bGames.**
![Ventana Principal](https://github.com/user-attachments/assets/7cf2d3c5-d0c8-4553-93e4-0f78ecb4d3bd)

---

### **Ventana de vinculación de cuenta de Steam.**
![PT-Sen-03-Nueva vista de Steam](https://github.com/user-attachments/assets/67a073f8-230a-4ed2-9a2f-0885c77f5174)

---

### **Ventana de puntos generados por el sensor StackOverflow.**
![PT-Sen-05-Puntos ganados Stack](https://github.com/user-attachments/assets/1f0487a3-4a4f-4480-b0d9-dfd633d24cc1)

---

# Cómo ejecutar el sensor bGames

- Es necesario descargar los servicios cloud de [bGames](https://github.com/BlendedGames-bGames/bGames-dev-services.git).
- Descarga la [aplicacón](https://github.com/MoisesGodoy17/sensor-steam-react/releases/tag/sensor-bGames-v.1.1).
- Extraiga el archivo `sensor-bgames-v1.1.rar` y haga clic en el ejecutable `bGames-sensor-installer.bat` para instalar el sensor.
- Asegúrese de tener instalada la versión 22.11 de Node.js. De lo contrario, el instalador de Node.js 22.11 está incluido en el archivo .rar.
- Vaya a la carpeta `sensor-steam-react\out\sensor-steam-react-win32-x64` y haga clic en el ejecutable `bGames-sensor-installer.exe`.

(**El sensor captura los datos a las 22:00, por lo que la aplicación debe estar en ejecución para su correcto funcionamiento.**)

---

# Instrucciones para desarrolladores:
## Clonar el repositorio
Descarga el repositorio desde GitHub ejecutando el siguiente comando:

```shell
git clone https://github.com/MoisesGodoy17/sensor-steam-react.git
```

## Requisitos para ejecutar la aplicación en modo desarrollo:
- **Docker:** versión 27.2.0
- **Node.js:** versión 22.11.0
- **NPM:** versión 10.9.0
- **Visual Studio Code** (o cualquier otro IDE)

---

# Ejecutar la aplicación
Para iniciar el proyecto, en la consola ingresar el siguiente comando:

```shell
npm start
```

---

# Exportar la aplicación
Para exportar la aplicación, es necesario modificar los siguientes archivos:
- `electron.js` (ubicado en `\sensor-steam-react\public\electron.js`)
- `vite.config.js`
- `package.json`

Cada archivo contiene instrucciones específicas sobre las modificaciones necesarias. Una vez realizadas estas modificaciones, instala las dependencias necesarias:

```shell
npm install --save-dev @electron-forge/cli
```

Después de instalar la librería, construye el front-end con el siguiente comando:

```shell
npm run build:frontend 
```

Finalmente, construye el resto del proyecto con:

```shell
npm run make
```

Esto generará una carpeta llamada `Out`, que contendrá la aplicación exportada en formato `.exe` con la siguiente ruta:

```
\sensor-steam-react\out\sensor-steam-react-win32-x64\sensor-steam-react.exe
```

---
