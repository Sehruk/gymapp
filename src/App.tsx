import { useState } from 'react'
import { ActivityScreen } from './components/ActivityScreen'
import { DataScreen } from './components/DataScreen'
import { ExercisesScreen } from './components/ExercisesScreen'
import { HomeScreen } from './components/HomeScreen'
import { StoreProvider } from './store'

type Tab = 'workouts' | 'cardio' | 'exercises' | 'data'
const TABS: [Tab, string, string][] = [
  ['workouts', '🏋️', 'Workouts'],
  ['cardio', '🚶', 'Cardio'],
  ['exercises', '📋', 'Exercises'],
  ['data', '💾', 'Data'],
]

export default function App() {
  const [tab, setTab] = useState<Tab>('workouts')
  return (
    <StoreProvider>
      <main>
        {tab === 'workouts' && <HomeScreen goData={() => setTab('data')} />}
        {tab === 'cardio' && <ActivityScreen />}
        {tab === 'exercises' && <ExercisesScreen />}
        {tab === 'data' && <DataScreen />}
      </main>
      <nav className="tabs">
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </StoreProvider>
  )
}
