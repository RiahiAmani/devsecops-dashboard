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

    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app
