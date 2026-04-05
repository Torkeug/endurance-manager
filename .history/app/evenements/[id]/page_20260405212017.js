import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 0

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })
}

function formatDatetime(dtStr) {
  if (!dtStr) return '—'
  return new Date(dtStr).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatDuration(hours) {
  if (!hours) return '—'
  if (hours % 1 === 0) return `${hours}h`
  const h = Math.floor(hours)
  const m = Math.round((hours % 1) * 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

export default async function EvenementDetail({ params }) {
  const { id } = await params

  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      circuits (name, pit_lane_time_seconds),
      car_entries (
        id, crew_name, class, sof, stream_url,
        cars (name)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !event) notFound()

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{event.name}</h1>
          <div className="accent-line" />
          <div style={{ marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {formatDate(event.date)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/evenements/${id}/modifier`} className="btn btn-secondary">
            Modifier
          </Link>
          <Link href="/evenements" className="btn btn-secondary">
            ← Retour
          </Link>
        </div>
      </div>

      {/* Info grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {[
          { label: 'Circuit',    value: event.circuits?.name || '—' },
          { label: 'Durée',      value: formatDuration(event.duration_hours) },
          { label: 'Format',     value: event.format || '—' },
          { label: 'Départ IRL', value: formatDatetime(event.irl_start) },
          { label: 'Départ IG',  value: event.ig_start_time || '—' },
          { label: 'Pit lane',   value: event.circuits?.pit_lane_time_seconds ? `${event.circuits.pit_lane_time_seconds}s` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: '0.95rem', color: 'var(--text)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {event.notes && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            Notes
          </div>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{event.notes}</p>
        </div>
      )}

      {/* Car entries */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2>Voitures engagées</h2>
        <Link href={`/evenements/${id}/voitures/nouveau`} className="btn btn-primary">
          + Ajouter une voiture
        </Link>
      </div>

      {!event.car_entries || event.car_entries.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">
            Aucune voiture engagée pour cet événement.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Équipage</th>
                <th>Voiture</th>
                <th>Classe</th>
                <th>SOF</th>
                <th>Stream</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {event.car_entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ fontWeight: 600 }}>{entry.crew_name}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{entry.cars?.name || '—'}</td>
                  <td>
                    {entry.class && (
                      <span className="badge badge-driver">{entry.class}</span>
                    )}
                  </td>
                  <td className="mono" style={{ color: 'var(--text-dim)' }}>
                    {entry.sof ?? '—'}
                  </td>
                  <td>
                    {entry.stream_url ? (
                      <a href={entry.stream_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#9147ff', fontSize: '0.85rem' }}>
                        Twitch ↗
                      </a>
                    ) : '—'}
                  </td>
                  <td>
                    <Link
                      href={`/evenements/${id}/voitures/${entry.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Gérer →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}