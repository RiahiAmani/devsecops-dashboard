import json
import os
import re
import time

import requests
from flask import Blueprint, jsonify, current_app

main = Blueprint('main', __name__)


def query_prometheus(promql):
    url = f"{current_app.config['PROMETHEUS_URL']}/api/v1/query"
    try:
        resp = requests.get(url, params={'query': promql}, timeout=5)
        resp.raise_for_status()
        result = resp.json().get('data', {}).get('result', [])
        if not result:
            return None
        return float(result[0]['value'][1])
    except Exception:
        return None


def query_loki_count(logql, minutes=60):
    """Compte le nombre total d'evenements correspondant a une requete LogQL,
    en sommant sur tous les streams (labels) retournes par Loki."""
    url = f"{current_app.config['LOKI_URL']}/loki/api/v1/query"
    try:
        resp = requests.get(url, params={'query': logql}, timeout=5)
        resp.raise_for_status()
        result = resp.json().get('data', {}).get('result', [])
        if not result:
            return 0
        total = 0
        for series in result:
            total += int(float(series['value'][1]))
        return total
    except Exception:
        return None


def query_loki_logs(logql, limit=5, window_seconds=3600):
    """Recupere les N dernieres lignes de logs correspondant a une requete LogQL."""
    url = f"{current_app.config['LOKI_URL']}/loki/api/v1/query_range"
    now_ns = int(time.time() * 1e9)
    start_ns = now_ns - int(window_seconds * 1e9)
    try:
        resp = requests.get(url, params={
            'query': logql,
            'limit': limit,
            'start': start_ns,
            'end': now_ns,
            'direction': 'backward',
        }, timeout=5)
        resp.raise_for_status()
        result = resp.json().get('data', {}).get('result', [])
        lines = []
        for stream in result:
            for value in stream.get('values', []):
                lines.append({'timestamp_ns': int(value[0]), 'line': value[1]})
        lines.sort(key=lambda x: x['timestamp_ns'], reverse=True)
        return lines[:limit]
    except Exception:
        return None


def jenkins_get(path, tree=None):
    """Appel GET authentifie vers l'API Jenkins (lecture seule)."""
    url = f"{current_app.config['JENKINS_URL']}{path}"
    params = {'tree': tree} if tree else {}
    auth = (current_app.config['JENKINS_USER'], current_app.config['JENKINS_TOKEN'])
    try:
        resp = requests.get(url, params=params, auth=auth, timeout=8)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def jenkins_get_artifact_text(job, build, relative_path):
    url = f"{current_app.config['JENKINS_URL']}/job/{job}/{build}/artifact/{relative_path}"
    auth = (current_app.config['JENKINS_USER'], current_app.config['JENKINS_TOKEN'])
    try:
        resp = requests.get(url, auth=auth, timeout=8)
        resp.raise_for_status()
        return resp.text
    except Exception:
        return None


def jenkins_public_build_url(job, build_number):
    """Construit l'URL publique (Cloudflare) d'un build, independamment
    de la configuration interne 'Jenkins URL' cote serveur Jenkins."""
    base = current_app.config['JENKINS_PUBLIC_URL'].rstrip('/')
    return f"{base}/job/{job}/{build_number}/"


def jenkins_public_artifact_url(job, build_number, relative_path):
    base = current_app.config['JENKINS_PUBLIC_URL'].rstrip('/')
    return f"{base}/job/{job}/{build_number}/artifact/{relative_path}"


def sonarcloud_get(path, params=None):
    url = f"https://sonarcloud.io{path}"
    token = current_app.config['SONARCLOUD_TOKEN']
    try:
        resp = requests.get(url, params=params, auth=(token, ''), timeout=8)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def parse_prom_metric(text, metric_name):
    """Extrait la valeur d'une metrique au format exposition Prometheus brut (texte)."""
    pattern = rf'^{re.escape(metric_name)}(\{{[^}}]*\}})?\s+([0-9.eE+-]+)'
    for line in text.splitlines():
        m = re.match(pattern, line)
        if m:
            return float(m.group(2))
    return None


# ----------------------------------------------------------------------
# Sante / vue d'ensemble
# ----------------------------------------------------------------------

