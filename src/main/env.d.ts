// Typen für die zur Build-Zeit injizierten Umgebungsvariablen (aus .env).
// electron-vite stellt MAIN_VITE_*-Variablen im Main-Prozess über
// import.meta.env bereit.
interface ImportMetaEnv {
  readonly MAIN_VITE_SGDB_KEY?: string
  readonly MAIN_VITE_ITAD_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
