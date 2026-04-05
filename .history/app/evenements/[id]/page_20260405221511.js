import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StartTimesManager from './StartTimesManager'

export const revalidate = 0

function formatDatetime(dtStr) {
  if (!dtStr) return '—'
  return new Date(dtStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDuration(hours) {
  if (!hours) return '—'
  if (hours % 1 === 0) return `${hours}h`
  const h = Math.floor(hours)
  const m = Math.round((hours % 1) * 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

function getEarliestStart(startTimes) {
  if (!startTimes || startTimes.length === 0) return null
  return startTimes.reduce((earliest, st) =>
    !earliest || new Date(st.irl_start) < new Date(earliest.irl_start) ? st : earliest
  , null)
}

export default async function EvenementDetail({ params }) {
  const { id } = await params

  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      circuits (name, pit_lane_time_seconds),
      car_entries (
        id, crew_name, class, stream_url, start_time_id,
        cars (name),
        event_start_times (irl_start, label)
      ),
      event_start_times (id, label, irl_start),
      signups (
        id, preferred_class, notes,
        drivers (id, name, irating),
        cars (name)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !event) notFound()

  const earliest = getEarliestStart(event.event_start_times)

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{event.name}</h1>
          <div className="accent-line" />
          <div style={{ marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {earliest ? formatDatetime(earliest.irl_start) : 'Date à confirmer'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/evenements/${id}/modifier`} className="btn btn-secondary">Modifier</Link>
          <Link href="/evenements" className="btn btn-secondary">← Retour</Link>
        </div>
      </div>

      {/* Info grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {[
          { label: 'Circuit',        value: event.circuits?.name || '—' },
          { label: 'Durée',          value: formatDuration(event.duration_hours) },
          { label: 'Format',         value: event.format || '—' },
          { label: 'Départ IG',      value: event.ig_start_time || '—' },
          { label: 'Lever soleil',   value: event.ig_sunrise || '—' },
          { label: 'Coucher soleil', value: event.ig_sunset  || '—' },
          { label: 'Pit lane',       value: event.circuits?.pit_lane_time_seconds
              ? `${event.circuits.pit_lane_time_seconds}s` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
              {label}
            </div>
            <div className="mono" style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {event.notes && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Notes</div>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>{event.notes}</p>
        </div>
      )}

      {/* Start times */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Horaires de départ</h2>
        <StartTimesManager eventId={id} initialStartTimes={event.event_start_times || []} />
      </div>

      {/* Sign-ups */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2>Inscriptions</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            {event.signups?.length ?? 0} pilote{(event.signups?.length ?? 0) !== 1 ? 's' : ''} inscrit{(event.signups?.length ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>
        <Link href={`/evenements/${id}/inscription`} className="btn btn-primary">
          + S&apos;inscrire
        </Link>
      </div>

      {!event.signups || event.signups.length === 0 ? (
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <div className="empty">Aucun pilote inscrit pour l&apos;instant.</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <table>
            <thead>
              <tr>
                <th>Pilote</th>
                <th>iRating</th>
                <th>Classe préférée</th>
                <th>Voiture préférée</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {event.signups
                .sort((a, b) => a.drivers?.name?.localeCompare(b.drivers?.name))
                .map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.drivers?.name || '—'}</td>
                  <td className="mono" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                    {s.drivers?.irating ?? '—'}
                  </td>
                  <td>
                    {s.preferred_class
                      ? <span className="badge badge-driver">{s.preferred_class}</span>
                      : <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    {s.cars?.name || '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '200px' }}>
                    {s.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Car entries */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2>Voitures engagées</h2>
        <Link href={`/evenements/${id}/voitures/nouveau`} className="btn btn-secondary">
          + Ajouter une voiture
        </Link>
      </div>

      {!event.car_entries || event.car_entries.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">Aucune voiture engagée pour cet événement.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Équipage</th>
                <th>Voiture</th>
                <th>Classe</th>
                <th>Départ IRL</th>
                <th>Stream</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {event.car_entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ fontWeight: 600 }}>{entry.crew_name}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{entry.cars?.name || '—'}</td>
                  <td>{entry.class && <span className="badge badge-driver">{entry.class}</span>}</td>
                  <td className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                    {entry.event_start_times
                      ? `${entry.event_start_times.label} — ${formatDatetime(entry.event_start_times.irl_start)}`
                      : '—'}
                  </td>
                  <td>
                    {entry.stream_url
                      ? <a href={entry.stream_url} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#9147ff', fontSize: '0.85rem' }}>Twitch ↗</a>
                      : '—'}
                  </td>
                  <td>
                    <Link href={`/evenements/${id}/voitures/${entry.id}`} className="btn btn-secondary btn-sm">
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