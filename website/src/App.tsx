import { useEffect, useState } from 'react'
import {
  Download,
  Github,
  LayoutGrid,
  Clock,
  BarChart3,
  Tags,
  Heart,
  Users,
  FolderTree,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import AppPreview from '@/components/AppPreview'
import logoUrl from '@/assets/logo.svg'

const REPO = 'Johann0601/buffd'
const RELEASES_LATEST = `https://github.com/${REPO}/releases/latest`

const PLATFORMS = [
  'Steam',
  'Epic Games',
  'Battle.net',
  'Minecraft',
  'Modrinth',
  'CurseForge',
  'FTB',
  '… und mehr'
]

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Eine Bibliothek',
    desc: 'Alle Spiele aus deinen Launchern an einem Ort — mit Covern, direkt startbar.'
  },
  {
    icon: Clock,
    title: 'Spielzeit-Tracking',
    desc: 'buffd misst automatisch, wann und wie lange du spielst — auch über Launcher hinweg.'
  },
  {
    icon: BarChart3,
    title: 'Statistiken',
    desc: 'Meistgespielte Titel, Spielzeit pro Woche und mehr auf einen Blick.'
  },
  {
    icon: Tags,
    title: 'Preisvergleich',
    desc: 'Eine Suche durchsucht Steam und Epic gleichzeitig und zeigt den günstigeren Preis.'
  },
  {
    icon: Heart,
    title: 'Wunschliste & Angebote',
    desc: 'Merk dir Spiele und behalte Rabatte und aktuelle Deals im Blick.'
  },
  {
    icon: Users,
    title: 'Freunde',
    desc: 'Sieh deine Steam-Freunde und was sie gerade spielen.'
  },
  {
    icon: FolderTree,
    title: 'Sammlungen & Filter',
    desc: 'Ordne Spiele in eigene Kategorien und filtere nach Launcher, Tags oder Suche.'
  },
  {
    icon: RefreshCw,
    title: 'Automatische Updates',
    desc: 'Neue Versionen installieren sich von selbst — du bleibst immer aktuell.'
  }
]

const FACTS = [
  { big: '0 €', lbl: 'komplett kostenlos' },
  { big: 'Open Source', lbl: 'Code öffentlich auf GitHub' },
  { big: 'Lokal', lbl: 'deine Daten bleiben auf deinem PC' },
  { big: 'Auto-Update', lbl: 'immer die neueste Version' }
]

function useLatestRelease(): { href: string; sub: string } {
  const [href, setHref] = useState(RELEASES_LATEST)
  const [sub, setSub] = useState('neueste Version · Windows 10/11 (64-bit)')

  useEffect(() => {
    let cancelled = false
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const exe = (data.assets || []).find((a: { name: string }) =>
          a.name.toLowerCase().endsWith('.exe')
        )
        if (exe) {
          setHref(exe.browser_download_url)
          const mb = (exe.size / 1048576).toFixed(0)
          const ver = String(data.tag_name || '').replace(/^v/, '')
          setSub(`Version ${ver} · ${mb} MB · Windows 10/11 (64-bit)`)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return { href, sub }
}

function DownloadButton({ href, size = 'lg' }: { href: string; size?: 'lg' | 'default' }): JSX.Element {
  return (
    <Button asChild size={size}>
      <a href={href}>
        <Download className="h-5 w-5" />
        Für Windows herunterladen
      </a>
    </Button>
  )
}

export default function App(): JSX.Element {
  const { href, sub } = useLatestRelease()

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <img src={logoUrl} alt="buffd Logo" className="h-8 w-8" />
            <span className="text-xl font-extrabold tracking-tight">
              buff<span className="text-[#a855f7]">d</span>
            </span>
          </a>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#features" className="hidden text-muted-foreground hover:text-foreground sm:block">
              Funktionen
            </a>
            <a href="#platforms" className="hidden text-muted-foreground hover:text-foreground sm:block">
              Plattformen
            </a>
            <Button asChild variant="outline" size="sm">
              <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <main id="top" className="container">
        {/* Hero */}
        <section className="pt-16 text-center sm:pt-24">
          <div className="animate-fade-up">
            <Badge variant="accent" className="mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" />
              Kostenlos &amp; quelloffen · Windows
            </Badge>
            <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Alle deine Spiele.
              <br />
              Ein{' '}
              <span className="bg-gradient-to-r from-[#a855f7] to-[#6c8cff] bg-clip-text text-transparent">
                Hub
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              buffd findet deine installierten Spiele aus Steam, Epic, Battle.net und mehr
              automatisch und bringt sie in eine aufgeräumte Bibliothek — mit Spielzeit,
              Preisvergleich und Wunschliste.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <DownloadButton href={href} />
              <span className="text-xs text-muted-foreground">{sub}</span>
            </div>
          </div>

          <AppPreview />
        </section>

        {/* Plattformen */}
        <section id="platforms" className="pt-24">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Erkennt deine Launcher automatisch
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Einmal starten — buffd durchsucht deinen PC und zieht die Spiele aus deinen Launchern
              zusammen.
            </p>
          </div>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {PLATFORMS.map((p) => (
              <span
                key={p}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
              >
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* Funktionen */}
        <section id="features" className="pt-24">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Was buffd kann</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Kein Abo, keine Werbung, kein Konto-Zwang. Einfach eine App für deine Spiele.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card
                key={title}
                className="group transition-all hover:-translate-y-1 hover:border-[#a855f7]/50"
              >
                <CardContent className="p-6">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#a855f7]/12 text-[#c084fc]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1.5 text-base font-bold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Fakten */}
        <section className="pt-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <Card key={f.lbl}>
                <CardContent className="p-6 text-center">
                  <div className="bg-gradient-to-r from-[#a855f7] to-[#6c8cff] bg-clip-text text-2xl font-extrabold text-transparent">
                    {f.big}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{f.lbl}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="mx-auto mt-7 max-w-2xl border-l-4 border-l-[#a855f7]">
            <CardContent className="p-5 text-sm text-muted-foreground">
              <b className="text-foreground">Hinweis beim ersten Start:</b> Windows zeigt evtl. „Der
              Computer wurde durch Windows geschützt". Das ist normal, weil die App (noch) nicht
              kostenpflichtig signiert ist. Einfach auf <b className="text-foreground">„Weitere
              Informationen"</b> → <b className="text-foreground">„Trotzdem ausführen"</b> klicken.
            </CardContent>
          </Card>
        </section>

        {/* Abschluss-CTA */}
        <section className="pt-24">
          <Card className="mx-auto max-w-2xl border-border bg-gradient-to-br from-[#a855f7]/12 to-[#6c8cff]/10">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight">Bereit?</h2>
              <p className="mx-auto mt-2.5 max-w-md text-muted-foreground">
                Lade buffd herunter und hab deine ganze Spielebibliothek in einer App.
              </p>
              <div className="mt-7 flex justify-center">
                <DownloadButton href={href} />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="container mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-8 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} buffd · made by Johann</span>
        <span className="flex gap-4">
          <a href={`https://github.com/${REPO}`} className="hover:text-foreground" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href={`https://github.com/${REPO}/releases`} className="hover:text-foreground" target="_blank" rel="noopener noreferrer">
            Alle Versionen
          </a>
        </span>
      </footer>
    </div>
  )
}
