# Wrapped

Анонимный сервис одноразовой передачи зашифрованных данных (текст, изображения, файлы). Шифрование выполняется в браузере (Web Crypto), на сервере хранится только ciphertext. После первого успешного открытия пакет удаляется из хранилища.

Возможности:

- zero-knowledge шифрование на клиенте
- одноразовое открытие (unwrap)
- опциональный пароль (`client_only` или `server_gate`)
- CAPTCHA: Cloudflare Turnstile и/или hCaptcha
- админка с лимитами, TTL, allowlist MIME, audit-логом
- Docker Compose и Helm

Ссылка для получателя: `/w/<id>#<key>` или токен `wrapped_v1.<id>.<key>`. Ключ шифрования в URL-фрагменте (`#...`) на сервер не уходит.

## Скриншоты

Интерфейс на русском и английском, светлая и тёмная тема.

### Создание wrap

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![Создание — светлая](docs/screenshots/create-light.png) | ![Создание — тёмная](docs/screenshots/create-dark.png) |

### Создание с текстом и файлами

Текст с подсветкой синтаксиса, вложения (изображения, документы), TTL и опциональный пароль.

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![С контентом — светлая](docs/screenshots/create-filled-light.png) | ![С контентом — тёмная](docs/screenshots/create-filled-dark.png) |

### Токен выдан

После создания — ссылка `/w/<id>#<key>` и `wrapped_v1`-токен. Ключ только во фрагменте URL.

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![Токен выдан — светлая](docs/screenshots/token-issued-light.png) | ![Токен выдан — тёмная](docs/screenshots/token-issued-dark.png) |

### Unwrap (открытие)

Одноразовое открытие: ciphertext удаляется на сервере, превью — только в текущей сессии браузера.

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![Unwrap — светлая](docs/screenshots/unwrap-light.png) | ![Unwrap — тёмная](docs/screenshots/unwrap-dark.png) |

---

## Быстрый старт (разработка)

Нужны Docker и Docker Compose.

```bash
make env          # создаёт .env из .env.example
make up           # app + Postgres + MinIO + nginx
```

| Сервис | URL |
|--------|-----|
| Приложение | http://localhost:8000 |
| Админка | http://localhost:8000/admin |
| MinIO Console | http://localhost:9001 (`wrappedminio` / `wrappedminio123`) |
| Postgres (опционально с хоста) | `127.0.0.1:5433` |

```bash
make logs         # логи app
make down         # остановить
make clean        # остановить и удалить volumes
```

Локальный `docker-compose.yml` **собирает** образ из Dockerfile и монтирует код с `--reload` — это режим разработки. Для сервера используйте готовый образ с Docker Hub (см. ниже).

---

## Запуск на сервере (Docker Hub + Compose)

