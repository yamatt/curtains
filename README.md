# curtains

This is a Python library and CLI to control BLE LED curtains.

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

### Change preset

```bash
rye run curtains write FF:44:10:22:75:68 49535343-8841-43f4-a8d4-ecbe34729bb3 PRESET 0201030d
```
