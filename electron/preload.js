
const { contextBridge, ipcRenderer } = require('electron');

// Log when preload script is executed
console.log('Preload script running');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    // whitelist channels
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Add diagnostics information
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  console.log('Electron version:', process.versions.electron);
  console.log('Chrome version:', process.versions.chrome);
  console.log('Node version:', process.versions.node);
  
  // Display diagnostics on page
  const diagnosticsDiv = document.createElement('div');
  diagnosticsDiv.style.position = 'fixed';
  diagnosticsDiv.style.bottom = '10px';
  diagnosticsDiv.style.right = '10px';
  diagnosticsDiv.style.background = 'rgba(0,0,0,0.7)';
  diagnosticsDiv.style.color = 'white';
  diagnosticsDiv.style.padding = '10px';
  diagnosticsDiv.style.borderRadius = '5px';
  diagnosticsDiv.style.zIndex = '9999';
  diagnosticsDiv.style.fontSize = '12px';
  diagnosticsDiv.innerHTML = `
    <h4 style="margin-top: 0">Electron Diagnostics</h4>
    <p style="margin: 5px 0">App loaded successfully at ${new Date().toLocaleTimeString()}</p>
    <p style="margin: 5px 0">Electron: ${process.versions.electron || 'unknown'}</p>
    <p style="margin: 5px 0">Chrome: ${process.versions.chrome || 'unknown'}</p>
    <p style="margin: 5px 0">Node: ${process.versions.node || 'unknown'}</p>
    <p style="margin: 5px 0">Platform: ${process.platform}</p>
  `;
  
  // Append to document body if it exists
  setTimeout(() => {
    if (document.body) {
      document.body.appendChild(diagnosticsDiv);
      console.log('Diagnostic overlay added to the page');
    } else {
      console.error('Document body not found - cannot add diagnostics');
    }
  }, 1000);
});
