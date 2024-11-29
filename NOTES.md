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

- `\xaa` is likely a header
- `\x04` is likely a length
- `\xb2` is likely a checksum

### Got some results when listening and pressing the button a few times:

- `\xaa\x04\x04\x00\x00\x00\x00\xb2`
- `\xaa\x01\x08\x00\x00\x00\x01\x02\x0b\x00d%`
- `\xaa\x01\x08\x00\x00\x00\x01\x02\x0c\x00d&`
- `\xaa\x01\x08\x00\x00\x00\x01\x02\r\x00d\`