Образ приложения публикуется на [Docker Hub](https://hub.docker.com/). На сервере его **не нужно собирать** — достаточно `docker compose pull` / `up`.

### 1. Подготовка

Создайте каталог и файлы:

```bash
mkdir -p /opt/wrapped && cd /opt/wrapped
```

Создайте `.env` (обязательно смените секреты):

```env
# Приложение
APP_NAME=Wrapped
APP_ENV=production
APP_SECRET_KEY=замените-на-длинную-случайную-строку
APP_BASE_URL=https://wrapped.example.com
LOG_LEVEL=INFO
DOCS_ENABLED=false

# Админ
ADMIN_USERNAME=admin
ADMIN_PASSWORD=замените-пароль

# БД и S3 задаются в compose (см. ниже). Для внешнего Postgres/MinIO
# переопределите DATABASE_URL и S3_* здесь или в environment сервиса app.

# CAPTCHA (опционально; site keys также можно задать в админке)
TURNSTILE_SECRET_KEY=
HCAPTCHA_SECRET_KEY=

# Доверие к прокси для реального IP клиента
TRUSTED_PROXIES=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

APP_PORT=8000
```

### 2. `docker-compose.yml` для продакшена

Образ на Docker Hub: `inecs/wrapped` (тег задайте нужный, например `0.1.0`).

```yaml
services:
  proxy:
    image: nginx:1.27-alpine
    container_name: wrapped-proxy
    restart: unless-stopped
    ports:
      - "${APP_PORT:-8000}:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app

  app:
    # Образ с Docker Hub — не build:
    image: inecs/wrapped:0.1.0
    container_name: wrapped-app
    restart: unless-stopped
    expose:
      - "8000"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+asyncpg://wrapped:CHANGE_DB_PASSWORD@postgres:5432/wrapped
      S3_ENDPOINT_URL: http://minio:9000
      S3_ACCESS_KEY: CHANGE_MINIO_USER
      S3_SECRET_KEY: CHANGE_MINIO_PASSWORD
      S3_BUCKET: wrapped
      S3_USE_SSL: "false"
      S3_CREATE_BUCKET: "true"
      APP_BASE_URL: ${APP_BASE_URL:-http://localhost:8000}
      APP_ENV: production
      DOCS_ENABLED: "false"
      TRUSTED_PROXIES: ${TRUSTED_PROXIES:-127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16}
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_started
      minio-init:
        condition: service_completed_successfully
    # Миграции и старт уже в CMD образа:
    # alembic upgrade head && uvicorn ...

  postgres:
    image: postgres:16-alpine
    container_name: wrapped-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: wrapped
      POSTGRES_PASSWORD: CHANGE_DB_PASSWORD
      POSTGRES_DB: wrapped
    volumes:
      - wrapped_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wrapped -d wrapped"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    container_name: wrapped-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: CHANGE_MINIO_USER
      MINIO_ROOT_PASSWORD: CHANGE_MINIO_PASSWORD
    volumes:
      - wrapped_minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio-init:
    image: minio/mc:latest
    container_name: wrapped-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 CHANGE_MINIO_USER CHANGE_MINIO_PASSWORD &&
      mc mb --ignore-existing local/wrapped &&
      exit 0
      "

volumes:
  wrapped_pg_data:
  wrapped_minio_data:
```

Рядом положите `nginx.conf` (прокси на app):

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 64m;

    location / {
        proxy_pass http://app:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 120s;
    }
}
```

Готовый пример конфига также есть в репозитории: `deploy/nginx.conf`.

### 3. Запуск

```bash
docker compose pull
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:8000/health
```

Обновление на новую версию образа:

```bash
# в .env / compose поменяйте тег, например inecs/wrapped:0.2.0
docker compose pull app
docker compose up -d app
```

HTTPS лучше завернуть снаружи (Caddy, Traefik, nginx на хосте, Cloudflare Tunnel) и проксировать на `${APP_PORT}`. В `APP_BASE_URL` укажите публичный `https://...` URL.

### Внешний Postgres и S3/MinIO

Если БД и объектное хранилище уже есть, уберите сервисы `postgres`, `minio`, `minio-init` из compose и задайте:

| Переменная | Пример |
|------------|--------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@db-host:5432/wrapped` |
| `S3_ENDPOINT_URL` | `https://s3.example.com` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | ключи |
| `S3_BUCKET` | `wrapped` |
| `S3_USE_SSL` | `true` |
| `S3_CREATE_BUCKET` | `false` (если бакет уже создан) |
| `S3_REGION` | `us-east-1` |

Минимальный compose в этом случае — только `app` (+ опционально `proxy`):

```yaml
services:
  app:
    image: inecs/wrapped:0.1.0
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      APP_ENV: production
      DOCS_ENABLED: "false"
```

---

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `APP_NAME` | Имя сервиса | `Wrapped` |
| `APP_ENV` | `development` / `production` | `development` |
| `APP_SECRET_KEY` | Секрет сессий/подписей | — смените |
| `APP_BASE_URL` | Публичный URL (ссылки, редиректы) | `http://localhost:8000` |
| `DOCS_ENABLED` | `/docs`, `/redoc`, `/openapi.json` | в prod лучше `false` |
| `LOG_LEVEL` | Уровень логов | `INFO` |
| `ADMIN_USERNAME` | Логин админки | `admin` |
| `ADMIN_PASSWORD` | Пароль админки | — смените |
| `DATABASE_URL` | Postgres (`asyncpg`) | — |
| `S3_ENDPOINT_URL` | Endpoint MinIO/S3 | — |
| `S3_ACCESS_KEY` | Access key | — |
| `S3_SECRET_KEY` | Secret key | — |
| `S3_BUCKET` | Имя бакета | `wrapped` |
| `S3_REGION` | Регион | `us-east-1` |
| `S3_USE_SSL` | TLS к S3 | `false` |
| `S3_CREATE_BUCKET` | Создавать бакет при старте | `true` |
| `TURNSTILE_SECRET_KEY` | Секрет Turnstile | пусто |
| `HCAPTCHA_SECRET_KEY` | Секрет hCaptcha | пусто |
| `TRUSTED_PROXIES` | IP/CIDR прокси для `X-Forwarded-*` | loopback + RFC1918 |

