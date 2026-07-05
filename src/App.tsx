import { useState } from 'react'
import './App.css'
import { METHODS } from './data/methods'
import MethodExplorer from './components/MethodExplorer'
import MethodTrainer from './components/MethodTrainer'
import InstallHint from './components/InstallHint'

type Tab = 'explorer' | 'trainer'

export default function App() {
  const [tab, setTab] = useState<Tab>('explorer')
  const [methodName, setMethodName] = useState<string>('Grandsire Triples')

  const method = METHODS.find((m) => m.name === methodName) ?? METHODS[0]

  return (
    <div className="app">
      <header className="app-header">
        <h1>Methodical</h1>
        <p className="tagline">Look up &amp; learn change ringing methods</p>
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'explorer'}
          className={tab === 'explorer' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('explorer')}
        >
          Method Explorer
        </button>
        <button
          role="tab"
          aria-selected={tab === 'trainer'}
          className={tab === 'trainer' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('trainer')}
        >
          Method Trainer
        </button>
      </nav>

      <InstallHint />

      <main className="content">
        {tab === 'explorer' ? (
          <MethodExplorer method={method} methodName={methodName} onMethodChange={setMethodName} />
        ) : (
          <MethodTrainer method={method} methodName={methodName} onMethodChange={setMethodName} />
        )}
      </main>

      <footer className="app-footer">
        Built on <code>ringing-lib-ts</code>
      </footer>
    </div>
  )
}
