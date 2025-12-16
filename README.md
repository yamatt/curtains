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

1. **Characteristic UUID**: The UUID field is prepopulated with the common UUID `49535343-8841-43f4-a8d4-ecbe34729bb3`. You can change it if your device uses a different UUID.

2. **Device Name Prefix (Optional)**: Leave empty to see all BLE devices, or enter a name prefix (e.g., "Hello Fairy") to filter devices. This will match any device whose name starts with the specified text, so "Hello Fairy" will match "Hello Fairy-7df1", "Hello Fairy-a2b3", etc.

3. **Connect**: Click "Connect" to open the browser's device picker showing all available BLE devices (or filtered by name prefix if specified).

4. **Power Control**: Use the On/Off buttons to turn the curtain lights on or off.

5. **Animated Presets**: Select a preset number (1-109) and adjust the brightness slider (0-255). Click "Apply Preset" or simply change the sliders to apply immediately when connected.

6. **Pause Animation**: Click "Pause Animation" to pause the current effect.

**Note**: The Web Bluetooth API is supported in Chrome, Edge, and Opera browsers. It requires a secure context (HTTPS or localhost).

### GitHub Pages Deployment

The app is automatically built and deployed to GitHub Pages when changes are pushed to the `main` branch. The workflow:
- Installs dependencies with `npm install`
- Builds the app with `npm run build`
- Deploys the `dist/` folder to GitHub Pages

No server-side code is needed - everything runs entirely in your browser!

## Python CLI Usage

### Debug

You can turn on debugging messages by setting the environment variable `LOG_LEVEL` to `DEBUG`.

```sh
LOG_LEVEL=DEBUG uv run curtains FF:44:10:22:75:68 --char-uuid 49535343-8841-43f4-a8d4-ecbe34729bb3 write 030701000003E803E8
```

### Setup

```bash
uv sync
```

### Look for devices

```bash
uv run curtains scan
```

Get the device address of the ones called _Hello Fairy_.

Mine is `FF:44:10:22:75:68`.

### List services

This lists UUIDs, Characteristics and Properties of a specific device.

```bash
uv run curtains FF:44:10:22:75:68 connect
```

### Turn curtains on and off

On:

```bash
uv run curtains FF:44:10:22:75:68 on
```

Off:

```bash
uv run curtains FF:44:10:22:75:68 off
```

### Change Colour

Use the `write` command to send raw payloads. Device address goes first; `--char-uuid` may be omitted (defaults to the common control UUID).

**Red**:

```sh
uv run curtains FF:44:10:22:75:68 write 030701000003E803E8
```

**White**:

```sh
uv run curtains FF:44:10:22:75:68 write 0307010000000003E8
```

### Change preset

```bash
uv run curtains FF:44:10:22:75:68 preset 2 --brightness 255 --speed 10
```

Where `2` is the preset animation type from 1 to 109. `--brightness` is brightness level from 0 (low brightness, but not off) to 255 (high brightness). The optional `--speed` parameter controls animation speed from 0 (slow) to 10 (fast), with a default of 10.

### Pixel operations

Use the `pixel` command with subcommands: `single`, `clear`, `fill`, `draw`.

Set single LED at coordinates (x,y) to a named color:

```sh
uv run curtains FF:44:10:22:75:68 pixel single 10 10 red
```

Clear LEDs (controller-dependent):

```sh
uv run curtains FF:44:10:22:75:68 pixel clear
```

Fill starting from an offset:

```sh
uv run curtains FF:44:10:22:75:68 pixel fill blue --offset 0
```

Enter drawing mode:

```sh
uv run curtains FF:44:10:22:75:68 pixel draw
```