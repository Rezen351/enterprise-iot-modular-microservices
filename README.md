# Enterprise IoT Modular Microservices

> **Aeroponic monitoring and control system** built on a microservice architecture with database-per-service isolation, event-driven communication via NATS JetStream, and a centralized API Gateway via Kong.

[![Architecture](https://img.shields.io/badge/architecture-microservice-blue)]()
[![Docker](https://img.shields.io/badge/docker-compose-ready-brightgreen)]()
[![Go](https://img.shields.io/badge/services-Go_%2B_Python-orange)]()
[![License](https://img.shields.io/badge/license-MIT-lightgrey)]()

---

## Overview

This project implements an end-to-end IoT system for **aeroponic plant monitoring and control**. It ingests telemetry from ESP32-based nodes via MQTT, processes alerts, stores time-series data, and exposes a React dashboard for real-time visualization and manual control.

Key characteristics:
- **Database-per-Service**: each microservice owns its schema (MariaDB / TimescaleDB / Redis logical DB)
- **Event-driven**: NATS JetStream for async pub/sub and durable streams
- **API Gateway**: Kong handles JWT, rate-limiting, CORS, and routing
- **Observability**: Prometheus + Grafana + exporters (mysqld, postgres, redis, nats, node, cadvisor)
- **Secure ingress**: Cloudflare Tunnel (outbound-only, no exposed ports)
- **ML/Vision**: YOLO inference via MediaMTX RTSP/HLS pipeline

---

## Architecture

```
Browser (HTTPS via Cloudflare Tunnel)
         │
         ▼
    ┌─────────┐
    │  Kong    │  API Gateway :8000/:8443
    │  :8000   │  - JWT validation
    └────┬────┘  - Rate limiting
         │        - CORS
         ▼
    ┌─────────────────────────────────────────┐
    │         Microservices (Docker)          │
    │                                         │
    │  auth → module → analytics → wsgateway  │
    │     ↘     ↓      ↓         ↓            │
    │      control ← alert ← notification     │
    │         ↓      ↓                        │
    │       audit   export                    │
    │                                         │
    │  stream → ml → cctv-capture             │
    │                                         │
    │  Infrastructure:                        │
    │  nats, mosquitto, redis-shared,         │
    │  timescaledb, mariadb, minio,           │
    │  mediamtx, prometheus, grafana          │
    └─────────────────────────────────────────┘
```

See [docs/planning.md](./docs/planning.md) for the full architecture, bounded contexts, and design rationale.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go 1.26 (microservices) + Python 3.11 (ML service) |
| **Frontend** | React + Vite + Tailwind CSS |
| **API Gateway** | Kong 3.6 (declarative config) |
| **Event Bus** | NATS JetStream 2.10 |
| **MQTT** | Eclipse Mosquitto 2 |
| **Databases** | MariaDB 10.11, TimescaleDB 2.17 (PostgreSQL 16), Redis 7 |
| **Storage** | MinIO (S3-compatible object storage) |
| **Streaming** | MediaMTX (RTSP / HLS / WebRTC) |
| **Monitoring** | Prometheus + Grafana + exporters |
| **Deployment** | Docker Compose + Cloudflare Tunnel |

---

## Quick Start

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Git
- (Optional) Go 1.26 and Node.js 20 for local development

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Rezen351/enterprise-iot-modular-microservices.git
cd enterprise-iot-modular-microservices

# 2. Copy environment file and fill in secrets
cp .env.example .env
# Edit .env with your values (JWT secret, DB passwords, Cloudflare token, etc.)

# 3. Start all services
docker compose up -d

# 4. Verify health
curl http://localhost:8000/auth/health
```

### Dashboard

```bash
# Build and run dashboard (dev mode with hot reload)
cd dashboard
npm ci
npm run dev

# Or build for production
npm run build
```

Access the dashboard at `http://localhost:5173`.

---

## Configuration

Environment variables are split into two categories:

- **`.env.example`** — secrets only (DB credentials, JWT secrets, API tokens, MQTT passwords, Cloudflare tunnel token). Never commit `.env`.
- **`docker-compose.yml`** — inline defaults for non-secret config (database names, service URLs, timeouts, bucket names, topic prefixes). This makes the stack portable across environments without a large `.env` file.

Secrets should be injected via GitHub Actions Secrets in CI/CD, or set manually in `.env` for local development.

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci-cd.yml`):

| Stage | What it does |
|-------|--------------|
| **CI** | `gofmt` check, `go vet`, `go build` for all Go services; `pytest` for ML service; Docker build & push to GHCR for all services; `npm ci` + lint + build for dashboard |
| **CD** | On push to `main`: checkout, generate `.env` from secrets, `docker compose pull` from GHCR, `docker compose up -d`, prune old images |

Deploys to a self-hosted runner via Docker.

---

## Documentation

Project documentation is organized as follows:

| Document | Purpose |
|----------|---------|
| [docs/planning.md](./docs/planning.md) | System architecture, bounded contexts, design rationale, scalability, and tech choices |
| [docs/adr.md](./docs/adr.md) | Architecture Decision Records — key decisions with context and consequences |
| [docs/roadmap.md](./docs/roadmap.md) | Feature roadmap, phase checklist, and delivery status |
| [docs/runbook.md](./docs/runbook.md) | Operational troubleshooting guide for production incidents |
| [docs/security-audit.md](./docs/security-audit.md) | Penetration test findings and hardening measures (Kong, JWT/RBAC, CORS, exporters) |
| [docs/testing-plan-agent.md](./docs/testing-plan-agent.md) | Backend API testing checklist (agent-executed) |
| [docs/testing-implementasi-manual.md](./docs/testing-implementasi-manual.md) | Manual UI/visual testing scenarios (user-executed) |
| [docs/grafana-service-health.md](./docs/grafana-service-health.md) | Guide to reading the Grafana "Service Health" dashboard |
| [docs/system-update.md](./docs/system-update.md) | System sync notes and infrastructure gap tracking |
| [docs/integration-guides/](./docs/integration-guides/) | Per-service integration guides — API contracts, NATS/MQTT topics, database schema, curl examples, and error codes for each microservice |
| [AGENTS.md](./AGENTS.md) | Project rules, coding guidelines, and AI agent workflow |

---

## Microservices Overview

| Service | Port | Responsibility |
|---------|------|----------------|
| `auth` | 8080 | Authentication, RBAC, JWT issuance, refresh tokens |
| `module` | 8080 | Device registry, MQTT discovery, telemetry ingest |
| `analytics` | 8080 | Time-series aggregation, rollups, export |
| `control` | 8080 | Manual/scheduled actuator commands, mode arbitration |
| `alert` | 8080 | Threshold evaluation, alert history |
| `audit` | 8080 | Append-only audit log API |
| `notification` | 8080 | Multi-channel alerts (Telegram, Email, Push) |
| `stream` | 8080 | Stream metadata, MediaMTX path registry, snapshot/recording |
| `ml` | 8080 | YOLO model registry and inference |
| `export-service` | 8080 | Telemetry/data export (CSV) |
| `wsgateway` | 8090 | NATS-to-WebSocket bridge (realtime dashboard) |
| `dlq` | 8080 | Dead Letter Queue saga worker |
| `cctv-capture` | — | External cron job for CCTV frame capture and ML inference |

---

## Contributing

See [AGENTS.md](./AGENTS.md) for project rules, coding standards, and commit conventions.

General workflow:
1. Create a feature branch
2. Make changes following the coding guidelines
3. Run `gofmt`, `go vet`, `go test` for Go services
4. Ensure `docker compose config` passes validation
5. Open a pull request to `main`

---

## License

MIT
