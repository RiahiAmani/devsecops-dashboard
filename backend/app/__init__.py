from flask import Flask
from flask_cors import CORS
import os

def create_app():
    app = Flask(__name__)
    CORS(app, origins=[os.getenv('FRONTEND_ORIGIN', '*')])

    app.config['PROMETHEUS_URL'] = os.getenv(
        'PROMETHEUS_URL',
        'http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090'
    )
    app.config['LOKI_URL'] = os.getenv(
        'LOKI_URL',
        'http://loki.monitoring.svc.cluster.local:3100'
    )
    app.config['JENKINS_URL'] = os.getenv(
        'JENKINS_URL',
        'http://jenkins-service.jenkins.svc.cluster.local:8080'
    )
    app.config['JENKINS_PUBLIC_URL'] = os.getenv(
        'JENKINS_PUBLIC_URL',
        'https://jenkins.riahi.dpdns.org'
    )
    app.config['JENKINS_USER'] = os.getenv('JENKINS_USER', '')
    app.config['JENKINS_TOKEN'] = os.getenv('JENKINS_TOKEN', '')
    app.config['JENKINS_JOB'] = os.getenv('JENKINS_JOB', 'taskmanager')
    app.config['CLOUDFLARED_METRICS_URL'] = os.getenv(
        'CLOUDFLARED_METRICS_URL',
        'http://cloudflared-metrics.cloudflared.svc.cluster.local:20241'
    )
    app.config['SONARCLOUD_TOKEN'] = os.getenv('SONARCLOUD_TOKEN', '')
    app.config['SONARCLOUD_PROJECT_KEY'] = os.getenv(
        'SONARCLOUD_PROJECT_KEY', 'RiahiAmani_devsecops-platform'
    )
    app.config['GRAFANA_FALCO_URL'] = os.getenv('GRAFANA_FALCO_URL', '')

    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app
