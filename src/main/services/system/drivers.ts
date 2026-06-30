import { execFile } from 'child_process'
import type { DeviceCategory, DeviceInfo } from '@shared/types'
import { getDeviceNames } from './deviceNames'

// PnP-Geräteklassen, die wir direkt aus Win32_PnPSignedDriver übernehmen.
// Maus/Tastatur, Speicher und Monitor lesen wir SEPARAT (genauere Quellen).
const CATEGORY_MAP: Record<string, DeviceCategory> = {
  DISPLAY: 'Grafikkarte',
  NET: 'Netzwerk',
  MEDIA: 'Audio',
  AUDIOENDPOINT: 'Audio',
  BLUETOOTH: 'Bluetooth',
  PROCESSOR: 'Prozessor'
}

const NOISE_NAME_PATTERNS = [
  'virtual',
  'tap-windows',
  'kernel debug',
  'wan miniport',
  'wi-fi direct',
  'personal area network',
  'loopback',
  'teredo',
  'isatap',
  '6to4',
  'openvpn data channel',
  'rfcomm',
  'enumerator',
  'generic attribute',
  'generic access',
  'attribute profile',
  'attribute service',
  'device information service',
  'bluetooth le device',
  'bluetooth le generic',
  'steam streaming',
  'audio endpoint'
]

// Monitor-Herstellercodes (EDID) -> Klartext.
const MONITOR_VENDORS: Record<string, string> = {
  SAM: 'Samsung',
  GSM: 'LG',
  DEL: 'Dell',
  ACI: 'ASUS',
  AUS: 'ASUS',
  BNQ: 'BenQ',
  ACR: 'Acer',
  HPN: 'HP',
  HWP: 'HP',
  MSI: 'MSI',
  AOC: 'AOC',
  VSC: 'ViewSonic',
  GBT: 'Gigabyte',
  NEC: 'NEC',
  PHL: 'Philips',
  LEN: 'Lenovo',
  IVM: 'iiyama'
}

// USB-Vendor-IDs -> Hersteller (für Maus/Tastatur).
const USB_VENDORS: Record<string, string> = {
  '046D': 'Logitech',
  '1532': 'Razer',
  '1B1C': 'Corsair',
  '1038': 'SteelSeries',
  '045E': 'Microsoft',
  '3434': 'Keychron',
  '0B05': 'ASUS',
  '320F': 'Wooting',
  '28DA': 'Glorious',
  '1E7D': 'ROCCAT',
  '1A2C': 'China Resource (generisch)'
}

function isNoise(nameLower: string): boolean {
  return NOISE_NAME_PATTERNS.some((p) => nameLower.includes(p))
}

/** Führt ein PowerShell-Kommando aus (UTF-8!) und parst dessen JSON-Ausgabe. */
function runPowerShellJson<T>(script: string): Promise<T[]> {
  // UTF-8-Ausgabe erzwingen, sonst werden Umlaute (ö, ä, ü) zerstört.
  const full = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ' + script
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', full],
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve([])
          return
        }
        try {
          const parsed = JSON.parse(stdout)
          resolve(Array.isArray(parsed) ? parsed : [parsed])
        } catch {
          resolve([])
        }
      }
    )
  })
}

// ---------------------------------------------------------------------------
//  Einzelquellen
// ---------------------------------------------------------------------------

interface RawDriver {
  Name: string | null
  Vendor: string | null
  Version: string | null
  Date: string | null
  Class: string | null
}

function readPnpDrivers(): Promise<RawDriver[]> {
  const script =
    'Get-CimInstance Win32_PnPSignedDriver -ErrorAction SilentlyContinue | ' +
    'Where-Object { $_.DriverVersion -and $_.DeviceName } | ' +
    'Select-Object ' +
    "@{n='Name';e={$_.DeviceName}}, " +
    "@{n='Vendor';e={ if($_.DriverProviderName){$_.DriverProviderName}else{$_.Manufacturer} }}, " +
    "@{n='Version';e={$_.DriverVersion}}, " +
    "@{n='Date';e={ if($_.DriverDate){ $_.DriverDate.ToString('yyyy-MM-dd') } else { '' } }}, " +
    "@{n='Class';e={$_.DeviceClass}} | " +
    'ConvertTo-Json -Compress'
  return runPowerShellJson<RawDriver>(script)
}