@main.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@main.route('/api/overview')
def overview():
    metrics = {
        'alerts_firing': query_prometheus('count(ALERTS{alertstate="firing"})'),
        'node_ready': query_prometheus('kube_node_status_condition{condition="Ready", status="true"}'),
        'pods_failed': query_prometheus('sum(kube_pod_status_phase{phase=~"Failed|Unknown"})'),
        'app_up': query_prometheus('up{job="taskmanager-app-service"}'),
        'db_up': query_prometheus('pg_up{job="postgres-exporter-service"}'),
        'cpu_percent': query_prometheus(
            '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
        ),
        'ram_available_percent': query_prometheus(
            'node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100'
        ),
        'disk_available_percent': query_prometheus(
            '(node_filesystem_avail_bytes{mountpoint="/var", fstype="ext4"} / '
            'node_filesystem_size_bytes{mountpoint="/var", fstype="ext4"}) * 100'
        ),
    }
    return jsonify(metrics)


@main.route('/api/application')
def application():
    metrics = {
        'request_rate': query_prometheus(
            'sum(rate(flask_http_request_total{job="taskmanager-app-service"}[5m]))'
        ),
        'error_rate_percent': query_prometheus(
            '100 * (sum(rate(flask_http_request_total{job="taskmanager-app-service", status=~"5.."}[5m])) '
            'or vector(0)) / sum(rate(flask_http_request_total{job="taskmanager-app-service"}[5m]))'
        ),
        'active_sessions': query_prometheus('taskmanager_active_sessions'),
        'replicas': query_prometheus(
            'kube_deployment_status_replicas{deployment="taskmanager-app", namespace="devsecops"}'
        ),
    }
    return jsonify(metrics)


@main.route('/api/database')
def database():
    metrics = {
        'connections_active': query_prometheus(
            'sum(pg_stat_activity_count{job="postgres-exporter-service", datname="mydb", state="active"})'
        ),
        'connections_total': query_prometheus(
            'sum(pg_stat_activity_count{job="postgres-exporter-service", datname="mydb"})'
        ),
        'db_size_bytes': query_prometheus(
            'pg_database_size_bytes{job="postgres-exporter-service", datname="mydb"}'
        ),
    }
    return jsonify(metrics)


# ----------------------------------------------------------------------
# Sante des pods (kube-state-metrics + cAdvisor)
# ----------------------------------------------------------------------

@main.route('/api/pods')
def pods_status():
    metrics = {
        'node_ready': query_prometheus('kube_node_status_condition{condition="Ready", status="true"}'),
        'backend_restarts': query_prometheus(
            'sum(kube_pod_container_status_restarts_total{namespace="devsecops", pod=~"devsecops-dashboard-backend.*"})'
        ),
        'app_restarts': query_prometheus(
            'sum(kube_pod_container_status_restarts_total{namespace="devsecops", pod=~"taskmanager-app.*"})'
        ),
        'db_restarts': query_prometheus(
            'sum(kube_pod_container_status_restarts_total{namespace="devsecops", pod=~"taskmanager-postgres.*"})'
        ),
        'app_memory_percent': query_prometheus(
            '100 * sum(container_memory_working_set_bytes{namespace="devsecops", pod=~"taskmanager-app.*"}) '
            '/ sum(kube_pod_container_resource_limits{namespace="devsecops", pod=~"taskmanager-app.*", resource="memory"})'
        ),
        'db_memory_percent': query_prometheus(
            '100 * sum(container_memory_working_set_bytes{namespace="devsecops", pod=~"taskmanager-postgres.*"}) '
            '/ sum(kube_pod_container_resource_limits{namespace="devsecops", pod=~"taskmanager-postgres.*", resource="memory"})'
        ),
    }
    return jsonify(metrics)


# ----------------------------------------------------------------------
# Pipeline CI/CD (Jenkins)
# ----------------------------------------------------------------------

@main.route('/api/pipeline')
def pipeline():
    job = current_app.config['JENKINS_JOB']
    data = jenkins_get(
        f'/job/{job}/lastBuild/api/json',
        tree='number,result,building,duration,timestamp'
    )
    if data is None:
        return jsonify({'available': False})

    stages_data = jenkins_get(f'/job/{job}/lastBuild/wfapi/describe')
    stages = []
    if stages_data:
        for s in stages_data.get('stages', []):
            stages.append({
                'name': s.get('name'),
                'status': s.get('status'),
                'duration_ms': s.get('durationMillis'),
            })

    return jsonify({
        'available': True,
        'job_name': job,
        'build_number': data.get('number'),
        'result': data.get('result'),
        'building': data.get('building'),
        'duration_ms': data.get('duration'),
        'timestamp_ms': data.get('timestamp'),
        'url': jenkins_public_build_url(job, data.get('number')),
        'stages': stages,
    })


