import React from "react";
import "../styles/Sidebar.css";

function Sidebar({ setCurrentView }) {
  return (
    <div className="sidebar">
      <div className="logo">
        <span className="sidebar-title">LifeSync-Games</span>
      </div>
      <button className="button" onClick={() => setCurrentView("lichess")}>
        Lichess
      </button>
      <button className="button" onClick={() => setCurrentView("chesscom")}>
        Chess.com
      </button>
      <button className="button" onClick={() => setCurrentView("htb")}>
        HTB Academy
      </button>
    </div>
  );
}

export default Sidebar;
