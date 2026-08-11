pipeline {
  agent {
    kubernetes {
      yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: ci-deployer
  containers:
  - name: gitleaks
    image: zricethezav/gitleaks:latest
    command: [sleep]
    args: [infinity]
  - name: checkov
    image: bridgecrew/checkov:latest
    command: [sleep]
    args: [infinity]
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: [sleep]
    args: [infinity]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker
  - name: trivy
    image: aquasec/trivy:latest
    command: [sleep]
    args: [infinity]
  - name: kubectl
    image: alpine/k8s:1.32.12
    command: [sleep]
    args: [infinity]
  volumes:
  - name: docker-config
    secret:
      secretName: docker-hub-creds
      items:
      - key: .dockerconfigjson
        path: config.json
"""
    }
  }
  environment {
    BACKEND_IMAGE  = "riahiamani/devsecops-dashboard-backend"
    FRONTEND_IMAGE = "riahiamani/devsecops-dashboard-frontend"
    IMAGE_TAG      = "${BUILD_NUMBER}"
  }
  stages {
    stage('Analyse des secrets (Gitleaks)') {
      steps {
        container('gitleaks') {
          sh '''
          gitleaks detect --source=${WORKSPACE} --report-format=json --report-path=${WORKSPACE}/gitleaks-report.json --redact --exit-code=0
          '''
        }
        archiveArtifacts artifacts: 'gitleaks-report.json', allowEmptyArchive: true
      }
    }
    stage('Analyse infrastructure (Checkov)') {
      steps {
        container('checkov') {
          sh '''
          checkov --directory ${WORKSPACE} \
            --framework dockerfile \
            --output json \
            --output-file-path ${WORKSPACE} \
            --soft-fail
          '''
        }
        archiveArtifacts artifacts: 'results_json.json', allowEmptyArchive: true
      }
    }
    stage('Build et push Backend (Kaniko)') {
      steps {
        container('kaniko') {
          sh '''
          /kaniko/executor \
            --context=dir://${WORKSPACE}/backend \
            --dockerfile=${WORKSPACE}/backend/Dockerfile \
            --destination=${BACKEND_IMAGE}:${IMAGE_TAG} \
            --destination=${BACKEND_IMAGE}:latest \
            --ignore-path=/product_uuid
          '''
        }
      }
    }
    stage('Build et push Frontend (Kaniko)') {
      steps {
        container('kaniko') {
          sh '''
          /kaniko/executor \
            --context=dir://${WORKSPACE}/frontend \
            --dockerfile=${WORKSPACE}/frontend/Dockerfile \
            --destination=${FRONTEND_IMAGE}:${IMAGE_TAG} \
            --destination=${FRONTEND_IMAGE}:latest \
            --ignore-path=/product_uuid
          '''
        }
      }
    }
    stage('Scan de vulnerabilites (Trivy)') {
      steps {
        container('trivy') {
          sh '''
          trivy image --severity HIGH,CRITICAL --format json --output trivy-backend.json --exit-code 0 ${BACKEND_IMAGE}:${IMAGE_TAG}
          trivy image --severity HIGH,CRITICAL --format json --output trivy-frontend.json --exit-code 0 ${FRONTEND_IMAGE}:${IMAGE_TAG}
          '''
        }
        archiveArtifacts artifacts: 'trivy-*.json', allowEmptyArchive: true
      }
    }
    stage('Deploiement Kubernetes') {
      steps {
        container('kubectl') {
          sh '''
          kubectl apply -f k8s/dashboard-deployment.yaml
          kubectl set image deployment/devsecops-dashboard-backend backend=${BACKEND_IMAGE}:${IMAGE_TAG} -n devsecops
          kubectl set image deployment/devsecops-dashboard-frontend frontend=${FRONTEND_IMAGE}:${IMAGE_TAG} -n devsecops
          kubectl rollout status deployment/devsecops-dashboard-backend -n devsecops --timeout=120s
          kubectl rollout status deployment/devsecops-dashboard-frontend -n devsecops --timeout=120s
          '''
        }
      }
    }
  }
}
