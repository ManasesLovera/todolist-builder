# Observability Stack

Skeleton infra for the pipeline described in `DESIGN.md` Section 3:

```
Next.js (web, JSON logs to stdout) -> Fluent Bit (tail + parse) -> Loki -> Grafana
```

Prometheus / `postgres_exporter` (also mentioned in DESIGN.md as optional) are not
part of this phase; only the logging path (Fluent Bit -> Loki -> Grafana) is wired up.

## Bringing the stack up

From the repo root, start the backing services (Postgres, Loki, Grafana, Fluent Bit):

```bash
docker compose up
```

Run the Next.js app directly on the host:

```bash
npm run dev
```

To run everything (including the Next.js app) inside Docker:

```bash
docker compose --profile web up --build
```

## Ports

| Port | Service | Notes |
| --- | --- | --- |
| `3000` | `web` (Next.js app) | `http://localhost:3000` |
| `3001` | Grafana UI | `http://localhost:3001` (container listens on 3000 internally; host port moved to 3001 since 3000 is taken by `web` when running with `--profile web`) |
| `5432` | Postgres | `postgresql://todolist:todolist@localhost:5432/todolist` from the host |
| `3100` | Loki | Push/query API, mainly used internally by Grafana and Fluent Bit (`http://loki:3100`) |

## Grafana login

Default admin credentials for local dev only: **admin / admin** (set via
`GF_SECURITY_ADMIN_USER` / `GF_SECURITY_ADMIN_PASSWORD` in `docker-compose.yml`).
Grafana will prompt to change the password on first login in some versions; for a
local training stack it's fine to dismiss that prompt.

The Loki datasource is pre-provisioned (`grafana/provisioning/datasources/datasources.yml`)
and set as default, so **Explore** should work against Loki immediately with no manual
setup.

## Dashboards are a placeholder

`grafana/provisioning/dashboards/` only wires up a dashboard *provider* pointing at
`grafana/provisioning/dashboards/json/`, which is currently empty (just a `.gitkeep`).
There is no real app traffic or bug-catalog logging yet to build meaningful panels
against, so actual dashboard JSON is deferred to a later phase (DESIGN.md Task #8),
once the app and its intentional bugs (`BUGS.md`) exist and are generating real log
signal to query and visualize.
