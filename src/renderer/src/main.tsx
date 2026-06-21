import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Lokal gebündelte Fonts (CSP blockiert externe). Look nach „Claude Design"-Entwurf:
// Space Grotesk = UI, JetBrains Mono = Labels/Mono, Audiowide = Wortmarke/Logo.
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/audiowide/400.css'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
