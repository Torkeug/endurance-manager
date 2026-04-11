'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function ArchiveToggle({ eventId, archived }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleToggle = async () => {
    const msg = archived
      ? 'Désarchiver cet événement ? Il sera à nouveau visible par tous les pilotes.'
      : 'Archiver cet événement ? Il passera en lecture seule pour les pilotes.'
    if (!confirm(msg)) return

    setLoading(true)
    await supabase.from('events').update({ archived: !archived }).eq('id', eventId)
    router.refresh()
    setLoading(false)
  }

  return (
    <button onClick={handleToggle} disabled={loading}
      className={archived ? 'btn btn-secondary' : 'btn btn-secondary'}
      style={{ borderColor: archived ? 'var(--accent)' : 'var(--text-dim)' }}>
      {loading ? '…' : archived ? '↩ Désarchiver' : '📦 Archiver'}
    </button>
  )
}