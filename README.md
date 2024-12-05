# curtains

This is a Python library and CLI to control BLE LED curtains.

You can also control the curtains from your browser.

## Usage

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
