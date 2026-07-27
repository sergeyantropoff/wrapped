// Wrapped — CI: multi-arch push (Harbor + Docker Hub), затем асинхронный Deploy
//
// Ресурсы k3s: Builder и Deploy не должны держать два DinD-пода сразу.
// 1) стадии сборки на agent label 'docker' (DinD)
// 2) при успехе — trigger Deploy с wait:false и agent none → Builder-под умирает
// 3) Deploy стартует отдельно уже без Builder
//
// Версия образа = VERSION из коммита. Bump: make bump-patch / make push.
//
// Credentials (Global):
//   harbor-devops-tools-push-pull-access — Harbor devops-tools (robot)
//   docker-hub                          — Docker Hub (inecs)
//   ssh-gitea-key                       — SCM checkout Gitea
//   k3s-kubeconfig                      — в job Deploy (Jenkinsfile.deploy)
//
// Deploy job: devops-tools/wrapped/wrapped-deploy/main

pipeline {
    agent none

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
        // RELEASE_TAG — после checkout (с agent none GIT_COMMIT ещё нет → валидация env падает)
        BUILDX_BUILDER    = "jenkins-wrapped-${env.BUILD_NUMBER}"
        DEPLOY_JOB        = 'devops-tools/wrapped/wrapped-deploy/main'
        TZ                = 'Europe/Moscow'
    }

    stages {
        stage('Build image') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            agent { label 'docker' }
            stages {
                stage('Checkout') {
                    steps {
                        checkout scm
                    }
                }

                stage('Version') {
                    steps {
                        container('docker') {
                            script {
                                env.IMAGE_VERSION = sh(
                                    script: "tr -d '[:space:]' < VERSION",
                                    returnStdout: true
                                ).trim()
                                if (!env.IMAGE_VERSION) {
                                    error('VERSION file is empty')
                                }
                                env.RELEASE_TAG = sh(
                                    script: 'git rev-parse --short=7 HEAD',
                                    returnStdout: true
                                ).trim()
                                if (!env.RELEASE_TAG) {
                                    error('could not resolve short git SHA for RELEASE_TAG')
                                }
                                echo "IMAGE_VERSION from VERSION → ${env.IMAGE_VERSION}"
                                echo "RELEASE_TAG → ${env.RELEASE_TAG}"
                            }
                        }
                    }
                }

                stage('Build & push') {
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

                                    test -n "${IMAGE_VERSION}"
                                    echo "Building tags: ${IMAGE_VERSION}, ${RELEASE_TAG}, latest"

                                    echo "$HARBOR_PASS" | docker login "$HARBOR_REGISTRY" -u "$HARBOR_USER" --password-stdin
                                    echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin

                                    docker buildx rm "$BUILDX_BUILDER" 2>/dev/null || true
                                    docker buildx create --name "$BUILDX_BUILDER" --driver docker-container --use
                                    docker buildx inspect --bootstrap >/dev/null

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

                                    for IMAGE in "$HARBOR_IMAGE" "$DOCKERHUB_IMAGE"; do
                                      docker buildx imagetools create \
                                        -t "${IMAGE}:${RELEASE_TAG}" \
                                        -t "${IMAGE}:${IMAGE_VERSION}" \
                                        -t "${IMAGE}:latest" \
                                        "${IMAGE}:${RELEASE_TAG}-amd64" \
                                        "${IMAGE}:${RELEASE_TAG}-arm64"
                                    done

                                    echo "--- Harbor ---"
                                    docker buildx imagetools inspect "${HARBOR_IMAGE}:${IMAGE_VERSION}" | sed -n '1,40p'
                                    echo "--- Docker Hub ---"
                                    docker buildx imagetools inspect "${DOCKERHUB_IMAGE}:${IMAGE_VERSION}" | sed -n '1,40p'

                                    docker buildx rm "$BUILDX_BUILDER" || true
                                '''
                            }
                        }
                    }
                }
            }
            post {
                always {
                    script {
                        try {
                            container('docker') {
                                sh 'docker buildx rm "$BUILDX_BUILDER" 2>/dev/null || true'
                            }
                        } catch (Ignored) {
                            // pod may already be gone
                        }
                    }
                }
                success {
                    echo "✓ Build OK: ${DOCKERHUB_IMAGE}:{${RELEASE_TAG},${IMAGE_VERSION},latest}"
                }
                failure {
                    echo "✗ Build/push не удались — Deploy не запускается"
                }
            }
        }

        // Без DinD: только очередь Deploy, Builder-под уже освобождён
        stage('Trigger deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            agent none
            steps {
                script {
                    echo "Build finished — triggering ${DEPLOY_JOB} → ${DOCKERHUB_IMAGE}:${IMAGE_VERSION} (wait: false)"
                    build(
                        job: env.DEPLOY_JOB,
                        wait: false,
                        propagate: false,
                        parameters: [
                            string(name: 'IMAGE_REPOSITORY', value: env.DOCKERHUB_IMAGE),
                            string(name: 'IMAGE_TAG', value: env.IMAGE_VERSION),
                            string(name: 'IMAGE_PULL_POLICY', value: 'Always'),
                        ]
                    )
                    echo "Deploy queued; Builder pipeline exits and releases cluster resources."
                }
            }
        }
    }

    post {
        success {
            echo "✓ Version: ${IMAGE_VERSION}"
            echo "✓ Image:   ${DOCKERHUB_IMAGE}:{${RELEASE_TAG},${IMAGE_VERSION},latest}"
            echo "✓ Deploy:  ${DEPLOY_JOB} triggered (async)"
        }
        failure {
            echo "✗ Сборка не удалась — см. лог Build image"
        }
    }
}