Полный шаблон: `.env.example`.

---

## Модель безопасности

- **Zero-knowledge.** Шифрование AES-GCM в браузере. Сервер видит только ciphertext и метаданные (TTL, MIME, размер).
- **Одноразовое открытие.** После успешного unwrap объект удаляется из S3/MinIO, статус wrap → `consumed`.
- **Пароль.** Режим `client_only` — пароль участвует в ключе на клиенте; `server_gate` — сервер проверяет хеш (Argon2) до выдачи ciphertext.
- **CAPTCHA.** Включается в админке; секреты — через env, site keys — в UI.
- **IP в audit.** Реальный IP берётся из заголовков только от `TRUSTED_PROXIES`.

Ключ в `#fragment` не отправляется на сервер в HTTP-запросе страницы.

---

## Админка

- UI: `/admin` (логин `/admin/login`)
- Настройки: лимиты загрузки, TTL, rate limit, MIME allowlist, CAPTCHA, режим пароля, retention audit
- Audit-лог и опасные операции (purge) — в соответствующих разделах UI
- JSON Admin API: Basic Auth (`ADMIN_USERNAME` / `ADMIN_PASSWORD`), тег OpenAPI `Admin`

---

## API (автоматизация)

Тот же ZK-протокол, что и в UI: сначала шифруете локально, затем:

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/api/v1/settings` | Публичные лимиты, CAPTCHA, режим пароля |
| `POST` | `/api/v1/wraps` | Загрузить ciphertext + метаданные |
| `POST` | `/api/v1/wraps/{id}/unwrap` | Одноразово получить ciphertext |
| `GET` | `/health` | Healthcheck |

Серверного endpoint «зашифруй за меня» нет.

При `DOCS_ENABLED=true` доступны Swagger `/docs` и OpenAPI `/openapi.json`.

---

## Сборка и публикация образа

Нужен логин в Docker Hub: `docker login` (пользователь `inecs`).

```bash
# Сборка + push на hub.docker.com как inecs/wrapped:0.1.0
make release IMAGE_TAG=0.1.0

# Только собрать и затегать локально (без push)
make release IMAGE_TAG=0.1.0 PUSH=0
```

По умолчанию: `RELEASE_REGISTRY=inecs`, `IMAGE_TAG=0.1.0` → образ `inecs/wrapped:0.1.0`.

Эквивалент вручную:

```bash
docker build -t inecs/wrapped:0.1.0 .
docker push inecs/wrapped:0.1.0
```

Образ при старте сам выполняет `alembic upgrade head` и поднимает uvicorn на порту `8000`. Healthcheck: `GET /health`.

---

## Kubernetes (Helm)

```bash
helm upgrade --install wrapped ./helm/wrapped \
  -f my-values.yaml
```

В `values.yaml` задайте образ с Hub, внешние DB/S3 и секреты:

```yaml
image:
  repository: inecs/wrapped
  tag: "0.1.0"
  pullPolicy: IfNotPresent

app:
  env: production
  baseUrl: "https://wrapped.example.com"
  secretKey: "..."
  adminUsername: admin
  adminPassword: "..."
  docsEnabled: false
  trustedProxies: "*"   # если до пода достучаться может только Ingress

external:
  databaseUrl: "postgresql+asyncpg://..."
  s3:
    endpointUrl: "https://..."
    accessKey: "..."
    secretKey: "..."
    bucket: wrapped
    createBucket: false
```

Упаковка чарта: `make helm-package IMAGE_TAG=0.1.0`.

---

## Make-цели (разработка)

| Цель | Описание |
|------|----------|
| `make env` | `.env` из `.env.example` |
| `make up` | Поднять dev-стек |
| `make down` / `make clean` | Остановить / с volumes |
| `make logs` / `make ps` | Логи / статус |
| `make migrate` | `alembic upgrade head` |
| `make release` | Сборка образа (+ push) и Helm package |
| `make helm-lint` / `make helm-package` | Helm |

---

## Требования

- Python 3.12+ (для запуска без Docker)
- PostgreSQL 16+
- S3-совместимое хранилище (MinIO и т.п.)
- Docker Compose v2 — для деплоя как выше

---

## Лицензия

Proprietary / на ваше усмотрение.
