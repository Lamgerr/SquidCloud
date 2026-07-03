
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Electron dependencies installation...');

try {
  // Force npm to install dependencies instead of bun
  console.log('Installing dependencies with npm...');
  
  // Use --no-git, --prefer-offline and --force options to avoid git clone issues
  execSync('npm install --no-package-lock --no-git --prefer-offline --force', { 
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  console.log('Electron dependencies installed successfully!');
} catch (error) {
  console.error('Error installing Electron dependencies:', error.message);
  process.exit(1);
}
