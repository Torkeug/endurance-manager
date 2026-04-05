import { supabase } from '../../../../../lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 0

function formatDatetime(dtStr) {
  if (!dtStr) return '—'
  return new Date(dtStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default async function VoitureDetail({ params }) {
  const { id, entryId } = await params

  const { data: entry, error } = await supabase
    .from('car_entries')
    .select(`
      *,
      cars (name, tank_size_litres, class),
      events (name, date, duration_hours, circuits (name, pit_lane_time_seconds))
    `)
    .eq('id', entryId)
    .single()

  if (error || !entry) notFound()

  const pitTime = entry.events?.circuits?.pit_lane_time_seconds

  const infoItems = [
    { label: 'Voiture',       value: entry.cars?.name || '—' },
    { label: 'Classe',        value: entry.class || entry.cars?.class || '—' },
    { label: 'Réservoir',     value: entry.cars?.tank_size_litres ? `${entry.cars.tank_size_litres}L` : '—' },
    { label: 'Pit lane',      value: pitTime ? `${pitTime}s` : '—' },
    { label: 'Départ IRL',    value: formatDatetime(entry.irl_start) },
    { label: 'BOP',           value: entry.bop_percent ? `${entry.bop_percent}%` : '100%' },
    { label: 'Ravitaillement',value: entry.refuel_time_seconds ? `${entry.refuel_time_seconds}s` : '—' },
    { label: 'Chgt pneus',    value: entry.tyre_change_time_seconds ? `${entry.tyre_change_time_seconds}s` : '0s' },
    { label: 'Lever soleil IG', value: entry.ig_sunrise || '—' },
    { label: 'Coucher soleil IG', value: entry.ig_sunset || '—' },
    { label: 'SOF',           value: entry.sof ?? '—' },
  ]

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{entry.crew_name}</h1>
          <div className="accent-line" />
          <div style={{ marginTop: '0.4rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            {entry.events?.name} — {entry.cars?.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/evenements/${id}/voitures/${entryId}/modifier`} className="btn btn-secondary">
            Modifier
          </Link>
          <Link href={`/evenements/${id}`} className="btn btn-secondary">
            ← Événement
          </Link>
        </div>
      </div>

      {/* Info grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {infoItems.map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {entry.stream_url && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
            Stream
          </div>
          <a href={entry.stream_url} target="_blank" rel="noopener noreferrer"
            style={{ color: '#9147ff', fontSize: '0.9rem' }}>
            {entry.stream_url} ↗
          </a>
        </div>
      )}

      {/* Placeholders for future sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[
          { title: 'Disponibilités', desc: 'Grille de disponibilité des pilotes — à venir' },
          { title: 'Relais',         desc: 'Grille de planification des relais — à venir' },
          { title: 'Performances',   desc: 'Données de performance par pilote — à venir' },
        ].map(({ title, desc }) => (
          <div key={title} className="card" style={{ opacity: 0.5 }}>
            <h3 style={{ marginBottom: '0.4rem' }}>{title}</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}