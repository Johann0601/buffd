# buffd

**Ein zentraler Hub für deine PC-Spiele – über alle Launcher hinweg.**

buffd sammelt deine Spiele aus Steam, Epic, Battle.net & Co. an einem Ort: starten, Spielzeit verfolgen, Neuigkeiten lesen, aufräumen und organisieren – ohne ständig zwischen fünf Launchern zu wechseln. Eine Windows-Desktop-App (Electron) für den persönlichen Gebrauch.

> Interne App-ID: `com.spielehub.app` (Update-Kanal, bleibt aus Kompatibilitätsgründen unverändert). Programm, Datenordner und der angezeigte Name heißen **buffd**; ältere Installationen werden beim ersten Start automatisch von `spiele-hub` auf `buffd` migriert.

## Funktionen

- **📚 Bibliothek** – installierte Spiele und besessene, aber nicht installierte Titel (Steam-Besitzkatalog + Epic-Bibliothek). Suche, Sortierung und ein gebündelter Filter nach Plattform, Steam-Tags und eigenen Sammlungen.
- **⏱ Spielzeit-Tracking** – erkennt automatisch, welches Spiel läuft, und zählt die Spielzeit mit (zusätzlich zum von Steam übernommenen Startwert).
- **🧩 Dashboard** – anpassbare Startseite mit Widgets (Spielzeit, zuletzt gespielt, Online-Freunde, News, Spotify …) per Drag & Drop.
- **📊 Statistik** – Gesamt-Spielzeit, meistgespielte Titel und eine Aktivitäts-Heatmap.
- **📰 News-Feed** – gebündelte News und Patchnotes deiner installierten Steam-Spiele.
- **🗂 Eigene Sammlungen** – frei benennbare Kategorien (z. B. „Mit Freunden", „Zum Entspannen").
- **💾 Speicher verwalten** – Ordnergrößen aller Spiele plus Aufräum-Vorschläge (groß & lange nicht gespielt).
- **📸 Screenshots** – deine eigenen Steam-Screenshots je Spiel, mit Kopieren / im Ordner zeigen / Löschen.
- **🛒 Shops & Wunschliste** – Preisvergleich und Preisalarm (IsThereAnyDeal), Steam-Angebote, Epic-Gratis-Spiele.
- **👥 Freunde** – Steam-Freundesliste (online/im Spiel) und wer welches Spiel wie lange gespielt hat.
- **🎵 Spotify** – kleines Steuer-Widget für die laufende Musik.
- **🖥 System / Treiber** – erkannte Geräte mit Treiberversionen und Nvidia-Update-Prüfung.
- **🔄 Updates & Mods** – Update-Erkennung pro Spiel sowie Mod-Verwaltung für World of Tanks und Minecraft-Profile.
- **Auto-Update** – die App aktualisiert sich selbst über GitHub-Releases.

### Unterstützte Plattformen/Launcher

Steam, Epic Games, Battle.net, Ubisoft Connect, Riot, EA, Rockstar, RSI (Star Citizen), Xbox sowie Minecraft-Launcher (Vanilla/Mojang, Modrinth, CurseForge, FTB, Prism). Welche erkannt werden, hängt davon ab, was lokal installiert ist.

## Technik

- **[Electron](https://www.electronjs.org/)** + **[electron-vite](https://electron-vite.org/)**
- **React 18** + **TypeScript**
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** für die lokale Datenbank (Spiele, Sitzungen, Sammlungen …)
- **electron-builder** (NSIS-Installer) + **electron-updater** (Auto-Update via GitHub-Releases)

Alle Daten bleiben lokal auf dem Rechner (`%APPDATA%\buffd`; aus Altinstallationen von `%APPDATA%\spiele-hub` migriert). API-Keys und verbundene Konten werden verschlüsselt gespeichert (Windows DPAPI / `safeStorage`).

## Entwicklung

Voraussetzungen: Node.js (getestet mit Node 24) und npm. Native Module werden **nicht** neu kompiliert – es kommen vorgefertigte Prebuilds zum Einsatz (kein VC++-Build-Tooling nötig).

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # App im Entwicklungsmodus starten
npm run typecheck  # TypeScript prüfen (Main + Renderer)
npm run build      # Produktions-Build (out/)
npm run dist       # Windows-Installer bauen (release/)
npm run release    # Build + Veröffentlichung als GitHub-Release (braucht GH_TOKEN)
```

> Hinweis: `npm run dev` nicht parallel zur installierten Version laufen lassen – beide greifen sonst auf dieselbe Datenbank zu.

## Optionale Schlüssel & Konten

Manche Funktionen brauchen einen (kostenlosen) Schlüssel bzw. ein verbundenes Konto, einzutragen unter **Einstellungen → Konten**:

- **Steam-Web-API-Key** – Erfolge, Freunde, Besitzkatalog
- **SteamGridDB** – schönere Cover
- **IsThereAnyDeal** – Preisvergleich & historischer Tiefstpreis
- **Epic-Konto** – Epic-Bibliothek & Spielzeit
- **Spotify-Client-ID** – Musik-Widget (jeder hinterlegt seine eigene)

## Lizenz

MIT
