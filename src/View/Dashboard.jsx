import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/Dashboard.css";
import "../styles/ButtonBackDashView.css";
import LichessView from "./LichessView.jsx";
import Sidebar from "../Components/Sidebar.jsx";

function Dashboard() {
  const [points, setPoints] = useState({
    social: 0,
    fisica: 0,
    afectivo: 0,
    mental: 0,
    linguistico: 0,
  });
  const prevPointsRef = useRef(points);
  const firstLoadRef = useRef(true);

  const [currentView, setCurrentView] = useState("default");
  const [errorMessage, setErrorMessage] = useState("");
  const [user, setUser] = useState({ name: "" });

  const mapAttributePoints = (pointsData) => {
    const find = (...names) => {
      const item = pointsData.find((p) => names.includes(p.name));
      return item?.data || 0;
    };
    return {
      social: find("Social"),
      fisica: find("Fisico", "Físico"),
      afectivo: find("Afectivo"),
      mental: find("Mental", "Cognitivo"),
      linguistico: find("Linguistico", "Lingüístico"),
    };
  };

  const fetchPoints = async () => {
    try {
      const response = await axios.get("http://localhost:8080/users/points");

      if (response.status === 200) {
        const pointsData = response.data;
        setErrorMessage("LSG conectado.");

        const newPoints = mapAttributePoints(pointsData);
        const prevPoints = prevPointsRef.current;
        const increased = Object.keys(newPoints).some(
          (key) => newPoints[key] > prevPoints[key]
        );

        if (increased && !firstLoadRef.current) {
          alert("¡Has ganado puntos bGames!");
        }

        firstLoadRef.current = false;
        prevPointsRef.current = newPoints;
        setPoints(newPoints);
      } else {
        setErrorMessage("No se pudieron obtener los puntos.");
      }
    } catch {
      setErrorMessage("Error al comunicarse con LSG.");
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get("http://localhost:8080/users/all");
        if (response.status === 201 && response.data[0]) {
          setUser({ name: response.data[0].name });
        }
      } catch {
        setErrorMessage("Error al obtener usuario.");
      }
    };

    fetchPoints();
    fetchUser();

    const interval = setInterval(fetchPoints, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleGoBack = () => {
    fetchPoints();
    setCurrentView("default");
  };

  return (
    <div className="dashboard-container">
      <Sidebar setCurrentView={setCurrentView} />

      <div className="main-content">
        {currentView === "lichess" && (
          <>
            <button onClick={handleGoBack} className="back-button">Volver</button>
            <LichessView />
          </>
        )}
        {currentView === "default" && (
          <>
            <div className="header">
              <div className="profile">
                <span>{user.name}</span>
              </div>
            </div>

            <div className="points-section">
              <h2>Tus puntos LSG:</h2>
              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <div className="points-grid">
                <div className="point-item">Social: <span>{points.social}</span></div>
                <div className="point-item">Físico: <span>{points.fisica}</span></div>
                <div className="point-item">Afectivo: <span>{points.afectivo}</span></div>
                <div className="point-item">Mental: <span>{points.mental}</span></div>
                <div className="point-item">Lingüístico: <span>{points.linguistico}</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
