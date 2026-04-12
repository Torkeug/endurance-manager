import { supabaseServer as supabase } from '../../lib/supabase-server'
import Link from 'next/link'
import { getSessionAndDriver, isAdmin } from '../../lib/auth'
import EventTabs from './EventTabs'

export const revalidate = 0

function getEarliestStart(startTimes) {
  if (!startTimes || startTimes.length === 0) return null
  return startTimes.reduce((earliest, st) =>
    !earliest || new Date(st.irl_start) < new Date(earliest.irl_start) ? st : earliest
  , null)
}

function getLatestStart(startTimes) {
  if (!startTimes || startTimes.length === 0) return null
  return startTimes.reduce((latest, st) =>
    !latest || new Date(st.irl_start) > new Date(latest.irl_start) ? st : latest
  , null)
}

function serializeEvent(ev) {
  const earliest = getEarliestStart(ev.event_start_times)
  return {
    id:               ev.id,
    name:             ev.name,
    format:           ev.format,
    duration_minutes: ev.duration_minutes,
    circuit:          ev.circuits?.name || '—',
    timezone:         ev.timezone || 'Europe/Paris',
    irl_start:        earliest?.irl_start || null,
    start_count:      ev.event_start_times?.length || 0,
    team_count:       ev.team_entries?.length || 0,
    archived:         ev.archived || false,
    is_special:       ev.is_special || false,
    championship_id:  ev.championship_id || null,
    round_number:     ev.round_number || null,
  }
}

export default async function EvenementsPage() {
  const { driver: currentDriver } = await getSessionAndDriver()
  const admin = isAdmin(currentDriver)
  const isExternal = currentDriver?.role === 'external'

  let eventsQuery = supabase.from('events').select(`
    *,
    circuits (name),
    team_entries (id),
    event_start_times (id, irl_start, label),
    timezone
  `).order('name')

  if (isExternal) {
    const { data: mySignups } = await supabase
      .from('signups').select('event_id').eq('driver_id', currentDriver.id)
    const registeredEventIds = (mySignups || []).map(s => s.event_id)
    if (registeredEventIds.length > 0) {
      eventsQuery = eventsQuery.in('id', registeredEventIds)
    } else {
      eventsQuery = eventsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  }

  const [{ data: evenements, error }, { data: championships }] = await Promise.all([
    eventsQuery,
    supabase.from('championships').select('*').order('name'),
  ])

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">Erreur : {error.message}</div>
      </div>
    )
  }

  // Auto-archive championship rounds past finish date + 2h headroom
  const now = new Date()
  const roundsToArchive = (evenements || []).filter(ev => {
    if (!ev.championship_id || ev.archived) return false
    const latestStart = getLatestStart(ev.event_start_times)
    if (!latestStart) return false
    const finish = new Date(new Date(latestStart.irl_start).getTime() +
      ((ev.duration_minutes || 0) + 120) * 60 * 1000)
    return finish < now
  })
  if (roundsToArchive.length > 0) {
    await supabase.from('events').update({ archived: true })
      .in('id', roundsToArchive.map(r => r.id))
    roundsToArchive.forEach(r => { r.archived = true })
  }

  const allEvents = (evenements || []).map(serializeEvent)

  const normalEvents       = allEvents.filter(ev => !ev.is_special && !ev.championship_id)
  const specialEvents      = allEvents.filter(ev => ev.is_special && !ev.championship_id)
  const championshipRounds = allEvents.filter(ev => ev.championship_id)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Événements</h1>
          <div className="accent-line" />
        </div>
        {admin && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/evenements/nouveau" className="btn btn-secondary">+ Événement</Link>
            <Link href="/championnats/nouveau" className="btn btn-primary">+ Championnat</Link>
          </div>
        )}
      </div>

      <EventTabs
        normalEvents={normalEvents}
        specialEvents={specialEvents}
        championshipRounds={championshipRounds}
        championships={championships || []}
        admin={admin}
      />
    </div>
  )
}