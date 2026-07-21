//------ Para exportar la aplicacion des-comente el siguiente bloque de código de codigo, de lo contrario funcionara en modo desarrollo ------//
/*
import { app, BrowserWindow, Tray, Menu } from 'electron';
import { fork } from 'child_process';
import path from 'path';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;
let backendProcess;
let tray;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Sensor LifeSync-Games',
        resizable: false,
        maximizable: false,
        icon: join(__dirname, 'icono.ico'), // Ahora sí puedes usar 'join'
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(__dirname, 'preload.cjs'),
        },
    });

    //mainWindow.loadURL('http://localhost:6969');

    // Oculta la ventana en vez de cerrarla
    mainWindow.on('close', (e) => {
        e.preventDefault();
        mainWindow.hide();
    });

    // Levantar el backend como un proceso hijo
    const backendPath = path.join(__dirname, '../server.js');
    backendProcess = fork(backendPath);

    backendProcess.on('error', (error) => {
        console.error('Error en el backend:', error.message);
    });

    backendProcess.on('message', (msg) => {
        if (msg === 'backend-ready') {
            // Cargar el frontend empaquetado por Vite
            const viteDistPath = path.join(__dirname, '../dist/index.html');
            mainWindow.loadFile(viteDistPath);
        }
    });

    // Cerrar backend al cerrar la aplicación
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (backendProcess) {
            backendProcess.kill();
        }
    });
}

app.on('ready', () => { 
    createWindow();

    tray = new Tray(join(__dirname, 'icono.ico'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => mainWindow.show() },
        {
            label: 'Close', click: () => {
                tray.destroy();
                app.quit();
            }
        }
    ]);
    tray.setToolTip('Sensor LifeSync-Games');
    tray.setContextMenu(contextMenu);

    app.setLoginItemSettings({
        openAtLogin: false,
    });
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

//------ Para exportar la aplicacion des-comente el bloque de código de arriba -----//
*/ 

//------ Bloque de codigo para ejecutar la aplicacion en modo desarrollo ------//
import { app, BrowserWindow, Tray, Menu, ipcMain, session, net } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HTB_ACADEMY_PARTITION = 'persist:htb-academy';
const HTB_ACADEMY_URL = 'https://academy.hackthebox.com';
const HTB_LOGIN_START_URL = `${HTB_ACADEMY_URL}/sso/redirect?redirect=${encodeURIComponent('/app/dashboard')}`;

const HTB_SESSION_COOKIE_NAMES = new Set(['htb_academy_session', 'academy_session']);

/** Solo borra cookies de sesión Academy; conserva localStorage (device ID de HTB Account). */
async function clearPreviousAcademySession(academySession) {
    const cookies = await academySession.cookies.get({});
    for (const cookie of cookies) {
        if (!HTB_SESSION_COOKIE_NAMES.has(cookie.name)) continue;
        const host = (cookie.domain || '').startsWith('.')
            ? cookie.domain.slice(1)
            : cookie.domain || 'academy.hackthebox.com';
        const url = `https://${host}${cookie.path || '/'}`;
        try {
            await academySession.cookies.remove(url, cookie.name);
        } catch {
            // ignorar
        }
    }
}

