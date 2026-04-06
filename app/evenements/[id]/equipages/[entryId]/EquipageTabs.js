'use client'
import { useState } from 'react'
import DriversAssignment from './DriversAssignment'
import AvailabilityGrid from './AvailabilityGrid'
import PerformanceData from './PerformanceData'
import StintGrid from './StintGrid'

const TABS = [
  { id: 'pilotes',       label: 'Pilotes' },
  { id: 'disponibilites', label: 'Disponibilités' },
  { id: 'relais',        label: 'Relais' },
  { id: 'performances',  label: 'Performances' },
]

export default function EquipageTabs({
  entryId,
  teamEntry,
  assignedDrivers,
  unassignedDrivers,
  entryCarId,
  entryClass,
}) {
  const [activeTab, setActiveTab] = useState('relais')

  const tabBar = (
    <div style={{
      display: 'flex', gap: '0.25rem',
      borderBottom: '1px solid var(--border)',
      marginBottom: '1.5rem', flexWrap: 'wrap',
    }}>
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
          padding: '0.6rem 1.25rem',
          background: 'transparent', border: 'none',
          borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
          color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-dim)',
          fontFamily: 'var(--font-rajdhani), sans-serif',
          fontSize: '0.9rem', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'color 0.15s', marginBottom: '-1px',
        }}>
          {tab.label}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      {tabBar}

      {activeTab === 'pilotes' && (
        <DriversAssignment
          entryId={entryId}
          entryCarId={entryCarId}
          entryClass={entryClass}
          assignedDrivers={assignedDrivers}
          unassignedDrivers={unassignedDrivers}
        />
      )}

      {activeTab === 'disponibilites' && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
            Sélectionnez votre nom et cliquez ou glissez sur les créneaux pour marquer votre disponibilité.
          </p>
          <AvailabilityGrid
            teamEntryId={entryId}
            assignedDrivers={assignedDrivers}
            irlStart={teamEntry.event_start_times?.irl_start || null}
            durationMinutes={teamEntry.events?.duration_minutes || 0}
            igStartTime={teamEntry.events?.ig_start_time || null}
            igSunrise={teamEntry.events?.ig_sunrise || null}
            igSunset={teamEntry.events?.ig_sunset || null}
          />
        </>
      )}

      {activeTab === 'relais' && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
            Les temps IRL et IG sont calculés automatiquement. Les points colorés indiquent la disponibilité de chaque pilote.
          </p>
          <StintGrid
            teamEntryId={entryId}
            teamEntry={teamEntry}
            assignedDrivers={assignedDrivers}
          />
        </>
      )}

      {activeTab === 'performances' && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
            Chronos et consommations relevés lors des essais. Cliquez sur Modifier pour renseigner vos données.
          </p>
          <PerformanceData
            teamEntryId={entryId}
            assignedDrivers={assignedDrivers}
          />
        </>
      )}
    </div>
  )
}