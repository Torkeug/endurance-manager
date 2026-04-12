import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { getSessionAndDriver } from '../lib/auth'

export default async function Home() {
  const { count: pilotesCount } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })

  const { count: evenementsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  const stats = [
    { label: 'Pilotes',     value: pilotesCount ?? 0,    href: '/pilotes' },
    { label: 'Événements',  value: evenementsCount ?? 0, href: '/evenements' },
    { label: 'Circuits',    value: 52,                   href: null },
    { label: 'Voitures',    value: 28,                   href: null },
  ]

  return (
    <div className="page">
      <div style={{ marginBottom: '3rem' }}>
        <h1>Tableau de bord</h1>
        <div className="accent-line" />
        <p style={{ color: 'var(--text-dim)', marginTop: '0.75rem', fontSize: '0.95rem' }}>
          Kronos SimSports — Planification courses d&apos;endurance
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '3rem',
      }}>
        {stats.map(({ label, value, href }) => {
          const content = (
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="mono" style={{
                fontSize: '2.5rem',
                fontWeight: 500,
                color: 'var(--accent)',
                lineHeight: 1,
                marginBottom: '0.5rem',
              }}>
                {value}
              </div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
              }}>
                {label}
              </div>
            </div>
          )

          return href ? (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              {content}
            </Link>
          ) : (
            <div key={label}>{content}</div>
          )
        })}
      </div>

      {/* Quick links */}
      <div>
        <h2 style={{ marginBottom: '1rem' }}>Actions rapides</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/pilotes/nouveau" className="btn btn-primary">+ Ajouter un pilote</Link>
          <Link href="/evenements/nouveau" className="btn btn-primary">+ Créer un événement</Link>
        </div>
      </div>
    </div>
  )
}