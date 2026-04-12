import { supabaseServer as supabase } from '../../lib/supabase-server'
import Link from 'next/link'
import { getSessionAndDriver, isAdmin } from '../../lib/auth'
import { formatDateInZone } from '../../lib/timezone'

export const revalidate = 0

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

  import { DateTime } from 'luxon'

  function getDay(dtStr, tz) {
    if (!dtStr) return '—'
    return DateTime.fromISO(dtStr, { zone: 'utc' }).setZone(tz).toFormat('dd')
  }
  function getMonth(dtStr, tz) {
    if (!dtStr) return ''
    return DateTime.fromISO(dtStr, { zone: 'utc' }).setZone(tz).setLocale('fr').toFormat('MMM')
  }
  function getYear(dtStr, tz) {
    if (!dtStr) return ''
    return DateTime.fromISO(dtStr, { zone: 'utc' }).setZone(tz).toFormat('yyyy')
  }

export default async function EvenementsPage() {
  const { driver: currentDriver } = await getSessionAndDriver()
  const admin = isAdmin(currentDriver)
  const { data: evenements, error } = await supabase
    .from('events')
    .select(`
      *,
      circuits (name),
      team_entries (id),
      event_start_times (id, irl_start, label),
      timezone
    `)

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">Erreur : {error.message}</div>
      </div>
    )
  }

  // Sort by earliest start time, events with no start times go to end
  const sorted = [...(evenements || [])].sort((a, b) => {
    const activeEvents   = sorted.filter(ev => !ev.archived)
    const archivedEvents = sorted.filter(ev => ev.archived)
    const aStart = getEarliestStart(a.event_start_times)
    const bStart = getEarliestStart(b.event_start_times)
    if (!aStart && !bStart) return 0
    if (!aStart) return 1
    if (!bStart) return -1
    return new Date(bStart.irl_start) - new Date(aStart.irl_start)
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Événements</h1>
          <div className="accent-line" />
        </div>
          {admin && (
            <Link href="/evenements/nouveau" className="btn btn-primary">+ Créer un événement</Link>
          )}
      </div>

      {/* Active events */}
      {activeEvents.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">Aucun événement actif.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {activeEvents.map((ev) => {
            const earliest = getEarliestStart(ev.event_start_times)
            return (
              <Link key={ev.id} href={`/evenements/${ev.id}`}
                className="event-card-link" style={{ textDecoration: 'none' }}>
                <div className="card event-card" style={{
                  display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap'
                }}>
                  {/* Date block */}
                  <div style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: '3px', padding: '0.5rem 0.75rem',
                    textAlign: 'center', minWidth: '64px',
                  }}>
                    {earliest ? (
                      <>
                        <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>
                          {getDay(earliest.irl_start, ev.timezone || 'Europe/Paris')}
                        </div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
                          {getMonth(earliest.irl_start, ev.timezone || 'Europe/Paris')}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                          {getYear(earliest.irl_start, ev.timezone || 'Europe/Paris')}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.25rem 0' }}>
                        Date à confirmer
                      </div>
                    )}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {ev.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      {ev.circuits?.name || '—'}
                      {ev.event_start_times?.length > 1 && (
                        <span style={{ marginLeft: '0.75rem', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>
                          {ev.event_start_times.length} créneaux
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="mono" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
                        {formatDuration(ev.duration_minutes)}
                      </div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
                        Durée
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="mono" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
                        {ev.team_entries?.length ?? 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
                        Équipage{(ev.team_entries?.length ?? 0) !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {ev.format && <span className="badge badge-admin">{ev.format}</span>}
                  </div>

                  <div style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>›</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        {sorted.length} événement{sorted.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}