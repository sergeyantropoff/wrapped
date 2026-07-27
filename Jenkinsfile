// Wrapped — CI: multi-arch push (Harbor + Docker Hub) + Helm deploy
//
// Триггер: push в main (webhook Gitea → Jenkins Multibranch).
// Версия образа = файл VERSION из коммита (без авто-bump в CI).
// Bump: make bump-patch / make push локально — что запушили, то и уйдёт в релиз.
//
// Credentials (Manage Jenkins → Credentials → Global):
//   harbor-devops-tools-push-pull-access — Harbor devops-tools (robot)
//   docker-hub                          — Docker Hub (inecs)
//   ssh-gitea-key                       — SCM checkout Gitea
//   k3s-kubeconfig                      — в job Deploy (Jenkinsfile.deploy)
//
// Теги образа: :<semver из VERSION>, :<sha>, :latest
// Deploy: devops-tools/wrapped/wrapped-deploy/main

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
        RELEASE_TAG       = "${env.GIT_COMMIT?.take(7) ?: 'dev'}"
        BUILDX_BUILDER    = "jenkins-wrapped-${env.BUILD_NUMBER}"
        DEPLOY_JOB        = 'devops-tools/wrapped/wrapped-deploy/main'
        TZ                = 'Europe/Moscow'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Version') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
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
                        echo "IMAGE_VERSION from VERSION → ${env.IMAGE_VERSION}"
                    }
                }
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

        stage('Trigger deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                script {
                    echo "Triggering ${DEPLOY_JOB} → ${DOCKERHUB_IMAGE}:${IMAGE_VERSION}"
                    build(
                        job: env.DEPLOY_JOB,
                        wait: true,
                        propagate: true,
                        parameters: [
                            string(name: 'IMAGE_REPOSITORY', value: env.DOCKERHUB_IMAGE),
                            string(name: 'IMAGE_TAG', value: env.IMAGE_VERSION),
                            string(name: 'IMAGE_PULL_POLICY', value: 'Always'),
                        ]
                    )
                }
            }
        }
    }

    post {
        success {
            echo "✓ Version:   ${IMAGE_VERSION}"
            echo "✓ Harbor:    ${HARBOR_IMAGE}:{${RELEASE_TAG},${IMAGE_VERSION},latest}"
            echo "✓ Docker Hub: ${DOCKERHUB_IMAGE}:{${RELEASE_TAG},${IMAGE_VERSION},latest}"
            echo "✓ Deploy:    ${DEPLOY_JOB} (${DOCKERHUB_IMAGE}:${IMAGE_VERSION})"
        }
        failure {
            echo "✗ Version / build / push / deploy — см. лог стадий"
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
