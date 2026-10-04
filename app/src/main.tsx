import { render } from 'preact'
// Atkinson Hyperlegible (Braille Institute, OFL): bundled so it works offline; Latin subset only (~40 KB).
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './styles.css'
import { App } from './app'

// Ask the browser not to evict the encrypted records (best effort; ignored where unsupported).
try { void navigator.storage?.persist?.().catch(() => undefined) } catch { /* ignore */ }

render(<App />, document.getElementById('app')!)
