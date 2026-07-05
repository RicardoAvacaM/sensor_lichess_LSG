import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/LichessView.css';

const API = 'http://localhost:8080/users';
const SYNC_INTERVAL_MS = 3 * 60 * 1000;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL');
}

function LichessView() {
  const [message, setMessage] = useState('');
  const [hasPlayer, setHasPlayer] = useState(false);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(null);
  const [transferMessage, setTransferMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const userRes = await axios.get(`${API}/all`);
      if (userRes.status === 201 && userRes.data[0]?.lichess_username) {
        setHasPlayer(true);
        setUsername(userRes.data[0].lichess_username);
      }

      const statusRes = await axios.get(`${API}/lichess/status`);
      if (statusRes.status === 200) {
        setStatus(statusRes.data.data);
        if (statusRes.data.data?.message) {
          setMessage(statusRes.data.data.message);
        }
      }
    } catch (error) {
      if (error.response?.status !== 400) {
        setMessage('Error al obtener estado del sensor.');
      }
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleLinkToken = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/lichess/link`, { token });
      if (response.status === 200) {
        setMessage(`Lichess conectado: ${response.data.username}`);
        setHasPlayer(true);
        setUsername(response.data.username);
        setToken('');
        fetchStatus();
      }
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  };

  const handleTransfer = async () => {
    setTransferMessage('');
    setTransferring(true);
    try {
      const response = await axios.post(`${API}/lichess/transfer`);
      if (response.status === 200) {
        const amount = response.data.data?.amount ?? 0;
        setTransferMessage(`${amount} puntos enviados a tu perfil LSG.`);
        setMessage(`${amount} puntos Mental acreditados en tu perfil.`);
        await fetchStatus();
      }
    } catch (error) {
      setTransferMessage(error.response?.data?.error || error.message);
    } finally {
      setTransferring(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const response = await axios.get(`${API}/lichess/poll`);
      const points = response.data.data?.points ?? 0;
      if (points > 0) {
        setMessage(`+${points} pts acumulados. Canjea para enviarlos a tu perfil.`);
      } else {
        setMessage('Sin avance nuevo desde la última sincronización.');
      }
      await fetchStatus();
    } catch (error) {
      setMessage('Error al sincronizar: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const accumulatedPoints = status?.accumulatedPoints ?? 0;

  const sections = status?.sections?.length
    ? status.sections
    : (status?.scoringRules || []).map((rule) => ({
        id: rule.id,
        label: rule.label,
        count: 0,
        pointsPerUnit: rule.pointsPerUnit,
        points: 0,
        cap: rule.cap,
      }));

  return (
    <div className="login-container lichess-view">
      {hasPlayer ? (
        <div className="lichess-dashboard">
          <header className="lichess-header">
            <h1>Sensor Lichess</h1>
            <p className="lichess-user">
              Cuenta: <strong>{username}</strong>
            </p>
            <p className="lichess-sync-note">
              Sincronización automática cada 3 minutos
              {status?.lastSyncAt && (
                <> · Última: {formatDate(status.lastSyncAt)}</>
              )}
            </p>
            <button
              type="button"
              className="lichess-sync-btn"
              onClick={handleSyncNow}
              disabled={syncing}
            >
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora (debug)'}
            </button>
          </header>

          <section className="lichess-balance">
            <h2>Saldo Mental (LSG)</h2>
            <p className="lichess-balance-value">
              {status?.mentalBalance ?? 0} <span>pts</span>
            </p>
            {accumulatedPoints > 0 && (
              <p className="lichess-last-cycle">
                Pendiente de enviar: {accumulatedPoints} pts
                {status.lastCyclePoints > 0 && (
                  <> · Último ciclo: +{status.lastCyclePoints} pts</>
                )}
              </p>
            )}
          </section>

          <section className="lichess-sections">
            <h2>Actividad detectada</h2>
            <p className="lichess-sections-hint">
              Los contadores se acumulan al sincronizar. Pulsa Canjear para enviarlos a tu perfil LSG.
              {status?.unsupportedLearn?.length > 0 && (
                <> No disponible vía API: {status.unsupportedLearn.join(', ')}.</>
              )}
            </p>
            <ul className="lichess-section-list">
              {sections.map((section) => (
                <li key={section.id} className="lichess-section-item">
                  <div className="lichess-section-main">
                    <span className="lichess-section-label">{section.label}</span>
                    {section.count != null && (
                      <span className="lichess-section-count">{section.count}</span>
                    )}
                  </div>
                  <div className="lichess-section-points">
                    <span className="lichess-section-rate">
                      +{section.pointsPerUnit} pts
                      {section.cap ? ` (máx. ${section.cap}/ciclo)` : ''}
                    </span>
                    <span className="lichess-section-earned">
                      {section.points > 0 ? `+${section.points} pts` : '0 pts'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="lichess-redeem">
            <h2>Canjear</h2>
            <p className="lichess-redeem-hint">
              Envía los puntos acumulados a tu perfil LSG (dimensión Mental).
            </p>
            <p className="lichess-redeem-pending">
              {accumulatedPoints > 0
                ? `${accumulatedPoints} pts listos para enviar`
                : 'No hay puntos acumulados. Juega en Lichess y sincroniza.'}
            </p>
            <button
              type="button"
              className="lichess-redeem-btn"
              onClick={handleTransfer}
              disabled={transferring || accumulatedPoints <= 0}
            >
              {transferring
                ? 'Enviando…'
                : `Canjear ${accumulatedPoints > 0 ? accumulatedPoints : ''} pts al perfil`}
            </button>
            {transferMessage && <p className="lichess-redeem-message">{transferMessage}</p>}
          </section>

          {message && <p className="lichess-message">{message}</p>}
        </div>
      ) : (
        <div className="login-form">
          <h1>Conectar Lichess</h1>
          <p className="lichess-hint">
            Genera un token personal en{' '}
            <a href="https://lichess.org/account/oauth/token" target="_blank" rel="noreferrer">
              lichess.org/account/oauth/token
            </a>
            {' '}(scopes: preference:read, puzzle:read) y pégalo aquí.
          </p>
          <form onSubmit={handleLinkToken}>
            <label>Personal Access Token:</label>
            <input
              type="password"
              placeholder="lip_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <button type="submit">Conectar</button>
          </form>
          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  );
}

export default LichessView;
