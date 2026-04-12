import { supabaseServer as supabase } from '../../lib/supabase-server'
import { getSessionAndDriver } from '../../lib/auth'
import { redirect } from 'next/navigation'
import AdminTabs from './AdminTabs'

export const revalidate = 0

export default async function AdminPage() {
  const { driver: currentDriver } = await getSessionAndDriver()
  // Redirect non-admin users — this is a server-side guard,
  // middleware also blocks this route but we double-check here
  if (!currentDriver || (currentDriver.role !== 'admin' && currentDriver.role !== 'super_admin')) {
    redirect('/')
  }

  const [
    { data: circuits },
    { data: cars },
    { data: crewNames },
    { data: carClasses },
    { data: eventTypes },
    { data: eventTypeCars },
    { data: drivers },
    { data: settingsData },
    { data: durationPresets },
    { data: specialStartTimes },
  ] = await Promise.all([
    supabase.from('circuits').select('*').order('name'),
    supabase.from('cars').select('*').order('class').order('name'),
    supabase.from('crew_names').select('*').order('name'),
    supabase.from('car_classes').select('*').order('sort_order'),
    supabase.from('event_types').select('*').order('sort_order'),
    supabase.from('event_type_cars').select('event_type_id, car_id'),
    supabase.from('drivers').select('id, name, email, role, approved, refused, iracing_id, discord, active, membership_ok, test_driver').order('name'),
    supabase.from('settings').select('key, value'),
    supabase.from('event_duration_presets').select('*').order('minutes'),
    supabase.from('special_event_start_times').select('*').order('hour').order('minute'),
  ])

  const settings = Object.fromEntries((settingsData || []).map(s => [s.key, s.value]))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Administration</h1>
          <div className="accent-line" />
          <p style={{ marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Données de référence &amp; gestion des accès
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
        drivers={drivers || []}
        currentDriver={currentDriver}
        settings={settings}
        durationPresets={durationPresets || []}
        specialStartTimes={specialStartTimes || []}
      />
    </div>
  )
}