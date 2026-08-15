import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const REFRESH_MS = 15000

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}m ${sec}s`
}

function timeAgo(ms) {
  if (!ms) return '—'
  const diffMin = Math.floor((Date.now() - ms) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

function StatCard({ label, value, unit = '', warn = false, invert = false, decimals = 1 }) {
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
        {value === null || value === undefined ? '—' : `${Number(value).toFixed(decimals)}${unit}`}
      </div>
    </div>
  )
}

function BoolCard({ label, ok }) {
  return (
    <div style={{
      padding: '1rem', borderRadius: 8,
      background: ok ? '#f0fdf4' : '#fee2e2',
      border: `1px solid ${ok ? '#16a34a' : '#dc2626'}`
    }}>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: ok ? '#16a34a' : '#dc2626' }}>
        {ok === null || ok === undefined ? '—' : ok ? 'OK' : 'KO'}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    SUCCESS: { bg: '#dcfce7', color: '#16a34a', label: 'SUCCÈS' },
    FAILURE: { bg: '#fee2e2', color: '#dc2626', label: 'ÉCHEC' },
    UNSTABLE: { bg: '#fef9c3', color: '#ca8a04', label: 'INSTABLE' },
    ABORTED: { bg: '#f3f4f6', color: '#6b7280', label: 'ANNULÉ' },
    BUILDING: { bg: '#dbeafe', color: '#2563eb', label: 'EN COURS' },
  }
  const s = map[status] || { bg: '#f3f4f6', color: '#6b7280', label: status || 'INCONNU' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      background: s.bg, color: s.color, fontSize: 12, fontWeight: 600
    }}>
      {s.label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const map = {
    Emergency: { bg: '#fee2e2', color: '#991b1b' },
    Alert: { bg: '#fee2e2', color: '#b91c1c' },
    Critical: { bg: '#fee2e2', color: '#dc2626' },
    Error: { bg: '#ffedd5', color: '#c2410c' },
    Warning: { bg: '#fef9c3', color: '#ca8a04' },
    Notice: { bg: '#dbeafe', color: '#2563eb' },
  }
  const s = map[priority] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', flexShrink: 0
    }}>
      {priority || '?'}
    </span>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: 18, borderBottom: '1px solid #e5e5e5', paddingBottom: 4, marginBottom: 2 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>{subtitle}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {children}
      </div>
    </section>
  )
}

function PipelineCard({ data }) {
  if (!data || !data.available) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', gridColumn: '1 / -1', color: '#888' }}>
        Jenkins injoignable ou aucun build trouvé
      </div>
    )
  }
  const status = data.building ? 'BUILDING' : data.result

  return (
    <div style={{ padding: '1.25rem', borderRadius: 8, background: '#fff', border: '1px solid #e5e5e5', gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Dernier build</div>
          <a href={data.url} target="_blank" rel="noreferrer"
             style={{ fontSize: 20, fontWeight: 'bold', color: '#111', textDecoration: 'none' }}>
            {data.job_name || 'taskmanager'} #{data.build_number}
          </a>
        </div>
        <StatusBadge status={status} />
        <div style={{ fontSize: 13, color: '#666' }}>
          Durée : {data.building ? 'en cours…' : formatDuration(data.duration_ms)}
        </div>
        <div style={{ fontSize: 13, color: '#666' }}>{timeAgo(data.timestamp_ms)}</div>
      </div>

      {data.stages?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: '1rem', flexWrap: 'wrap' }}>
          {data.stages.map((s, i) => (
            <div key={i} style={{
              flex: '1 1 120px', padding: '0.5rem', borderRadius: 6, textAlign: 'center',
              background: s.status === 'SUCCESS' ? '#f0fdf4' : s.status === 'FAILED' ? '#fee2e2' : '#f9fafb',
              border: `1px solid ${s.status === 'SUCCESS' ? '#bbf7d0' : s.status === 'FAILED' ? '#fecaca' : '#e5e5e5'}`
            }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#666' }}>{formatDuration(s.duration_ms)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BuildHistoryTimeline({ data }) {
  if (!data || !data.available || !data.builds?.length) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', gridColumn: '1 / -1', color: '#888' }}>
        Aucun historique de build disponible
      </div>
    )
  }
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {data.builds.map((b) => (
          <a
        
          key={b.build_number}
          href={b.url}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: '0 0 150px', padding: '0.75rem', borderRadius: 8, textDecoration: 'none', color: '#111',
            background: '#fff', border: '1px solid #e5e5e5'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>#{b.build_number}</span>
            <StatusBadge status={b.result} />
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{formatDuration(b.duration_ms)}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{timeAgo(b.timestamp_ms)}</div>
        </a>
      ))}
    </div>
  )
}

function QualityGateCard({ data }) {
  if (!data || !data.available) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', gridColumn: '1 / -1', color: '#888' }}>
        SonarCloud injoignable ou aucune analyse disponible
      </div>
    )
  }
  const gateOk = data.quality_gate_status === 'OK'
  return (
    <>
      <BoolCard label="Quality Gate" ok={gateOk} />
      <StatCard label="Bugs" value={Number(data.bugs)} warn={0} decimals={0} />
      <StatCard label="Vulnérabilités" value={Number(data.vulnerabilities)} warn={0} decimals={0} />
      <StatCard label="Code smells" value={Number(data.code_smells)} warn={10} decimals={0} />
      <StatCard label="Security hotspots" value={Number(data.security_hotspots)} warn={0} decimals={0} />
      <StatCard label="Couverture" value={Number(data.coverage)} unit="%" warn={80} invert decimals={1} />
      {data.project_url && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
          <a href={data.project_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>
            Voir l'analyse complète sur SonarCloud →
          </a>
        </div>
      )}
    </>
  )
}

function FalcoRecentEvents({ data }) {
  if (!data || !data.available) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', color: '#888' }}>
        Aucun événement récent disponible
      </div>
    )
  }
  if (!data.events?.length) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a' }}>
        Aucun événement critique récent
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.events.map((e, i) => (
        <div key={i} style={{
          padding: '0.6rem 0.75rem', borderRadius: 8, background: '#fff',
          border: '1px solid #e5e5e5', display: 'flex', gap: 10, alignItems: 'flex-start'
        }}>
          <PriorityBadge priority={e.priority} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{e.rule || 'Règle inconnue'}</div>
            <div
              title={e.output}
              style={{
                fontSize: 11, color: '#666', marginTop: 2, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis'
              }}
            >
              {e.output}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>
            {e.time ? new Date(e.time).toLocaleTimeString('fr-FR') : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

function PodsHealthCard({ data }) {
  if (!data) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', gridColumn: '1 / -1', color: '#888' }}>
        Métriques pods indisponibles
      </div>
    )
  }
  return (
    <>
      <BoolCard label="Nœud prêt" ok={data.node_ready === 1 || data.node_ready === true} />
      <StatCard label="App — mémoire" value={data.app_memory_percent} unit="%" warn={85} />
      <StatCard label="DB — mémoire" value={data.db_memory_percent} unit="%" warn={85} />
      <StatCard label="Redémarrages App" value={data.app_restarts} warn={5} decimals={0} />
      <StatCard label="Redémarrages DB" value={data.db_restarts} warn={5} decimals={0} />
      <StatCard label="Redémarrages Backend" value={data.backend_restarts} warn={5} decimals={0} />
    </>
  )
}

function auditDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function AuditsCard({ data }) {
  if (!data) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', gridColumn: '1 / -1', color: '#888' }}>
        Rapports d'audit indisponibles
      </div>
    )
  }

  const bench = data.kube_bench
  const hunter = data.kube_hunter

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>

      <div style={{ padding: '1.25rem', borderRadius: 8, background: '#fff', border: '1px solid #e5e5e5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>kube-bench</div>
            <div style={{ fontSize: 11, color: '#999' }}>Conformité CIS Kubernetes Benchmark</div>
          </div>
          {bench?.available && (
            <span style={{ fontSize: 11, color: '#999' }}>audit du {auditDate(bench.scanned_at)}</span>
          )}
        </div>

        {!bench?.available && <div style={{ color: '#888', fontSize: 13 }}>Aucun rapport disponible</div>}

        {bench?.available && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span style={{
                fontSize: 34, fontWeight: 700,
                color: bench.score_percent >= 80 ? '#16a34a' : bench.score_percent >= 60 ? '#ca8a04' : '#dc2626'
              }}>
                {bench.score_percent}%
              </span>
              <span style={{ fontSize: 12, color: '#666' }}>de conformité (contrôles automatisés)</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{bench.passed}</div>
                <div style={{ fontSize: 10, color: '#666' }}>CONFORMES</div>
              </div>
              <div style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#fee2e2', border: '1px solid #fecaca', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{bench.failed}</div>
                <div style={{ fontSize: 10, color: '#666' }}>ÉCHECS</div>
              </div>
              <div style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#fef9c3', border: '1px solid #fde68a', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ca8a04' }}>{bench.warned}</div>
                <div style={{ fontSize: 10, color: '#666' }}>MANUELS</div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 600 }}>Détail par section</div>
            {bench.sections?.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 11 }}>
                <span style={{ color: '#999', minWidth: 14 }}>{s.id}</span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.text}</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{s.passed}</span>
                <span style={{ color: '#ccc' }}>/</span>
                <span style={{ color: s.failed > 0 ? '#dc2626' : '#ccc', fontWeight: 600 }}>{s.failed}</span>
                <span style={{ color: '#ccc' }}>/</span>
                <span style={{ color: '#ca8a04', fontWeight: 600 }}>{s.warned}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ padding: '1.25rem', borderRadius: 8, background: '#fff', border: '1px solid #e5e5e5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>kube-hunter</div>
            <div style={{ fontSize: 11, color: '#999' }}>Test d'intrusion externe du cluster</div>
          </div>
          {hunter?.available && (
            <span style={{ fontSize: 11, color: '#999' }}>audit du {auditDate(hunter.scanned_at)}</span>
          )}
        </div>

        {!hunter?.available && <div style={{ color: '#888', fontSize: 13 }}>Aucun rapport disponible</div>}

        {hunter?.available && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e5e5', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{hunter.nodes_count}</div>
                <div style={{ fontSize: 10, color: '#666' }}>NŒUDS</div>
              </div>
              <div style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e5e5', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{hunter.services_count}</div>
                <div style={{ fontSize: 10, color: '#666' }}>SERVICES</div>
              </div>
              <div style={{
                flex: 1, padding: '0.5rem', borderRadius: 6, textAlign: 'center',
                background: hunter.vulnerabilities_count > 0 ? '#fee2e2' : '#f0fdf4',
                border: `1px solid ${hunter.vulnerabilities_count > 0 ? '#fecaca' : '#bbf7d0'}`
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: hunter.vulnerabilities_count > 0 ? '#dc2626' : '#16a34a' }}>
                  {hunter.vulnerabilities_count}
                </div>
                <div style={{ fontSize: 10, color: '#666' }}>VULNÉRABILITÉS</div>
              </div>
            </div>

            {hunter.vulnerabilities?.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 600 }}>Détections</div>
                {hunter.vulnerabilities.map((v, i) => (
                  <div key={i} style={{ padding: '0.5rem', borderRadius: 6, background: '#fafafa', border: '1px solid #eee', marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <PriorityBadge priority={v.severity ? v.severity.charAt(0).toUpperCase() + v.severity.slice(1) : '?'} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{v.vid} — {v.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{v.description}</div>
                    {v.reference && (
                      <a href={v.reference} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>
                        Documentation →
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AlertsCard({ data }) {
  if (!data) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', gridColumn: '1 / -1', color: '#888' }}>
        Alertes indisponibles
      </div>
    )
  }
  if (!data.available) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #e5e5e5', gridColumn: '1 / -1', color: '#888' }}>
        {data.reason || 'Alertes indisponibles'}
      </div>
    )
  }
  if (data.total === 0) {
    return (
      <div style={{ padding: '1rem', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', gridColumn: '1 / -1', color: '#16a34a' }}>
        Aucune alerte active
      </div>
    )
  }

  const grouped = []
  data.alerts.forEach((a) => {
    const existing = grouped.find(g => g.name === a.name && g.severity === a.severity)
    if (existing) {
      existing.count += 1
      if ((a.duration_minutes || 0) > (existing.duration_minutes || 0)) {
        existing.duration_minutes = a.duration_minutes
      }
    } else {
      grouped.push({ ...a, count: 1 })
    }
  })

  const fmtDuration = (min) => {
    if (min === null || min === undefined) return '—'
    if (min < 60) return `${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}j`
  }

  const sevColor = (sev) => {
    if (sev === 'critical') return { bg: '#fee2e2', border: '#fecaca', dot: '#dc2626' }
    if (sev === 'warning') return { bg: '#fef9c3', border: '#fde68a', dot: '#ca8a04' }
    return { bg: '#f9fafb', border: '#e5e5e5', dot: '#6b7280' }
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(data.by_severity).map(([sev, n]) => (
          <span key={sev} style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: sevColor(sev).bg, color: sevColor(sev).dot,
            border: `1px solid ${sevColor(sev).border}`
          }}>
            {n} {sev}
          </span>
        ))}
        {Object.entries(data.by_category).map(([cat, n]) => (
          <span key={cat} style={{ fontSize: 11, color: '#666' }}>
            {cat} : {n}
          </span>
        ))}
        {data.silenced > 0 && (
          <span style={{ fontSize: 11, color: '#999' }}>({data.silenced} silencée{data.silenced > 1 ? 's' : ''})</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {grouped.map((a, i) => {
          const c = sevColor(a.severity)
          return (
            <div key={i} style={{
              padding: '0.7rem 0.9rem', borderRadius: 8, background: '#fff',
              border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.dot}`,
              display: 'flex', alignItems: 'center', gap: 12, opacity: a.silenced ? 0.55 : 1
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.name}
                  {a.count > 1 && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: '#f3f4f6', color: '#6b7280' }}>
                      ×{a.count}
                    </span>
                  )}
                  {a.no_data && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: '#e0e7ff', color: '#4338ca' }}>
                      SANS DONNÉES
                    </span>
                  )}
                  {a.silenced && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: '#f3f4f6', color: '#6b7280' }}>
                      SILENCÉE
                    </span>
                  )}
                </div>
                {a.summary && (
                  <div
                    title={a.summary}
                    style={{
                      fontSize: 11, color: '#666', marginTop: 3,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}
                  >
                    {a.summary.replace(/^Summary:\s*/, '').split('\n')[0]}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#999', flexShrink: 0, textAlign: 'right' }}>
                <div>{a.category}</div>
                <div>depuis {fmtDuration(a.duration_minutes)}</div>
              </div>
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer"
                   style={{ fontSize: 11, color: '#2563eb', flexShrink: 0, textDecoration: 'none' }}>
                  Grafana →
                </a>
              )}
            </div>
          )
        })}
      </div>

      {data.grafana_alerting_url && (
        <div style={{ textAlign: 'right', marginTop: 10 }}>
          <a href={data.grafana_alerting_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>
            Gérer toutes les alertes dans Grafana →
          </a>
        </div>
      )}
    </div>
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
        .then(d => { setData(d); setError(null) })
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
  const pipeline = useEndpoint('/pipeline')
  const pipelineHistory = useEndpoint('/pipeline/history')
  const quality = useEndpoint('/quality')
  const falco = useEndpoint('/security/falco')
  const falcoRecent = useEndpoint('/security/falco/recent')
  const scans = useEndpoint('/security/scans')
  const tunnel = useEndpoint('/tunnel')
  const pods = useEndpoint('/pods')
  const alerts = useEndpoint('/alerts')
  const audits = useEndpoint('/audits')

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

      <Section title="Alertes actives" subtitle="Règles Grafana actuellement déclenchées">
        {alerts.error && <p style={{ color: 'red' }}>{alerts.error}</p>}
        <AlertsCard data={alerts.data} />
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

      <Section title="Santé des pods / du nœud" subtitle="Consommation mémoire et stabilité des composants critiques">
        {pods.error && <p style={{ color: 'red' }}>{pods.error}</p>}
        <PodsHealthCard data={pods.data} />
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

      <Section title="Pipeline CI/CD — Jenkins">
        {pipeline.error && <p style={{ color: 'red' }}>{pipeline.error}</p>}
        <PipelineCard data={pipeline.data} />
      </Section>

      <Section title="Historique des builds" subtitle="5 derniers builds du pipeline">
        {pipelineHistory.error && <p style={{ color: 'red' }}>{pipelineHistory.error}</p>}
        <BuildHistoryTimeline data={pipelineHistory.data} />
      </Section>

      <Section title="Qualité du code — SonarCloud">
        {quality.error && <p style={{ color: 'red' }}>{quality.error}</p>}
        <QualityGateCard data={quality.data} />
      </Section>

      <Section title="Sécurité runtime — Falco" subtitle="Événements critiques détectés par le moteur eBPF, remontés via Loki">
        {falco.error && <p style={{ color: 'red' }}>{falco.error}</p>}
        {falco.data && (
          <>
            <StatCard label="Événements critiques (1h)" value={falco.data.critical_events_1h} warn={5} decimals={0} />
            <StatCard label="Événements critiques (24h)" value={falco.data.critical_events_24h} warn={20} decimals={0} />
            {falco.data.grafana_url && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                <a href={falco.data.grafana_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>
                  Voir les logs complets dans Grafana →
                </a>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Falco — derniers événements">
        {falcoRecent.error && <p style={{ color: 'red' }}>{falcoRecent.error}</p>}
        <div style={{ gridColumn: '1 / -1' }}>
          <FalcoRecentEvents data={falcoRecent.data} />
        </div>
      </Section>

      <Section
        title="Résultats des scans de sécurité"
        subtitle={scans.data?.available ? `Basé sur le build #${scans.data.build_number} (${timeAgo(scans.data.timestamp_ms)})` : undefined}
      >
        {scans.error && <p style={{ color: 'red' }}>{scans.error}</p>}
        {scans.data && !scans.data.available && <p style={{ color: '#888' }}>Aucun rapport disponible</p>}
        {scans.data?.available && (
          <>
            <StatCard label="Trivy — CVE critiques" value={scans.data.trivy?.critical} warn={0} decimals={0} />
            <StatCard label="Trivy — CVE élevées" value={scans.data.trivy?.high} warn={0} decimals={0} />
            <StatCard label="Gitleaks — Secrets détectés" value={scans.data.gitleaks?.secrets_found} warn={0} decimals={0} />
            <StatCard label="Checkov — Contrôles échoués" value={scans.data.checkov?.failed} warn={0} decimals={0} />
            {(scans.data.artifact_urls?.trivy || scans.data.artifact_urls?.gitleaks || scans.data.artifact_urls?.checkov) && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 12 }}>
                {scans.data.artifact_urls?.trivy && (
                  <a href={scans.data.artifact_urls.trivy} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Rapport Trivy →</a>
                )}
                {scans.data.artifact_urls?.gitleaks && (
                  <a href={scans.data.artifact_urls.gitleaks} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Rapport Gitleaks →</a>
                )}
                {scans.data.artifact_urls?.checkov && (
                  <a href={scans.data.artifact_urls.checkov} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Rapport Checkov →</a>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Audits de sécurité du cluster" subtitle="Analyses ponctuelles de conformité et de vulnérabilités">
        {audits.error && <p style={{ color: 'red' }}>{audits.error}</p>}
        <AuditsCard data={audits.data} />
      </Section>

      <Section title="Tunnel Cloudflare">
        {tunnel.error && <p style={{ color: 'red' }}>{tunnel.error}</p>}
        {tunnel.data && (
          <>
            <BoolCard label="Tunnel joignable" ok={tunnel.data.reachable} />
            <StatCard label="Connexions actives" value={tunnel.data.active_connections} warn={0} invert decimals={0} />
            <StatCard label="Erreurs de config" value={tunnel.data.config_push_errors} warn={0} decimals={0} />
          </>
        )}
      </Section>
    </div>
  )
}
