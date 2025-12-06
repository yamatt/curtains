# curtains

This is a Python library and CLI to control BLE LED curtains.

You can also control the curtains from your browser using a single page app.

## Browser App Usage

The browser app is a standalone single page application that works entirely in the browser using the Web Bluetooth API. No server required!

### Live Demo

The app is automatically deployed to GitHub Pages: **[Open Curtain Control App](https://yamatt.github.io/curtains/)**

Simply open the link in a supported browser (Chrome, Edge, or Opera) and start controlling your curtains!

### Local Development

1. Build the browser app:
```bash
npm install
npm run build
```

2. Open the app locally:
```bash
python3 -m http.server 8080 --directory dist
```
Then open `http://localhost:8080` in your browser.

### Using the App

1. **Connect**: Enter the Characteristic UUID (e.g., `49535343-8841-43f4-a8d4-ecbe34729bb3`) and click "Connect" to select your "Hello Fairy" BLE device.

2. **Power Control**: Use the On/Off buttons to turn the curtain lights on or off.

3. **Animated Presets**: Select a preset number (1-109) and adjust the brightness slider (0-255), then click "Apply Preset".

4. **Pause Animation**: Click "Pause Animation" to pause the current effect.

**Note**: The Web Bluetooth API is supported in Chrome, Edge, and Opera browsers. It requires a secure context (HTTPS or localhost).

### GitHub Pages Deployment

The app is automatically built and deployed to GitHub Pages when changes are pushed to the `main` branch. The workflow:
- Installs dependencies with `npm install`
- Builds the app with `npm run build`
- Deploys the `dist/` folder to GitHub Pages

No server-side code is needed - everything runs entirely in your browser!

## Python CLI Usage

### Setup

```bash
rye sync
```

### Look for devices

```bash
rye run curtains scan
```

Get the device address of the ones called _Hello Fairy_.

Mine is `FF:44:10:22:75:68`.

### List services

This lists UUIDs, Characteristics and Properties of specific device.

```bash
rye run curtains connect FF:44:10:22:75:68
```

### Turn curtains on and off

On:

```bash
rye run curtains on FF:44:10:22:75:68 49535343-8841-43f4-a8d4-ecbe34729bb3
```

Off:

```bash
rye run curtains off FF:44:10:22:75:68 49535343-8841-43f4-a8d4-ecbe34729bb3
```

### Change preset

```bash
rye run curtains preset FF:44:10:22:75:68 49535343-8841-43f4-a8d4-ecbe34729bb3 2 --brightness 0
```

Where `2` is the preset animation type from 1 to 109. And `--brightness` is brightness level from 0 (low brightness, but not off) to 255 (high brightness).
