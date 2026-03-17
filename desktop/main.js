const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');

let mainWindow;
let apiProcess;
let workerProcess;

// Définition des chemins de base
const projectRoot = isDev 
  ? path.join(__dirname, '..') 
  : process.resourcesPath;

const backendDir = path.join(projectRoot, 'backend');
const workerDir = path.join(projectRoot, 'worker');
const sessionFile = path.join(workerDir, 'session.json');

const distPath = isDev
  ? path.join(__dirname, '../frontend/dist/index.html')
  : path.join(process.resourcesPath, 'frontend/dist/index.html');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.resolve(__dirname, 'preload.js')
    },
    title: "Vinted Sniper - Standalone",
    backgroundColor: '#0f172a'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      console.log('Serveur Vite non trouvé, chargement du build local...');
      mainWindow.loadFile(distPath);
    });
  } else {
    mainWindow.loadFile(distPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  console.log('🚀 Démarrage du Backend...');
  const apiScript = path.join(backendDir, 'src/index.js');
  
  apiProcess = spawn('node', [apiScript], {
    env: { ...process.env, PORT: 3001, NODE_ENV: 'production' }
  });

  apiProcess.stdout.on('data', (data) => console.log(`[Backend]: ${data}`));
  apiProcess.stderr.on('data', (data) => console.error(`[Backend ERROR]: ${data}`));
}

function startWorker() {
  console.log('🚀 Démarrage du Worker...');
  const workerScript = path.join(workerDir, 'main.py');
  
  const pythonPath = process.platform === 'win32' 
    ? path.join(workerDir, 'venv/Scripts/python.exe')
    : path.join(workerDir, 'venv/bin/python');
  
  workerProcess = spawn(pythonPath, [workerScript], {
    env: { 
      ...process.env, 
      API_URL: 'http://localhost:3001', 
      PYTHONUNBUFFERED: '1',
      PYTHONUTF8: '1'
    }
  });

  workerProcess.stdout.on('data', (data) => console.log(`[Worker]: ${data}`));
  workerProcess.stderr.on('data', (data) => console.error(`[Worker ERROR]: ${data}`));
}

function checkAndSetupDependencies() {
  return new Promise((resolve) => {
    const venvPath = path.join(workerDir, process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python3');
    
    if (fs.existsSync(venvPath)) {
      return resolve();
    }

    console.log("🚀 Première installation détectée, lancement du setup automatique...");
    
    const setupScript = process.platform === 'win32' 
      ? path.join(projectRoot, 'setup_windows.bat')
      : path.join(projectRoot, 'setup_mac.sh');

    if (!fs.existsSync(setupScript)) {
      console.error("❌ Script de setup introuvable:", setupScript);
      return resolve();
    }

    const setup = process.platform === 'win32'
      ? spawn('cmd.exe', ['/c', setupScript], { cwd: projectRoot })
      : spawn('bash', [setupScript], { cwd: projectRoot });

    setup.stdout.on('data', (data) => console.log(`[Setup]: ${data}`));
    setup.stderr.on('data', (data) => console.error(`[Setup Error]: ${data}`));

    setup.on('close', (code) => {
      console.log(`✅ Setup terminé avec le code ${code}`);
      resolve();
    });
  });
}

async function startApp() {
  await checkAndSetupDependencies();
  startBackend();
  startWorker();
  createWindow();
}

app.on('ready', startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (apiProcess) apiProcess.kill();
  if (workerProcess) workerProcess.kill();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Gestionnaire pour la connexion Vinted
ipcMain.on('vinted-login', () => {
  const loginWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: "Connexion à Vinted",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  loginWindow.loadURL('https://www.vinted.fr/member/signup/select_type?intent=login');

  // On surveille les cookies pour capturer la session
  const filter = { urls: ['*://*.vinted.fr/*', '*://*.vinted.com/*'] };
  
  const checkCookies = () => {
    session.defaultSession.cookies.get({ domain: '.vinted.fr' })
      .then((cookies) => {
        const sessionCookie = cookies.find(c => c.name === 'v_sess');
        if (sessionCookie) {
          console.log('✅ Session Vinted capturée !');
          
          // Formater les cookies pour Playwright
          const playwrightCookies = cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            expires: c.expirationDate,
            httpOnly: c.httpOnly,
            secure: c.secure,
            sameSite: 'None'
          }));

          fs.writeFileSync(sessionFile, JSON.stringify(playwrightCookies, null, 2));
          
          // Notifier le frontend
          mainWindow.webContents.send('login-success', true);
          
          // Fermer la fenêtre de login après un court délai
          setTimeout(() => {
            if (!loginWindow.isDestroyed()) loginWindow.close();
            // Optionnel : redémarrer le worker pour prendre en compte la session
            if (workerProcess) workerProcess.kill();
            startWorker();
          }, 2000);
        }
      })
      .catch((error) => {
        console.error('Erreur cookies:', error);
      });
  };

  loginWindow.webContents.on('did-navigate', checkCookies);
  loginWindow.webContents.on('did-frame-finish-load', checkCookies);
});
