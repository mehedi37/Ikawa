import { useEffect, useState } from 'preact/hooks'
import { Store, DEMO_DB } from './store'
import { session, update, useSession } from './lib/session'
import { AppBar, DemoBar, DemoModelBanner, MachineNote } from './screens/ui'
import { useLang } from './content/i18n'
import { demoMode, DEMO_PIN, loadDemo } from './lib/demo'
import { Home, Consent, VoiceSetup, Pin } from './screens/early'
import { Photos } from './screens/photos'
import { Questions, Result, Escalate } from './screens/result'
import { Officer, Coop } from './screens/admin'

const route = () => (location.hash.replace(/^#\/?/, '') || 'home')
export const go = (r: string) => { location.hash = '/' + r; window.scrollTo(0, 0) }

export function App() {
  const [r, setR] = useState(route())
  const [demoReady, setDemoReady] = useState(!demoMode())
  const s = useSession()
  useLang()
  useEffect(() => { const f = () => setR(route()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const unlock = async (pin: string) => { update({ store: await Store.unlock(pin) }) }
  useEffect(() => {
    if (!demoMode() || session.store) return
    // The demo has its own database with a fixed PIN, so it starts with no set-up and never touches real records.
    void (async () => {
      update({ store: await Store.unlock(DEMO_PIN, DEMO_DB) })
      await loadDemo()
      setDemoReady(true)
      if (route() === 'home' || route() === '') go('photos')
    })()
  }, [])
  let body
  if (r === 'officer') body = <Officer />  // no PIN: the officer only decodes SMS text
  else if (!demoReady) body = <main><p class="lead">Loading the demo leaves…</p></main>
  else if (!session.store) body = <Pin onUnlock={unlock} />
  else body = ({
    home: <Home />, consent: <Consent />, voice: <VoiceSetup />, photos: <Photos />,
    questions: <Questions />, result: <Result />, escalate: <Escalate />, coop: <Coop />,
  } as Record<string, preact.JSX.Element>)[r] ?? <Home />
  void s
  return (
    <div class="app">
      <DemoModelBanner />
      <AppBar />
      <DemoBar route={r} />
      <MachineNote />
      {body}
    </div>
  )
}
