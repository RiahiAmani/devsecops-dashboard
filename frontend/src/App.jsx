import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const REFRESH_MS = 15000
const THEME_KEY = 'devsecops-dashboard-theme'

const MONO = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace"
const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const LIGHT = {
  mode: 'light',
  ink: '#0E1420', inkSoft: '#1B2432',
  canvas: '#F6F7F9', surface: '#FFFFFF', surfaceAlt: '#FAFBFC',
  border: '#E4E8EE', borderSoft: '#EDF0F4',
  text: '#18202D', muted: '#6C7789', faint: '#9BA5B4',
  ok: '#0F7B53', okBg: '#E9F6F0', okBd: '#CBE7DB',
  warn: '#A66200', warnBg: '#FDF3E3', warnBd: '#EFDCBB',
  crit: '#B3352C', critBg: '#FBEBEA', critBd: '#F0CFCC',
  accent: '#2B5FD9', accentBg: '#EAEFFB', accentBd: '#CFDBF7',
  neutralBg: '#F1F3F6',
  mono: MONO, sans: SANS,
}

const DARK = {
  mode: 'dark',
  ink: '#080C13', inkSoft: '#151C27',
  canvas: '#0D131C', surface: '#141C27', surfaceAlt: '#111925',
  border: '#25303F', borderSoft: '#1E2836',
  text: '#E4E9F0', muted: '#8B97A8', faint: '#5F6B7C',
  ok: '#3ECF8E', okBg: '#11291F', okBd: '#1F4635',
  warn: '#E0A64A', warnBg: '#2A2115', warnBd: '#4A3A1E',
  crit: '#E5645A', critBg: '#2A1614', critBd: '#4C2723',
  accent: '#6C97F5', accentBg: '#161F33', accentBd: '#28375A',
  neutralBg: '#1A2432',
  mono: MONO, sans: SANS,
}

