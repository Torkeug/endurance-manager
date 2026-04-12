import { supabase } from '../../../lib/supabase'
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

function formatDuration(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export default async function DriverDetail({ params }) {
  const { id } = await params

  // Fetch driver
  const { data: driver, error } = await supabase
    .from('drivers').select('*').eq('id', id).single()

  if (error || !driver) notFound()

  // Fetch all signups for this driver with full context
  const { data: signups } = await supabase
    .from('signups')
    .select(`
      *,
      events (
        id, name, duration_minutes, format,
        circuits (name),
        event_start_times (id, label, irl_start)
      ),
      team_entries (
        id, crew_name, class,
        cars (name),
        event_start_times (label, irl_start)
      )
    `)
    .eq('driver_id', id)
    .order('created_at', { ascending: false })

  // Fetch availability counts per team entry
  const teamEntryIds = (signups || [])
    .map(s => s.team_entry_id).filter(Boolean)

  const { data: availData } = teamEntryIds.length > 0
    ? await supabase.from('availabilities')
        .select('team_entry_id, available')
        .eq('driver_id', id)
        .in('team_entry_id', teamEntryIds)
    : { data: [] }

  // Fetch assigned stints
  const { data: stints } = teamEntryIds.length > 0
    ? await supabase.from('stints')
        .select('*, team_entries(crew_name, events(name))')
        .eq('driver_id', id)
        .in('team_entry_id', teamEntryIds)
        .order('stint_number')
    : { data: [] }

  // Build avail map: team_entry_id → { filled, available }
  const availMap = {}
  ;(availData || []).forEach(a => {
    if (!availMap[a.team_entry_id]) availMap[a.team_entry_id] = { filled: 0, available: 0 }
    availMap[a.team_entry_id].filled++
    if (a.available === true) availMap[a.team_entry_id].available++
  })

  // Build stints map: team_entry_id → stints[]
  const stintsMap = {}
  ;(stints || []).forEach(s => {
    if (!stintsMap[s.team_entry_id]) stintsMap[s.team_entry_id] = []
    stintsMap[s.team_entry_id].push(s)
  })

  // Sort signups by event start time descending
  const sortedSignups = (signups || []).sort((a, b) => {
    const aDate = a.events?.event_start_times?.[0]?.irl_start || ''
    const bDate = b.events?.event_start_times?.[0]?.irl_start || ''
    return bDate.localeCompare(aDate)
  })

  const socials = [
    { label: 'iRacing ID', value: driver.iracing_id },
    { label: 'Email',      value: driver.email || '—' },
    { label: 'Discord',    value: driver.discord || '—' },
    { label: 'Twitch',     value: driver.twitch, link: driver.twitch ? `https://twitch.tv/${driver.twitch}` : null },
    { label: 'Instagram',  value: driver.instagram, link: driver.instagram ? `https://instagram.com/${driver.instagram}` : null },
  ].filter(s => s.value || s.label === 'Email')

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{driver.name}</h1>
          <div className="accent-line" />
          <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
              {driver.irating ? `${driver.irating} iR` : 'iRating non renseigné'}
            </span>
            {!driver.active && (
              <span className="badge badge-driver">Inactif</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href={`/pilotes/${id}/modifier`} className="btn btn-secondary">Modifier</Link>
          <Link href="/pilotes" className="btn btn-secondary">← Pilotes</Link>
        </div>
      </div>

      {/* Driver info */}
      {socials.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {socials.map(({ label, value, link }) => (
              <div key={label}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
                  {label}
                </div>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    className="mono" style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
                    {value}
                  </a>
                ) : (
                  <span className="mono" style={{ fontSize: '0.85rem' }}>{value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engagements */}
      <h2 style={{ marginBottom: '1rem' }}>
        Engagements
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-dim)', marginLeft: '0.75rem' }}>
          {sortedSignups.length} événement{sortedSignups.length !== 1 ? 's' : ''}
        </span>
      </h2>

      {sortedSignups.length === 0 ? (
        <div className="card">
          <div className="empty">Ce pilote n&apos;est inscrit à aucun événement.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedSignups.map(signup => {
            const event      = signup.events
            const teamEntry  = signup.team_entries
            const avail      = teamEntry ? availMap[teamEntry.id] : null
            const myStints   = teamEntry ? (stintsMap[teamEntry.id] || []) : []
            const startTimes = event?.event_start_times || []
            const earliest   = startTimes.length > 0
              ? startTimes.reduce((a, b) => a.irl_start < b.irl_start ? a : b)
              : null

            // Preferred start times labels
            const prefStartLabels = (signup.preferred_start_time_ids || [])
              .map(stId => startTimes.find(st => st.id === stId)?.label)
              .filter(Boolean)

            return (
              <div key={signup.id} className="card">
                {/* Event header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{event?.name || '—'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                      {earliest ? formatDatetime(earliest.irl_start) : 'Date à confirmer'}
                      {event?.circuits?.name && ` · ${event.circuits.name}`}
                      {event?.format && ` · ${event.format}`}
                      {event?.duration_minutes && ` · ${formatDuration(event.duration_minutes)}`}
                    </div>
                  </div>
                  <Link href={`/evenements/${event?.id}`} className="btn btn-secondary btn-sm">
                    Voir l&apos;événement →
                  </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>

                  {/* Team */}
                    <div style={{ background: 'var(--surface-2)', borderRadius: '3px', padding: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                        Équipe
                        </div>
                        {teamEntry ? (
                        <>
                            <div style={{ fontWeight: 600 }}>{teamEntry.crew_name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                            {teamEntry.cars?.name || '—'}
                            {teamEntry.class && ` · ${teamEntry.class}`}
                            </div>
                            {teamEntry.event_start_times && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.2rem' }}>
                                {teamEntry.event_start_times.label}
                            </div>
                            )}
                        </>
                        ) : (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Non assigné</div>
                        )}
                    </div>
                    {teamEntry && (
                        <div style={{ marginTop: '0.75rem' }}>
                        <Link href={`/evenements/${event?.id}/equipages/${teamEntry.id}`} className="btn btn-primary btn-sm">
                            Équipage →
                        </Link>
                        </div>
                    )}
                    </div>
                    
                  {/* Preferences */}
                  <div style={{ background: 'var(--surface-2)', borderRadius: '3px', padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                      Préférences
                    </div>
                    {(signup.preferred_class || []).length > 0 && (
                      <div style={{ fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>Classes : </span>
                        {signup.preferred_class.join(', ')}
                      </div>
                    )}
                    {prefStartLabels.length > 0 && (
                      <div style={{ fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>Créneaux : </span>
                        {prefStartLabels.join(', ')}
                      </div>
                    )}
                    {(signup.preferred_class || []).length === 0 && prefStartLabels.length === 0 && (
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>—</div>
                    )}
                  </div>

                  {/* Availability */}
                  {teamEntry && (
                    <div style={{ background: 'var(--surface-2)', borderRadius: '3px', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                        Disponibilités
                      </div>
                      {avail ? (
                        <>
                          <div style={{ fontSize: '0.85rem' }}>
                            <span style={{ color: '#2eb460', fontWeight: 600 }}>{avail.available}</span>
                            <span style={{ color: 'var(--text-dim)' }}> disponibles · </span>
                            <span style={{ fontWeight: 600 }}>{avail.filled}</span>
                            <span style={{ color: 'var(--text-dim)' }}> renseignés</span>
                          </div>
                          <div style={{ marginTop: '0.5rem', height: '6px', background: 'var(--border)',
                            borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: '3px',
                              background: 'var(--accent)',
                              width: `${Math.min(100, (avail.available / Math.max(1, avail.filled)) * 100)}%`,
                            }} />
                          </div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Non renseignée</div>
                      )}
                    </div>
                  )}

                    {/* Stints */}
                    {teamEntry && (
                    <div style={{ background: 'var(--surface-2)', borderRadius: '3px', padding: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                            Relais assignés
                        </div>
                        {myStints.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {myStints.map(stint => (
                                <div key={stint.id} className="mono" style={{ fontSize: '0.78rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ color: 'var(--accent)' }}>Relais #{stint.stint_number}</span>
                                {stint.irl_start && (
                                <span style={{ color: 'var(--text-dim)' }}>
                                    {new Date(stint.irl_start).toLocaleString('fr-FR', {
                                    day: '2-digit', month: '2-digit',
                                    hour: '2-digit', minute: '2-digit', hour12: false,
                                    })}
                                </span>
                                )}
                                {stint.rain && <span>💧</span>}
                                {stint.tyre_change && <span>🛞</span>}
                                </div>
                            ))}
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Aucun relais assigné</div>
                        )}
                        </div>
                        <div style={{ marginTop: '0.75rem' }}>
                        <Link href={`/evenements/${event?.id}/equipages/${teamEntry.id}`} className="btn btn-primary btn-sm">
                            Voir les relais →
                        </Link>
                        </div>
                    </div>
                    )}
                </div>

                {/* Notes */}
                {signup.notes && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-dim)',
                    borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>Notes : </span>
                    {signup.notes}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}