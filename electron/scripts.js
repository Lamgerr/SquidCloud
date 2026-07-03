
// This file contains the scripts to be added to package.json
// Copy these scripts to your package.json file:
/*
"electron:start": "concurrently \"cross-env BROWSER=none npm run dev\" \"wait-on http://localhost:8080 && electron electron/main.js\"",
"electron:build": "cross-env ELECTRON_BUILD=true npm run build && electron-builder build --win --publish never",
"electron:package": "cross-env ELECTRON_BUILD=true npm run build && electron-builder build --win --publish never --config electron-builder.yml",
"electron:debug": "cross-env ELECTRON_BUILD=true npm run build && electron electron/main.js"
*/

// Note: Make sure you have these dependencies installed:
// concurrently, cross-env, wait-on, electron, electron-builder

// Steps to build and run:
// 1. Add the above scripts to your package.json
// 2. For development: npm run electron:start
// 3. For testing build locally: npm run electron:debug
// 4. For packaging: npm run electron:package
