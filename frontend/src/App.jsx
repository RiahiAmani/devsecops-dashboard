import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const REFRESH_MS = 15000

// ---------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------
const T = {
  ink: '#0E1420',
  inkSoft: '#1B2432',
  canvas: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E4E8EE',
  borderSoft: '#EDF0F4',
  text: '#18202D',
  muted: '#6C7789',
  faint: '#9BA5B4',
  ok: '#0F7B53',
  okBg: '#E9F6F0',
  warn: '#A66200',
  warnBg: '#FDF3E3',
  crit: '#B3352C',
  critBg: '#FBEBEA',
  accent: '#2B5FD9',
  mono: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const GRAFANA = {
  infra: 'https://grafana.riahi.dpdns.org/d/adrrw5m/devsecops-systeme-and-infrastructure?orgId=1&from=now-6h&to=now&timezone=browser',
  app: 'https://grafana.riahi.dpdns.org/d/add7qcw/devsecops-application-task-manager?orgId=1&from=now-6h&to=now&timezone=browser',
  db: 'https://grafana.riahi.dpdns.org/d/addsvw8/devsecops-base-de-donnees-postgresql?orgId=1&from=now-6h&to=now&timezone=browser',
  jenkins: 'https://grafana.riahi.dpdns.org/d/haryan-jenkins/jenkins3a-performance-and-health-overview?orgId=1&from=now-6h&to=now&timezone=browser',
  logs: 'https://grafana.riahi.dpdns.org/d/ad5hblk/logs-centralises-e28094-devsecops?orgId=1&from=now-6h&to=now&timezone=browser',
  alerting: 'https://grafana.riahi.dpdns.org/alerting/list',
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------
function Metric({ label, value, unit = '', threshold = null, invert = false, decimals = 1, hint }) {
  const num = value === null || value === undefined ? null : Number(value)
  let state = 'neutral'
  if (num !== null && threshold !== null) {
    state = invert ? (num < threshold ? 'bad' : 'good') : (num > threshold ? 'bad' : 'good')
  }

  const accentColor = state === 'bad' ? T.crit : state === 'good' ? T.ok : T.faint

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${state === 'bad' ? '#F0CFCC' : T.border}`,
      borderRadius: 6,
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: accentColor, opacity: state === 'neutral' ? 0.25 : 1,
      }} />
      <div style={{
        fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: T.muted, marginBottom: 6, fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: T.mono, fontSize: 26, fontWeight: 600, lineHeight: 1,
        color: state === 'bad' ? T.crit : T.text,
      }}>
        {num === null ? <span style={{ color: T.faint }}>—</span> : `${num.toFixed(decimals)}`}
        {num !== null && unit && (
          <span style={{ fontSize: 14, fontWeight: 500, color: T.muted, marginLeft: 2 }}>{unit}</span>
        )}
      </div>
      {hint && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

function StateMetric({ label, ok, hint }) {
  const isOk = ok === true || ok === 1
  const unknown = ok === null || ok === undefined
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${!unknown && !isOk ? '#F0CFCC' : T.border}`,
      borderRadius: 6, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: unknown ? T.faint : isOk ? T.ok : T.crit,
      }} />
      <div style={{
        fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: T.muted, marginBottom: 6, fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: unknown ? T.faint : isOk ? T.ok : T.crit,
        }} />
        <span style={{
          fontFamily: T.mono, fontSize: 17, fontWeight: 600,
          color: unknown ? T.faint : isOk ? T.ok : T.crit,
        }}>
          {unknown ? 'inconnu' : isOk ? 'opérationnel' : 'hors service'}
        </span>
      </div>
      {hint && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

function Tag({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: '#F1F3F6', fg: T.muted, bd: T.border },
    ok: { bg: T.okBg, fg: T.ok, bd: '#CBE7DB' },
    warn: { bg: T.warnBg, fg: T.warn, bd: '#EFDCBB' },
    crit: { bg: T.critBg, fg: T.crit, bd: '#F0CFCC' },
    info: { bg: '#EAEFFB', fg: T.accent, bd: '#CFDBF7' },
  }
  const s = tones[tone] || tones.neutral
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', fontFamily: T.sans, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function buildStatusTone(status) {
  if (status === 'SUCCESS') return 'ok'
  if (status === 'FAILURE') return 'crit'
  if (status === 'UNSTABLE') return 'warn'
  if (status === 'BUILDING') return 'info'
  return 'neutral'
}

function buildStatusLabel(status) {
  const map = {
    SUCCESS: 'succès', FAILURE: 'échec', UNSTABLE: 'instable',
    ABORTED: 'annulé', BUILDING: 'en cours',
  }
  return map[status] || (status ? status.toLowerCase() : 'inconnu')
}

function GrafanaLink({ href, children = 'Explorer dans Grafana' }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      fontSize: 11.5, color: T.accent, textDecoration: 'none',
      display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {children}
      <span style={{ fontSize: 13, lineHeight: 1 }}>↗</span>
    </a>
  )
}

