import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/HtbAcademyView.css';

const API = 'http://localhost:8080/users';
const SYNC_INTERVAL_MS = 3 * 60 * 1000;

function hasEmbeddedLogin() {
  return typeof window !== 'undefined' && typeof window.electronAPI?.openHtbAcademyLogin === 'function';
}

function isElectronShell() {
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL');
}

function HtbAcademyView() {
  const [message, setMessage] = useState('');
  const [hasPlayer, setHasPlayer] = useState(false);
  const [status, setStatus] = useState(null);
  const [transferMessage, setTransferMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [manualSession, setManualSession] = useState('');
  const [embeddedLogin, setEmbeddedLogin] = useState(hasEmbeddedLogin);

  useEffect(() => {
    setEmbeddedLogin(hasEmbeddedLogin());
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const checkRes = await axios.get(`${API}/check-htb-user`);
      if (checkRes.data?.userCreated) {
        setHasPlayer(true);
      }

      const statusRes = await axios.get(`${API}/htb/status`);
      if (statusRes.status === 200) {
        setStatus(statusRes.data.data);
        if (statusRes.data.data?.message) {
          setMessage(statusRes.data.data.message);
        }
      }
    } catch (error) {
      if (error.response?.status !== 400) {
        setMessage('Error al obtener estado del sensor HTB.');
      } else if (!hasPlayer) {
        setHasPlayer(false);
      }
    }
  }, [hasPlayer]);

  useEffect(() => {
    axios.get(`${API}/check-htb-user`).then((res) => {
      if (res.data?.userCreated) setHasPlayer(true);
    }).catch(() => {});
    fetchStatus();
    const interval = setInterval(fetchStatus, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const linkSession = async (session) => {
    try {
      const response = await axios.post(`${API}/htb/link`, { session });
      if (response.status === 200) {
        setHasPlayer(true);
        setMessage(
          `HTB Academy conectado. ${response.data.modulesTracked ?? 0} módulos con progreso.`
        );
        setManualSession('');
        await fetchStatus();
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      setMessage(msg);
      throw error;
    }
  };

  const handleEmbeddedLogin = async () => {
    if (!embeddedLogin) {
      if (isElectronShell()) {
        setMessage('No se cargó el módulo de Electron. Cierra la app y ejecuta "npm start" de nuevo.');
      } else {
        setMessage(
          'Abre la app desde la ventana de Electron (npm start), no desde el navegador en localhost:6969.'
        );
      }
      return;
    }
    setLoggingIn(true);
    setMessage('Abre la ventana, inicia sesión en HTB y espera: la cookie se capturará sola al volver al dashboard.');
    try {
      const result = await window.electronAPI.openHtbAcademyLogin();
      if (result?.ok && result.session) {
        setMessage('Sesión capturada. Vinculando con el sensor…');
        await linkSession(result.session);
      } else {
        setMessage(result?.error || 'No se pudo obtener la sesión de Academy.');
      }
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleManualLink = async (e) => {
    e.preventDefault();
    try {
      await linkSession(manualSession.trim());
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  };

  const handleTransfer = async () => {
    setTransferMessage('');
    setTransferring(true);
    try {
      const response = await axios.post(`${API}/htb/transfer`);
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
      const response = await axios.get(`${API}/htb/poll`);
      const points = response.data.data?.points ?? 0;
      if (points > 0) {
        setMessage(`+${points} pts acumulados por avance en módulos. Canjea para enviarlos.`);
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

  const displayModules = status?.modules?.length
    ? status.modules
    : (status?.sections || []).map((s) => ({
        id: s.moduleId || s.id,
        name: s.label,
        progress: s.lastProgress ?? s.count ?? 0,
        completed: s.completed,
        difficulty: s.difficulty,
        tier: s.tier,
      }));

  const scoringRules = status?.scoringRules || [];

  return (
    <div className="login-container lichess-view htb-view">
      {hasPlayer && !status?.sessionExpired ? (
        <div className="lichess-dashboard">
          <header className="lichess-header">
            <h1>Sensor HTB Academy</h1>
            <p className="lichess-user">
              {status?.modulesInProgress != null && (
                <>
                  En progreso: <strong>{status.modulesInProgress}</strong>
                  {' · '}
                  Completados: <strong>{status.modulesCompleted ?? 0}</strong>
                </>
              )}
            </p>
            <p className="lichess-sync-note">
              Sincronización automática cada 3 minutos
              {status?.lastSyncAt && <> · Última: {formatDate(status.lastSyncAt)}</>}
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
                {status?.lastCyclePoints > 0 && (
                  <> · Último ciclo: +{status.lastCyclePoints} pts</>
                )}
              </p>
            )}
          </section>

          <section className="lichess-sections">
            <h2>Módulos con progreso</h2>
            <p className="htb-scoring-hint">
              Ganas +{scoringRules.find((r) => r.id === 'progressPercent')?.pointsPerUnit ?? 2} pts
              por cada 1% de avance y +{scoringRules.find((r) => r.id === 'moduleCompleted')?.pointsPerUnit ?? 30} pts
              al completar un módulo.
            </p>
            <ul className="lichess-section-list">
              {displayModules.length === 0 ? (
                <li className="lichess-section-item">
                  <span className="lichess-section-label">
                    Sin módulos desbloqueados con progreso. Empieza un módulo en Academy.
                  </span>
                </li>
              ) : (
                displayModules.map((mod) => {
                  const section = (status?.sections || []).find(
                    (s) => String(s.moduleId) === String(mod.id) || s.id === `module-${mod.id}`
                  );
                  return (
                    <li key={mod.id} className="lichess-section-item">
                      <div className="lichess-section-main">
                        <span className="lichess-section-label">{mod.name}</span>
                        <span className="lichess-section-count">{mod.progress}%</span>
                      </div>
                      {(mod.difficulty || mod.tier) && (
                        <p className="htb-module-meta">
                          {[mod.difficulty, mod.tier].filter(Boolean).join(' · ')}
                          {mod.completed ? ' · Completado' : ''}
                        </p>
                      )}
                      <div className="htb-progress-bar-wrap">
                        <div
                          className="htb-progress-bar"
                          style={{ width: `${Math.min(100, mod.progress)}%` }}
                        />
                      </div>
                      {section?.points > 0 && (
                        <div className="lichess-section-points">
                          <span className="lichess-section-earned">+{section.points} pts acumulados</span>
                        </div>
                      )}
                    </li>
                  );
                })
              )}
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
                : 'No hay puntos acumulados. Avanza en módulos Academy y sincroniza.'}
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
          <h1>Conectar HTB Academy</h1>
          {status?.sessionExpired && (
            <p className="htb-expired-banner">
              Tu sesión expiró. Inicia sesión de nuevo para seguir sincronizando.
            </p>
          )}
          <p className="lichess-hint">
            Pulsa el botón, inicia sesión en la ventana de HTB Academy y vuelve al dashboard.
            El sensor captura la cookie automáticamente y consulta tu avance en módulos.
          </p>
          <p className="lichess-hint htb-electron-hint">
            Primero inicia sesión en LSG (pantalla principal). Luego vincula HTB Academy aquí.
          </p>

          <div className="htb-login-actions">
            <button
              type="button"
              className="htb-login-btn"
              onClick={handleEmbeddedLogin}
              disabled={loggingIn}
            >
              {loggingIn ? 'Esperando inicio de sesión…' : 'Iniciar sesión en HTB Academy'}
            </button>

            {!embeddedLogin && (
              <p className="lichess-hint htb-electron-hint">
                {isElectronShell()
                  ? 'Reinicia la aplicación con npm start si el botón no abre el login.'
                  : 'Usa la ventana de Electron (npm start). Si abres localhost:6969 en Chrome, solo verás la opción manual.'}
              </p>
            )}

            <details className="htb-manual-cookie">
              <summary>Vincular cookie manualmente (avanzado)</summary>
              <form onSubmit={handleManualLink}>
                <label>htb_academy_session:</label>
                <input
                  type="password"
                  placeholder="Valor de la cookie…"
                  value={manualSession}
                  onChange={(e) => setManualSession(e.target.value)}
                />
                <button type="submit" disabled={!manualSession.trim()}>
                  Vincular cookie
                </button>
              </form>
            </details>
          </div>

          {message && <p>{message}</p>}
        </div>
      )}
    </div>
  );
}

export default HtbAcademyView;
