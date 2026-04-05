'use client'
import { useState } from 'react'
import CrewNamesManager from './CrewNamesManager'
import CarsManager from './CarsManager'
import ClassesManager from './ClassesManager'
import CircuitsManager from './CircuitsManager'
import EventTypesManager from './EventTypesManager'

const TABS = [
  { id: 'equipages',  label: 'Équipages' },
  { id: 'voitures',   label: 'Voitures' },
  { id: 'classes',    label: 'Classes' },
  { id: 'circuits',   label: 'Circuits' },
  { id: 'types',      label: "Types d'événement" },
]

export default function AdminTabs({ circuits, cars, crewNames, carClasses, eventTypes, eventTypeCars }) {
  const [activeTab, setActiveTab] = useState('equipages')

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        borderBottom: '1px solid var(--border)',
        marginBottom: '2rem',
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.6rem 1.25rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-dim)',
              fontFamily: 'var(--font-rajdhani), sans-serif',
              fontSize: '0.9rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'equipages' && (
        <CrewNamesManager initialCrewNames={crewNames} />
      )}
      {activeTab === 'voitures' && (
        <CarsManager initialCars={cars} carClasses={carClasses} />
      )}
      {activeTab === 'classes' && (
        <ClassesManager initialClasses={carClasses} />
      )}
      {activeTab === 'circuits' && (
        <CircuitsManager initialCircuits={circuits} />
      )}
      {activeTab === 'types' && (
        <EventTypesManager
          initialEventTypes={eventTypes}
          initialEventTypeCars={eventTypeCars}
          cars={cars}
          carClasses={carClasses}
        />
      )}
    </div>
  )
}