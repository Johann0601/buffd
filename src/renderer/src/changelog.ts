// Versions-Historie der App. Bei JEDEM Release kommt der neueste Eintrag
// NACH OBEN — diese Datei wird mit ausgeliefert, jede Version kennt also
// ihre eigene Geschichte.

export type ChangelogEntry = {
  version: string
  date: string // ISO, z. B. '2026-06-11'
  title: string
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.21.6',
    date: '2026-06-16',
    title: 'Shops umgebaut: gemeinsame Suche & Preisvergleich',
    changes: [
      'Die beiden Knöpfe „Epic Games" und „Steam" oben in den Shops sind weg — stattdessen gibt es eine gemeinsame Suchleiste, die Steam und Epic gleichzeitig durchsucht.',
      'In der Suche kannst du filtern: nur in einem Shop suchen (Steam/Epic/beide), nur Angebote, nur Gratis-Spiele und per Schieberegler (0 bis 80+ €) einen Höchstpreis festlegen.',
      'Findet die App ein Spiel in beiden Shops, zeigt sie den günstigeren Preis an (mit Hinweis, was es im anderen Shop kostet).',
      'Leeres Suchfeld + „Suchen" zeigt die aktuellen Steam-Angebote zum Stöbern — zusammen mit den Filtern (z. B. „Nur Angebote" oder Höchstpreis) bekommst du so schnell viele passende Spiele.',
      'Die Wunschliste klappt jetzt als Popup direkt unter dem Knopf aus (wie das Spotify-Widget) und listet alle Spiele mit Preis — inklusive Preisvergleich zwischen Steam und Epic.',
      'Neuer Knopf „Zurücksetzen" leert Suche und Filter wieder komplett.',
      'Die Epic-Leiste heißt jetzt „Angebote bei Epic" und ist mit reduzierten Epic-Spielen gefüllt — die Gratisspiele stehen weiterhin am Anfang (auf der Startseite und in den Shops). Dazu kommen wie gehabt die Steam-Angebote.'
    ]
  },
  {
    version: '0.21.5',
    date: '2026-06-16',
    title: 'Feedback-Funktion & Update-Knöpfe',
    changes: [
      'Neuer Bereich „Feedback" in der Seitenleiste: Bug melden oder Vorschlag schicken (Art wählen, Text, optional ein Anhang bis 8 MB wie ein Screenshot). App- und Windows-Version werden automatisch mitgeschickt.',
      'Neuer Knopf „Nach Updates suchen" in den Einstellungen (Bereich App) — prüft sofort und zeigt an, wann zuletzt geprüft wurde.',
      'Der „Aktualisieren"-Knopf bei den Benachrichtigungen prüft jetzt auch sofort auf neue App-Versionen.',
      'Beim Deinstallieren gibt es jetzt ein optionales Häkchen, um die eigenen buffd-Daten (Spielzeit & Einstellungen) gleich mitzulöschen.'
    ]
  },
  {
    version: '0.21.4',
    date: '2026-06-16',
    title: 'Launcher-Filter, gemeinsame Suche & schnellerer Update-Check',
    changes: [
      'In der Bibliothek kannst du auf einen Launcher klicken: Er wird hervorgehoben und die Liste zeigt nur noch Spiele dieser Plattform. Erneut klicken hebt den Filter wieder auf.',
      'Suche und Filter gelten jetzt für installierte UND nicht installierte Spiele gemeinsam — die separate Such-/Plattform-Leiste der „Nicht installiert"-Sektion entfällt.',
      'Die Suche nach App-Updates beim Start läuft jetzt von Anfang an im Hintergrund, sodass ein verfügbares Update früher bereitsteht.'
    ]
  },
  {
    version: '0.21.3',
    date: '2026-06-16',
    title: 'Startseite: „Zuletzt gespielt"-Karussell',
    changes: [
      'Das „Zuletzt gespielt"-Widget wurde durch ein seitlich scrollbares Karussell auf der Startseite ersetzt (wie die Angebote darunter) — mit Cover, Spielname und Spielzeit.',
      'Auf jedem Cover erscheint beim Drüberfahren ein Play-Knopf, mit dem du das Spiel direkt starten kannst.',
      'Zurück-Knopf merkt sich die Herkunft: Von der Startseite ins Detail gewechselt → „Zurück" führt zur Startseite; aus der Bibliothek → zurück in die Bibliothek.'
    ]
  },
  {
    version: '0.21.2',
    date: '2026-06-15',
    title: 'Ein-/Ausklapp-Knopf der Seitenleiste verbessert',
    changes: [
      'Der Knopf zum Ein- und Ausklappen der Seitenleiste sitzt jetzt als kleiner Griff mittig am rechten Rand der Leiste (auf der Trennlinie) statt oben — er liegt nicht mehr über den Navigations-Punkten.',
      'Neue, klarere Pfeil-Symbole (Chevron) und ein etwas größerer Griff.'
    ]
  },
  {
    version: '0.21.1',
    date: '2026-06-15',
    title: 'Größeres Fenster & einklappbare Seitenleiste',
    changes: [
      'Das Fenster startet jetzt größer (passt sich an deinen Bildschirm an).',
      'Die Seitenleiste lässt sich mit dem Knopf oben links fest ein- und ausklappen. Sie klappt nicht mehr von selbst beim Drüberfahren auf — nur noch der Knopf steuert das. Der Zustand wird gemerkt.'
    ]
  },
  {
    version: '0.21.0',
    date: '2026-06-15',
    title: 'Neue Icons in der ganzen App',
    changes: [
      'Die Emojis in der gesamten Oberfläche wurden durch einheitliche, schlanke Icons (Lucide) ersetzt — Seitenleiste, Knöpfe, Überschriften, Karten und Statusanzeigen. Die Icons passen sich automatisch an Hell- und Dunkel-Modus an.',
      'Kleinigkeit: In der Bibliothek steht oben jetzt „Bibliothek" statt „buffd".'
    ]
  },
  {
    version: '0.20.1',
    date: '2026-06-15',
    title: 'Update-Quelle umgestellt',
    changes: [
      'Intern: Das Projekt-Repository heißt jetzt „buffd". Ab dieser Version sucht die App ihre Updates direkt dort — keine Umleitung mehr nötig.'
    ]
  },
  {
    version: '0.20.0',
    date: '2026-06-15',
    title: 'buffd deinstallieren',
    changes: [
      'Neuer Bereich „App" in den Einstellungen mit einem Knopf zum Deinstallieren von buffd (mit Sicherheits-Rückfrage). Deine Spiele und Launcher bleiben dabei unberührt.'
    ]
  },
  {
    version: '0.19.0',
    date: '2026-06-15',
    title: 'Eigene Sammlungen & gebündelter Filter',
    changes: [
      'Du kannst jetzt eigene Sammlungen/Kategorien anlegen (z. B. „Mit Freunden", „Zum Entspannen") und Spiele frei zuordnen. Verwalten (anlegen/umbenennen/löschen) über den Knopf „📁 Sammlungen".',
      'In der Detailansicht eines Spiels lassen sich Sammlungen per Klick an-/abwählen — und mit „+ Neu" direkt eine neue Sammlung mit diesem Spiel erstellen.',
      'Neuer gebündelter „⚙ Filter"-Knopf in der Bibliothek: Plattform, Steam-Tags und Sammlungen sind jetzt in einem aufklappbaren Panel zusammengefasst (statt mehrerer einzelner Auswahlfelder). Der Knopf zeigt die Anzahl aktiver Filter und bietet „Alle Filter zurücksetzen".'
    ]
  },
  {
    version: '0.18.0',
    date: '2026-06-15',
    title: 'Speicher verwalten & eigene Screenshots',
    changes: [
      'Neuer Bereich „💾 Speicher verwalten" unter Einstellungen: zeigt alle installierten Spiele nach Größe sortiert mit der gesamten belegten Speichermenge.',
      'Ganz oben gibt es jetzt hervorgehobene Aufräum-Vorschläge — große Spiele (über 10 GB), die du seit über 3 Monaten nicht mehr gespielt hast, lassen sich dort direkt deinstallieren. Angezeigt wird auch, wie viel Speicher das insgesamt freigeben würde.',
      'Die Speicherplatz-Analyse wurde aus „System / Treiber" herausgelöst; diese Seite konzentriert sich nun auf Hardware und Treiber.',
      'In der Detailansicht eines Steam-Spiels werden jetzt deine eigenen, selbst aufgenommenen Screenshots angezeigt (aus Steam) — als Galerie, mit Klick für die Großansicht.',
      'In der Großansicht eines eigenen Screenshots kannst du ihn jetzt verwalten: 📋 in die Zwischenablage kopieren (z. B. zum Einfügen in Discord/Chat), 📂 im Datei-Explorer anzeigen oder 🗑 löschen (landet im Papierkorb, ist also umkehrbar).'
    ]
  },
  {
    version: '0.17.0',
    date: '2026-06-15',
    title: 'Anpassbares Startseiten-Dashboard',
    changes: [
      'Die Startseite hat jetzt ein anpassbares Dashboard: Mit „✏️ Anpassen" kannst du Widgets per Drag & Drop umsortieren sowie hinzufügen oder entfernen. Deine Anordnung wird gespeichert; „↺ Zurücksetzen" stellt die Standard-Belegung wieder her.',
      'Verfügbare Widgets: Spiele, Mods, Spielzeit (Zeitraum 14/30/365 Tage umschaltbar), Online-Freunde, Zuletzt gespielt, News und 🎵 Spotify.',
      'Neues 🎵 Spotify-Widget: zeigt den laufenden Song mit Cover und erlaubt Zurück/Play-Pause/Weiter (Steuern erfordert Spotify Premium).',
      'Die Widgets füllen jede Reihe gleichmäßig aus (keine halben Reihen mehr); das News-Widget ist doppelt so breit für bessere Lesbarkeit.',
      'Kleinerer Fix: Die Unter-Tabs der Bibliothek (Spiele · Updates · Mods) sitzen jetzt immer mittig statt zu verrutschen.'
    ]
  },
  {
    version: '0.16.0',
    date: '2026-06-15',
    title: 'News-Feed & aufgeräumte Seitenleiste',
    changes: [
      'Neuer Bereich „📰 News": die neuesten News und Patchnotes all deiner installierten Steam-Spiele gebündelt in einem Feed, nach Datum sortiert. Klick öffnet den vollständigen Beitrag im Browser.',
      'Eine Vorschau der neuesten Neuigkeiten erscheint jetzt auch direkt auf der Startseite.',
      'Aufgeräumte Seitenleiste: „Spiele" heißt nun „📚 Bibliothek" und enthält die früheren Tabs Updates und Mods als Unter-Tabs (Spiele · Updates · Mods) — weniger Einträge, alles an einem Ort.'
    ]
  },
  {
    version: '0.15.0',
    date: '2026-06-14',
    title: 'Statistik-Seite & Tracking-Fix',
    changes: [
      'Neuer Bereich „📊 Statistik": Gesamt-Spielzeit, letzte 7 und 30 Tage sowie Anzahl gespielter/ungespielter Spiele auf einen Blick.',
      'Aktivitäts-Heatmap (letzte 16 Wochen) zeigt, wann und wie viel du gespielt hast — im GitHub-Stil.',
      'Liste der meistgespielten Spiele mit Balken und eine Auswertung, an welchen Wochentagen du am meisten spielst.',
      'Wichtiger Fix beim Spielzeit-Tracking: Hintergrund-/Launcher-Prozesse (z. B. das Wargaming Game Center bei World of Tanks) lösten fälschlich Mini-Sitzungen aus — das ist behoben. Zudem werden laufende Sitzungen jetzt beim Schließen der App sauber gespeichert, statt verloren zu gehen.',
      'Bessere Tag-Erkennung für den Tag-Filter auf der Spiele-Seite: Marken-Symbole im Namen werden ignoriert und bekannte, von Steam abgemeldete Titel (z. B. Rocket League) bekommen ihre Tags trotzdem.'
    ]
  },
  {
    version: '0.14.0',
    date: '2026-06-14',
    title: 'Freunde (Steam)',
    changes: [
      'Neuer Bereich „👥 Freunde": zeigt deine Steam-Freunde mit Online-Status und dem Spiel, das sie gerade spielen.',
      'Ein Klick auf einen Freund öffnet (sofern öffentlich) seine Bibliothek mit den meistgespielten Spielen und Spielzeiten.',
      'Auf der Spiel-Detailseite gibt es jetzt „Freunde mit diesem Spiel" (direkt unter den Knöpfen, bei vielen Freunden mehrspaltig) — wer es besitzt und wie viel Zeit er darin verbracht hat.',
      'Neuer Knopf „⚙ Verwalten" auf der Detailseite: öffnet ein Fenster, über das du den Installationsordner im Explorer öffnen oder das Spiel deinstallieren kannst.',
      'Spiele ohne Steam-Cover werden in der Freundes-Bibliothek nun mit ihrem Namen statt einem kaputten Bild angezeigt.',
      'Alles nur lesend über die offizielle Steam-Web-API — sichtbar ist ausschließlich, was jeder Freund über seine eigenen Steam-Privatsphäre-Einstellungen freigibt. Braucht den (kostenlosen) Steam-Web-API-Key.'
    ]
  },
  {
    version: '0.13.1',
    date: '2026-06-14',
    title: 'Update-Hinweis als Pop-up',
    changes: [
      'Sobald beim Start ein App-Update heruntergeladen wurde, erscheint jetzt ein Pop-up mit einem direkten „Jetzt neu starten & aktualisieren"-Knopf.',
      'Mit „Später" verschwindet es und bleibt wie gewohnt in der 🔔-Glocke verfügbar.'
    ]
  },
  {
    version: '0.13.0',
    date: '2026-06-14',
    title: 'Erste-Schritte-Begrüßung',
    changes: [
      'Beim allerersten Start begrüßt dich jetzt ein kurzes Pop-up und bietet an, den (optionalen) Steam-Web-API-Key einzugeben — für Erfolge und den vollständigen Besitz-Katalog.',
      'Alles überspringbar: Mit „Überspringen" geht es sofort los, und Schlüssel/Konten lassen sich jederzeit später unter Einstellungen → Konten nachtragen.'
    ]
  },
  {
    version: '0.12.1',
    date: '2026-06-14',
    title: 'Preisvergleich eingebaut',
    changes: [
      'Bestpreis über alle Shops und historischer Tiefstpreis sind jetzt direkt eingebaut (IsThereAnyDeal) — auf den Spiel-Detailseiten sichtbar, ohne dass jemand einen eigenen Key braucht.'
    ]
  },
  {
    version: '0.12.0',
    date: '2026-06-14',
    title: 'Tag-Filter & weniger Einrichtung',
    changes: [
      'Neuer Tag-Filter auf der Spiele-Seite: filtere nach Steam-Community-Tags (z. B. „Koop", „Roguelike", „Open World") — mehrere Tags kombinierbar, die Auswahl wird gemerkt. Die Tags werden im Hintergrund automatisch geladen.',
      'Weniger Einrichtung unter „Konten": bessere Cover (SteamGridDB) und Preisvergleich (IsThereAnyDeal) sind jetzt direkt eingebaut — niemand muss dafür mehr einen eigenen Key eintragen.',
      'Der Steam-Web-API-Key ist jetzt klar als optional gekennzeichnet (nur für persönliche Erfolge und den vollständigen Besitz-Katalog nötig).'
    ]
  },
  {
    version: '0.11.0',
    date: '2026-06-14',
    title: 'Detailansicht für nicht installierte Spiele',
    changes: [
      'Ein Klick auf ein nicht installiertes Spiel öffnet jetzt eine Detailseite — mit Store-Infos (Beschreibung, Genres, Screenshots), Preisen, Neuigkeiten und (bei Steam) Erfolgen, genau wie bei installierten Spielen.',
      'Direkt von dort installieren bzw. den passenden Launcher öffnen.'
    ]
  },
  {
    version: '0.10.1',
    date: '2026-06-14',
    title: 'Hell-Modus: Plaketten lesbar',
    changes: [
      'Die Spielzeit-Plakette auf den Spiel-Kacheln (und „● läuft" / Plattform-Markierung) war im Hell-Modus dunkel auf dunklem Grund — jetzt wieder klar lesbar.'
    ]
  },
  {
    version: '0.10.0',
    date: '2026-06-14',
    title: 'Neuer Name: buffd',
    changes: [
      'Die App heißt jetzt „buffd" — mit eigenem Logo (Hexagon-Hub-Symbol) und Wortmarke in der Seitenleiste und im Kopfbereich.',
      'Neues App-Icon für Fenster, Taskleiste, Startmenü- und Desktop-Verknüpfung.',
      'Hell-Modus überarbeitet: Kopfzeilen sind jetzt im hellen Design gut lesbar (vorher dunkel auf dunkel), und die Seitenleiste bleibt bewusst dunkel, damit die Symbole klar erkennbar sind.',
      'Der Schalter heißt jetzt „Darkmode" und ist standardmäßig an.',
      'Deine Daten bleiben vollständig erhalten — Spielzeiten, Konten und Einstellungen wandern unverändert mit.'
    ]
  },
  {
    version: '0.9.2',
    date: '2026-06-14',
    title: 'Nicht-installiert: Suche, Filter & Sortierung',
    changes: [
      'Die Kategorie „Nicht installiert" hat jetzt eine eigene Suchleiste, einen Plattform-Filter und eine Sortierung (zuletzt gespielt, Spielzeit, Name) — unabhängig von den installierten Spielen.',
      'Filter und Sortierung der Liste werden gemerkt.'
    ]
  },
  {
    version: '0.9.1',
    date: '2026-06-14',
    title: 'Glocke aktualisieren',
    changes: [
      'Neuer Knopf „↻ Aktualisieren" in den Benachrichtigungen: prüft sofort alles neu — Spiel-Updates (frischer Bibliotheks-Scan), Wunschlisten-Preise, Nvidia-Treiber und Epic-Gratisspiele — ohne auf die automatische 6-Stunden-Prüfung zu warten.'
    ]
  },
  {
    version: '0.9.0',
    date: '2026-06-14',
    title: 'Nicht installierte Spiele',
    changes: [
      'Neue Kategorie „Nicht installiert" unter den installierten Spielen: zeigt deinen kompletten Besitz-Katalog, der gerade nicht installiert ist — mit Spielzeit und (wo verfügbar) „zuletzt gespielt".',
      'Steam liefert den ganzen Besitz-Katalog samt echtem „zuletzt gespielt" (braucht den Steam-Web-API-Key und öffentliche Spieldetails); Epic die komplette Bibliothek (braucht das verbundene Konto).',
      'Andere Launcher (Battle.net, Ubisoft, Riot, RSI, Xbox) haben keine solche Schnittstelle — dort erscheinen Spiele, die mal installiert waren (z. B. dein deinstalliertes Call of Duty), weiterhin mit erhaltener Spielzeit.',
      'Direkt aus der Kachel installieren: bei Steam öffnet sich der Installations-Dialog, bei Epic der Launcher; Suche und Plattform-Filter gelten auch hier.',
      'Ein Hinweis erklärt, was noch fehlt (Key hinterlegen, Konto verbinden oder Steam-Spieldetails auf „öffentlich" stellen).'
    ]
  },
  {
    version: '0.8.2',
    date: '2026-06-12',
    title: 'Deinstallierte Spiele werden erkannt',
    changes: [
      'Deinstallierst du ein Spiel, verschwindet es jetzt automatisch aus der Bibliothek — samt veralteter Update-Hinweise in der 🔔-Glocke (vorher blieb beides hängen).',
      'Deine Spielzeiten bleiben dabei vollständig erhalten: Installierst du das Spiel später neu, ist alles sofort wieder da.'
    ]
  },
  {
    version: '0.8.1',
    date: '2026-06-12',
    title: 'Sidebar-Feinschliff',
    changes: [
      'Die Seitenleiste klappt beim Drüberfahren wieder sofort auf — die kurze Wartezeit ist raus.'
    ]
  },
  {
    version: '0.8.0',
    date: '2026-06-12',
    title: 'Wunschliste, Preise & Xbox-Spiele',
    changes: [
      'Shop-übergreifende Wunschliste mit Preisalarm (Shops → ⭐ Wunschliste): Spiele aus Steam UND Epic per Suche oder ☆ hinzufügen, die App prüft Preise alle 6 Stunden — Rabatte melden sich in der 🔔-Glocke.',
      'Steam-Wunschliste importieren: Ein Klick übernimmt die Wunschliste deines Steam-Kontos.',
      'Epic-Gratisspiel-Erinnerung: Die Glocke meldet Wochen-Gratisspiele, die noch nicht in deiner Epic-Bibliothek sind (ausblendbar).',
      'Preise auf den Spiel-Detailseiten: aktueller Steam-Preis, mit IsThereAnyDeal-Key (Einstellungen → Konten) zusätzlich bester Shop-Preis und historischer Tiefstpreis.',
      'Store-Suche in den Shop-Bereichen von Steam und Epic; die Shop-Übersicht zeigt Highlights aus allen Shops.',
      'Spiele-Seite: Suchleiste, Plattform-Filter und Sortierung (Spielzeit, zuletzt gespielt, Name, Größe) — Filter und Sortierung werden gemerkt.',
      'Xbox-App-Spiele werden erkannt und getrackt (z. B. Minecraft Launcher und Roblox aus dem XboxGames-Ordner); der Xbox-Launcher-Chip zeigt jetzt das echte Logo.'
    ]
  },
  {
    version: '0.7.0',
    date: '2026-06-12',
    title: 'Speicherplatz-Analyse',
    changes: [
      'Neuer Bereich „Speicherplatz der Spiele" unter System / Treiber: alle Spiele nach Größe sortiert, mit Balken, Gesamtsumme und Laufwerk — einmal berechnet, dauerhaft gespeichert.',
      'Aufräum-Tipps: Spiele über 10 GB, die seit über 3 Monaten nicht gespielt wurden, zeigen an, wie viel Platz eine Deinstallation freigeben würde.',
      'Deinstallieren-Knopf (🗑) in der Speicherplatz-Liste und auf der Spiel-Detailseite: bei Steam öffnet sich direkt der offizielle Bestätigungs-Dialog, bei anderen Launchern der passende Launcher mit Wegbeschreibung. Die App selbst löscht nie etwas.',
      'Spiel-Detailseite zeigt den belegten Speicher als eigene Kachel (mit Berechnen-Knopf).',
      'System / Treiber aufgeräumt: zwei aufklappbare Hauptbereiche „Speicherplatz der Spiele" und „Hardware" — die Geräteliste steht damit wieder direkt oben.'
    ]
  },
  {
    version: '0.6.0',
    date: '2026-06-12',
    title: 'Spiel-Detailseiten',
    changes: [
      'Detailseiten zeigen jetzt Store-Infos: Genres, Metacritic-Wertung, deutsche Beschreibung, Entwickler/Publisher/Erscheinungsdatum und eine scrollbare Screenshot-Reihe mit Großansicht — auch für Nicht-Steam-Spiele wie Call of Duty oder Star Citizen.',
      'Neuer Bereich „Neuigkeiten & Patchnotes" pro Spiel: die letzten Meldungen mit Datum und Quelle, Klick öffnet die volle Meldung im Browser.',
      'Steam-Erfolge auf der Detailseite: Fortschrittsbalken und alle Erfolge mit weltweiter Freischalt-Quote — dafür unter Einstellungen → Konten den kostenlosen Steam-Web-API-Key hinterlegen.',
      'SteamGridDB-Anbindung für bessere Cover (Einstellungen → Konten): ersetzt die bisherigen Wikipedia-Logos automatisch durch echte Box-Art.',
      'Beide Schlüssel werden mit Windows-Verschlüsselung nur lokal gespeichert.'
    ]
  },
  {
    version: '0.5.0',
    date: '2026-06-12',
    title: 'Launcher-Welle 2',
    changes: [
      'Sechs neue Launcher als Schnellstart: Battle.net, Ubisoft Connect, Riot Client, EA App, Rockstar Games, Wargaming Game Center und die Xbox App.',
      'Spiele dieser Launcher werden automatisch erkannt und getrackt — z. B. Call of Duty, Hearthstone (Battle.net) und Star Citizen (RSI); Ubisoft- und Riot-Spiele erscheinen, sobald welche installiert sind.',
      'Update-Erkennung für Battle.net-Spiele: Die App vergleicht die installierte Version mit Blizzards Versions-Server — Hinweise erscheinen in der 🔔-Glocke und im Updates-Tab, inklusive Historie.',
      'Online-Cover für Spiele ohne lokale Bilder (über die Steam-Store-Suche bzw. Wikipedia); Logos werden als elegante Logo-Kacheln dargestellt.'
    ]
  },
  {
    version: '0.4.1',
    date: '2026-06-12',
    title: 'Aufgeräumte Startseite & Sidebar-Verhalten',
    changes: [
      'Startseite verschlankt: Die Karten „Updates" und „System / Treiber" sind weg — das übernimmt jetzt die 🔔-Glocke.',
      'Seitwärts scrollbare Reihen reagieren nicht mehr aufs Mausrad (nur noch per Scrollbalken) — das Rad scrollt überall ganz normal die Seite hoch und runter.',
      'Die Seitenleiste verdeckt beim Aufklappen nichts mehr: Der Inhalt rückt sanft mit zur Seite, und die Leiste klappt erst nach kurzem Verweilen auf.'
    ]
  },
  {
    version: '0.4.0',
    date: '2026-06-12',
    title: 'Benachrichtigungen',
    changes: [
      'Neue Glocke unten in der Seitenleiste: bündelt alles rund um Updates an einem Ort — App-Updates, ausstehende Steam-Spiel-Updates und Nvidia-Treiber-Updates.',
      'Zähler-Badge an der Glocke zeigt auf einen Blick, wie viel ansteht (auch bei eingeklappter Leiste).',
      'Der orange Update-Knopf unten links ist dafür in die Benachrichtigungen umgezogen („Jetzt neu starten").'
    ]
  },
  {
    version: '0.3.2',
    date: '2026-06-11',
    title: 'Sidebar-Feinschliff',
    changes: [
      'Der Update-Hinweis unten links wird nicht mehr abgeschnitten: eingeklappt ein kompaktes ⬆️-Kästchen, ausgeklappt mit vollständigem Text.'
    ]
  },
  {
    version: '0.3.1',
    date: '2026-06-11',
    title: 'Scroll-Feinschliff',
    changes: [
      'Mausrad über einer seitlich scrollbaren Reihe bewegt jetzt nur noch die Reihe — die Seite scrollt dabei nicht mehr mit.'
    ]
  },
  {
    version: '0.3.0',
    date: '2026-06-11',
    title: 'Shops, Angebote & neues Design',
    changes: [
      'Neuer Bereich „Shops": Epic-Gratisspiele der Woche, deine komplette Epic-Bibliothek (auch nicht installierte Spiele, mit offizieller Spielzeit) und die aktuellen Steam-Angebote.',
      'Startseite zeigt jetzt Top-Angebote: „Gratis bei Epic" und „Steam-Angebote" als seitlich scrollbare Reihen.',
      'Schnellauswahl „Weiter spielen": scrollbare Reihe statt Umbruch; der ▶-Knopf in der Bildmitte startet das Spiel, ein Klick daneben öffnet die Detailansicht.',
      'Die Seitenleiste ist jetzt ein schmaler Balken und klappt beim Drüberfahren aus.',
      'Neuer Einstellungen-Bereich (unten in der Leiste): Konten, System/Treiber und Changelog sind dorthin umgezogen — dazu ein Schalter für den Hell-Modus.',
      'Layout im Vollbild verbessert: Inhalt zentriert, Bereiche nutzen die Breite.'
    ]
  },
  {
    version: '0.2.0',
    date: '2026-06-11',
    title: 'Epic-Konto verbinden',
    changes: [
      'Neuer Bereich „Konten": Verbinde dein Epic-Games-Konto mit der App (Anmeldung läuft über die offizielle Epic-Seite, das Passwort sieht die App nie).',
      'Epic-Spielzeiten werden automatisch übernommen — die offiziellen Werte aus deinem Epic-Konto, abgeglichen bei jedem App-Start.',
      'Die Zugangsdaten werden mit Windows-Verschlüsselung nur lokal gespeichert; Trennen jederzeit möglich.'
    ]
  },
  {
    version: '0.1.2',
    date: '2026-06-11',
    title: 'Changelog',
    changes: [
      'Neuer Menüpunkt „Changelog": zeigt für jede Version, was sich geändert hat.',
      'Die eigene installierte Version wird im Changelog markiert.'
    ]
  },
  {
    version: '0.1.1',
    date: '2026-06-11',
    title: 'Automatische Updates',
    changes: [
      'Die App prüft beim Start (und alle 6 Stunden) auf GitHub, ob es eine neue Version gibt.',
      'Updates werden still im Hintergrund heruntergeladen — installiert wird erst per Klick auf „Neu starten".',
      'Versionsanzeige unten links in der Seitenleiste.'
    ]
  },
  {
    version: '0.1.0',
    date: '2026-06-11',
    title: 'Erste installierbare Version',
    changes: [
      'Windows-Installer (Setup-exe) mit Startmenü- und Desktop-Verknüpfung.',
      'Startseite mit Highlights, „Weiter spielen"-Schnellauswahl und Launcher-Leiste.',
      'Spiele-Bibliothek: Steam- und Epic-Spiele mit Covern, Start/Schließen aus der App.',
      'Spielzeit-Tracking über Prozess-Überwachung — zählt auch direkt gestartete Spiele.',
      'Steam-Update-Erkennung mit eigener Update-Historie.',
      'World-of-Tanks-Mod-Verwaltung: an/aus, hinzufügen, nach Spiel-Updates wiederherstellen.',
      'Minecraft-Profile aus Modrinth, CurseForge und FTB App.',
      'System-Ansicht: Geräte mit Treiberversionen, Nvidia-Treiber-Update-Prüfung, Laufwerks-Füllstände.'
    ]
  }
]