@main.route('/api/pipeline/history')
def pipeline_history():
    job = current_app.config['JENKINS_JOB']
    data = jenkins_get(
        f'/job/{job}/api/json',
        tree='builds[number,result,timestamp,duration]{0,5}'
    )
    if data is None:
        return jsonify({'available': False})

    builds = []
    for b in data.get('builds', []):
        builds.append({
            'build_number': b.get('number'),
            'result': b.get('result'),
            'timestamp_ms': b.get('timestamp'),
            'duration_ms': b.get('duration'),
            'url': jenkins_public_build_url(job, b.get('number')),
        })
    return jsonify({'available': True, 'builds': builds})


# ----------------------------------------------------------------------
# Qualite du code (SonarCloud)
# ----------------------------------------------------------------------

@main.route('/api/quality')
def quality():
    project_key = current_app.config['SONARCLOUD_PROJECT_KEY']

    qg = sonarcloud_get('/api/qualitygates/project_status', params={'projectKey': project_key})
    if qg is None:
        return jsonify({'available': False})

    measures = sonarcloud_get('/api/measures/component', params={
        'component': project_key,
        'metricKeys': 'coverage,bugs,vulnerabilities,code_smells,security_hotspots',
    })

    result = {
        'available': True,
        'quality_gate_status': qg.get('projectStatus', {}).get('status'),
        'project_url': f"https://sonarcloud.io/project/overview?id={project_key}",
    }
    if measures:
        for m in measures.get('component', {}).get('measures', []):
            result[m['metric']] = m.get('value')

    return jsonify(result)


# ----------------------------------------------------------------------
# Securite runtime (Falco via Loki)
# ----------------------------------------------------------------------

@main.route('/api/security/falco')
def security_falco():
    count_1h = query_loki_count(
        'count_over_time({namespace="falco"} |~ "Critical|Error|Alert|Emergency" [1h])'
    )
    count_24h = query_loki_count(
        'count_over_time({namespace="falco"} |~ "Critical|Error|Alert|Emergency" [24h])'
    )
    return jsonify({
        'critical_events_1h': count_1h,
        'critical_events_24h': count_24h,
        'grafana_url': current_app.config['GRAFANA_FALCO_URL'],
    })


@main.route('/api/security/falco/recent')
def security_falco_recent():
    raw = query_loki_logs(
        '{namespace="falco"} |~ "Critical|Error|Alert|Emergency"', limit=5
    )
    if raw is None:
        return jsonify({'available': False})

    events = []
    for entry in raw:
        try:
            parsed = json.loads(entry['line'])
            events.append({
                'timestamp_ns': entry['timestamp_ns'],
                'time': parsed.get('time'),
                'priority': parsed.get('priority'),
                'rule': parsed.get('rule'),
                'output': parsed.get('output'),
            })
        except Exception:
            events.append({
                'timestamp_ns': entry['timestamp_ns'],
                'time': None,
                'priority': None,
                'rule': None,
                'output': entry['line'][:300],
            })
    return jsonify({'available': True, 'events': events})


# ----------------------------------------------------------------------
# Scans de securite (derniers rapports Jenkins : Trivy / Gitleaks / Checkov)
# ----------------------------------------------------------------------

