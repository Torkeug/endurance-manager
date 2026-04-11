'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const DURATION_PRESETS = [
  { label: '2h', value: 120 },
  { label: '2h30', value: 150 },
  { label: '2h40', value: 160 },
  { label: '3h', value: 180 },
  { label: '6h', value: 360 },
  { label: '8h', value: 480 },
  { label: '12h', value: 720 },
  { label: '24h', value: 1440 },
]

export default function SettingsManager({ initialSettings }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  const defaultDuration = parseInt(initialSettings?.default_event_duration_minutes || '160')
  const [duration, setDuration] = useState(defaultDuration)
  const [customH, setCustomH]   = useState('')
  const [customM, setCustomM]   = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const isPreset = DURATION_PRESETS.some(d => d.value === duration)

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(false)
    const { error: err } = await supabase.from('settings')
      .upsert({ key: 'default_event_duration_minutes', value: String(duration) })
    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true)
    setSaving(false)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  const durationButtonStyle = (value) => ({
    padding: '0.45rem 1rem', borderRadius: '3px', border: '1px solid',
    borderColor: duration === value ? 'var(--accent)' : 'var(--border)',
    background: duration === value ? 'var(--accent-dim)' : 'var(--surface-2)',
    color: duration === value ? 'var(--accent)' : 'var(--text-dim)',
    fontFamily: 'var(--font-mono), monospace', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.9rem', transition: 'all 0.15s',
  })

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✓ Paramètres enregistrés.</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-dim)' }}>Durée par défaut des événements</h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {DURATION_PRESETS.map(({ label, value }) => (
            <button key={value} type="button"
              onClick={() => { setDuration(value); setCustomH(''); setCustomM('') }}
              style={durationButtonStyle(value)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Autre :</span>
          <input type="number" min="0" max="99" value={customH}
            onChange={e => {
              setCustomH(e.target.value)
              const h = parseInt(e.target.value) || 0
              const m = parseInt(customM) || 0
              const total = h * 60 + m
              if (total > 0) setDuration(total)
            }}
            placeholder="h"
            style={{ width: '70px', padding: '0.45rem 0.5rem', background: 'var(--surface-2)',
              border: '1px solid', borderColor: !isPreset ? 'var(--accent)' : 'var(--border)',
              borderRadius: '3px', color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
          <span style={{ color: 'var(--text-dim)' }}>h</span>
          <input type="number" min="0" max="59" value={customM}
            onChange={e => {
              setCustomM(e.target.value)
              const h = parseInt(customH) || 0
              const m = parseInt(e.target.value) || 0
              const total = h * 60 + m
              if (total > 0) setDuration(total)
            }}
            placeholder="min"
            style={{ width: '70px', padding: '0.45rem 0.5rem', background: 'var(--surface-2)',
              border: '1px solid', borderColor: !isPreset ? 'var(--accent)' : 'var(--border)',
              borderRadius: '3px', color: 'var(--text)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.9rem' }} />
          <span style={{ color: 'var(--text-dim)' }}>min</span>
          {!isPreset && duration > 0 && (
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem' }}>
              = {Math.floor(duration / 60)}h{(duration % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
          Durée actuelle par défaut : <span className="mono" style={{ color: 'var(--accent)' }}>
            {Math.floor(defaultDuration / 60)}h{(defaultDuration % 60).toString().padStart(2, '0')}
          </span>
        </div>

        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  )
}