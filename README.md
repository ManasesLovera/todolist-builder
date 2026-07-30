# ToDoList — Observability/Debugging Training App

## Dependencies

Start Postgres, Loki, Grafana, and Fluent Bit:

```bash
docker compose up
```

This runs only the backing services (Postgres on 5432, Loki on 3100, Grafana on 3001). The Next.js app runs directly on the host.

## Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To run everything inside Docker instead (including the Next.js build):

```bash
docker compose --profile web up --build
```
