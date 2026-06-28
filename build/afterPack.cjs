// electron-builder afterPack-Hook: setzt Icon + Versions-Infos der frisch
// gepackten buffd.exe per rcedit.
//
// Warum nötig: In electron-builder.yml ist `signAndEditExecutable: false`
// gesetzt, weil das An-/Bearbeiten der exe winCodeSign herunterlädt, dessen
// 7z-Extraktion ohne Windows-Developer-Mode an macOS-Symlinks scheitert. Damit
// wird aber auch der eingebaute Schritt übersprungen, der normalerweise das
// Icon und die Versions-Ressourcen in die exe schreibt — ohne diesen Hook
// zeigte die App das Electron-Standard-Logo (Taskleiste, Desktop-Verknüpfung)
// und „Electron" als Produktname/Version.
//
// rcedit selbst braucht KEIN winCodeSign und kein Developer Mode.

const path = require('path')
// rcedit ist ein ESM-Paket mit benanntem Export -> destrukturieren.
const { rcedit } = require('rcedit')

exports.default = async function afterPack(context) {
  // Nur Windows-Pakete haben eine zu bearbeitende .exe.
  if (context.electronPlatformName !== 'win32') return

  const { productFilename, version } = context.packager.appInfo
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`)

  await rcedit(exePath, {
    icon: path.join(__dirname, 'icon.ico'),
    'file-version': version,
    'product-version': version,
    'version-string': {
      ProductName: 'buffd',
      FileDescription: 'buffd',
      CompanyName: 'buffd',
      OriginalFilename: `${productFilename}.exe`,
      InternalName: productFilename,
      LegalCopyright: `Copyright © ${new Date().getFullYear()} Johann Dreischhoff`
    }
  })

  console.log(`[afterPack] Icon & Versions-Infos in ${productFilename}.exe gesetzt`)
}
