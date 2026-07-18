.PHONY: help env build up down restart logs shell migrate revision release helm-package helm-lint clean ps push

COMPOSE ?= docker compose
IMAGE_NAME ?= wrapped
IMAGE_TAG ?= 0.1.0
# Docker Hub namespace → image: $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
# Example: inecs/wrapped:0.1.0
RELEASE_REGISTRY ?= inecs
# Set PUSH=0 to build/tag only (no docker push)
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
	@echo "  make release      Build, tag & push $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)"
	@echo "  make push         git add ., commit (prompt), push origin"
	@echo "  make helm-lint    Lint Helm chart"
	@echo "  make helm-package Package Helm chart"
	@echo "  make clean        Remove containers, volumes, local image"
	@echo ""
	@echo "Release examples:"
	@echo "  make release IMAGE_TAG=0.1.0"
	@echo "  make release IMAGE_TAG=0.1.0 PUSH=0"

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

# Release: build image, tag as $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG), push to Docker Hub.
# External Postgres/MinIO: set DATABASE_URL and S3_* in runtime env / Helm values.
release: env
	@echo "Building $(IMAGE_NAME):$(IMAGE_TAG)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
	@echo "Tagged $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)"
	@if [ "$(PUSH)" = "1" ]; then \
		echo "Pushing $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)"; \
		docker push $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG); \
	else \
		echo "PUSH=0 — skipped docker push"; \
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
	-docker rmi $(IMAGE_NAME):$(IMAGE_TAG) $(RELEASE_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true
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
