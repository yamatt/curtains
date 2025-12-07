# Browser-Based Curtain Control

This directory contains a single page application (SPA) for controlling BLE LED curtains directly from your browser.

## Live App

**[🚀 Open the app on GitHub Pages](https://yamatt.github.io/curtains/)**

The app is automatically deployed and always up-to-date!

## How It Works

The app uses the **Web Bluetooth API** to connect directly to your BLE curtain devices from the browser. Everything runs client-side - no server needed!

## Quick Start

### Option 1: Open Directly (Recommended for localhost)
1. Build the app: `npm install && npm run build`
2. Serve locally: `python3 -m http.server 8080 --directory dist`
3. Open: `http://localhost:8080`

### Option 2: File Protocol (May have limitations)
1. Build the app: `npm install && npm run build`
2. Open `dist/index.html` directly in your browser

**Note**: Some browsers restrict Web Bluetooth API on `file://` protocol. Using localhost (Option 1) is recommended.

## Supported Browsers

- Chrome 56+
- Edge 79+
- Opera 43+

(Web Bluetooth API is not supported in Firefox or Safari)

## Usage

1. **Characteristic UUID**: The UUID field is prepopulated with the common UUID `49535343-8841-43f4-a8d4-ecbe34729bb3`. You can change it if your device uses a different UUID.

2. **Device Name (Optional)**: Leave empty to see all BLE devices, or enter a specific name (e.g., "Hello Fairy") to filter devices.

3. **Click Connect**: Browser will show a device picker with all available BLE devices (or filtered by name if specified).

4. **Control Your Curtains**:
   - Turn on/off with power buttons
   - Select preset animations (1-109)
   - Adjust brightness (0-255)
   - Pause animations

## Files

- `src/html/index.html` - UI markup and styling
- `src/js/ble.js` - Bluetooth communication and packet building
- `src/js/controls.js` - UI event handling and commands
- `src/js/index.js` - Entry point
- `dist/` - Built application (ready to use)

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# The built files will be in dist/
```

All JavaScript runs in the browser - there's no backend or server-side code needed!
