import { supabase } from '../../lib/supabase'
import AdminTabs from './AdminTabs'

export const revalidate = 0

export default async function AdminPage() {
  const [
    { data: circuits },
    { data: cars },
    { data: crewNames },
    { data: carClasses },
    { data: eventTypes },
    { data: eventTypeCars },
  ] = await Promise.all([
    supabase.from('circuits').select('*').order('name'),
    supabase.from('cars').select('*').order('class').order('name'),
    supabase.from('crew_names').select('*').order('sort_order'),
    supabase.from('car_classes').select('*').order('sort_order'),
    supabase.from('event_types').select('*').order('sort_order'),
    supabase.from('event_type_cars').select('event_type_id, car_id'),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Administration</h1>
          <div className="accent-line" />
          <p style={{ marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Données de référence
          </p>
        </div>
      </div>

      <AdminTabs
        circuits={circuits || []}
        cars={cars || []}
        crewNames={crewNames || []}
        carClasses={carClasses || []}
        eventTypes={eventTypes || []}
        eventTypeCars={eventTypeCars || []}
      />
    </div>
  )
}