@main.route('/api/security/scans')
def security_scans():
    job = current_app.config['JENKINS_JOB']
    last_build = jenkins_get(
        f'/job/{job}/lastSuccessfulBuild/api/json',
        tree='number,timestamp,artifacts[fileName,relativePath]'
    )
    if last_build is None:
        return jsonify({'available': False})

    build_number = last_build.get('number')
    artifacts = {a['fileName']: a['relativePath'] for a in last_build.get('artifacts', [])}

    result = {
        'available': True,
        'build_number': build_number,
        'timestamp_ms': last_build.get('timestamp'),
        'trivy': None,
        'gitleaks': None,
        'checkov': None,
        'artifact_urls': {},
    }

    if 'trivy-report.json' in artifacts:
        result['artifact_urls']['trivy'] = jenkins_public_artifact_url(
            job, build_number, artifacts['trivy-report.json']
        )
        text = jenkins_get_artifact_text(job, build_number, artifacts['trivy-report.json'])
        if text:
            try:
                data = json.loads(text)
                high = critical = 0
                for res in data.get('Results', []) or []:
                    for vuln in res.get('Vulnerabilities', []) or []:
                        sev = vuln.get('Severity')
                        if sev == 'HIGH':
                            high += 1
                        elif sev == 'CRITICAL':
                            critical += 1
                result['trivy'] = {'high': high, 'critical': critical}
            except Exception:
                pass

    if 'gitleaks-report.json' in artifacts:
        result['artifact_urls']['gitleaks'] = jenkins_public_artifact_url(
            job, build_number, artifacts['gitleaks-report.json']
        )
        text = jenkins_get_artifact_text(job, build_number, artifacts['gitleaks-report.json'])
        if text:
            try:
                data = json.loads(text)
                result['gitleaks'] = {'secrets_found': len(data) if isinstance(data, list) else 0}
            except Exception:
                pass

    if 'results_json.json' in artifacts:
        result['artifact_urls']['checkov'] = jenkins_public_artifact_url(
            job, build_number, artifacts['results_json.json']
        )
        text = jenkins_get_artifact_text(job, build_number, artifacts['results_json.json'])
        if text:
            try:
                data = json.loads(text)
                summary = data.get('summary', {}) if isinstance(data, dict) else {}
                result['checkov'] = {
                    'passed': summary.get('passed'),
                    'failed': summary.get('failed'),
                }
            except Exception:
                pass

    return jsonify(result)


# ----------------------------------------------------------------------
# Tunnel Cloudflare
# ----------------------------------------------------------------------

@main.route('/api/tunnel')
def tunnel_status():
    url = f"{current_app.config['CLOUDFLARED_METRICS_URL']}/metrics"
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        text = resp.text
    except Exception:
        return jsonify({'reachable': False})

    ha_connections = parse_prom_metric(text, 'cloudflared_tunnel_ha_connections')
    config_errors = parse_prom_metric(text, 'cloudflared_config_local_config_pushes_errors')

    return jsonify({
        'reachable': True,
        'active_connections': ha_connections,
        'config_push_errors': config_errors,
    })
# ----------------------------------------------------------------------
# Audits de securite ponctuels (kube-bench CIS / kube-hunter)
# ----------------------------------------------------------------------
@main.route('/api/audits')
def audits():
    import os
    from datetime import datetime, timezone

    base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audit-reports')
    result = {'kube_bench': {'available': False}, 'kube_hunter': {'available': False}}

    # --- kube-bench ---
    bench_path = os.path.join(base_dir, 'kube-bench-report.json')
    try:
        with open(bench_path, encoding='utf-8') as f:
            bench = json.load(f)
        totals = bench.get('Totals', {})
        sections = []
        for c in bench.get('Controls', []):
            sections.append({
                'id': c.get('id'),
                'text': c.get('text'),
                'passed': c.get('total_pass', 0),
                'failed': c.get('total_fail', 0),
                'warned': c.get('total_warn', 0),
            })
        total_evaluated = (
            totals.get('total_pass', 0)
            + totals.get('total_fail', 0)
            + totals.get('total_warn', 0)
        )
        automated = totals.get('total_pass', 0) + totals.get('total_fail', 0)
        score = round(totals.get('total_pass', 0) / automated * 100, 1) if automated else None
        result['kube_bench'] = {
            'available': True,
            'passed': totals.get('total_pass', 0),
            'failed': totals.get('total_fail', 0),
            'warned': totals.get('total_warn', 0),
            'total': total_evaluated,
            'score_percent': score,
            'sections': sections,
            'scanned_at': datetime.fromtimestamp(
                os.path.getmtime(bench_path), tz=timezone.utc
            ).isoformat(),
        }
    except Exception:
        pass

    # --- kube-hunter ---
    hunter_path = os.path.join(base_dir, 'kube-hunter-report.json')
    try:
        with open(hunter_path, encoding='utf-8') as f:
            hunter = json.load(f)
        vulns = hunter.get('vulnerabilities', []) or []
        by_severity = {}
        for v in vulns:
            sev = (v.get('severity') or 'unknown').lower()
            by_severity[sev] = by_severity.get(sev, 0) + 1
        result['kube_hunter'] = {
            'available': True,
            'nodes_count': len(hunter.get('nodes', []) or []),
            'services_count': len(hunter.get('services', []) or []),
            'vulnerabilities_count': len(vulns),
            'by_severity': by_severity,
            'vulnerabilities': [
                {
                    'vid': v.get('vid'),
                    'name': v.get('vulnerability'),
                    'severity': (v.get('severity') or 'unknown').lower(),
                    'location': v.get('location'),
                    'description': v.get('description'),
                    'reference': v.get('avd_reference'),
                }
                for v in vulns
            ],
            'scanned_at': datetime.fromtimestamp(
                os.path.getmtime(hunter_path), tz=timezone.utc
            ).isoformat(),
        }
    except Exception:
        pass

    return jsonify(result)
