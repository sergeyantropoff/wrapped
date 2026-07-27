// Wrapped — CI: auto SemVer bump + multi-arch push (Harbor + Docker Hub) + deploy
//
// Триггер: push в main (webhook Gitea → Jenkins Multibranch).
// Коммиты с [skip ci] в сообщении — без повторного bump (анти-цикл после version commit).
//
// Credentials (Manage Jenkins → Credentials → Global):
//   harbor-devops-tools-push-pull-access — Harbor devops-tools (robot)
//   docker-hub                          — Docker Hub (inecs)
//   ssh-gitea-key                       — SSH к Gitea (push bump VERSION)
//   gitea-jenkins-token                 — token Gitea (если нужен API; SCM обычно ssh-gitea-key)
//
// Версия: файл VERSION (+ pyproject / Helm). Теги образа: :<semver>, :<sha>, :latest
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
        // SSH «Доступ к Gitea по SSH» — push bump-коммита VERSION
        GIT_SSH_CREDENTIALS_ID = 'ssh-gitea-key'
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
                        sh 'apk add --no-cache python3 git openssh-client >/dev/null'
                        def lastMsg = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                        if (lastMsg.contains('[skip ci]')) {
                            env.IMAGE_VERSION = sh(script: 'cat VERSION', returnStdout: true).trim()
                            env.SKIP_CI = '1'
                            echo "Skip CI for version-bump commit ([skip ci]); VERSION=${env.IMAGE_VERSION}"
                        } else {
                            env.IMAGE_VERSION = sh(
                                script: 'PYTHONPATH=. python3 scripts/bump_version.py patch',
                                returnStdout: true
                            ).trim()
                            env.SKIP_CI = '0'
                            echo "Bumped VERSION → ${env.IMAGE_VERSION}"
                        }
                    }
                }
            }
        }

        stage('Build & push') {
            when {
                allOf {
                    anyOf { branch 'main'; branch 'master' }
                    expression { return env.SKIP_CI != '1' }
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

        stage('Commit version') {
            when {
                allOf {
                    anyOf { branch 'main'; branch 'master' }
                    expression { return env.SKIP_CI != '1' }
                }
            }
            steps {
                container('docker') {
                    sshagent(credentials: [env.GIT_SSH_CREDENTIALS_ID]) {
                        sh '''
                            set -eux
                            git config user.email "jenkins@antropoff.ru"
                            git config user.name "Jenkins"
                            git add VERSION pyproject.toml helm/wrapped/Chart.yaml helm/wrapped/values.yaml
                            if git diff --cached --quiet; then
                              echo "No version files to commit"
                              exit 0
                            fi
                            git commit -m "Bump version to ${IMAGE_VERSION} [skip ci]."
                            # Multibranch detached HEAD → push to branch name
                            BRANCH="${BRANCH_NAME:-main}"
                            git push origin "HEAD:refs/heads/${BRANCH}"
                        '''
                    }
                }
            }
        }

        stage('Trigger deploy') {
            when {
                allOf {
                    anyOf { branch 'main'; branch 'master' }
                    expression { return env.SKIP_CI != '1' }
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
