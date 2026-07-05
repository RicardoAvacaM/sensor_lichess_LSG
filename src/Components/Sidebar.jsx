import React from "react";
import "../styles/Sidebar.css";

function Sidebar({ setCurrentView }) {
  return (
    <div className="sidebar">
      <div className="logo">
        <span className="sidebar-title">LSG Sensor</span>
      </div>
      <button className="button" onClick={() => setCurrentView("lichess")}>
        Lichess
      </button>
    </div>
  );
}

export default Sidebar;
