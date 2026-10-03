import { useEffect, useState } from 'preact/hooks'
import { Store } from './store'
import { session, update, useSession } from './lib/session'
import { DemoBanner, LangBar } from './screens/ui'
import { useLang } from './content/i18n'
import { demoMode, DEMO_PIN, loadDemo } from './lib/demo'
import { Home, Consent, VoiceSetup, Pin } from './screens/early'
import { Photos } from './screens/photos'
import { Questions, Result, Escalate } from './screens/result'
import { Officer, Coop } from './screens/admin'

const route = () => (location.hash.replace(/^#\/?/, '') || 'home')
export const go = (r: string) => { location.hash = '/' + r }

export function App() {
  const [r, setR] = useState(route())
  const s = useSession()
  useLang()
  useEffect(() => { const f = () => setR(route()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const unlock = async (pin: string) => { update({ store: await Store.unlock(pin) }) }
  useEffect(() => {
    if (!demoMode() || session.store) return
    void (async () => { try { update({ store: await Store.unlock(DEMO_PIN) }); await loadDemo(); go('photos') } catch { /* a different PIN is set: show the PIN screen */ } })()
  }, [])
  let body
  if (r === 'officer') body = <Officer />  // no PIN: officer only decodes SMS text
  else if (!session.store) body = <Pin onUnlock={unlock} />
  else body = ({
    home: <Home />, consent: <Consent />, voice: <VoiceSetup />, photos: <Photos />,
    questions: <Questions />, result: <Result />, escalate: <Escalate />, coop: <Coop />,
  } as Record<string, preact.JSX.Element>)[r] ?? <Home />
  void s
  return <div class="app"><DemoBanner /><LangBar />{body}</div>
}
