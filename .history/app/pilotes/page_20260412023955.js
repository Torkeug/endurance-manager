import { supabaseServer as supabase } from '../../lib/supabase-server'
import Link from 'next/link'
import { getSessionAndDriver, isAdmin } from '../../lib/auth'

export const revalidate = 0

export default async function PilotesPage() {
  const { driver: currentDriver } = await getSessionAndDriver()
  const admin = isAdmin(currentDriver)
  const isExternal = currentDriver?.role === 'external'
  const { data: pilotes, error } = await supabase
    .from('drivers')
    .select('*')
    .order('name')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Pilotes</h1>
          <div className="accent-line" />
        </div>
          {admin && (
            <Link href="/pilotes/nouveau" className="btn btn-primary">+ Ajouter un pilote</Link>
          )}
      </div>

      {error && (
        <div className="alert alert-error">Erreur : {error.message}</div>
      )}

      {!pilotes || pilotes.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">
            Aucun pilote enregistré. Commencez par en ajouter un.
          </div>
        </div>
      ) : (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '900px' }}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>iRacing ID</th>
                <th>iRating</th>
                <th>Discord</th>
                <th>Twitch</th>
                <th>Instagram</th>
                <th>Email</th>
                <th>Rôle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pilotes.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="mono" style={{ fontSize: '0.85rem' }}>
                    {p.iracing_id ? (
                    <a href={`https://members-ng.iracing.com/web/racing/profile?cust_id=${p.iracing_id}&tab=licenses`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--text-dim)', textDecoration: 'underline' }}>
                      {p.iracing_id} ↗
                    </a>
                    ) : '—'}
                  </td>
                  <td className="mono" style={{ color: 'var(--accent)' }}>
                    {p.irating ?? '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    {p.discord || '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    {p.twitch ? (
                      <a
                        href={`https://twitch.tv/${p.twitch}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#9147ff', textDecoration: 'none' }}
                      >
                        {p.twitch}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    {p.instagram
                      ? <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#405DE6' }}>{p.instagram}</a>
                      : '—'}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }} className="mono">
                    {p.email || '—'}
                  </td>
                  <td>
                    <span className="badge badge-driver" style={{
                      color: p.role === 'super_admin' ? '#e05555' : p.role === 'admin' ? 'var(--accent)' : 'var(--text-dim)',
                      borderColor: p.role === 'super_admin' ? '#e05555' : p.role === 'admin' ? 'var(--accent)' : 'var(--border)',
                    }}>
                      {p.role === 'super_admin' ? 'Super Admin' : p.role === 'admin' ? 'Admin' : 'Pilote'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link href={`/pilotes/${p.id}`} className="btn btn-primary btn-sm">Voir</Link>
                      {(admin || currentDriver?.id === p.id) && (
                        <Link href={`/pilotes/${p.id}/modifier`} className="btn btn-secondary btn-sm">Modifier</Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
        {pilotes?.length ?? 0} pilote{(pilotes?.length ?? 0) !== 1 ? 's' : ''}
      </div>
    </div>
  )
}