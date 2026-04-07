'use client'
import { useState } from 'react'
import CrewNamesManager from './CrewNamesManager'
import CarsManager from './CarsManager'
import ClassesManager from './ClassesManager'
import CircuitsManager from './CircuitsManager'
import EventTypesManager from './EventTypesManager'
import DriversManager from './DriversManager'

const TABS = [
  { id: 'pilotes',   label: 'Pilotes' },
  { id: 'equipages', label: 'Équipages' },
  { id: 'voitures',  label: 'Voitures' },
  { id: 'classes',   label: 'Classes' },
  { id: 'circuits',  label: 'Circuits' },
  { id: 'types',     label: "Types d'événement" },
]

export default function AdminTabs({ circuits, cars, crewNames, carClasses, eventTypes, eventTypeCars, drivers, currentDriver }) {
  const [activeTab, setActiveTab] = useState('pilotes')
  const pendingCount = (drivers || []).filter(d => !d.approved && !d.refused).length

  return (
    <div>
      <div style={{
        display: 'flex', gap: '0.25rem',
        borderBottom: '1px solid var(--border)',
        marginBottom: '2rem', flexWrap: 'wrap',
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
            {tab.id === 'pilotes' && pendingCount > 0 && (
              <span style={{
                marginLeft: '0.4rem', background: 'var(--danger)', color: '#fff',
                fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px',
                borderRadius: '10px', verticalAlign: 'middle',
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'pilotes'   && <DriversManager initialDrivers={drivers || []} currentDriver={currentDriver} />}
      {activeTab === 'equipages' && <CrewNamesManager initialCrewNames={crewNames} />}
      {activeTab === 'voitures'  && <CarsManager initialCars={cars} />}
      {activeTab === 'classes'   && <ClassesManager initialClasses={carClasses} initialCars={cars} />}
      {activeTab === 'circuits'  && <CircuitsManager initialCircuits={circuits} />}
      {activeTab === 'types'     && (
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