import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const REFRESH_MS = 15000

function StatCard({ label, value, unit = '', warn = false, invert = false }) {
  const isBad = value === null || value === undefined
    ? false
    : invert ? value < warn : value > warn
  return (
    <div style={{
      padding: '1rem', borderRadius: 8,
      background: isBad ? '#fee2e2' : '#f0fdf4',
      border: `1px solid ${isBad ? '#dc2626' : '#16a34a'}`
    }}>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>
        {value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}${unit}`}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: 18, borderBottom: '1px solid #e5e5e5', paddingBottom: 4 }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {children}
      </div>
    </section>
  )
}

function useEndpoint(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = () => {
      fetch(`${API_BASE}${path}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then(setData)
        .catch(() => setError('Impossible de joindre le backend'))
    }
    fetchData()
    const interval = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(interval)
  }, [path])

  return { data, error }
}

export default function App() {
  const overview = useEndpoint('/overview')
  const application = useEndpoint('/application')
  const database = useEndpoint('/database')

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1>DevSecOps Dashboard — Vue d'ensemble</h1>
      <p style={{ color: '#888', fontSize: 13 }}>Rafraîchissement automatique toutes les 15 secondes</p>

      <Section title="État global">
        {overview.error && <p style={{ color: 'red' }}>{overview.error}</p>}
        {overview.data && (
          <>
            <StatCard label="Alertes actives" value={overview.data.alerts_firing} warn={0} />
            <StatCard label="Pods en échec" value={overview.data.pods_failed} warn={0} />
            <StatCard label="App up" value={overview.data.app_up} warn={0} invert />
            <StatCard label="DB up" value={overview.data.db_up} warn={0} invert />
          </>
        )}
      </Section>

      <Section title="Infrastructure">
        {overview.data && (
          <>
            <StatCard label="CPU cluster" value={overview.data.cpu_percent} unit="%" warn={80} />
            <StatCard label="RAM disponible" value={overview.data.ram_available_percent} unit="%" warn={20} invert />
            <StatCard label="Disque disponible (/var)" value={overview.data.disk_available_percent} unit="%" warn={15} invert />
          </>
        )}
      </Section>

      <Section title="Application Task Manager">
        {application.error && <p style={{ color: 'red' }}>{application.error}</p>}
        {application.data && (
          <>
            <StatCard label="Requêtes/s" value={application.data.request_rate} unit="/s" warn={999999} />
            <StatCard label="Taux d'erreur" value={application.data.error_rate_percent} unit="%" warn={5} />
            <StatCard label="Sessions actives" value={application.data.active_sessions} warn={999999} />
            <StatCard label="Répliques" value={application.data.replicas} warn={999999} />
          </>
        )}
      </Section>

      <Section title="Base de données PostgreSQL">
        {database.error && <p style={{ color: 'red' }}>{database.error}</p>}
        {database.data && (
          <>
            <StatCard label="Connexions actives" value={database.data.connections_active} warn={999999} />
            <StatCard label="Connexions totales" value={database.data.connections_total} warn={999999} />
            <StatCard
              label="Taille de la base"
              value={database.data.db_size_bytes ? database.data.db_size_bytes / 1024 / 1024 : null}
              unit=" Mo"
              warn={999999}
            />
          </>
        )}
      </Section>
    </div>
  )
}
