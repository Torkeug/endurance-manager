import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data: circuits, error } = await supabase
    .from('circuits')
    .select('*')
    .order('name')

  if (error) {
    return <p>Erreur de connexion : {error.message}</p>
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Kronos Endurance Planner</h1>
      <p>{circuits.length} circuits chargés depuis Supabase ✅</p>
      <ul>
        {circuits.map(c => (
          <li key={c.id}>{c.name} — {c.pit_lane_time_seconds}s</li>
        ))}
      </ul>
    </main>
  )
}