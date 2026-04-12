import { supabase } from '../../../../../lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DriversAssignment from './DriversAssignment'
import AvailabilityGrid from './AvailabilityGrid'
import PerformanceData from './PerformanceData'
import StintGrid from './StintGrid'

export const revalidate = 0

function formatDatetime(dtStr) {
  if (!dtStr) return '—'
  return new Date(dtStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default async function EquipageDetail({ params }) {
  const { id, entryId } = await params

  const { data: entry, error } = await supabase
    .from('team_entries')
    .select(`
      *,
      cars (id, name, tank_size_litres, class),
      events (name, duration_minutes, ig_start_time, ig_sunrise, ig_sunset,
        circuits (name, pit_lane_time_seconds)),
      event_start_times (irl_start, label)
    `)
    .eq('id', entryId)
    .single()

  if (error || !entry) notFound()

  const { data: allSignups } = await supabase
    .from('signups')
    .select('*, drivers(id, name, irating)')
    .eq('event_id', entry.event_id)
    .order('drivers(name)')

  const assignedDrivers   = (allSignups || []).filter(s => s.team_entry_id === entryId)
  const unassignedDrivers = (allSignups || []).filter(s => !s.team_entry_id)

  const pitTime    = entry.events?.circuits?.pit_lane_time_seconds
  const entryCarId = entry.car_id
  const entryClass = entry.class || entry.cars?.class

  const infoItems = [
    { label: 'Voiture',           value: entry.cars?.name || '—' },
    { label: 'Classe',            value: entryClass || '—' },
    { label: 'Réservoir',         value: entry.cars?.tank_size_litres ? `${entry.cars.tank_size_litres}L` : '—' },
    { label: 'Pit lane',          value: pitTime ? `${pitTime}s` : '—' },
    { label: 'BOP Puissance',     value: `${entry.bop_power_percent ?? 100}%` },
    { label: 'BOP Poids',         value: `${entry.bop_weight_kg ?? 0}kg` },
    { label: 'Ravitaillement',    value: entry.refuel_time_seconds ? `${entry.refuel_time_seconds}s` : '—' },
    { label: 'Chgt pneus',        value: `${entry.tyre_change_time_seconds ?? 0}s` },
    { label: 'Lever soleil IG',   value: entry.events?.ig_sunrise || '—' },
    { label: 'Coucher soleil IG', value: entry.events?.ig_sunset  || '—' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{entry.crew_name}</h1>
          <div className="accent-line" />
          <div style={{ marginTop: '0.4rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            {entry.events?.name} — {entry.cars?.name || 'Voiture à définir'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/evenements/${id}/equipages/${entryId}/modifier`} className="btn btn-secondary">
            Modifier
          </Link>
          <Link href={`/evenements/${id}`} className="btn btn-secondary">Événement</Link>
        </div>
      </div>

      {entry.event_start_times && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent-dim)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
            Horaire de départ
          </div>
          <div style={{ fontWeight: 700 }}>{entry.event_start_times.label}</div>
          <div className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            {formatDatetime(entry.event_start_times.irl_start)}
          </div>
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '0.75rem', marginBottom: '2rem',
      }}>
        {infoItems.map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {entry.stream_url && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Stream</div>
          <a href={entry.stream_url} target="_blank" rel="noopener noreferrer"
            style={{ color: '#9147ff', fontSize: '0.9rem' }}>{entry.stream_url} ↗</a>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Pilotes assignés</h2>
        <DriversAssignment
          entryId={entryId}
          entryCarId={entryCarId}
          entryClass={entryClass}
          assignedDrivers={assignedDrivers}
          unassignedDrivers={unassignedDrivers}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Disponibilités</h2>
        <AvailabilityGrid
          teamEntryId={entryId}
          assignedDrivers={assignedDrivers}
          irlStart={entry.event_start_times?.irl_start || null}
          durationMinutes={entry.events?.duration_minutes || 0}
          igStartTime={entry.events?.ig_start_time || null}
          igSunrise={entry.events?.ig_sunrise || null}
          igSunset={entry.events?.ig_sunset || null}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Relais</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
          Les temps IRL et IG sont calculés automatiquement. Les points colorés indiquent la disponibilité de chaque pilote.
        </p>
        <StintGrid
          teamEntryId={entryId}
          teamEntry={entry}
          assignedDrivers={assignedDrivers}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Performances</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
          Chronos et consommations relevés lors des essais.
        </p>
        <PerformanceData
          teamEntryId={entryId}
          assignedDrivers={assignedDrivers}
        />
      </div>
    </div>
  )
}