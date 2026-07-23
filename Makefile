.PHONY: help env build up down restart logs shell migrate revision release buildx-setup helm-package helm-lint clean ps push

COMPOSE ?= docker compose
IMAGE_NAME ?= wrapped
IMAGE_TAG ?= 0.1.0
# Docker Hub namespace → image: $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
# Example: inecs/wrapped:0.1.0
RELEASE_REGISTRY ?= inecs
FULL_IMAGE := $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
# Multi-arch platforms for make release (Docker Hub manifest list)
RELEASE_PLATFORMS ?= linux/amd64,linux/arm64
BUILDX_BUILDER ?= wrapped-release
# Set PUSH=0 to build only (no docker push; image stays in buildx cache)
PUSH ?= 1
APP_PORT ?= 8000

help:
	@echo "Wrapped — make targets"
	@echo ""
	@echo "  make env          Copy .env.example -> .env (if missing)"
	@echo "  make build        Build app image"
	@echo "  make up           Start dev stack (app + Postgres + MinIO)"
	@echo "  make down         Stop stack"
	@echo "  make restart      Restart app service"
	@echo "  make logs         Tail app logs"
	@echo "  make ps           Show compose status"
	@echo "  make shell        Shell into app container"
	@echo "  make migrate      Run alembic upgrade head"
	@echo "  make revision m=\"msg\"  Create alembic revision"
	@echo "  make release      Multi-arch build & push $(FULL_IMAGE)"
	@echo "                    platforms: $(RELEASE_PLATFORMS)"
	@echo "  make push         git add ., commit (prompt), push origin"
	@echo "  make helm-lint    Lint Helm chart"
	@echo "  make helm-package Package Helm chart"
	@echo "  make clean        Remove containers, volumes, local image"
	@echo ""
	@echo "Release examples:"
	@echo "  make release IMAGE_TAG=0.1.0"
	@echo "  make release IMAGE_TAG=0.1.0 PUSH=0"
	@echo "  make release IMAGE_TAG=0.1.0 RELEASE_PLATFORMS=linux/arm64"

env:
	@test -f .env || cp .env.example .env
	@echo ".env ready"

build: env
	$(COMPOSE) build app

up: env
	$(COMPOSE) up -d --build
	@echo ""
	@echo "Wrapped: http://localhost:$(APP_PORT)"
	@echo "MinIO console: http://localhost:9001 (wrappedminio / wrappedminio123)"
	@echo "Admin: http://localhost:$(APP_PORT)/admin"

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart app

logs:
	$(COMPOSE) logs -f app

ps:
	$(COMPOSE) ps

shell:
	$(COMPOSE) exec app sh

migrate:
	$(COMPOSE) exec app alembic upgrade head

revision:
	@test -n "$(m)" || (echo 'Usage: make revision m="message"' && exit 1)
	$(COMPOSE) exec app alembic revision --autogenerate -m "$(m)"

buildx-setup:
	@command -v docker >/dev/null 2>&1 || (echo "docker is required" >&2; exit 1)
	@docker buildx version >/dev/null 2>&1 || (echo "docker buildx is required" >&2; exit 1)
	@docker buildx inspect $(BUILDX_BUILDER) >/dev/null 2>&1 || \
		docker buildx create --name $(BUILDX_BUILDER) --driver docker-container --use
	@docker buildx use $(BUILDX_BUILDER)
	@docker buildx inspect --bootstrap >/dev/null

# Multi-arch release: linux/amd64 + linux/arm64 → Docker Hub manifest list.
# PUSH=1 (default): buildx --push. PUSH=0: build only (cache; cannot --load multi-arch).
# Only tag $(FULL_IMAGE) — a bare "$(IMAGE_NAME):tag" would push to docker.io/library/...
release: env buildx-setup
	@echo "Building $(FULL_IMAGE) [$(RELEASE_PLATFORMS)]"
	@if [ "$(PUSH)" = "1" ]; then \
		docker buildx build \
			--platform $(RELEASE_PLATFORMS) \
			--provenance=false \
			--sbom=false \
			-t $(FULL_IMAGE) \
			--push \
			. \
		&& echo "Pushed $(FULL_IMAGE) (multi-arch)" \
		&& docker buildx imagetools inspect $(FULL_IMAGE) | sed -n '1,40p'; \
	else \
		docker buildx build \
			--platform $(RELEASE_PLATFORMS) \
			--provenance=false \
			--sbom=false \
			-t $(FULL_IMAGE) \
			. \
		&& echo "PUSH=0 — multi-arch built into buildx cache (not pushed, not loaded locally)"; \
	fi
	@$(MAKE) helm-package IMAGE_TAG=$(IMAGE_TAG)

helm-lint:
	helm lint ./helm/wrapped

# Helm chart --version must be SemVer; non-semver IMAGE_TAG (e.g. latest) → 0.0.0-<tag>
helm-package:
	@mkdir -p dist
	@tag="$(IMAGE_TAG)"; \
	if echo "$$tag" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([.+].*)?$$'; then \
		chart_ver="$$tag"; \
	else \
		chart_ver="0.0.0-$$tag"; \
		echo "IMAGE_TAG '$$tag' is not SemVer — helm chart version=$$chart_ver"; \
	fi; \
	helm package ./helm/wrapped --destination dist --version "$$chart_ver" --app-version "$$tag"
	@echo "Helm chart in dist/"

clean:
	$(COMPOSE) down -v --remove-orphans
	-docker rmi $(IMAGE_NAME):$(IMAGE_TAG) $(FULL_IMAGE) 2>/dev/null || true
	-docker buildx rm $(BUILDX_BUILDER) 2>/dev/null || true
	rm -rf dist

# Same flow as proxmox_api_simulator: stage all, multiline commit via Ctrl-D, push origin.
push:
	@set -e; \
	git add .; \
	echo "=== staged ==="; \
	git status --short; \
	echo; \
	if git diff --cached --quiet; then \
		echo "Nothing to commit — pushing current branch."; \
	else \
		echo "Enter commit message (multiline OK), then Ctrl-D:"; \
		msg=$$(cat </dev/tty); \
		if [ -z "$$msg" ]; then echo "Empty commit message, aborting." >&2; exit 1; fi; \
		printf '%s\n' "$$msg" | git commit -F -; \
	fi; \
	echo "Pushing to both remotes:"; \
	git remote get-url --push --all origin | sed 's/^/  - /'; \
	git push origin HEAD