interface RawMonitor {
  Man: string | null
  Name: string | null
}

function readMonitorIds(): Promise<RawMonitor[]> {
  const script =
    "Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue | ForEach-Object { " +
    "$man = ($_.ManufacturerName | Where-Object {$_ -gt 0} | ForEach-Object {[char]$_}) -join ''; " +
    "$name = ($_.UserFriendlyName | Where-Object {$_ -gt 0} | ForEach-Object {[char]$_}) -join ''; " +
    '[PSCustomObject]@{ Man=$man; Name=$name } } | ConvertTo-Json -Compress'
  return runPowerShellJson<RawMonitor>(script)
}

interface RawPnpDevice {
  Class: string | null
  FriendlyName: string | null
  Bus: string | null // "Bus reported device description" = USB-Produktname des Geräts
  InstanceId: string | null
}

function readPnpDevices(): Promise<RawPnpDevice[]> {
  // Zusätzlich zur (oft generischen) FriendlyName lesen wir die vom Gerät selbst
  // gemeldete USB-Produktbezeichnung (BusReportedDeviceDesc). Die ist häufig der
  // echte Modellname, z. B. "Keychron V6 Max" statt "USB-Eingabegerät".
  const script =
    'Get-PnpDevice -PresentOnly -Class Mouse,Keyboard,HIDClass,USB -ErrorAction SilentlyContinue | ' +
    'ForEach-Object { ' +
    "$bus = (Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' -ErrorAction SilentlyContinue).Data; " +
    '[PSCustomObject]@{ Class=$_.Class; FriendlyName=$_.FriendlyName; Bus=$bus; InstanceId=$_.InstanceId } } | ' +
    'ConvertTo-Json -Compress'
  return runPowerShellJson<RawPnpDevice>(script)
}

interface RawDisk {
  Id: string | null
  Label: string | null
  Size: number | null
  Free: number | null
  Model: string | null
}

function readDisks(): Promise<RawDisk[]> {
  // Logische Laufwerke (C:, D: …) + physisches Modell über die CIM-Assoziation.
  const script =
    'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { ' +
    '$ld=$_; $model=""; ' +
    'try { foreach($p in @(Get-CimAssociatedInstance -InputObject $ld -ResultClassName Win32_DiskPartition -ErrorAction Stop)){ ' +
    '$dd=Get-CimAssociatedInstance -InputObject $p -ResultClassName Win32_DiskDrive -ErrorAction Stop; ' +
    'if($dd){ $model=(@($dd)[0]).Model; break } } } catch {} ' +
    '[PSCustomObject]@{ Id=$ld.DeviceID; Label=$ld.VolumeName; Size=$ld.Size; Free=$ld.FreeSpace; Model=$model } } | ' +
    'ConvertTo-Json -Compress'
  return runPowerShellJson<RawDisk>(script)
}

// ---------------------------------------------------------------------------
//  Aufbereitung
// ---------------------------------------------------------------------------

function categorizePnp(raw: RawDriver[]): DeviceInfo[] {
  const seen = new Set<string>()
  const devices: DeviceInfo[] = []
  for (const r of raw) {
    const cls = (r.Class ?? '').toUpperCase()
    const category = CATEGORY_MAP[cls]
    if (!category) continue

    const name = (r.Name ?? '').trim()
    const vendor = (r.Vendor ?? '').trim() || 'Unbekannt'
    const driverVersion = (r.Version ?? '').trim()
    if (!name || !driverVersion) continue
    if (isNoise(name.toLowerCase())) continue

    const key = `${cls}|${name}|${driverVersion}`
    if (seen.has(key)) continue
    seen.add(key)

    const isNvidiaGpu = category === 'Grafikkarte' && /nvidia/i.test(`${name} ${vendor}`)
    devices.push({
      id: `pnp:${category}:${name}`,
      category,
      name,
      defaultName: name,
      vendor,
      driverVersion,
      driverDate: (r.Date ?? '').trim() || null,
      isNvidiaGpu
    })
  }
  return devices
}

const GENERIC_PERIPHERAL =
  /hid|usb-eingabe|usb input|usb receiver|eingabeger|standard|composite|verbund|systemcontroller|benutzersteuer|vom hersteller|virtual|\broot\b|\bhub\b/i

