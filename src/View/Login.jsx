import React, { useState } from 'react';
import axios from 'axios';
import '../styles/LoginBGamesView.css';

function Login({ setView }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('http://localhost:8080/users/login', {
        email,
        password,
      });
      if (response.status === 200) {
        setMessage(`Bienvenido, ${response.data.user?.name || 'jugador'}.`);
        setView('dashboard');
      }
    } catch (error) {
      setMessage(error.response?.data?.error || error.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginBGames-container">
      <h1>LifeSync-Games</h1>
      <p className="loginBGames-subtitle">Inicia sesión para continuar</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label>Contraseña:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

export default Login;
