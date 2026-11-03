// Generates simple PNG app icons (dumbbell on dark background) with no dependencies.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function crc32(buf) {
  let crc = ~0
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(s, maskable) {
  const bg = [17, 24, 39]
  const fg = [163, 230, 53]
  const px = Buffer.alloc(s * (s * 3 + 1))
  const k = maskable ? 0.72 : 1
  const rects = [
    [0.18, 0.46, 0.82, 0.54],
    [0.26, 0.3, 0.34, 0.7],
    [0.66, 0.3, 0.74, 0.7],
    [0.16, 0.38, 0.24, 0.62],
    [0.76, 0.38, 0.84, 0.62],
  ].map((r) => r.map((v) => 0.5 + (v - 0.5) * k))
  for (let y = 0; y < s; y++) {
    const row = y * (s * 3 + 1)
    px[row] = 0
    for (let x = 0; x < s; x++) {
      const fx = x / s
      const fy = y / s
      const on = rects.some(([x0, y0, x1, y1]) => fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1)
      const c = on ? fg : bg
      px[row + 1 + x * 3] = c[0]
      px[row + 2 + x * 3] = c[1]
      px[row + 3 + x * 3] = c[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(s, 0)
  ihdr.writeUInt32BE(s, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(px)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', png(192, false))
writeFileSync('public/icon-512.png', png(512, false))
writeFileSync('public/icon-maskable-512.png', png(512, true))
console.log('icons written')
