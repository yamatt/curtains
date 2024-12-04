# write endpoints:

- 5833ff02-9b8b-5191-6142-22a4536ef123
- 49535343-8841-43f4-a8d4-ecbe34729bb3

# notify endpoints:

- 49535343-1e4d-4bd9-ba61-23c647249616
- 5833ff03-9b8b-5191-6142-22a4536ef123

## 5833ff03-9b8b-5191-6142-22a4536ef123

Doesn't return anything in 60 seconds

## 49535343-1e4d-4bd9-ba61-23c647249616

Returns in 10 seconds:

- Before change: `\xaa\x04\x04\x00\x00\x00\x00\xb2`
- After change: `\xaa\x04\x04\x00\x00\x00\x00\xb2`

The values are identical

- First byte is likely a header
- Second byte is a type value
- Third byte is a length of the payload
- The next set of bytes in the length is the payload
- The last byte is a checksum of sum of all bytes modulo to 256

### Got some results when listening and pressing the button a few times:

- `\xaa\x04\x04\x00\x00\x00\x00\xb2`
- `\xaa\x01\x08\x00\x00\x00\x01\x02\x0b\x00d%`
- `\xaa\x01\x08\x00\x00\x00\x01\x02\x0c\x00d&`
- `\xaa\x01\x08\x00\x00\x00\x01\x02\r\x00d\`

## Turned them on and off

I wrote `\xaa\x02\x08\x00\x00\x00\x01\x02\x0d\x00\x64` plus checksum to `49535343-8841-43f4-a8d4-ecbe34729bb3` and this turned them off

- `\xaa\x02\x01\x01\x64` turned it back on
- `\xaa\x02\x01\x00\x64` turned it off