const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  console.log('Creating main window');
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icons/icon.ico')
  });

  // Load the app
  let startUrl;
  
  if (process.env.ELECTRON_START_URL) {
    // Dev mode - load from dev server
    startUrl = process.env.ELECTRON_START_URL;
    console.log('Loading from dev server:', startUrl);
  } else {
    // Production mode - load from built files
    let indexPath;
    
    if (app.isPackaged) {
      indexPath = path.join(process.resourcesPath, 'app/dist/index.html');
    } else {
      indexPath = path.join(__dirname, '../dist/index.html');
    }
    
    console.log('Attempting to load from:', indexPath);
    
    // Check if the file exists
    if (fs.existsSync(indexPath)) {
      console.log('✅ Found index.html at:', indexPath);
      startUrl = url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true
      });
    } else {
      console.error('❌ Index file not found at:', indexPath);
      console.log('Current directory:', __dirname);
      console.log('Files in parent directory:', fs.readdirSync(path.join(__dirname, '..')));
      
      // Show error dialog if index.html doesn't exist
      dialog.showErrorBox('Application Error', 
        `Could not find index.html at ${indexPath}. The application may not be built correctly.`);
      app.quit();
      return;
    }
  }
  
  // Load the URL
  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl)
    .then(() => {
      console.log('Successfully loaded the application');
    })
    .catch(err => {
      console.error('Failed to load URL:', err);
      dialog.showErrorBox('Application Error', 
        `Failed to load the application: ${err.message}`);
    });

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Set up the application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click() {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Developer',
      submenu: [
        { 
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click() {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About SquidCloud',
          click() {
            dialog.showMessageBox(mainWindow, {
              title: 'About SquidCloud',
              message: 'SquidCloud v1.0.0',
              detail: 'Cloud storage and file management application\nCopyright © 2025 '
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log('Electron app is ready');
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  // On macOS it is common for applications to stay open until the user quits
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // On macOS it's common to re-create a window when the dock icon is clicked
  if (mainWindow === null) createWindow();
});

// Set up IPC handlers
ipcMain.on('toMain', (event, data) => {
  console.log('Received IPC message:', data);
  // Handle messages from renderer process
});
