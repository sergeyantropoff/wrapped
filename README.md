# Wrapped

Анонимный сервис одноразовой передачи зашифрованных данных (текст, изображения, файлы). Шифрование выполняется в браузере (Web Crypto), на сервере хранится только ciphertext. После первого успешного открытия пакет удаляется из хранилища.

**Возможности**

- zero-knowledge шифрование на клиенте (AES-GCM)
- одноразовая расшифровка — ciphertext удаляется с сервера после открытия
- опциональный пароль: Argon2-проверка до выдачи ciphertext, лимит попыток (по умолчанию 3), пустой пароль попытку не тратит
- подсветка синтаксиса (highlight.js), ручной выбор языка
- после расшифровки: прокрутка текста по вертикали и горизонтали, копирование в буфер обмена
- вложения: drag-and-drop, выбор файлов, вставка скриншота из буфера
- спиннер с логотипом при создании и расшифровке
- RU / EN, светлая и тёмная тема
- CAPTCHA: Cloudflare Turnstile и/или hCaptcha
- админка: **статистика**, настройки, audit (пагинация + очистка), danger purge
- Docker Compose и Helm; образ на Docker Hub: [`inecs/wrapped`](https://hub.docker.com/r/inecs/wrapped)

Ссылка для получателя: `/w/<id>#<key>` или токен `wrapped_v1.<id>.<key>`. Ключ шифрования в URL-фрагменте (`#...`) на сервер не уходит.

## Скриншоты

Интерфейс на русском и английском, светлая и тёмная тема.

### Создание wrap

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![Создание — светлая](docs/screenshots/create-light.png) | ![Создание — тёмная](docs/screenshots/create-dark.png) |

### Создание с текстом и файлами

Текст с подсветкой синтаксиса, вложения, TTL и опциональный пароль.

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![С контентом — светлая](docs/screenshots/create-filled-light.png) | ![С контентом — тёмная](docs/screenshots/create-filled-dark.png) |

### Токен выдан

После создания — ссылка `/w/<id>#<key>` и `wrapped_v1`-токен. Ключ только во фрагменте URL.

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![Токен выдан — светлая](docs/screenshots/token-issued-light.png) | ![Токен выдан — тёмная](docs/screenshots/token-issued-dark.png) |

### Расшифровка

Одноразовое открытие: ciphertext удаляется на сервере, превью — только в текущей сессии браузера. Текст с подсветкой прокручивается по обеим осям; рядом — кнопки копирования и скачивания.

| Светлая тема | Тёмная тема |
|:------------:|:-----------:|
| ![Расшифровка — светлая](docs/screenshots/unwrap-light.png) | ![Расшифровка — тёмная](docs/screenshots/unwrap-dark.png) |

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
| Админка (статистика) | http://localhost:8000/admin |
| MinIO Console | http://localhost:9001 (`wrappedminio` / `wrappedminio123`) |
| Postgres (опционально с хоста) | `127.0.0.1:5433` |

```bash
make logs         # логи app
make down         # остановить
make clean        # остановить и удалить volumes
make migrate      # alembic upgrade head (в контейнере app)
```

Локальный `docker-compose.yml` **собирает** образ из Dockerfile и монтирует код с `--reload` — режим разработки. Для сервера используйте готовый образ с Docker Hub (см. ниже).

При старте контейнер app сам выполняет `alembic upgrade head` (миграции, в т.ч. лимит попыток пароля).

---

## Запуск на сервере (Docker Hub + Compose)

Образ: [`inecs/wrapped`](https://hub.docker.com/r/inecs/wrapped). На сервере **не нужно собирать** — достаточно `docker compose pull` / `up`.

### 1. Подготовка

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

# CAPTCHA (опционально; site keys также в админке)
TURNSTILE_SECRET_KEY=
HCAPTCHA_SECRET_KEY=

# Доверие к прокси для реального IP клиента
TRUSTED_PROXIES=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

APP_PORT=8000
```

### 2. `docker-compose.yml` для продакшена

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

Рядом — `nginx.conf` (пример также в репозитории: `deploy/nginx.conf`):

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

### 3. Запуск и обновление

```bash
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8000/health
```

```bash
# новая версия образа, например 0.2.0
docker compose pull app
docker compose up -d app
```

HTTPS лучше завернуть снаружи (Caddy, Traefik, nginx на хосте, Cloudflare Tunnel). В `APP_BASE_URL` укажите публичный `https://...`.

### Внешний Postgres и S3/MinIO

Уберите сервисы `postgres`, `minio`, `minio-init` и задайте:

| Переменная | Пример |
|------------|--------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@db-host:5432/wrapped` |
| `S3_ENDPOINT_URL` | `https://s3.example.com` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | ключи |
| `S3_BUCKET` | `wrapped` |
| `S3_USE_SSL` | `true` |
| `S3_CREATE_BUCKET` | `false` (бакет уже есть) |
| `S3_REGION` | `us-east-1` |

Минимальный compose — только `app` (+ опционально `proxy`):

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
| `APP_SECRET_KEY` | Секрет сессий | — смените |
| `APP_BASE_URL` | Публичный URL | `http://localhost:8000` |
| `DOCS_ENABLED` | `/docs`, `/redoc`, `/openapi.json` | в prod — `false` |
| `LOG_LEVEL` | Уровень логов | `INFO` |
| `ADMIN_USERNAME` | Логин админки | `admin` |
| `ADMIN_PASSWORD` | Пароль админки | — смените |
| `DATABASE_URL` | Postgres (`asyncpg`) | — |
| `S3_ENDPOINT_URL` | Endpoint MinIO/S3 | — |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Ключи S3 | — |
| `S3_BUCKET` | Имя бакета | `wrapped` |
| `S3_REGION` | Регион | `us-east-1` |
| `S3_USE_SSL` | TLS к S3 | `false` |
| `S3_CREATE_BUCKET` | Создавать бакет при старте | `true` |
| `TURNSTILE_SECRET_KEY` | Секрет Turnstile | пусто |
| `HCAPTCHA_SECRET_KEY` | Секрет hCaptcha | пусто |
| `TRUSTED_PROXIES` | IP/CIDR прокси для `X-Forwarded-*` | loopback + RFC1918 |

Лимиты загрузки, TTL, MIME, CAPTCHA, режим пароля и **число попыток пароля** задаются в админке (таблица `app_settings`), не через env. Полный шаблон env: `.env.example`.

---

## Модель безопасности

- **Zero-knowledge.** Шифрование AES-GCM в браузере. Сервер видит только ciphertext и метаданные (TTL, MIME, размер).
- **Одноразовая расшифровка.** После успешного открытия объект удаляется из S3/MinIO, статус → `consumed`. Превью остаётся только в сессии браузера.
- **Пароль.** При создании с паролем сервер сохраняет Argon2-хеш и проверяет его *до* выдачи ciphertext.
  - пустой пароль → `password_required`, попытка **не** списывается;
  - неверный пароль → `bad_password`, UI показывает оставшиеся попытки;
  - лимит: `password_max_attempts` в админке (по умолчанию **3**); при исчерпании wrap уничтожается (`password_locked`);
  - в `client_only` пароль также участвует в шифровании на клиенте.
- **CAPTCHA.** Включается в админке; секреты — через env, site keys — в UI.
- **IP в audit.** Реальный IP — только из заголовков от `TRUSTED_PROXIES`.

Ключ в `#fragment` не уходит на сервер в запросе страницы.

---

## Админка

Логин: `/admin/login`. После входа — **Статистика** (`/admin/stats`).

| Раздел | URL | Что делает |
|--------|-----|------------|
| **Статистика** | `/admin/stats` | MinIO: объём и число объектов нерасшифрованного ciphertext; расшифровано / pending; загрузки и items за всё время; таблица по статусам wraps; с паролем; создано за 24ч/7д; счётчики audit (create/unwrap ok/fail) |
| **Настройки** | `/admin/settings` | Limits (upload, TTL, retention audit), rate limits, MIME allowlist, пароль (режим + лимит попыток), CAPTCHA |
| **Аудит** | `/admin/audit` | Фильтры, пагинация (10/25/50/100), номера страниц, кнопка **Очистить** (с подтверждением; пишется событие `admin.audit_clear`) |
| **Опасная зона** | `/admin/danger` | Полная очистка wraps и объектов в MinIO (`PURGE`) |

JSON Admin API: HTTP Basic (`ADMIN_USERNAME` / `ADMIN_PASSWORD`), тег OpenAPI `Admin`.

---

## API

Тот же ZK-протокол, что в UI: шифруете локально, затем:

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/api/v1/settings` | Публичные лимиты, CAPTCHA, режим пароля, `password_max_attempts` |
| `POST` | `/api/v1/wraps` | Загрузить ciphertext + метаданные |
| `POST` | `/api/v1/wraps/{id}/unwrap` | Одноразово получить ciphertext |
| `GET` | `/health` | Healthcheck |

Серверного «зашифруй за меня» нет.

Ошибки пароля при unwrap — `403`:

| `detail.code` | Когда |
|---------------|--------|
| `password_required` | пароль не введён (попытка не списывается) |
| `bad_password` | неверный пароль (`attempts_remaining` / `attempts_max`) |
| `password_locked` | попытки исчерпаны, wrap уничтожен |

Пример:

```json
{
  "detail": {
    "code": "bad_password",
    "attempts_remaining": 2,
    "attempts_max": 3
  }
}
```

При `DOCS_ENABLED=true` — Swagger `/docs` и OpenAPI `/openapi.json`.

---

## Сборка образа и git

### Docker Hub (`make release`)

Сборка **multi-arch** (`linux/amd64` + `linux/arm64`) через Docker Buildx и push манифеста на Docker Hub.

```bash
docker login   # пользователь inecs

make release IMAGE_TAG=0.1.0              # buildx amd64+arm64 + push inecs/wrapped:0.1.0
make release IMAGE_TAG=0.1.0 PUSH=0       # только сборка в buildx cache (без push)
make release RELEASE_PLATFORMS=linux/arm64  # одна платформа
```

Нужны Docker Buildx и (для cross-build) QEMU/эмуляция — на Docker Desktop обычно уже есть.

Эквивалент:

```bash
docker buildx create --name wrapped-release --driver docker-container --use  # один раз
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t inecs/wrapped:0.1.0 \
  --push .
```

Образ при старте: `alembic upgrade head` + uvicorn `:8000`. Healthcheck: `GET /health`.

### Git (`make push`)

Как в proxmox_api_simulator:

```bash
make push
```

1. `git add .`
2. ввод сообщения коммита (**можно несколько строк**)
3. **Ctrl-D** — конец ввода
4. `git push origin HEAD`

---

## Kubernetes (Helm)

```bash
helm upgrade --install wrapped ./helm/wrapped \
  -f my-values.yaml
```

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

## Make-цели

| Цель | Описание |
|------|----------|
| `make env` | `.env` из `.env.example` |
| `make up` / `make down` / `make clean` | Dev-стек |
| `make logs` / `make ps` / `make restart` | Логи, статус, рестарт app |
| `make migrate` | `alembic upgrade head` |
| `make revision m="msg"` | Новая alembic-ревизия |
| `make release` | Multi-arch образ (amd64+arm64) на Docker Hub (+ Helm package) |
| `make push` | git add → многострочный commit (Ctrl-D) → push |
| `make helm-lint` / `make helm-package` | Helm |

---

## Требования

- Python 3.12+ (без Docker)
- PostgreSQL 16+
- S3-совместимое хранилище (MinIO и т.п.)
- Docker Compose v2

---

## Лицензия

Proprietary / на ваше усмотрение.
