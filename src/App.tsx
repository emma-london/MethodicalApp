import './App.css'
import MethodExplorer from './components/MethodExplorer'
import MethodTrainer from './components/MethodTrainer'
import Pinboard from './components/Pinboard'
import InstallHint from './components/InstallHint'
import InstallButton from './components/InstallButton'
import { MethodCatalogProvider, useMethodCatalog } from './state/MethodCatalog'
import { usePersistentState } from './hooks/usePersistentState'

type Tab = 'explorer' | 'trainer' | 'pinboard'

function AppInner() {
  const { findMethod, pickerMethods } = useMethodCatalog()
  const [tab, setTab] = usePersistentState<Tab>('methodical.tab', 'explorer', (r) =>
    r === 'explorer' || r === 'trainer' || r === 'pinboard' ? r : undefined,
  )
  const [methodName, setMethodName] = usePersistentState<string>(
    'methodical.method',
    'Grandsire Triples',
    (r) => r || undefined,
  )

  // Resolve the selected method across all tiers (standard, used, loaded); fall
  // back to the first picker method if the name can't be resolved.
  const method = findMethod(methodName) ?? pickerMethods[0]

  return (
    <div className={tab === 'trainer' ? 'app app--trainer' : 'app'}>
      <header className="app-header">
        <div className="app-header__titles">
          <h1>Methodical</h1>
          <p className="tagline">Look up &amp; learn change ringing methods</p>
        </div>
        <InstallButton />
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'explorer'}
          className={tab === 'explorer' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('explorer')}
        >
          Explorer
        </button>
        <button
          role="tab"
          aria-selected={tab === 'trainer'}
          className={tab === 'trainer' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('trainer')}
        >
          Trainer
        </button>
        <button
          role="tab"
          aria-selected={tab === 'pinboard'}
          className={tab === 'pinboard' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('pinboard')}
        >
          Pinboard
        </button>
      </nav>

      <InstallHint />

      <main className="content">
        {tab === 'explorer' ? (
          <MethodExplorer method={method} methodName={methodName} onMethodChange={setMethodName} />
        ) : tab === 'trainer' ? (
          <MethodTrainer method={method} methodName={methodName} onMethodChange={setMethodName} />
        ) : (
          <Pinboard method={method} methodName={methodName} onMethodChange={setMethodName} />
        )}
      </main>

      <footer className="app-footer">
        Built on <code>ringing-lib-ts</code> · © Emma Bruce 2026
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <MethodCatalogProvider>
      <AppInner />
    </MethodCatalogProvider>
  )
}
