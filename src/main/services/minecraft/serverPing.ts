import net from 'net'
import type { McServerInfo, McServerStatus } from '@shared/types'

/**
 * Stufe 1: Fragt Minecraft-Server per "Server List Ping" (SLP) ab — genau das
 * Protokoll, das auch der Minecraft-Client für die Server-Liste nutzt.
 * KEIN API-Key, KEIN Account nötig. Liefert Spielerzahl, MOTD, Version,
 * Server-Icon und gemessenen Ping.
 *
 * Protokoll-Doku: https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping
 */

/** Server, die im Server-Tab der Minecraft-Seite angezeigt werden. */
export const MC_SERVERS: McServerInfo[] = [
  { id: 'hypixel', label: 'Hypixel Network', host: 'mc.hypixel.net', port: 25565 }
]

const PING_TIMEOUT_MS = 6000

// --- Minecraft-Protokoll: VarInt + String ---

function encodeVarInt(value: number): Buffer {
  const bytes: number[] = []
  let v = value >>> 0 // als unsigned behandeln (deckt auch -1 ab)
  do {
    let temp = v & 0x7f
    v >>>= 7
    if (v !== 0) temp |= 0x80
    bytes.push(temp)
  } while (v !== 0)
  return Buffer.from(bytes)
}

function encodeString(str: string): Buffer {
  const b = Buffer.from(str, 'utf8')
  return Buffer.concat([encodeVarInt(b.length), b])
}

/** VarInt ab offset lesen. null, wenn der Puffer noch nicht genug Bytes hat. */
function readVarInt(buf: Buffer, offset: number): { value: number; size: number } | null {
  let value = 0
  let size = 0
  let byte: number
  do {
    if (offset + size >= buf.length) return null // Daten noch unvollständig
    byte = buf[offset + size]
    value |= (byte & 0x7f) << (7 * size)
    size++
    if (size > 5) throw new Error('VarInt zu lang')
  } while ((byte & 0x80) !== 0)
  return { value: value >>> 0, size }
}

/** Hängt eine VarInt-Längenangabe vor die zusammengesetzten Daten (= ein Paket). */
function framePacket(...parts: Buffer[]): Buffer {
  const data = Buffer.concat(parts)
  return Buffer.concat([encodeVarInt(data.length), data])
}

// --- MOTD-Aufbereitung (kann String oder verschachtelte Chat-Komponente sein) ---

function flattenMotd(desc: unknown): string {
  if (desc == null) return ''
  if (typeof desc === 'string') return desc
  if (Array.isArray(desc)) return desc.map(flattenMotd).join('')
  if (typeof desc === 'object') {
    const o = desc as { text?: unknown; extra?: unknown }
    let s = typeof o.text === 'string' ? o.text : ''
    if (Array.isArray(o.extra)) s += o.extra.map(flattenMotd).join('')
    return s
  }
  return ''
}

/** Entfernt §-Farbcodes und normalisiert Whitespace/Zeilen. */
function cleanMotd(desc: unknown): string {
  return flattenMotd(desc)
    .replace(/§./g, '') // §x Formatierungscodes
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

// --- Ein Server abfragen ---

function pingServer(server: McServerInfo): Promise<McServerStatus> {
  return new Promise((resolve) => {
    const base: McServerStatus = {
      id: server.id,
      label: server.label,
      host: server.host,
      port: server.port,
      online: false,
      playersOnline: null,
      playersMax: null,
      motd: null,
      version: null,
      pingMs: null,
      faviconDataUrl: null
    }

    let settled = false
    const finish = (patch: Partial<McServerStatus>): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve({ ...base, ...patch })
    }

    const socket = net.createConnection({ host: server.host, port: server.port })
    socket.setTimeout(PING_TIMEOUT_MS)
    const timer = setTimeout(() => finish({ error: 'Zeitüberschreitung' }), PING_TIMEOUT_MS)

    let started = 0
    let incoming = Buffer.alloc(0)

    socket.on('connect', () => {
      const handshake = framePacket(
        encodeVarInt(0x00), // Packet-ID: Handshake
        encodeVarInt(-1), // Protokollversion (für Status egal)
        encodeString(server.host),
        Buffer.from([(server.port >> 8) & 0xff, server.port & 0xff]), // Port (unsigned short, big-endian)
        encodeVarInt(0x01) // nächster Zustand: Status
      )
      const statusRequest = framePacket(encodeVarInt(0x00)) // Packet-ID: Status Request
      started = Date.now()
      socket.write(Buffer.concat([handshake, statusRequest]))
    })

    socket.on('data', (chunk) => {
      incoming = Buffer.concat([incoming, chunk])
      try {
        const lenHeader = readVarInt(incoming, 0)
        if (!lenHeader) return // Paketlänge noch unvollständig
        const total = lenHeader.size + lenHeader.value
        if (incoming.length < total) return // Paket noch nicht komplett angekommen

        let off = lenHeader.size
        const pid = readVarInt(incoming, off)
        if (!pid) return
        off += pid.size
        const jsonLen = readVarInt(incoming, off)
        if (!jsonLen) return
        off += jsonLen.size
        const json = incoming.slice(off, off + jsonLen.value).toString('utf8')
        const data = JSON.parse(json)

        finish({
          online: true,
          pingMs: Date.now() - started,
          playersOnline: typeof data?.players?.online === 'number' ? data.players.online : null,
          playersMax: typeof data?.players?.max === 'number' ? data.players.max : null,
          motd: cleanMotd(data?.description) || null,
          version: typeof data?.version?.name === 'string' ? data.version.name : null,
          faviconDataUrl:
            typeof data?.favicon === 'string' && data.favicon.startsWith('data:')
              ? data.favicon
              : null
        })
      } catch {
        finish({ error: 'Ungültige Antwort' })
      }
    })

    socket.on('timeout', () => finish({ error: 'Zeitüberschreitung' }))
    socket.on('error', (err) => finish({ error: err.message }))
    socket.on('close', () => finish({ error: 'Verbindung getrennt' }))
  })
}

/** Fragt alle konfigurierten Server parallel ab. */
export async function listMcServerStatus(): Promise<McServerStatus[]> {
  return Promise.all(MC_SERVERS.map(pingServer))
}
