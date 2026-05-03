# Frontend

React dashboard for the industrial monitoring take-home assignment.

## Run Locally

```bash
npm install
npm run dev
```

The frontend expects the FastAPI backend to run at:

```text
http://127.0.0.1:8000
```

## Notes

- Uses React with Vite
- Fetches the facilities list, summary, and sensor reading data from the backend
- Refreshes dashboard data every 5 seconds
- Uses Recharts for a selectable time-series chart across plant metrics