# ----------------------------------------------------------------------
# Alertes Grafana actives (via l'API Alertmanager interne)
# ----------------------------------------------------------------------
@main.route('/api/alerts')
def alerts():
    import os
    from datetime import datetime, timezone

    grafana_url = os.environ.get('GRAFANA_URL', '').rstrip('/')
    grafana_token = os.environ.get('GRAFANA_TOKEN', '')
    public_url = os.environ.get('GRAFANA_PUBLIC_URL', '').rstrip('/')

    if not grafana_url or not grafana_token:
        return jsonify({'available': False, 'reason': 'configuration Grafana absente'})

    try:
        resp = requests.get(
            f'{grafana_url}/api/alertmanager/grafana/api/v2/alerts',
            headers={'Authorization': f'Bearer {grafana_token}'},
            timeout=5,
        )
        resp.raise_for_status()
        raw = resp.json()
    except Exception:
        return jsonify({'available': False, 'reason': 'Grafana injoignable'})

    now = datetime.now(timezone.utc)
    alerts_list = []
    by_severity = {}
    by_category = {}
    silenced_count = 0

    for a in raw:
        labels = a.get('labels', {}) or {}
        annotations = a.get('annotations', {}) or {}
        status = a.get('status', {}) or {}

        is_silenced = bool(status.get('silencedBy'))
        if is_silenced:
            silenced_count += 1

        severity = (labels.get('severity') or 'unknown').lower()
        category = labels.get('category') or 'autre'
        alertname = labels.get('alertname') or ''
        # rulename est plus lisible que alertname quand il est present
        name = labels.get('rulename') or alertname or 'Alerte sans nom'

        # duree depuis le declenchement
        duration_min = None
        starts_at = a.get('startsAt')
        if starts_at:
            try:
                started = datetime.fromisoformat(starts_at.replace('Z', '+00:00'))
                duration_min = int((now - started).total_seconds() / 60)
            except Exception:
                pass

        # une alerte DatasourceNoData signale une absence de donnees, pas un incident metier
        is_no_data = alertname == 'DatasourceNoData'

        by_severity[severity] = by_severity.get(severity, 0) + 1
        by_category[category] = by_category.get(category, 0) + 1

        alerts_list.append({
            'name': name,
            'alertname': alertname,
            'severity': severity,
            'category': category,
            'folder': labels.get('grafana_folder'),
            'summary': annotations.get('summary'),
            'started_at': starts_at,
            'duration_minutes': duration_min,
            'silenced': is_silenced,
            'no_data': is_no_data,
            'url': a.get('generatorURL'),
        })

    # tri : critiques d'abord, puis les plus anciennes
    severity_order = {'critical': 0, 'warning': 1, 'info': 2, 'unknown': 3}
    alerts_list.sort(key=lambda x: (
        severity_order.get(x['severity'], 9),
        -(x['duration_minutes'] or 0),
    ))

    return jsonify({
        'available': True,
        'total': len(alerts_list),
        'silenced': silenced_count,
        'by_severity': by_severity,
        'by_category': by_category,
        'alerts': alerts_list,
        'grafana_alerting_url': f'{public_url}/alerting/list' if public_url else None,
    })