// Hersteller, die (fast) nur Tastaturen bauen — entscheidet bei Geräten,
// die sich als Maus UND Tastatur melden, die richtige Kategorie.
const KEYBOARD_VENDOR_IDS = new Set(['3434', '320F', '04D9', '0C45'])

function parseVidPid(instanceId: string): { vid: string; pid: string } | null {
  const m = /VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(instanceId)
  return m ? { vid: m[1].toUpperCase(), pid: m[2].toUpperCase() } : null
}

/**
 * Maus + Tastatur: EIN Eintrag pro physischem Gerät (USB VID:PID).
 *
 * Hintergrund: Ein einziges Gerät meldet bei Windows oft mehrere Geräteklassen —
 * eine Tastatur meldet ihre Medientasten als "Maus", ein Funk-Maus-Receiver
 * zusätzlich eine "Tastatur". Naiv gelistet erscheinen so 5–6 Einträge für
 * real 2 Geräte. Darum: nach VID:PID gruppieren und die Kategorie entscheiden.
 */
function buildPeripherals(raw: RawPnpDevice[]): DeviceInfo[] {
  interface Agg {
    vid: string
    pid: string
    classes: Set<string> // 'mouse' / 'keyboard'
    busModel?: string // vom Gerät gemeldeter USB-Produktname, z. B. "Keychron V6 Max"
    fnModel?: string // bester nicht-generischer FriendlyName, z. B. "LIGHTSPEED Receiver"
    virtual: boolean // G HUB Virtual Keyboard & Co. -> komplett ausblenden
  }

  // 1) Alle PnP-Einträge je physischem Gerät (VID:PID) einsammeln.
  const byDevice = new Map<string, Agg>()
  const withoutId: { cls: string; name: string }[] = [] // z. B. reine Bluetooth-Geräte

  for (const d of raw) {
    const fn = (d.FriendlyName ?? '').trim()
    const bus = (d.Bus ?? '').trim()
    const cls = (d.Class ?? '').toLowerCase()
    const vp = parseVidPid(d.InstanceId ?? '')

    if (!vp) {
      if ((cls === 'mouse' || cls === 'keyboard') && fn && !/virtual/i.test(fn)) {
        withoutId.push({ cls, name: fn })
      }
      continue
    }

    const key = `${vp.vid}:${vp.pid}`
    const agg =
      byDevice.get(key) ?? { vid: vp.vid, pid: vp.pid, classes: new Set<string>(), virtual: false }
    if (cls === 'mouse' || cls === 'keyboard') agg.classes.add(cls)
    if (fn) {
      if (/virtual/i.test(fn)) agg.virtual = true
      else if (!agg.fnModel && !GENERIC_PERIPHERAL.test(fn)) agg.fnModel = fn
    }
    // Der bus-reported Name ist der vom Gerät selbst gemeldete Produktname und
    // damit der zuverlässigste Modellname -> bevorzugt vor dem FriendlyName.
    if (bus && !agg.busModel && !GENERIC_PERIPHERAL.test(bus)) agg.busModel = bus
    byDevice.set(key, agg)
  }

  // 2) Pro physischem Gerät genau einen Eintrag erzeugen.
  const result: DeviceInfo[] = []
  for (const agg of byDevice.values()) {
    if (agg.virtual || agg.classes.size === 0) continue

    const vendor = USB_VENDORS[agg.vid] ?? `USB ${agg.vid}`
    const model = agg.busModel ?? agg.fnModel
    const modelLc = (model ?? '').toLowerCase()

    // Kategorie bestimmen — Reihenfolge nach Verlässlichkeit:
    let category: DeviceCategory
    if (KEYBOARD_VENDOR_IDS.has(agg.vid)) {
      // Reiner Tastatur-Hersteller (z. B. Keychron) -> NIE als Maus zeigen, auch
      // wenn das Gerät (nur) eine Maus-HID-Collection für Medientasten meldet.
      category = 'Tastatur'
    } else if (/receiver|mouse|maus/.test(modelLc)) {
      category = 'Maus' // z. B. Logitech LIGHTSPEED Receiver (Funk-Maus)
    } else if (/keyboard|tastatur/.test(modelLc)) {
      category = 'Tastatur'
    } else if (agg.classes.size === 1) {
      category = agg.classes.has('mouse') ? 'Maus' : 'Tastatur'
    } else {
      category = 'Tastatur'
    }

    // Hersteller nicht doppeln, falls der Modellname ihn schon enthält
    // (z. B. "Keychron V6 Max" -> nicht "Keychron Keychron V6 Max").
    const name = model
      ? model.toLowerCase().startsWith(vendor.toLowerCase())
        ? model
        : `${vendor} ${model}`
      : `${vendor} ${category}`
    result.push({
      id: `dev:${agg.vid}:${agg.pid}`,
      category,
      name,
      defaultName: name,
      vendor,
      driverVersion: '',
      driverDate: null,
      isNvidiaGpu: false
    })
  }

  // 3) Geräte ohne USB-ID (Bluetooth) einzeln übernehmen, dedupliziert.
  const seen = new Set<string>()
  for (const e of withoutId) {
    const category: DeviceCategory = e.cls === 'mouse' ? 'Maus' : 'Tastatur'
    const key = `${category}|${e.name}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({
      id: `dev:bt:${category}:${e.name}`,
      category,
      name: e.name,
      defaultName: e.name,
      vendor: 'Bluetooth',
      driverVersion: '',
      driverDate: null,
      isNvidiaGpu: false
    })
  }

  return result
}

function buildMonitors(raw: RawMonitor[], driverVersion: string): DeviceInfo[] {
  return raw
    .map((m) => {
      const code = (m.Man ?? '').trim().toUpperCase()
      const model = (m.Name ?? '').trim()
      const vendor = MONITOR_VENDORS[code] ?? code ?? 'Unbekannt'
      const name = model || `${vendor} Monitor`
      return {
        id: `mon:${code || vendor}:${name}`,
        category: 'Monitor' as DeviceCategory,
        name,
        defaultName: name,
        vendor: vendor || 'Unbekannt',
        driverVersion,
        driverDate: null,
        isNvidiaGpu: false
      }
    })
    .filter((d) => d.name)
}

function buildStorage(raw: RawDisk[]): DeviceInfo[] {
  return raw
    .filter((d) => d.Id && d.Size)
    .map((d) => {
      const label = (d.Label ?? '').trim()
      const id = (d.Id ?? '').trim()
      const name = label ? `${label} (${id})` : `Laufwerk ${id}`
      return {
        id: `disk:${id}`,
        category: 'Speicher' as DeviceCategory,
        name,
        defaultName: name,
        vendor: (d.Model ?? '').trim() || 'Datenträger',
        driverVersion: '',
        driverDate: null,
        isNvidiaGpu: false,
        storage: { totalBytes: Number(d.Size) || 0, freeBytes: Number(d.Free) || 0 }
      }
    })
}

/** Vom Nutzer vergebene eigene Namen anwenden (überschreibt nur `name`). */
function applyCustomNames(devices: DeviceInfo[]): DeviceInfo[] {
  const custom = getDeviceNames()
  for (const d of devices) {
    const c = custom[d.id]
    if (c && c.trim()) d.name = c.trim()
  }
  return devices
}

function sortDevices(devices: DeviceInfo[]): DeviceInfo[] {
  const order: DeviceCategory[] = [
    'Grafikkarte',
    'Prozessor',
    'Monitor',
    'Maus',
    'Tastatur',
    'Audio',
    'Netzwerk',
    'Bluetooth',
    'Speicher'
  ]
  return devices.sort((a, b) => {
    const ci = order.indexOf(a.category) - order.indexOf(b.category)
    return ci !== 0 ? ci : a.name.localeCompare(b.name)
  })
}

/** Liest alle Geräte + Treiber aus mehreren, je passenden Quellen. */
export async function readDevices(): Promise<DeviceInfo[]> {
  const [raw, monitorsRaw, pnpDevices, disks] = await Promise.all([
    readPnpDrivers(),
    readMonitorIds(),
    readPnpDevices(),
    readDisks()
  ])

  const monitorDriverVersion =
    raw.find((r) => (r.Class ?? '').toUpperCase() === 'MONITOR')?.Version?.trim() || '—'

  return applyCustomNames(
    sortDevices([
      ...categorizePnp(raw),
      ...buildPeripherals(pnpDevices),
      ...buildMonitors(monitorsRaw, monitorDriverVersion),
      ...buildStorage(disks)
    ])
  )
}
