import { supabase } from '../../../lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StartTimesManager from './StartTimesManager'
import { getSessionAndDriver, isAdmin } from '../../../lib/auth'

export const revalidate = 0

function formatDatetime(dtStr) {
  if (!dtStr) return '—'
  return new Date(dtStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDuration(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
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

  const { driver: currentDriver } = await getSessionAndDriver()
  const admin = isAdmin(currentDriver)

  const [{ data: event, error }, { data: allCars }] = await Promise.all([
    supabase.from('events').select(`
      *,
      circuits (name, pit_lane_time_seconds),
      team_entries (
        id, crew_name, class, stream_url, start_time_id,
        cars (name),
        event_start_times (irl_start, label)
      ),
      event_start_times (id, label, irl_start),
      signups (
        id, preferred_class, preferred_car_ids, preferred_start_time_ids, notes, team_entry_id,
        drivers (id, name, irating),
        team_entries (crew_name)
      )
    `).eq('id', id).single(),
    supabase.from('cars').select('id, name'),
  ])

  if (error || !event) notFound()

  const earliest = getEarliestStart(event.event_start_times)

  // Build car id → name map for displaying preferred cars
  const carsMap = (allCars || []).reduce((acc, car) => {
    acc[car.id] = car.name
    return acc
  }, {})

  const formatPreferences = (signup) => {
    const classes = signup.preferred_class || []
    const carNames = (signup.preferred_car_ids || [])
      .map(cid => carsMap[cid]).filter(Boolean)
    const parts = [...classes, ...carNames]
    return parts.length > 0 ? parts.join(', ') : '—'
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{event.name}</h1>
          <div className="accent-line" />
          <div style={{ marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {earliest ? formatDatetime(earliest.irl_start) : 'Date à confirmer'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {admin && (
            <Link href={`/evenements/${id}/modifier`} className="btn btn-secondary">Modifier</Link>
          )}
          <Link href="/evenements" className="btn btn-secondary">← Retour</Link>
        </div>
      </div>

      {/* Info grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '0.75rem', marginBottom: '2rem',
      }}>
        {[
          { label: 'Circuit',        value: event.circuits?.name || '—' },
          { label: 'Durée',          value: formatDuration(event.duration_minutes) },
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
                <th>Équipe</th>
                <th>Préférences</th>
                <th>Créneaux</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(event.signups || [])
                .sort((a, b) => (a.drivers?.name || '').localeCompare(b.drivers?.name || ''))
                .map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.drivers?.name || '—'}</td>
                  <td className="mono" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                    {s.drivers?.irating ?? '—'}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {s.team_entries?.crew_name
                      ? <span className="badge badge-admin">{s.team_entries.crew_name}</span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '200px' }}>
                    {formatPreferences(s)}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {(s.preferred_start_time_ids || []).length > 0
                      ? (s.preferred_start_time_ids || [])
                          .map(stId => event.event_start_times?.find(st => st.id === stId)?.label || '?')
                          .join(', ')
                      : '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '160px' }}>
                    {s.notes || '—'}
                  </td>
                  <td>
                    <Link
                      href={`/evenements/${id}/inscription?driver=${s.drivers?.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Gérer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Car entries */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2>Équipages engagés</h2>
        <Link href={`/evenements/${id}/equipages/nouveau`} className="btn btn-primary">
          + Ajouter un équipage
        </Link>
      </div>

      {!event.team_entries || event.team_entries.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">Aucun équipage engagé pour cet événement.</div>
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
              {event.team_entries.map((entry) => (
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
                    <Link href={`/evenements/${id}/equipages/${entry.id}`} className="btn btn-secondary btn-sm">
                      Gérer
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