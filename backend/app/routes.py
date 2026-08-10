from flask import Blueprint, jsonify, current_app
import requests

main = Blueprint('main', __name__)

def query_prometheus(promql):
    """Interroge Prometheus et retourne la première valeur scalaire, ou None."""
    url = f"{current_app.config['PROMETHEUS_URL']}/api/v1/query"
    try:
        resp = requests.get(url, params={'query': promql}, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        result = data.get('data', {}).get('result', [])
        if not result:
            return None
        return float(result[0]['value'][1])
    except Exception:
        return None


@main.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@main.route('/api/overview')
def overview():
    """Regroupe les métriques clés de la vue d'ensemble en un seul appel."""
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
