import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { getSessionAndDriver } from '../lib/auth'

export default async function Home() {
  const { driver: currentDriver } = await getSessionAndDriver()
  const isAdmin = currentDriver?.role === 'admin' || currentDriver?.role === 'super_admin'
 
  let pendingCount = 0
  if (isAdmin) {
    const { count } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('approved', false)
      .eq('refused', false)
    pendingCount = count || 0
  }

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

      {isAdmin && pendingCount > 0 && (
        <div style={{
          background: 'rgba(224,85,85,0.1)', border: '1px solid var(--danger)',
          borderRadius: '4px', padding: '0.75rem 1rem',
          marginBottom: '1.5rem', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.9rem' }}>
            ⚠️ {pendingCount} pilote{pendingCount > 1 ? 's' : ''}{' '} en attente d&apos;approbation
          </span>
          <Link href="/admin" className="btn btn-danger btn-sm">
            Gérer les accès →
          </Link>
        </div>
      )}

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
          {isAdmin && (
            <>
              <Link href="/pilotes/nouveau" className="btn btn-primary">+ Ajouter un pilote</Link>
              <Link href="/evenements/nouveau" className="btn btn-primary">+ Créer un événement</Link>
            </>
          )}
          <Link href="/evenements" className="btn btn-secondary">Voir les événements</Link>
          {currentDriver && (
            <Link href={`/pilotes/${currentDriver.id}`} className="btn btn-secondary">Mon profil</Link>
          )}
        </div>
      </div>
    </div>
  )
}