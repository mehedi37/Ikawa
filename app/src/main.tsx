import { render } from 'preact'
import './styles.css'
import { App } from './app'

// Ask the browser not to evict the encrypted records (best effort; ignored where unsupported).
try { void navigator.storage?.persist?.().catch(() => undefined) } catch { /* ignore */ }

render(<App />, document.getElementById('app')!)
