import os
import re

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
    """Compte le nombre d'evenements correspondant a une requete LogQL sur les N dernieres minutes."""
    url = f"{current_app.config['LOKI_URL']}/loki/api/v1/query"
    try:
        resp = requests.get(url, params={'query': logql}, timeout=5)
        resp.raise_for_status()
        result = resp.json().get('data', {}).get('result', [])
        if not result:
            return 0
        return int(float(result[0]['value'][1]))
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


def parse_prom_metric(text, metric_name):
    """Extrait la valeur d'une metrique au format exposition Prometheus brut (texte)."""
    pattern = rf'^{re.escape(metric_name)}(\{{[^}}]*\}})?\s+([0-9.eE+-]+)'
    for line in text.splitlines():
        m = re.match(pattern, line)
        if m:
            return float(m.group(2))
    return None


# ----------------------------------------------------------------------
# Sante / vue d'ensemble (existant)
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
# Pipeline CI/CD (Jenkins)
# ----------------------------------------------------------------------

@main.route('/api/pipeline')
def pipeline():
    job = current_app.config['JENKINS_JOB']
    data = jenkins_get(
        f'/job/{job}/lastBuild/api/json',
        tree='number,result,building,duration,timestamp,url'
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
        'build_number': data.get('number'),
        'result': data.get('result'),
        'building': data.get('building'),
        'duration_ms': data.get('duration'),
        'timestamp_ms': data.get('timestamp'),
        'url': data.get('url'),
        'stages': stages,
    })


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
    })


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
    }

    # Trivy : compte des vulnerabilites HIGH/CRITICAL
    if 'trivy-report.json' in artifacts:
        text = jenkins_get_artifact_text(job, build_number, artifacts['trivy-report.json'])
        if text:
            try:
                import json
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

    # Gitleaks : nombre de secrets detectes
    if 'gitleaks-report.json' in artifacts:
        text = jenkins_get_artifact_text(job, build_number, artifacts['gitleaks-report.json'])
        if text:
            try:
                import json
                data = json.loads(text)
                result['gitleaks'] = {'secrets_found': len(data) if isinstance(data, list) else 0}
            except Exception:
                pass

    # Checkov : resume pass/fail
    if 'results_json.json' in artifacts:
        text = jenkins_get_artifact_text(job, build_number, artifacts['results_json.json'])
        if text:
            try:
                import json
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
# Tunnel Cloudflare (metriques cloudflared, lues directement)
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
