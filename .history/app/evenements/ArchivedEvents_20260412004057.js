'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
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

export default function ArchivedEvents({ events }) {
    const [open, setOpen] = useState(false)

    useEffect(() => {
    const saved = localStorage.getItem('archives-collapsed')
    if (saved !== null) setOpen(saved === 'true')
    }, [])

  if (events.length === 0) return null

  return (
    <div style={{ marginTop: '2rem' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', padding: 0,
        marginBottom: open ? '1rem' : 0,
      }}>
        <span>{open ? '▲' : '▼'}</span>
        Archives ({events.length})
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {events.map(ev => (
            <Link key={ev.id} href={`/evenements/${ev.id}`}
              style={{ textDecoration: 'none', opacity: 0.7 }}>
              <div className="card" style={{
                display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
              }}>
                {/* Date block */}
                <div style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: '3px', padding: '0.5rem 0.75rem',
                  textAlign: 'center', minWidth: '64px',
                }}>
                  {ev.irl_start ? (
                    <>
                      <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--text-dim)', lineHeight: 1 }}>
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
                      —
                    </div>
                  )}
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{ev.name}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', padding: '0.1rem 0.4rem',
                      background: 'rgba(224,85,85,0.1)', border: '1px solid var(--danger)',
                      borderRadius: '3px', color: 'var(--danger)' }}>
                      Archivé
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                    {ev.circuit}
                  </div>
                </div>

                {ev.format && (
                  <span className="badge badge-admin">{ev.format}</span>
                )}
                <div style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>›</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}