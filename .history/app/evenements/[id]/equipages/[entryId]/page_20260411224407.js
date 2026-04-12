import { supabaseServer as supabase } from '../../../../../lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import EquipageTabs from './EquipageTabs'
import { getSessionAndDriver } from '../../../../../lib/auth'
import { formatInZone, formatTimeInZone } from '../../../../../lib/timezone'
import CollapsibleSummary from './CollapsibleSummary'

export const revalidate = 0

export default async function EquipageDetail({ params }) {
  const { id, entryId } = await params

  const { driver: currentDriver } = await getSessionAndDriver()

  const { data: entry, error } = await supabase
    .from('team_entries')
    .select(`
      *,
      cars (id, name, tank_size_litres, class),
      events (name, duration_minutes, ig_start_time, ig_sunrise, ig_sunset, timezone,
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

  const driversWithIrating = assignedDrivers.filter(d => d.drivers?.irating)
  const avgIrating = driversWithIrating.length > 0
    ? Math.round(driversWithIrating.reduce((sum, d) => sum + d.drivers.irating, 0) / driversWithIrating.length)
    : null

  const infoItems = [
    { label: 'Voiture',           value: entry.cars?.name || '—' },
    { label: 'Classe',            value: entryClass || '—' },
    { label: 'SoF', value: avgIrating ? `${avgIrating} iR` : '—' },
    { label: 'Réservoir', value: entry.bop_tank_size_percent
      ? `${(entry.cars?.tank_size_litres * entry.bop_tank_size_percent / 100).toFixed(1)}L (${entry.bop_tank_size_percent}% BoP)`
      : entry.cars?.tank_size_litres ? `${entry.cars.tank_size_litres}L` : '—' },
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
      {/* Header */}
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

      {/* Start time */}
      {entry.event_start_times && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent-dim)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
            Horaire de départ
          </div>
          <div style={{ fontWeight: 700 }}>{entry.event_start_times.label}</div>
          <div className="mono" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
            Départ à {formatTimeInZone(entry.event_start_times.irl_start, entry.events?.timezone || 'Europe/Paris')}
          </div>
        </div>
      )}

      {/* Info grid */}
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

      {/* Tabbed sections */}
      <EquipageTabs
        entryId={entryId}
        teamEntry={entry}
        assignedDrivers={assignedDrivers}
        unassignedDrivers={unassignedDrivers}
        entryCarId={entryCarId}
        entryClass={entryClass}
        currentDriver={currentDriver}
      />
    </div>
  )
}