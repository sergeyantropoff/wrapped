// Wrapped — CI: multi-arch (amd64+arm64) build & push to Harbor + Docker Hub
//
// Триггер: push в main (webhook Gitea → Jenkins Multibranch / Pipeline from SCM).
//
// Credentials в Jenkins (Manage Credentials → System → Global):
//   harbor-devops-tools-push-pull-access — Username with password (Harbor devops-tools)
//   docker-hub                          — Username with password (Docker Hub)
//
// Agent: cloud kubernetes, pod template default (labels docker / dind)
//
// Образы:
//   hub.antropoff.ru/devops-tools/wrapped:<sha|0.1.0|latest>
//   inecs/wrapped:<sha|0.1.0|latest>

pipeline {
    agent { label 'docker' }

    options {
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
        timeout(time: 60, unit: 'MINUTES')
        timestamps()
    }

    environment {
        HARBOR_REGISTRY   = 'hub.antropoff.ru'
        HARBOR_IMAGE      = 'hub.antropoff.ru/devops-tools/wrapped'
        DOCKERHUB_IMAGE   = 'inecs/wrapped'
        IMAGE_VERSION     = '0.1.0'
        RELEASE_TAG       = "${env.GIT_COMMIT?.take(7) ?: 'dev'}"
        BUILDX_BUILDER    = "jenkins-wrapped-${env.BUILD_NUMBER}"
        TZ                = 'Europe/Moscow'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build & push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'harbor-devops-tools-push-pull-access',
                        usernameVariable: 'HARBOR_USER',
                        passwordVariable: 'HARBOR_PASS'
                    ),
                    usernamePassword(
                        credentialsId: 'docker-hub',
                        usernameVariable: 'DOCKERHUB_USER',
                        passwordVariable: 'DOCKERHUB_PASS'
                    )
                ]) {
                    container('docker') {
                        sh '''
                            set -eux

                            echo "$HARBOR_PASS" | docker login "$HARBOR_REGISTRY" -u "$HARBOR_USER" --password-stdin
                            echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin

                            docker buildx rm "$BUILDX_BUILDER" 2>/dev/null || true
                            docker buildx create --name "$BUILDX_BUILDER" --driver docker-container --use
                            docker buildx inspect --bootstrap >/dev/null

                            # Per-arch images → both registries (Harbor is happier than a single multi-arch --push)
                            docker buildx build \
                              --platform linux/amd64 \
                              --provenance=false --sbom=false --push \
                              -t "${HARBOR_IMAGE}:${RELEASE_TAG}-amd64" \
                              -t "${DOCKERHUB_IMAGE}:${RELEASE_TAG}-amd64" \
                              -f Dockerfile .

                            docker buildx build \
                              --platform linux/arm64 \
                              --provenance=false --sbom=false --push \
                              -t "${HARBOR_IMAGE}:${RELEASE_TAG}-arm64" \
                              -t "${DOCKERHUB_IMAGE}:${RELEASE_TAG}-arm64" \
                              -f Dockerfile .

                            # Multi-arch manifests: :sha, :0.1.0, :latest on each registry
                            for IMAGE in "$HARBOR_IMAGE" "$DOCKERHUB_IMAGE"; do
                              docker buildx imagetools create \
                                -t "${IMAGE}:${RELEASE_TAG}" \
                                -t "${IMAGE}:${IMAGE_VERSION}" \
                                -t "${IMAGE}:latest" \
                                "${IMAGE}:${RELEASE_TAG}-amd64" \
                                "${IMAGE}:${RELEASE_TAG}-arm64"
                            done

                            echo "--- Harbor ---"
                            docker buildx imagetools inspect "${HARBOR_IMAGE}:${RELEASE_TAG}" | sed -n '1,40p'
                            echo "--- Docker Hub ---"
                            docker buildx imagetools inspect "${DOCKERHUB_IMAGE}:${RELEASE_TAG}" | sed -n '1,40p'

                            docker buildx rm "$BUILDX_BUILDER" || true
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "✓ Harbor:    ${HARBOR_IMAGE}:{${RELEASE_TAG},${IMAGE_VERSION},latest}"
            echo "✓ Docker Hub: ${DOCKERHUB_IMAGE}:{${RELEASE_TAG},${IMAGE_VERSION},latest}"
        }
        failure {
            echo "✗ Сборка или push не удались — см. лог стадии Build & push"
        }
        always {
            script {
                try {
                    container('docker') {
                        sh 'docker buildx rm "$BUILDX_BUILDER" 2>/dev/null || true'
                    }
                } catch (Ignored) {
                    // agent may already be gone
                }
            }
        }
    }
}
