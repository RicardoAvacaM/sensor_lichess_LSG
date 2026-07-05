import React, { useState, useEffect } from "react";
import axios from 'axios';
import "../styles/SteamView.css";

function SteamLogin() {
  const [apiKey, setApiKey] = useState('');
  const [userIdSteam, setIDUser] = useState('');
  const [message, setMessage] = useState('');
  const [yesterdayPoints, setYesterdayPoints] = useState(0);
  const [todayPoints, setTodayPoints] = useState(0);
  const [hasPlayer, setHasPlayer] = useState(false); // Estado para verificar si existe un jugador

  useEffect(() => {
    const fetchSensorPoints = async () => {
      try {
        const response = await axios.post('http://localhost:8080/users/allPoints', {
          tipe_sensor: "Steam",
        });

        if (response.status === 200 && response.data.data.length > 0) {
          const sensorPoints = response.data.data;
          const today = parseFloat(sensorPoints[0] || 0);
          const yesterday = parseFloat(sensorPoints[1] || 0);
          setTodayPoints(today);
          setYesterdayPoints(yesterday);
        } else {
          setMessage("Sensor points could not be obtained.");
        }
      } catch (error) {
        setMessage("Error communicating with the server to obtain sensor points.");
      }
    };

    const fetchUser = async () => {
      try {
        const response = await axios.get("http://localhost:8080/users/all");

        if (response.status === 201) {
          const user = response.data[0];

          if ((user.key_steam && user.id_user_steam) != null) {
            console.log(user.key_steam);
            setHasPlayer(true); // Jugador encontrado
          } else {
            setHasPlayer(false); // Jugador no encontrado
            setMessage("No users found.");
          }
        } else {
          setMessage("The user could not be obtained.");
        }
      } catch (error) {
        setMessage("Error communicating with the server to obtain a user.");
      }
    };

    fetchSensorPoints();
    fetchUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:8080/users/steam', {
        key_steam: apiKey,
        id_user_steam: userIdSteam,
      });

      if (response.status === 200) {
        setMessage('User successfully registered.');
        setHasPlayer(true); // Actualizar el estado para mostrar los puntos
      } else {
        setMessage('Error registering user.');
      }
    } catch (error) {
      setMessage('Server error: ' + error.response?.data?.error || error.message);
    }
  };

  return (
    <div className="login-container">
      {/* Si existe un jugador, muestra los puntos */}
      {hasPlayer ? (
        <div className="points-container">
          <h1>Your Points</h1>
          <div className="points-box1">Today's points: <span>{todayPoints}</span></div>
          <div className="points-box1">Yesterday's points: <span>{yesterdayPoints}</span></div>
        </div>
      ) : (
        // Si no existe un jugador, muestra el formulario de registro
        <div className="login-form">
          <h1>Connect to Steam</h1>
          <form onSubmit={handleSubmit}>
            <div>
              <label>Steam Api Key:</label>
              <input
                type="text"
                placeholder="Api Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Steam User ID:</label>
              <input
                type="text"
                placeholder="User ID"
                value={userIdSteam}
                onChange={(e) => setIDUser(e.target.value)}
                required
              />
            </div>
            <span>
              You can get your Steam Api Key <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer">here</a>.
            </span>
            <button type="submit">Send</button>
          </form>
          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  );
}

export default SteamLogin;