const GRAFANA = {
  infra: 'https://grafana.riahi.dpdns.org/d/adrrw5m/devsecops-systeme-and-infrastructure?orgId=1&from=now-6h&to=now&timezone=browser',
  app: 'https://grafana.riahi.dpdns.org/d/add7qcw/devsecops-application-task-manager?orgId=1&from=now-6h&to=now&timezone=browser',
  db: 'https://grafana.riahi.dpdns.org/d/addsvw8/devsecops-base-de-donnees-postgresql?orgId=1&from=now-6h&to=now&timezone=browser',
  jenkins: 'https://grafana.riahi.dpdns.org/d/haryan-jenkins/jenkins3a-performance-and-health-overview?orgId=1&from=now-6h&to=now&timezone=browser',
  logs: 'https://grafana.riahi.dpdns.org/d/ad5hblk/logs-centralises-e28094-devsecops?orgId=1&from=now-6h&to=now&timezone=browser',
  alerting: 'https://grafana.riahi.dpdns.org/alerting/list',
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function timeAgo(ms) {
  if (!ms) return '—'
  const m = Math.floor((Date.now() - ms) / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

function fmtMinutes(min) {
  if (min === null || min === undefined) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} j`
}

function auditDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Metric({ T, label, value, unit = '', threshold = null, invert = false, decimals = 1, hint }) {
  const num = value === null || value === undefined ? null : Number(value)
  let state = 'neutral'
  if (num !== null && threshold !== null) {
    state = invert ? (num < threshold ? 'bad' : 'good') : (num > threshold ? 'bad' : 'good')
  }
  const bar = state === 'bad' ? T.crit : state === 'good' ? T.ok : T.faint
  return (
    <div style={{
      background: T.surface, border: `1px solid ${state === 'bad' ? T.critBd : T.border}`,
      borderRadius: 6, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: bar, opacity: state === 'neutral' ? 0.3 : 1 }} />
      <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 26, fontWeight: 600, lineHeight: 1, color: state === 'bad' ? T.crit : T.text }}>
        {num === null ? <span style={{ color: T.faint }}>—</span> : num.toFixed(decimals)}
        {num !== null && unit && <span style={{ fontSize: 14, fontWeight: 500, color: T.muted, marginLeft: 2 }}>{unit}</span>}
      </div>
      {hint && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

function StateMetric({ T, label, ok, hint }) {
  const isOk = ok === true || ok === 1
  const unknown = ok === null || ok === undefined
  const color = unknown ? T.faint : isOk ? T.ok : T.crit
  return (
    <div style={{
      background: T.surface, border: `1px solid ${!unknown && !isOk ? T.critBd : T.border}`,
      borderRadius: 6, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
        <span style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 600, color }}>
          {unknown ? 'inconnu' : isOk ? 'opérationnel' : 'hors service'}
        </span>
      </div>
      {hint && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

function Tag({ T, children, tone = 'neutral' }) {
  const map = {
    neutral: { bg: T.neutralBg, fg: T.muted, bd: T.border },
    ok: { bg: T.okBg, fg: T.ok, bd: T.okBd },
    warn: { bg: T.warnBg, fg: T.warn, bd: T.warnBd },
    crit: { bg: T.critBg, fg: T.crit, bd: T.critBd },
    info: { bg: T.accentBg, fg: T.accent, bd: T.accentBd },
  }
  const s = map[tone] || map.neutral
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function buildTone(s) {
  if (s === 'SUCCESS') return 'ok'
  if (s === 'FAILURE') return 'crit'
  if (s === 'UNSTABLE') return 'warn'
  if (s === 'BUILDING') return 'info'
  return 'neutral'
}

function buildLabel(s) {
  const m = { SUCCESS: 'succès', FAILURE: 'échec', UNSTABLE: 'instable', ABORTED: 'annulé', BUILDING: 'en cours' }
  return m[s] || (s ? s.toLowerCase() : 'inconnu')
}

function ExtLink({ T, href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      fontSize: 11.5, color: T.accent, textDecoration: 'none',
      display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500, whiteSpace: 'nowrap',
    }}>{children}<span style={{ fontSize: 13, lineHeight: 1 }}>↗</span></a>
  )
}

function Section({ T, eyebrow, title, subtitle, link, linkLabel, children, grid = true }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, paddingBottom: 10, marginBottom: 16, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap',
      }}>
        <div>
          {eyebrow && <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.faint, marginBottom: 5 }}>{eyebrow}</div>}
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: T.text, letterSpacing: '-0.01em' }}>{title}</h2>
          {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, color: T.muted }}>{subtitle}</p>}
        </div>
        {link && <ExtLink T={T} href={link}>{linkLabel || 'Explorer dans Grafana'}</ExtLink>}
      </div>
      {grid ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>{children}</div>
      ) : children}
    </section>
  )
}

function Panel({ T, children, style = {} }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 18, ...style }}>{children}</div>
}

function Empty({ T, children }) {
  return <div style={{ padding: 18, borderRadius: 6, border: `1px dashed ${T.border}`, color: T.faint, fontSize: 12.5, gridColumn: '1 / -1', textAlign: 'center' }}>{children}</div>
}

function ErrorLine({ T, error }) {
  if (!error) return null
  return <div style={{ gridColumn: '1 / -1', padding: '10px 14px', borderRadius: 6, background: T.critBg, border: `1px solid ${T.critBd}`, fontSize: 12, color: T.crit }}>{error}</div>
}

function AlertsPanel({ T, data }) {
  if (!data) return <Empty T={T}>Chargement des alertes…</Empty>
  if (!data.available) return <Empty T={T}>{data.reason || 'Alertes indisponibles'}</Empty>
  if (data.total === 0) {
    return (
      <div style={{ gridColumn: '1 / -1', padding: '16px 18px', borderRadius: 6, background: T.okBg, border: `1px solid ${T.okBd}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.ok }} />
        <span style={{ fontSize: 13, color: T.ok, fontWeight: 600 }}>Aucune alerte active</span>
      </div>
    )
  }
  const grouped = []
  data.alerts.forEach((a) => {
    const k = grouped.find(g => g.name === a.name && g.severity === a.severity)
    if (k) {
      k.count += 1
      if ((a.duration_minutes || 0) > (k.duration_minutes || 0)) k.duration_minutes = a.duration_minutes
    } else grouped.push({ ...a, count: 1 })
  })
  const tone = (s) => (s === 'critical' ? 'crit' : s === 'warning' ? 'warn' : 'neutral')
  const color = (s) => (s === 'critical' ? T.crit : s === 'warning' ? T.warn : T.faint)
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(data.by_severity).map(([s, n]) => <Tag T={T} key={s} tone={tone(s)}>{n} {s}</Tag>)}
        <span style={{ color: T.border }}>│</span>
        {Object.entries(data.by_category).map(([c, n]) => (
          <span key={c} style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{c} <span style={{ color: T.faint }}>{n}</span></span>
        ))}
        {data.silenced > 0 && <span style={{ fontSize: 11, color: T.faint }}>· {data.silenced} silencée{data.silenced > 1 ? 's' : ''}</span>}
      </div>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden' }}>
        {grouped.map((a, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', background: T.surface,
            borderTop: i === 0 ? 'none' : `1px solid ${T.borderSoft}`, opacity: a.silenced ? 0.5 : 1,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color(a.severity), flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.name}</span>
                {a.count > 1 && <Tag T={T}>×{a.count}</Tag>}
                {a.no_data && <Tag T={T} tone="info">sans données</Tag>}
                {a.silenced && <Tag T={T}>silencée</Tag>}
              </div>
              {a.summary && (
                <div title={a.summary} style={{ fontSize: 11.5, color: T.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.summary.replace(/^Summary:\s*/, '').split('\n')[0]}
                </div>
              )}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textAlign: 'right', flexShrink: 0, lineHeight: 1.5 }}>
              <div style={{ color: T.faint }}>{a.category}</div>
              <div>{fmtMinutes(a.duration_minutes)}</div>
            </div>
            {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: 'none', flexShrink: 0 }}>Détail ↗</a>}
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelinePanel({ T, data }) {
  if (!data || !data.available) return <Empty T={T}>Aucun build trouvé</Empty>
  const status = data.building ? 'BUILDING' : data.result
  return (
    <Panel T={T} style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: data.stages?.length ? 16 : 0 }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, fontWeight: 600, marginBottom: 4 }}>Dernier build</div>
          <a href={data.url} target="_blank" rel="noreferrer" style={{ fontFamily: T.mono, fontSize: 19, fontWeight: 600, color: T.text, textDecoration: 'none' }}>
            {data.job_name || 'taskmanager'} <span style={{ color: T.faint }}>#{data.build_number}</span>
          </a>
        </div>
        <Tag T={T} tone={buildTone(status)}>{buildLabel(status)}</Tag>
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{data.building ? 'en cours…' : formatDuration(data.duration_ms)}</div>
        <div style={{ fontSize: 12, color: T.faint }}>{timeAgo(data.timestamp_ms)}</div>
      </div>
      {data.stages?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {data.stages.map((s, i) => {
            const failed = s.status === 'FAILED'
            const ok = s.status === 'SUCCESS'
            return (
              <div key={i} style={{
                flex: '1 1 116px', padding: '9px 10px', borderRadius: 5,
                background: failed ? T.critBg : ok ? T.okBg : T.surfaceAlt,
                border: `1px solid ${failed ? T.critBd : ok ? T.okBd : T.border}`,
                borderBottom: `2px solid ${failed ? T.crit : ok ? T.ok : T.border}`,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{s.name}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 3 }}>{formatDuration(s.duration_ms)}</div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function BuildHistory({ T, data }) {
  if (!data || !data.available || !data.builds?.length) return <Empty T={T}>Aucun historique disponible</Empty>
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {data.builds.map((b) => {
        const tone = buildTone(b.result)
        const c = tone === 'ok' ? T.ok : tone === 'crit' ? T.crit : T.faint
        return (
          <a key={b.build_number} href={b.url} target="_blank" rel="noreferrer" style={{
            flex: '0 0 138px', padding: '12px 13px', borderRadius: 6, background: T.surface,
            border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text }}>#{b.build_number}</span>
              <Tag T={T} tone={tone}>{buildLabel(b.result)}</Tag>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{formatDuration(b.duration_ms)}</div>
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{timeAgo(b.timestamp_ms)}</div>
          </a>
        )
      })}
    </div>
  )
}

function QualityPanel({ T, data }) {
  if (!data || !data.available) return <Empty T={T}>Aucune analyse SonarCloud disponible</Empty>
  const gateOk = data.quality_gate_status === 'OK'
  return (
    <>
      <StateMetric T={T} label="Quality Gate" ok={gateOk} hint={gateOk ? 'conditions respectées' : 'conditions non respectées'} />
      <Metric T={T} label="Bugs" value={Number(data.bugs)} threshold={0} decimals={0} />
      <Metric T={T} label="Vulnérabilités" value={Number(data.vulnerabilities)} threshold={0} decimals={0} />
      <Metric T={T} label="Code smells" value={Number(data.code_smells)} threshold={10} decimals={0} />
      <Metric T={T} label="Hotspots sécurité" value={Number(data.security_hotspots)} threshold={0} decimals={0} />
      <Metric T={T} label="Couverture" value={Number(data.coverage)} unit="%" threshold={80} invert decimals={1} hint="seuil : 80 %" />
      {data.project_url && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
          <ExtLink T={T} href={data.project_url}>Analyse complète sur SonarCloud</ExtLink>
        </div>
      )}
    </>
  )
}

function ScanDetails({ T, data, artifactUrls }) {
  const [tab, setTab] = useState('trivy')
  if (!data) return <Empty T={T}>Chargement du détail…</Empty>
  if (!data.available) return <Empty T={T}>Aucun rapport détaillé disponible</Empty>

  const tabs = [
    { key: 'trivy', label: 'Trivy', sub: 'CVE image & dépendances', n: data.trivy?.total || 0 },
    { key: 'gitleaks', label: 'Gitleaks', sub: 'Secrets exposés', n: data.gitleaks?.total || 0 },
    { key: 'checkov', label: 'Checkov', sub: 'Configuration', n: data.checkov?.total || 0 },
  ]
  const current = data[tab] || { items: [], total: 0 }
  const artifactUrl = artifactUrls?.[tab]

  const th = { textAlign: 'left', padding: '8px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.faint, fontWeight: 600, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }
  const td = { padding: '9px 12px', fontSize: 11.5, color: T.text, borderBottom: `1px solid ${T.borderSoft}`, verticalAlign: 'top' }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
              background: active ? T.surface : 'transparent',
              border: `1px solid ${active ? T.border : 'transparent'}`,
              borderBottom: `2px solid ${active ? (t.n > 0 ? T.crit : T.ok) : 'transparent'}`,
              textAlign: 'left', fontFamily: T.sans,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? T.text : T.muted }}>{t.label}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: t.n > 0 ? T.crit : T.ok }}>{t.n}</span>
              </div>
              <div style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>{t.sub}</div>
            </button>
          )
        })}
      </div>

      {current.total === 0 ? (
        <div style={{ padding: '16px 18px', borderRadius: 6, background: T.okBg, border: `1px solid ${T.okBd}`, fontSize: 12.5, color: T.ok, fontWeight: 600 }}>
          Aucun problème détecté par {tabs.find(t => t.key === tab).label}
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden', background: T.surface }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              {tab === 'trivy' && (
                <>
                  <thead><tr>
                    <th style={th}>Sévérité</th><th style={th}>Identifiant</th><th style={th}>Paquet</th>
                    <th style={th}>Version</th><th style={th}>Correctif</th><th style={th}>Description</th>
                  </tr></thead>
                  <tbody>
                    {current.items.map((v, i) => (
                      <tr key={i}>
                        <td style={td}><Tag T={T} tone={v.severity === 'CRITICAL' ? 'crit' : 'warn'}>{v.severity}</Tag></td>
                        <td style={{ ...td, fontFamily: T.mono, whiteSpace: 'nowrap' }}>
                          {v.url ? <a href={v.url} target="_blank" rel="noreferrer" style={{ color: T.accent, textDecoration: 'none' }}>{v.id}</a> : v.id}
                        </td>
                        <td style={{ ...td, fontFamily: T.mono }}>{v.package}</td>
                        <td style={{ ...td, fontFamily: T.mono, color: T.muted }}>{v.installed}</td>
                        <td style={{ ...td, fontFamily: T.mono }}>
                          {v.fixed ? <span style={{ color: T.ok }}>{v.fixed}</span> : <span style={{ color: T.faint }}>aucun</span>}
                        </td>
                        <td style={{ ...td, color: T.muted, maxWidth: 300 }}>{v.title || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'gitleaks' && (
                <>
                  <thead><tr>
                    <th style={th}>Règle</th><th style={th}>Fichier</th><th style={th}>Ligne</th>
                    <th style={th}>Commit</th><th style={th}>Auteur</th>
                  </tr></thead>
                  <tbody>
                    {current.items.map((s, i) => (
                      <tr key={i}>
                        <td style={{ ...td, fontFamily: T.mono }}>{s.rule}</td>
                        <td style={{ ...td, fontFamily: T.mono }}>{s.file}</td>
                        <td style={{ ...td, fontFamily: T.mono, color: T.muted }}>{s.line}</td>
                        <td style={{ ...td, fontFamily: T.mono, color: T.muted }}>{s.commit || '—'}</td>
                        <td style={{ ...td, color: T.muted }}>{s.author || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'checkov' && (
                <>
                  <thead><tr>
                    <th style={th}>Contrôle</th><th style={th}>Description</th><th style={th}>Fichier</th><th style={th}>Ligne</th>
                  </tr></thead>
                  <tbody>
                    {current.items.map((c, i) => (
                      <tr key={i}>
                        <td style={{ ...td, fontFamily: T.mono, whiteSpace: 'nowrap' }}>
                          {c.url ? <a href={c.url} target="_blank" rel="noreferrer" style={{ color: T.accent, textDecoration: 'none' }}>{c.id}</a> : c.id}
                        </td>
                        <td style={{ ...td, maxWidth: 340 }}>{c.name}</td>
                        <td style={{ ...td, fontFamily: T.mono, color: T.muted }}>{c.file}</td>
                        <td style={{ ...td, fontFamily: T.mono, color: T.muted }}>{c.line === null || c.line === undefined ? '—' : c.line}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: T.surfaceAlt, gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: T.faint }}>
              {current.truncated ? `${current.items.length} entrées affichées sur ${current.total}` : `${current.total} entrée${current.total > 1 ? 's' : ''}`}
              {tab === 'trivy' && ' · sévérités élevée et critique uniquement'}
            </span>
            {artifactUrl && <ExtLink T={T} href={artifactUrl}>Rapport brut</ExtLink>}
          </div>
        </div>
      )}
    </div>
  )
}

function AuditsPanel({ T, data }) {
  if (!data) return <Empty T={T}>Rapports d'audit indisponibles</Empty>
  const bench = data.kube_bench
  const hunter = data.kube_hunter
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12 }}>
      <Panel T={T}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 13.5, fontWeight: 600, color: T.text }}>kube-bench</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Conformité CIS Kubernetes Benchmark</div>
          </div>
          {bench?.available && <span style={{ fontSize: 10.5, color: T.faint, fontFamily: T.mono }}>{auditDate(bench.scanned_at)}</span>}
        </div>
        {!bench?.available && <div style={{ fontSize: 12.5, color: T.faint }}>Aucun rapport disponible</div>}
        {bench?.available && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 14 }}>
              <span style={{ fontFamily: T.mono, fontSize: 38, fontWeight: 600, lineHeight: 1, color: bench.score_percent >= 80 ? T.ok : bench.score_percent >= 60 ? T.warn : T.crit }}>
                {bench.score_percent}<span style={{ fontSize: 19 }}>%</span>
              </span>
              <span style={{ fontSize: 11.5, color: T.muted }}>conformité<br />(contrôles automatisés)</span>
            </div>
            <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ flex: bench.passed, background: T.ok }} />
              <div style={{ flex: bench.failed, background: T.crit }} />
              <div style={{ flex: bench.warned, background: T.warn, opacity: 0.6 }} />
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              {[{ n: bench.passed, l: 'conformes', c: T.ok }, { n: bench.failed, l: 'échecs', c: T.crit }, { n: bench.warned, l: 'manuels', c: T.warn }].map((x) => (
                <div key={x.l}>
                  <div style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 600, color: x.c }}>{x.n}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.muted }}>{x.l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.faint, fontWeight: 600, marginBottom: 6 }}>Par section</div>
            {bench.sections?.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0', fontSize: 11.5, borderTop: `1px solid ${T.borderSoft}` }}>
                <span style={{ fontFamily: T.mono, color: T.faint, minWidth: 12 }}>{s.id}</span>
                <span style={{ flex: 1, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.text}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11 }}>
                  <span style={{ color: T.ok }}>{s.passed}</span>
                  <span style={{ color: T.border }}> · </span>
                  <span style={{ color: s.failed > 0 ? T.crit : T.faint }}>{s.failed}</span>
                  <span style={{ color: T.border }}> · </span>
                  <span style={{ color: T.warn }}>{s.warned}</span>
                </span>
              </div>
            ))}
          </>
        )}
      </Panel>

      <Panel T={T}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 13.5, fontWeight: 600, color: T.text }}>kube-hunter</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Test d'intrusion externe du cluster</div>
          </div>
          {hunter?.available && <span style={{ fontSize: 10.5, color: T.faint, fontFamily: T.mono }}>{auditDate(hunter.scanned_at)}</span>}
        </div>
        {!hunter?.available && <div style={{ fontSize: 12.5, color: T.faint }}>Aucun rapport disponible</div>}
        {hunter?.available && (
          <>
            <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
              {[
                { n: hunter.nodes_count, l: 'nœuds', c: T.text },
                { n: hunter.services_count, l: 'services exposés', c: T.text },
                { n: hunter.vulnerabilities_count, l: 'vulnérabilités', c: hunter.vulnerabilities_count > 0 ? T.crit : T.ok },
              ].map((x) => (
                <div key={x.l}>
                  <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 600, color: x.c }}>{x.n}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.muted }}>{x.l}</div>
                </div>
              ))}
            </div>
            {hunter.vulnerabilities?.length > 0 && (
              <>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.faint, fontWeight: 600, marginBottom: 8 }}>Détections</div>
                {hunter.vulnerabilities.map((v, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 5, background: T.surfaceAlt, border: `1px solid ${T.borderSoft}`, marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <Tag T={T} tone={v.severity === 'high' || v.severity === 'critical' ? 'crit' : 'warn'}>{v.severity}</Tag>
                      <span style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color: T.text }}>{v.vid}</span>
                      <span style={{ fontSize: 12, color: T.text }}>{v.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{v.description}</div>
                    {v.reference && <ExtLink T={T} href={v.reference}>Documentation Aqua</ExtLink>}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}

function EtcdBackupPanel({ T, data }) {
  if (!data) return <Empty T={T}>Chargement du statut des sauvegardes…</Empty>
  if (!data.available) return <Empty T={T}>{data.reason || 'Statut des sauvegardes indisponible'}</Empty>

  const stale = data.age_hours !== null && data.age_hours > data.threshold_hours
  const sizeMo = data.size_bytes ? (data.size_bytes / 1024 / 1024).toFixed(1) : null

  return (
    <>
      <StateMetric
        T={T}
        label="Dernière sauvegarde"
        ok={!stale}
        hint={stale ? `au-delà du seuil de ${data.threshold_hours} h` : `seuil : ${data.threshold_hours} h`}
      />
      <Metric
        T={T}
        label="Ancienneté"
        value={data.age_hours}
        unit=" h"
        threshold={data.threshold_hours}
        decimals={1}
        hint={timeAgo(data.last_success_ms)}
      />
      <Metric T={T} label="Taille du snapshot" value={sizeMo} unit=" Mo" decimals={1} />
      <Metric T={T} label="Snapshots conservés" value={data.count} decimals={0} hint="rétention : 7 jours" />
    </>
  )
}

function useEndpoint(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  useEffect(() => {
    let alive = true
    const run = () => {
      fetch(`${API_BASE}${path}`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(d => { if (alive) { setData(d); setError(null); setUpdatedAt(Date.now()) } })
        .catch(() => { if (alive) setError('backend injoignable') })
    }
    run()
    const id = setInterval(run, REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [path])
  return { data, error, updatedAt }
}

function ThemeToggle({ mode, onToggle }) {
  const dark = mode === 'dark'
  return (
    <button onClick={onToggle}
      aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px',
        borderRadius: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)', color: '#C9D2E0',
        fontSize: 11.5, fontFamily: SANS, fontWeight: 500,
      }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>{dark ? '☀' : '☾'}</span>
      {dark ? 'Clair' : 'Sombre'}
    </button>
  )
}

export default function App() {
  const [mode, setMode] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY)
      if (saved === 'dark' || saved === 'light') return saved
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch (e) { return 'light' }
  })
  const T = mode === 'dark' ? DARK : LIGHT

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    try { window.localStorage.setItem(THEME_KEY, next) } catch (e) { /* stockage indisponible */ }
  }

  useEffect(() => {
    document.body.style.background = T.canvas
    document.body.style.margin = '0'
  }, [T.canvas])

  const overview = useEndpoint('/overview')
  const alerts = useEndpoint('/alerts')
  const application = useEndpoint('/application')
  const database = useEndpoint('/database')
  const pipeline = useEndpoint('/pipeline')
  const pipelineHistory = useEndpoint('/pipeline/history')
  const quality = useEndpoint('/quality')
  const falco = useEndpoint('/security/falco')
  const scans = useEndpoint('/security/scans')
  const scanDetails = useEndpoint('/security/scans/details')
  const tunnel = useEndpoint('/tunnel')
  const pods = useEndpoint('/pods')
  const etcdBackup = useEndpoint('/etcd-backup')
  const audits = useEndpoint('/audits')

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const secondsAgo = overview.updatedAt ? Math.floor((Date.now() - overview.updatedAt) / 1000) : null
  const connected = !overview.error

  return (
    <div style={{ fontFamily: T.sans, background: T.canvas, minHeight: '100vh', color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        a:focus-visible, button:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      <header style={{ background: T.ink, color: '#fff', padding: '16px 28px', borderBottom: `1px solid ${T.inkSoft}` }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7C89A0', marginBottom: 4 }}>
              Plateforme DevSecOps
            </div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em' }}>Console de supervision</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7C89A0' }}>Actualisation</div>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: '#C9D2E0' }}>{secondsAgo === null ? '—' : `il y a ${secondsAgo} s`}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#3ECF8E' : '#E5645A' }} />
              <span style={{ fontSize: 12, color: '#C9D2E0' }}>{connected ? 'connecté' : 'déconnecté'}</span>
            </div>
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '30px 28px 60px' }}>

        <Section T={T} eyebrow="Supervision" title="Alertes actives" subtitle="Règles Grafana actuellement déclenchées" link={GRAFANA.alerting} linkLabel="Gérer les alertes">
          <ErrorLine T={T} error={alerts.error} />
          <AlertsPanel T={T} data={alerts.data} />
        </Section>

        <Section T={T} eyebrow="Plateforme" title="État global">
          <ErrorLine T={T} error={overview.error} />
          {overview.data && (
            <>
              <Metric T={T} label="Alertes actives" value={overview.data.alerts_firing} threshold={0} decimals={0} />
              <Metric T={T} label="Pods en échec" value={overview.data.pods_failed} threshold={0} decimals={0} />
              <StateMetric T={T} label="Application" ok={overview.data.app_up === 1} />
              <StateMetric T={T} label="Base de données" ok={overview.data.db_up === 1} />
            </>
          )}
        </Section>

        <Section T={T} eyebrow="Infrastructure" title="Système &amp; ressources" subtitle="Consommation du nœud Kubernetes" link={GRAFANA.infra}>
          {overview.data && (
            <>
              <Metric T={T} label="CPU cluster" value={overview.data.cpu_percent} unit="%" threshold={80} />
              <Metric T={T} label="RAM disponible" value={overview.data.ram_available_percent} unit="%" threshold={20} invert hint="seuil : 20 %" />
              <Metric T={T} label="Disque disponible" value={overview.data.disk_available_percent} unit="%" threshold={15} invert hint="/var · seuil : 15 %" />
            </>
          )}
        </Section>

        <Section T={T} eyebrow="Infrastructure" title="Santé des pods" subtitle="Mémoire et stabilité des composants" link={GRAFANA.infra}>
          <ErrorLine T={T} error={pods.error} />
          {pods.data && (
            <>
              <StateMetric T={T} label="Nœud" ok={pods.data.node_ready === 1} />
              <Metric T={T} label="Mémoire application" value={pods.data.app_memory_percent} unit="%" threshold={85} />
              <Metric T={T} label="Mémoire base" value={pods.data.db_memory_percent} unit="%" threshold={85} />
              <Metric T={T} label="Redémarrages app" value={pods.data.app_restarts} threshold={5} decimals={0} />
              <Metric T={T} label="Redémarrages base" value={pods.data.db_restarts} threshold={5} decimals={0} />
              <Metric T={T} label="Redémarrages backend" value={pods.data.backend_restarts} threshold={5} decimals={0} />
            </>
          )}
        </Section>

        <Section T={T} eyebrow="Infrastructure" title="Sauvegardes etcd" subtitle="Snapshots quotidiens de la base d'état du cluster">
          <ErrorLine T={T} error={etcdBackup.error} />
          <EtcdBackupPanel T={T} data={etcdBackup.data} />
        </Section>

        <Section T={T} eyebrow="Application" title="Task Manager" subtitle="Trafic et disponibilité applicative" link={GRAFANA.app}>
          <ErrorLine T={T} error={application.error} />
          {application.data && (
            <>
              <Metric T={T} label="Requêtes" value={application.data.request_rate} unit="/s" decimals={2} />
              <Metric T={T} label="Taux d'erreur" value={application.data.error_rate_percent} unit="%" threshold={5} />
              <Metric T={T} label="Sessions actives" value={application.data.active_sessions} decimals={0} />
              <Metric T={T} label="Répliques" value={application.data.replicas} decimals={0} />
            </>
          )}
        </Section>

        <Section T={T} eyebrow="Données" title="Base PostgreSQL" subtitle="Connexions et volumétrie" link={GRAFANA.db}>
          <ErrorLine T={T} error={database.error} />
          {database.data && (
            <>
              <Metric T={T} label="Connexions actives" value={database.data.connections_active} decimals={0} />
              <Metric T={T} label="Connexions totales" value={database.data.connections_total} decimals={0} />
              <Metric T={T} label="Taille de la base" value={database.data.db_size_bytes ? database.data.db_size_bytes / 1024 / 1024 : null} unit=" Mo" />
            </>
          )}
        </Section>

        <Section T={T} eyebrow="Livraison continue" title="Pipeline CI/CD" subtitle="Dernière exécution et étapes" link={GRAFANA.jenkins} linkLabel="Métriques Jenkins">
          <ErrorLine T={T} error={pipeline.error} />
          <PipelinePanel T={T} data={pipeline.data} />
        </Section>

        <Section T={T} eyebrow="Livraison continue" title="Historique des builds" subtitle="Cinq dernières exécutions">
          <ErrorLine T={T} error={pipelineHistory.error} />
          <BuildHistory T={T} data={pipelineHistory.data} />
        </Section>

        <Section T={T} eyebrow="Qualité" title="Analyse du code" subtitle="SonarCloud — projet Task Manager">
          <ErrorLine T={T} error={quality.error} />
          <QualityPanel T={T} data={quality.data} />
        </Section>

        <Section T={T} eyebrow="Sécurité" title="Analyses du pipeline"
          subtitle={scans.data && scans.data.available ? `Build #${scans.data.build_number} · ${timeAgo(scans.data.timestamp_ms)}` : 'Résultats des scans automatisés'}>
          <ErrorLine T={T} error={scans.error} />
          {scans.data && !scans.data.available && <Empty T={T}>Aucun rapport disponible</Empty>}
          {scans.data && scans.data.available && (
            <>
              <Metric T={T} label="CVE critiques" value={scans.data.trivy?.critical} threshold={0} decimals={0} hint="Trivy" />
              <Metric T={T} label="CVE élevées" value={scans.data.trivy?.high} threshold={0} decimals={0} hint="Trivy" />
              <Metric T={T} label="Secrets détectés" value={scans.data.gitleaks?.secrets_found} threshold={0} decimals={0} hint="Gitleaks" />
              <Metric T={T} label="Contrôles échoués" value={scans.data.checkov?.failed} threshold={0} decimals={0} hint="Checkov" />
            </>
          )}
        </Section>

        <Section T={T} eyebrow="Sécurité" title="Détail des vulnérabilités" subtitle="Résultats analysés par outil">
          <ErrorLine T={T} error={scanDetails.error} />
          <ScanDetails T={T} data={scanDetails.data} artifactUrls={scans.data?.artifact_urls} />
        </Section>

        <Section T={T} eyebrow="Sécurité" title="Audits du cluster" subtitle="Analyses ponctuelles de conformité et d'exposition">
          <ErrorLine T={T} error={audits.error} />
          <AuditsPanel T={T} data={audits.data} />
        </Section>

        <Section T={T} eyebrow="Sécurité" title="Détection runtime" subtitle="Falco — moteur eBPF, événements remontés via Loki" link={GRAFANA.logs} linkLabel="Logs centralisés">
          <ErrorLine T={T} error={falco.error} />
          {falco.data && (
            <>
              <Metric T={T} label="Événements critiques" value={falco.data.critical_events_1h} threshold={5} decimals={0} hint="dernière heure" />
              <Metric T={T} label="Événements critiques" value={falco.data.critical_events_24h} threshold={20} decimals={0} hint="dernières 24 h" />
            </>
          )}
        </Section>

        <Section T={T} eyebrow="Réseau" title="Tunnel Cloudflare" subtitle="Exposition publique de la plateforme">
          <ErrorLine T={T} error={tunnel.error} />
          {tunnel.data && (
            <>
              <StateMetric T={T} label="Tunnel" ok={tunnel.data.reachable} />
              <Metric T={T} label="Connexions actives" value={tunnel.data.active_connections} threshold={0} invert decimals={0} />
              <Metric T={T} label="Erreurs de configuration" value={tunnel.data.config_push_errors} threshold={0} decimals={0} />
            </>
          )}
        </Section>

        <footer style={{ marginTop: 44, paddingTop: 18, borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint }}>
            Kubernetes · Jenkins · Prometheus · Loki · Falco · Trivy · SonarCloud
          </span>
          <span style={{ fontSize: 10.5, color: T.faint }}>
            Actualisation automatique toutes les {REFRESH_MS / 1000} secondes
          </span>
        </footer>
      </main>
    </div>
  )
}
