
# SquidCloud Desktop Application

This is the Electron desktop application for SquidCloud.

## Installation

To install dependencies and set up the application:

```bash
# Navigate to the electron directory
cd electron

# Install dependencies (use npm instead of bun for native modules)
npm install --force
```

## Development

To run the app in development mode:

```bash
npm run start
```

## Building

To build the application:

```bash
# First build the React app
cd ..
npm run build

# Then build the Electron app
cd electron
npm run build
```

## Troubleshooting

If you encounter issues with native dependencies:

1. Make sure you're using npm instead of bun in the electron directory
2. Try running `npm run postinstall` to rebuild native dependencies
3. Delete the node_modules directory and reinstall