function Section({ eyebrow, title, subtitle, link, linkLabel, children, grid = true }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, paddingBottom: 10, marginBottom: 16,
        borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap',
      }}>
        <div>
          {eyebrow && (
            <div style={{
              fontFamily: T.mono, fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: T.faint, marginBottom: 5,
            }}>
              {eyebrow}
            </div>
          )}
          <h2 style={{
            margin: 0, fontSize: 16, fontWeight: 650, color: T.text, letterSpacing: '-0.01em',
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: T.muted }}>{subtitle}</p>
          )}
        </div>
        {link && <GrafanaLink href={link}>{linkLabel}</GrafanaLink>}
      </div>
      {grid ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
        }}>
          {children}
        </div>
      ) : children}
    </section>
  )
}

function Panel({ children, padded = true, style = {} }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
      padding: padded ? 18 : 0, ...style,
    }}>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return (
    <div style={{
      padding: '18px', borderRadius: 6, border: `1px dashed ${T.border}`,
      color: T.faint, fontSize: 12.5, gridColumn: '1 / -1', textAlign: 'center',
    }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------
// Alertes
// ---------------------------------------------------------------------
function AlertsPanel({ data }) {
  if (!data) return <Empty>Chargement des alertes…</Empty>
  if (!data.available) return <Empty>{data.reason || 'Alertes indisponibles'}</Empty>
  if (data.total === 0) {
    return (
      <div style={{
        gridColumn: '1 / -1', padding: '16px 18px', borderRadius: 6,
        background: T.okBg, border: '1px solid #CBE7DB',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.ok }} />
        <span style={{ fontSize: 13, color: T.ok, fontWeight: 600 }}>Aucune alerte active</span>
      </div>
    )
  }

  const grouped = []
  data.alerts.forEach((a) => {
    const key = grouped.find(g => g.name === a.name && g.severity === a.severity)
    if (key) {
      key.count += 1
      if ((a.duration_minutes || 0) > (key.duration_minutes || 0)) key.duration_minutes = a.duration_minutes
    } else {
      grouped.push({ ...a, count: 1 })
    }
  })

  const sevTone = (s) => (s === 'critical' ? 'crit' : s === 'warning' ? 'warn' : 'neutral')
  const sevColor = (s) => (s === 'critical' ? T.crit : s === 'warning' ? T.warn : T.faint)

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(data.by_severity).map(([sev, n]) => (
          <Tag key={sev} tone={sevTone(sev)}>{n} {sev}</Tag>
        ))}
        <span style={{ color: T.border }}>│</span>
        {Object.entries(data.by_category).map(([cat, n]) => (
          <span key={cat} style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
            {cat} <span style={{ color: T.faint }}>{n}</span>
          </span>
        ))}
        {data.silenced > 0 && (
          <span style={{ fontSize: 11, color: T.faint }}>· {data.silenced} silencée{data.silenced > 1 ? 's' : ''}</span>
        )}
      </div>

      <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden' }}>
        {grouped.map((a, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '11px 14px', background: T.surface,
            borderTop: i === 0 ? 'none' : `1px solid ${T.borderSoft}`,
            opacity: a.silenced ? 0.5 : 1,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: sevColor(a.severity), flexShrink: 0,
            }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.name}</span>
                {a.count > 1 && <Tag>×{a.count}</Tag>}
                {a.no_data && <Tag tone="info">sans données</Tag>}
                {a.silenced && <Tag>silencée</Tag>}
              </div>
              {a.summary && (
                <div title={a.summary} style={{
                  fontSize: 11.5, color: T.muted, marginTop: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {a.summary.replace(/^Summary:\s*/, '').split('\n')[0]}
                </div>
              )}
            </div>
            <div style={{
              fontFamily: T.mono, fontSize: 11, color: T.muted,
              textAlign: 'right', flexShrink: 0, lineHeight: 1.5,
            }}>
              <div style={{ color: T.faint }}>{a.category}</div>
              <div>{fmtMinutes(a.duration_minutes)}</div>
            </div>
            {a.url && (
              <a href={a.url} target="_blank" rel="noreferrer" style={{
                fontSize: 11, color: T.accent, textDecoration: 'none', flexShrink: 0,
              }}>
                Détail ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------
function PipelinePanel({ data }) {
  if (!data || !data.available) return <Empty>Aucun build trouvé</Empty>
  const status = data.building ? 'BUILDING' : data.result

  return (
    <Panel style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: data.stages?.length ? 16 : 0 }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{
            fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: T.muted, fontWeight: 600, marginBottom: 4,
          }}>
            Dernier build
          </div>
          <a href={data.url} target="_blank" rel="noreferrer" style={{
            fontFamily: T.mono, fontSize: 19, fontWeight: 600,
            color: T.text, textDecoration: 'none',
          }}>
            {data.job_name || 'taskmanager'} <span style={{ color: T.faint }}>#{data.build_number}</span>
          </a>
        </div>
        <Tag tone={buildStatusTone(status)}>{buildStatusLabel(status)}</Tag>
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
          {data.building ? 'en cours…' : formatDuration(data.duration_ms)}
        </div>
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
                background: failed ? T.critBg : ok ? T.okBg : '#F7F8FA',
                border: `1px solid ${failed ? '#F0CFCC' : ok ? '#CBE7DB' : T.border}`,
                borderBottom: `2px solid ${failed ? T.crit : ok ? T.ok : T.border}`,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{s.name}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 3 }}>
                  {formatDuration(s.duration_ms)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function BuildHistory({ data }) {
  if (!data || !data.available || !data.builds?.length) return <Empty>Aucun historique disponible</Empty>
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {data.builds.map((b) => {
        const tone = buildStatusTone(b.result)
        const color = tone === 'ok' ? T.ok : tone === 'crit' ? T.crit : T.faint
        return (
          <a key={b.build_number} href={b.url} target="_blank" rel="noreferrer" style={{
            flex: '0 0 138px', padding: '12px 13px', borderRadius: 6,
            background: T.surface, border: `1px solid ${T.border}`,
            borderTop: `2px solid ${color}`, textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text }}>
                #{b.build_number}
              </span>
              <Tag tone={tone}>{buildStatusLabel(b.result)}</Tag>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{formatDuration(b.duration_ms)}</div>
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{timeAgo(b.timestamp_ms)}</div>
          </a>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------
// Qualité du code
// ---------------------------------------------------------------------
function QualityPanel({ data }) {
  if (!data || !data.available) return <Empty>Aucune analyse SonarCloud disponible</Empty>
  const gateOk = data.quality_gate_status === 'OK'
  return (
    <>
      <StateMetric label="Quality Gate" ok={gateOk} hint={gateOk ? 'toutes les conditions respectées' : 'conditions non respectées'} />
      <Metric label="Bugs" value={Number(data.bugs)} threshold={0} decimals={0} />
      <Metric label="Vulnérabilités" value={Number(data.vulnerabilities)} threshold={0} decimals={0} />
      <Metric label="Code smells" value={Number(data.code_smells)} threshold={10} decimals={0} />
      <Metric label="Hotspots sécurité" value={Number(data.security_hotspots)} threshold={0} decimals={0} />
      <Metric label="Couverture" value={Number(data.coverage)} unit="%" threshold={80} invert decimals={1} hint="seuil : 80 %" />
      {data.project_url && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
          <GrafanaLink href={data.project_url}>Analyse complète sur SonarCloud</GrafanaLink>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// Falco
// ---------------------------------------------------------------------
function FalcoEvents({ data }) {
  if (!data || !data.available) return <Empty>Aucun événement récent disponible</Empty>
  if (!data.events?.length) {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 6, background: T.okBg,
        border: '1px solid #CBE7DB', fontSize: 12.5, color: T.ok, fontWeight: 600,
      }}>
        Aucun événement critique récent
      </div>
    )
  }
  const tone = (p) => {
    const s = (p || '').toLowerCase()
    if (['emergency', 'alert', 'critical'].includes(s)) return 'crit'
    if (['error', 'warning'].includes(s)) return 'warn'
    return 'info'
  }
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden' }}>
      {data.events.map((e, i) => (
        <div key={i} style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px',
          background: T.surface, borderTop: i === 0 ? 'none' : `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ paddingTop: 1 }}><Tag tone={tone(e.priority)}>{e.priority || '?'}</Tag></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{e.rule || 'Règle inconnue'}</div>
            <div title={e.output} style={{
              fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {e.output}
            </div>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint, flexShrink: 0 }}>
            {e.time ? new Date(e.time).toLocaleTimeString('fr-FR') : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------
function AuditsPanel({ data }) {
  if (!data) return <Empty>Rapports d'audit indisponibles</Empty>
  const bench = data.kube_bench
  const hunter = data.kube_hunter

  return (
    <div style={{
      gridColumn: '1 / -1', display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12,
    }}>
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 13.5, fontWeight: 600, color: T.text }}>kube-bench</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Conformité CIS Kubernetes Benchmark</div>
          </div>
          {bench?.available && (
            <span style={{ fontSize: 10.5, color: T.faint, fontFamily: T.mono }}>
              {auditDate(bench.scanned_at)}
            </span>
          )}
        </div>

        {!bench?.available && <div style={{ fontSize: 12.5, color: T.faint }}>Aucun rapport disponible</div>}

        {bench?.available && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 14 }}>
              <span style={{
                fontFamily: T.mono, fontSize: 38, fontWeight: 600, lineHeight: 1,
                color: bench.score_percent >= 80 ? T.ok : bench.score_percent >= 60 ? T.warn : T.crit,
              }}>
                {bench.score_percent}<span style={{ fontSize: 19 }}>%</span>
              </span>
              <span style={{ fontSize: 11.5, color: T.muted }}>conformité<br />(contrôles automatisés)</span>
            </div>

            <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ flex: bench.passed, background: T.ok }} />
              <div style={{ flex: bench.failed, background: T.crit }} />
              <div style={{ flex: bench.warned, background: '#DCC48A' }} />
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              {[
                { n: bench.passed, l: 'conformes', c: T.ok },
                { n: bench.failed, l: 'échecs', c: T.crit },
                { n: bench.warned, l: 'manuels', c: T.warn },
              ].map((x) => (
                <div key={x.l}>
                  <div style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 600, color: x.c }}>{x.n}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.muted }}>{x.l}</div>
                </div>
              ))}
            </div>

            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: T.faint, fontWeight: 600, marginBottom: 6,
            }}>
              Par section
            </div>
            {bench.sections?.map((s) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '4px 0', fontSize: 11.5,
                borderTop: `1px solid ${T.borderSoft}`,
              }}>
                <span style={{ fontFamily: T.mono, color: T.faint, minWidth: 12 }}>{s.id}</span>
                <span style={{ flex: 1, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.text}
                </span>
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

      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 13.5, fontWeight: 600, color: T.text }}>kube-hunter</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Test d'intrusion externe du cluster</div>
          </div>
          {hunter?.available && (
            <span style={{ fontSize: 10.5, color: T.faint, fontFamily: T.mono }}>
              {auditDate(hunter.scanned_at)}
            </span>
          )}
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
                <div style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: T.faint, fontWeight: 600, marginBottom: 8,
                }}>
                  Détections
                </div>
                {hunter.vulnerabilities.map((v, i) => (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 5, background: '#FAFBFC',
                    border: `1px solid ${T.borderSoft}`, marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <Tag tone={v.severity === 'high' || v.severity === 'critical' ? 'crit' : 'warn'}>
                        {v.severity}
                      </Tag>
                      <span style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color: T.text }}>
                        {v.vid}
                      </span>
                      <span style={{ fontSize: 12, color: T.text }}>{v.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{v.description}</div>
                    {v.reference && <GrafanaLink href={v.reference}>Documentation Aqua</GrafanaLink>}
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

// ---------------------------------------------------------------------
// Data hook
// ---------------------------------------------------------------------
function useEndpoint(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    let alive = true
    const fetchData = () => {
      fetch(`${API_BASE}${path}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then(d => {
          if (!alive) return
          setData(d); setError(null); setUpdatedAt(Date.now())
        })
        .catch(() => { if (alive) setError('backend injoignable') })
    }
    fetchData()
    const id = setInterval(fetchData, REFRESH_MS)
    return () => { alive = false; clearInterval(id) }
  }, [path])

  return { data, error, updatedAt }
}

function ErrorLine({ error }) {
  if (!error) return null
  return (
    <div style={{
      gridColumn: '1 / -1', padding: '10px 14px', borderRadius: 6,
      background: T.critBg, border: '1px solid #F0CFCC',
      fontSize: 12, color: T.crit,
    }}>
      {error}
    </div>
  )
}

// ---------------------------------------------------------------------
// App
// ---------------------------------------------------------------------
export default function App() {
  const overview = useEndpoint('/overview')
  const alerts = useEndpoint('/alerts')
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
  const audits = useEndpoint('/audits')

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const lastUpdate = overview.updatedAt
  const secondsAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate) / 1000) : null
  const connected = !overview.error

  return (
    <div style={{
      fontFamily: T.sans, background: T.canvas, minHeight: '100vh', color: T.text,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        a:focus-visible, button:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      <header style={{
        background: T.ink, color: '#fff', padding: '16px 28px',
        borderBottom: `1px solid ${T.inkSoft}`,
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontFamily: T.mono, fontSize: 9.5, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: '#7C89A0', marginBottom: 4,
            }}>
              Plateforme DevSecOps
            </div>
            <h1 style={{
              margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em',
            }}>
              Console de supervision
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: T.mono, fontSize: 10, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#7C89A0',
              }}>
                Actualisation
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: '#C9D2E0' }}>
                {secondsAgo === null ? '—' : `il y a ${secondsAgo} s`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: connected ? '#3ECF8E' : '#E5645A',
              }} />
              <span style={{ fontSize: 12, color: '#C9D2E0' }}>
                {connected ? 'connecté' : 'déconnecté'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '30px 28px 60px' }}>

        <Section
          eyebrow="Supervision"
          title="Alertes actives"
          subtitle="Règles Grafana actuellement déclenchées"
          link={GRAFANA.alerting}
          linkLabel="Gérer les alertes"
        >
          <ErrorLine error={alerts.error} />
          <AlertsPanel data={alerts.data} />
        </Section>

        <Section
          eyebrow="Plateforme"
          title="État global"
        >
          <ErrorLine error={overview.error} />
          {overview.data && (
            <>
              <Metric label="Alertes actives" value={overview.data.alerts_firing} threshold={0} decimals={0} />
              <Metric label="Pods en échec" value={overview.data.pods_failed} threshold={0} decimals={0} />
              <StateMetric label="Application" ok={overview.data.app_up === 1} />
              <StateMetric label="Base de données" ok={overview.data.db_up === 1} />
            </>
          )}
        </Section>

        <Section
          eyebrow="Infrastructure"
          title="Système & ressources"
          subtitle="Consommation du nœud Kubernetes"
          link={GRAFANA.infra}
        >
          {overview.data && (
            <>
              <Metric label="CPU cluster" value={overview.data.cpu_percent} unit="%" threshold={80} />
              <Metric label="RAM disponible" value={overview.data.ram_available_percent} unit="%" threshold={20} invert hint="seuil : 20 %" />
              <Metric label="Disque disponible" value={overview.data.disk_available_percent} unit="%" threshold={15} invert hint="/var · seuil : 15 %" />
            </>
          )}
        </Section>

        <Section
          eyebrow="Infrastructure"
          title="Santé des pods"
          subtitle="Mémoire et stabilité des composants"
          link={GRAFANA.infra}
        >
          <ErrorLine error={pods.error} />
          {pods.data && (
            <>
              <StateMetric label="Nœud" ok={pods.data.node_ready === 1} />
              <Metric label="Mémoire application" value={pods.data.app_memory_percent} unit="%" threshold={85} />
              <Metric label="Mémoire base" value={pods.data.db_memory_percent} unit="%" threshold={85} />
              <Metric label="Redémarrages app" value={pods.data.app_restarts} threshold={5} decimals={0} />
              <Metric label="Redémarrages base" value={pods.data.db_restarts} threshold={5} decimals={0} />
              <Metric label="Redémarrages backend" value={pods.data.backend_restarts} threshold={5} decimals={0} />
            </>
          )}
        </Section>

        <Section
          eyebrow="Application"
          title="Task Manager"
          subtitle="Trafic et disponibilité applicative"
          link={GRAFANA.app}
        >
          <ErrorLine error={application.error} />
          {application.data && (
            <>
              <Metric label="Requêtes" value={application.data.request_rate} unit="/s" decimals={2} />
              <Metric label="Taux d'erreur" value={application.data.error_rate_percent} unit="%" threshold={5} />
              <Metric label="Sessions actives" value={application.data.active_sessions} decimals={0} />
              <Metric label="Répliques" value={application.data.replicas} decimals={0} />
            </>
          )}
        </Section>

        <Section
          eyebrow="Données"
          title="Base PostgreSQL"
          subtitle="Connexions et volumétrie"
          link={GRAFANA.db}
        >
          <ErrorLine error={database.error} />
          {database.data && (
            <>
              <Metric label="Connexions actives" value={database.data.connections_active} decimals={0} />
              <Metric label="Connexions totales" value={database.data.connections_total} decimals={0} />
              <Metric
                label="Taille de la base"
                value={database.data.db_size_bytes ? database.data.db_size_bytes / 1024 / 1024 : null}
                unit=" Mo"
              />
            </>
          )}
        </Section>

        <Section
          eyebrow="Livraison continue"
          title="Pipeline CI/CD"
          subtitle="Dernière exécution et étapes"
          link={GRAFANA.jenkins}
          linkLabel="Métriques Jenkins"
        >
          <ErrorLine error={pipeline.error} />
          <PipelinePanel data={pipeline.data} />
        </Section>

        <Section
          eyebrow="Livraison continue"
          title="Historique des builds"
          subtitle="Cinq dernières exécutions"
        >
          <ErrorLine error={pipelineHistory.error} />
          <BuildHistory data={pipelineHistory.data} />
        </Section>

        <Section
          eyebrow="Qualité"
          title="Analyse du code"
          subtitle="SonarCloud — projet Task Manager"
        >
          <ErrorLine error={quality.error} />
          <QualityPanel data={quality.data} />
        </Section>

        <Section
          eyebrow="Sécurité"
          title="Analyses du pipeline"
          subtitle={scans.data?.available
            ? `Build #${scans.data.build_number} · ${timeAgo(scans.data.timestamp_ms)}`
            : 'Résultats des scans automatisés'}
        >
          <ErrorLine error={scans.error} />
          {scans.data && !scans.data.available && <Empty>Aucun rapport disponible</Empty>}
          {scans.data?.available && (
            <>
              <Metric label="CVE critiques" value={scans.data.trivy?.critical} threshold={0} decimals={0} hint="Trivy" />
              <Metric label="CVE élevées" value={scans.data.trivy?.high} threshold={0} decimals={0} hint="Trivy" />
              <Metric label="Secrets détectés" value={scans.data.gitleaks?.secrets_found} threshold={0} decimals={0} hint="Gitleaks" />
              <Metric label="Contrôles échoués" value={scans.data.checkov?.failed} threshold={0} decimals={0} hint="Checkov" />
              {(scans.data.artifact_urls?.trivy || scans.data.artifact_urls?.gitleaks || scans.data.artifact_urls?.checkov) && (
                <div style={{
                  gridColumn: '1 / -1', display: 'flex', gap: 18,
                  justifyContent: 'flex-end', flexWrap: 'wrap',
                }}>
                  {scans.data.artifact_urls?.trivy && <GrafanaLink href={scans.data.artifact_urls.trivy}>Rapport Trivy</GrafanaLink>}
                  {scans.data.artifact_urls?.gitleaks && <GrafanaLink href={scans.data.artifact_urls.gitleaks}>Rapport Gitleaks</GrafanaLink>}
                  {scans.data.artifact_urls?.checkov && <GrafanaLink href={scans.data.artifact_urls.checkov}>Rapport Checkov</GrafanaLink>}
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          eyebrow="Sécurité"
          title="Audits du cluster"
          subtitle="Analyses ponctuelles de conformité et d'exposition"
        >
          <ErrorLine error={audits.error} />
          <AuditsPanel data={audits.data} />
        </Section>

        <Section
          eyebrow="Sécurité"
          title="Détection runtime"
          subtitle="Falco — moteur eBPF, événements remontés via Loki"
          link={GRAFANA.logs}
          linkLabel="Logs centralisés"
        >
          <ErrorLine error={falco.error} />
          {falco.data && (
            <>
              <Metric label="Événements critiques" value={falco.data.critical_events_1h} threshold={5} decimals={0} hint="dernière heure" />
              <Metric label="Événements critiques" value={falco.data.critical_events_24h} threshold={20} decimals={0} hint="dernières 24 h" />
            </>
          )}
          <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
            <ErrorLine error={falcoRecent.error} />
            <FalcoEvents data={falcoRecent.data} />
          </div>
        </Section>

        <Section
          eyebrow="Réseau"
          title="Tunnel Cloudflare"
          subtitle="Exposition publique de la plateforme"
        >
          <ErrorLine error={tunnel.error} />
          {tunnel.data && (
            <>
              <StateMetric label="Tunnel" ok={tunnel.data.reachable} />
              <Metric label="Connexions actives" value={tunnel.data.active_connections} threshold={0} invert decimals={0} />
              <Metric label="Erreurs de configuration" value={tunnel.data.config_push_errors} threshold={0} decimals={0} />
            </>
          )}
        </Section>

        <footer style={{
          marginTop: 44, paddingTop: 18, borderTop: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint }}>
            Plateforme DevSecOps · Kubernetes · Jenkins · Prometheus · Loki · Falco
          </span>
          <span style={{ fontSize: 10.5, color: T.faint }}>
            Actualisation automatique toutes les {REFRESH_MS / 1000} secondes
          </span>
        </footer>
      </main>
    </div>
  )
}