async function buildAcademyCookieHeader(academySession) {
    const byUrl = await academySession.cookies.get({ url: HTB_ACADEMY_URL });
    const all = await academySession.cookies.get({});
    const merged = new Map();
    for (const cookie of [...byUrl, ...all]) {
        const domain = String(cookie.domain || '');
        if (
            domain.includes('academy.hackthebox.com') ||
            domain === '.hackthebox.com' ||
            domain === 'hackthebox.com'
        ) {
            merged.set(cookie.name, cookie);
        }
    }
    const cookies = [...merged.values()];
    const sessionCookie = cookies.find((c) => HTB_SESSION_COOKIE_NAMES.has(c.name));
    if (!sessionCookie?.value) return null;
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

function readCookieValue(cookieHeader, name) {
    const match = String(cookieHeader).match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

function isModulesPayload(body) {
    return (
        Array.isArray(body) ||
        Array.isArray(body?.data) ||
        Array.isArray(body?.modules) ||
        Array.isArray(body?.data?.data) ||
        Array.isArray(body?.data?.modules)
    );
}

async function verifyAcademySessionWithNet(cookieHeader) {
    try {
        const headers = {
            Cookie: cookieHeader,
            Accept: 'application/json, text/plain, */*',
            Referer: `${HTB_ACADEMY_URL}/app/dashboard`,
            Origin: HTB_ACADEMY_URL,
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        const xsrf = readCookieValue(cookieHeader, 'XSRF-TOKEN');
        if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

        const response = await net.fetch(`${HTB_ACADEMY_URL}/api/v2/modules`, { headers });
        if (!response.ok) return false;
        const body = await response.json();
        return isModulesPayload(body);
    } catch {
        return false;
    }
}

/** Verifica con las cookies reales del navegador embebido (más fiable que net.fetch). */
async function verifyAcademySessionInWindow(loginWindow) {
    if (loginWindow.isDestroyed()) return false;
    const url = loginWindow.webContents.getURL() || '';
    if (!url.includes('academy.hackthebox.com')) return false;

    try {
        return await loginWindow.webContents.executeJavaScript(
            `(() => fetch('/api/v2/modules', {
                credentials: 'include',
                headers: {
                    Accept: 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(async (r) => {
                if (!r.ok) return false;
                const body = await r.json().catch(() => null);
                return Array.isArray(body)
                    || Array.isArray(body?.data)
                    || Array.isArray(body?.modules)
                    || Array.isArray(body?.data?.data)
                    || Array.isArray(body?.data?.modules);
            })
            .catch(() => false))()`,
            true
        );
    } catch {
        return false;
    }
}

function registerHtbLoginHandler() {
    ipcMain.handle('htb:open-login', async () => {
        const academySession = session.fromPartition(HTB_ACADEMY_PARTITION);

        await clearPreviousAcademySession(academySession);

        return new Promise((resolve) => {
            const loginWindow = new BrowserWindow({
                width: 960,
                height: 720,
                title: 'Iniciar sesión — HTB Academy',
                autoHideMenuBar: true,
                webPreferences: {
                    partition: HTB_ACADEMY_PARTITION,
                    contextIsolation: true,
                    nodeIntegration: false,
                },
            });

            let resolved = false;
            let finishTimer = null;
            let pollTimer = null;
            let cookieListener = null;
            let capturing = false;

            const cleanup = () => {
                if (finishTimer) clearTimeout(finishTimer);
                if (pollTimer) clearInterval(pollTimer);
                if (cookieListener) {
                    academySession.cookies.removeListener('changed', cookieListener);
                    cookieListener = null;
                }
            };

            const finishOk = (cookieHeader) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                if (!loginWindow.isDestroyed()) loginWindow.close();
                resolve({ ok: true, session: cookieHeader });
            };

            const tryCaptureSession = async () => {
                if (resolved || capturing || loginWindow.isDestroyed()) return;
                capturing = true;

                try {
                    const cookieHeader = await buildAcademyCookieHeader(academySession);
                    if (!cookieHeader) return;

                    const currentUrl = loginWindow.webContents.getURL() || '';
                    const onAcademyApp =
                        currentUrl.includes('/app/') || currentUrl.includes('/dashboard');

                    // Preferir verificación dentro de la ventana (usa cookies del partition).
                    let valid = await verifyAcademySessionInWindow(loginWindow);
                    if (!valid) {
                        valid = await verifyAcademySessionWithNet(cookieHeader);
                    }

                    // Si ya hay cookie de sesión y el usuario está en el app, aceptar
                    // aunque la API tarde un poco en responder JSON.
                    if (!valid && onAcademyApp) {
                        await new Promise((r) => setTimeout(r, 1500));
                        if (resolved || loginWindow.isDestroyed()) return;
                        valid =
                            (await verifyAcademySessionInWindow(loginWindow)) ||
                            (await verifyAcademySessionWithNet(cookieHeader));
                    }

                    if (!valid) return;
                    finishOk(cookieHeader);
                } catch (error) {
                    console.warn('[HTB login] captura fallida:', error?.message || error);
                } finally {
                    capturing = false;
                }
            };

            const scheduleCapture = (delayMs = 800) => {
                if (finishTimer) clearTimeout(finishTimer);
                finishTimer = setTimeout(tryCaptureSession, delayMs);
            };

            cookieListener = (event, cookie, cause, removed) => {
                if (removed) return;
                if (
                    HTB_SESSION_COOKIE_NAMES.has(cookie.name) ||
                    cookie.name === 'XSRF-TOKEN'
                ) {
                    scheduleCapture(1200);
                }
            };
            academySession.cookies.on('changed', cookieListener);

            loginWindow.webContents.on('did-finish-load', () => scheduleCapture(1000));
            loginWindow.webContents.on('did-navigate', () => scheduleCapture(1000));
            loginWindow.webContents.on('did-navigate-in-page', () => scheduleCapture(1000));
            loginWindow.webContents.on('did-redirect-navigation', () => scheduleCapture(1200));

            // Reintento periódico por si HTB setea la cookie sin disparar navegación.
            pollTimer = setInterval(() => {
                if (!resolved && !loginWindow.isDestroyed()) {
                    tryCaptureSession();
                }
            }, 2500);

            loginWindow.on('closed', () => {
                cleanup();
                if (!resolved) {
                    resolved = true;
                    resolve({ ok: false, error: 'Ventana cerrada sin completar el inicio de sesión.' });
                }
            });

            loginWindow.loadURL(HTB_LOGIN_START_URL);
        });
    });
}

let mainWindow;
let tray;

const DEV_URL = 'http://localhost:6969';

async function loadDevUrlWithRetry(window, url = DEV_URL, maxAttempts = 30, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await window.loadURL(url);
            return;
        } catch (error) {
            const refused = String(error?.message || error).includes('ERR_CONNECTION_REFUSED');
            if (!refused || attempt === maxAttempts) {
                console.error(`No se pudo cargar ${url}:`, error.message || error);
                throw error;
            }
            console.log(`Esperando Vite en ${url} (intento ${attempt}/${maxAttempts})…`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Sensor LifeSync-Games',
        resizable: false,
        maximizable: false,
        icon: join(__dirname, 'icono.ico'),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(__dirname, 'preload.cjs'),
        },
    });

    loadDevUrlWithRetry(mainWindow).catch(() => {
        console.error(
            'Inicia el frontend con "npm run dev" o usa "npm start" para levantar todo junto.'
        );
    });

    // Oculta la ventana en vez de cerrarla
    mainWindow.on('close', (e) => {
        e.preventDefault();
        mainWindow.hide();
    });
}

app.on('ready', () => {
    registerHtbLoginHandler();
    createWindow();

    tray = new Tray(join(__dirname, 'icono.ico'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Mostrar', click: () => mainWindow.show() },
        { label: 'Salir', click: () => {
            tray.destroy();
            app.quit();
        } }
    ]);
    tray.setToolTip('Mi App en Segundo Plano');
    tray.setContextMenu(contextMenu);

    app.setLoginItemSettings({
        openAtLogin: true,
    });
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});