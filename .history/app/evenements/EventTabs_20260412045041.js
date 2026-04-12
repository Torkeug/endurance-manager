'use client'
import { useState } from 'react'
import Link from 'next/link'
import { DateTime } from 'luxon'

function formatDuration(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

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

function EventCard({ ev }) {
  return (
    <Link href={`/evenements/${ev.id}`} style={{ textDecoration: 'none' }}>
      <div className="card event-card" style={{
        display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
        opacity: ev.archived ? 0.7 : 1,
      }}>
        {/* Date block */}
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '3px', padding: '0.5rem 0.75rem',
          textAlign: 'center', minWidth: '64px',
        }}>
          {ev.irl_start ? (
            <>
              <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 500, color: ev.archived ? 'var(--text-dim)' : 'var(--accent)', lineHeight: 1 }}>
                {getDay(ev.irl_start, ev.timezone)}
              </div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
                {getMonth(ev.irl_start, ev.timezone)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                {getYear(ev.irl_start, ev.timezone)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{ev.name}</span>
            {ev.archived && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '0.1rem 0.4rem',
                background: 'rgba(224,85,85,0.1)', border: '1px solid var(--danger)',
                borderRadius: '3px', color: 'var(--danger)' }}>
                Archivé
              </span>
            )}
            {ev.round_number && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                borderRadius: '3px', color: 'var(--accent)' }}>
                Manche {ev.round_number}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            {ev.circuit}
            {ev.start_count > 1 && (
              <span style={{ marginLeft: '0.75rem', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>
                {ev.start_count} créneaux
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
              {ev.team_count}
            </div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>
              Équipage{ev.team_count !== 1 ? 's' : ''}
            </div>
          </div>
          {ev.format && <span className="badge badge-admin">{ev.format}</span>}
        </div>

        <div style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>›</div>
      </div>
    </Link>
  )
}

function EventList({ events, emptyMessage }) {
  const active   = events.filter(ev => !ev.archived)
  const archived = events.filter(ev => ev.archived)
  const [showArchived, setShowArchived] = useState(false)

  return (
    <div>
      {active.length === 0 && archived.length === 0 ? (
        <div className="table-wrap"><div className="empty">{emptyMessage}</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {active.sort((a, b) => {
            if (!a.irl_start && !b.irl_start) return 0
            if (!a.irl_start) return 1
            if (!b.irl_start) return -1
            return new Date(b.irl_start) - new Date(a.irl_start)
          }).map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}

      {archived.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <button onClick={() => setShowArchived(!showArchived)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase', padding: 0,
            marginBottom: showArchived ? '1rem' : 0,
          }}>
            <span>{showArchived ? '▲' : '▼'}</span>
            Archives ({archived.length})
          </button>
          {showArchived && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {archived.sort((a, b) => {
                if (!a.irl_start && !b.irl_start) return 0
                if (!a.irl_start) return 1
                if (!b.irl_start) return -1
                return new Date(b.irl_start) - new Date(a.irl_start)
              }).map(ev => <EventCard key={ev.id} ev={ev} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChampionshipSection({ championship, rounds, admin }) {
  const [expanded, setExpanded] = useState(!championship.archived)
  const activeRounds   = rounds.filter(r => !r.archived).sort((a, b) => (a.round_number || 0) - (b.round_number || 0))
  const archivedRounds = rounds.filter(r => r.archived).sort((a, b) => (a.round_number || 0) - (b.round_number || 0))

  return (
    <div className="card" style={{ marginBottom: '0.75rem', opacity: championship.archived ? 0.7 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', marginBottom: expanded ? '1rem' : 0 }}
        onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{championship.name}</span>
            {championship.archived && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '0.1rem 0.4rem',
                background: 'rgba(224,85,85,0.1)', border: '1px solid var(--danger)',
                borderRadius: '3px', color: 'var(--danger)' }}>
                Archivé
              </span>
            )}
          </div>
          {championship.season && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
              {championship.season}
            </div>
          )}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
            {activeRounds.length} manche{activeRounds.length !== 1 ? 's' : ''} active{activeRounds.length !== 1 ? 's' : ''}
            {archivedRounds.length > 0 && ` · ${archivedRounds.length} archivée${archivedRounds.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {admin && (
            <>
                <Link href={`/championnats/${championship.id}/modifier`}
                onClick={e => e.stopPropagation()}
                className="btn btn-secondary btn-sm">
                Modifier
                </Link>
                <Link href={`/championnats/${championship.id}/nouveau-round`}
                onClick={e => e.stopPropagation()}
                className="btn btn-secondary btn-sm">
                + Manche
                </Link>
            </>
            )}
          <span style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div>
          {activeRounds.length === 0 && archivedRounds.length === 0 ? (
            <div className="empty" style={{ padding: '1rem' }}>Aucune manche configurée.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activeRounds.map(ev => <EventCard key={ev.id} ev={ev} />)}
              {archivedRounds.length > 0 && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                    Manches archivées
                  </div>
                  {archivedRounds.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'normaux',      label: 'Normaux' },
  { id: 'speciaux',     label: 'Spéciaux' },
  { id: 'championnats', label: 'Championnats' },
]

export default function EventTabs({ normalEvents, specialEvents, championshipRounds, championships, admin }) {
    const [activeTab, setActiveTab] = useState('normaux')

    useEffect(() => {
    const saved = localStorage.getItem('events-active-tab')
    if (saved) setActiveTab(saved)
    }, [])

    const switchTab = (tabId) => {
    setActiveTab(tabId)
    localStorage.setItem('events-active-tab', tabId)
    }

  const activeChampionships   = championships.filter(c => !c.archived)
  const archivedChampionships = championships.filter(c => c.archived)
  const [showArchivedChampionships, setShowArchivedChampionships] = useState(false)

  return (
    <div>
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem',
        borderBottom: '1px solid var(--border)',
        marginBottom: '1.5rem',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => switchTab(tab.id)} style={{
            padding: '0.6rem 1.25rem',
            background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-dim)',
            fontFamily: 'var(--font-rajdhani), sans-serif',
            fontSize: '0.9rem', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'color 0.15s', marginBottom: '-1px',
            whiteSpace: 'nowrap',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Normaux */}
      {activeTab === 'normaux' && (
        <EventList
          events={normalEvents}
          emptyMessage="Aucun événement normal."
        />
      )}

      {/* Spéciaux */}
      {activeTab === 'speciaux' && (
        <EventList
          events={specialEvents}
          emptyMessage="Aucun événement spécial."
        />
      )}

      {/* Championnats */}
      {activeTab === 'championnats' && (
        <div>
          {activeChampionships.length === 0 && archivedChampionships.length === 0 ? (
            <div className="table-wrap">
              <div className="empty">Aucun championnat créé.</div>
            </div>
          ) : (
            <>
              {activeChampionships.map(c => (
                <ChampionshipSection
                  key={c.id}
                  championship={c}
                  rounds={championshipRounds.filter(r => r.championship_id === c.id)}
                  admin={admin}
                />
              ))}

              {archivedChampionships.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <button onClick={() => setShowArchivedChampionships(!showArchivedChampionships)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase', padding: 0,
                    marginBottom: showArchivedChampionships ? '1rem' : 0,
                  }}>
                    <span>{showArchivedChampionships ? '▲' : '▼'}</span>
                    Championnats archivés ({archivedChampionships.length})
                  </button>
                  {showArchivedChampionships && archivedChampionships.map(c => (
                    <ChampionshipSection
                      key={c.id}
                      championship={c}
                      rounds={championshipRounds.filter(r => r.championship_id === c.id)}
                      admin={admin}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}