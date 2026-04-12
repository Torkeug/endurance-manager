import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export const revalidate = 0

function getDay(dateStr) {
  if (!dateStr) return '—'
  return dateStr.split('-')[2]
}

function getMonth(dateStr) {
  if (!dateStr) return ''
  const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
  return months[parseInt(dateStr.split('-')[1]) - 1]
}

function getYear(dateStr) {
  if (!dateStr) return ''
  return dateStr.split('-')[0]
}

function formatDuration(hours) {
  if (!hours) return '—'
  if (hours % 1 === 0) return `${hours}h`
  const h = Math.floor(hours)
  const m = Math.round((hours % 1) * 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

export default async function EvenementsPage() {
  const { data: evenements, error } = await supabase
    .from('events')
    .select('*, circuits (name), car_entries (id)')
    .order('date', { ascending: false })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Événements</h1>
          <div className="accent-line" />
        </div>
        <Link href="/evenements/nouveau" className="btn btn-primary">
          + Créer un événement
        </Link>
      </div>

      {error && <div className="alert alert-error">Erreur : {error.message}</div>}

      {!evenements || evenements.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">Aucun événement créé. Commencez par en créer un.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {evenements.map((ev) => (
            <Link key={ev.id} href={`/evenements/${ev.id}`} className="event-card-link" style={{ textDecoration: 'none' }}>
              <div className="card event-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                {/* Date block */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '3px', padding: '0.5rem 0.75rem', textAlign: 'center', minWidth: '64px' }}>
                  <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>{getDay(ev.date)}</div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>{getMonth(ev.date)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{getYear(ev.date)}</div>
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{ev.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{ev.circuits?.name || '—'}</div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="mono" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>{formatDuration(ev.duration_hours)}</div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>Durée</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="mono" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>{ev.car_entries?.length ?? 0}</div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)' }}>Voiture{(ev.car_entries?.length ?? 0) !== 1 ? 's' : ''}</div>
                  </div>
                  {ev.format && <span className="badge badge-admin">{ev.format}</span>}
                </div>

                <div style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>›</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        {evenements?.length ?? 0} événement{(evenements?.length ?? 0) !== 1 ? 's' : ''}
      </div>
    </div>
  )
}