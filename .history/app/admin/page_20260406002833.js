import { supabase } from '../../lib/supabase'
import CircuitsManager from './CircuitsManager'
import CarsManager from './CarsManager'
import CrewNamesManager from './CrewNamesManager'

export const revalidate = 0

export default async function AdminPage() {
  const [
    { data: circuits },
    { data: cars },
    { data: crewNames },
  ] = await Promise.all([
    supabase.from('circuits').select('*').order('name'),
    supabase.from('cars').select('*').order('class').order('name'),
    supabase.from('crew_names').select('*').order('sort_order'),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Administration</h1>
          <div className="accent-line" />
          <p style={{ marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Données de référence — circuits, voitures, équipages
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        <section>
          <h2 style={{ marginBottom: '1rem' }}>Noms d&apos;équipage</h2>
          <CrewNamesManager initialCrewNames={crewNames || []} />
        </section>

        <section>
          <h2 style={{ marginBottom: '1rem' }}>Voitures</h2>
          <CarsManager initialCars={cars || []} />
        </section>

        <section>
          <h2 style={{ marginBottom: '1rem' }}>Circuits</h2>
          <CircuitsManager initialCircuits={circuits || []} />
        </section>
      </div>
    </div>
  )
}