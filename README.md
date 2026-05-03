# Industrial Realtime Dashboard

A small full-stack monitoring dashboard built for the CVector take-home assignment.

The app models two industrial facilities, stores their sensor data in SQLite, exposes that data through a FastAPI backend, and renders a polling dashboard in React.

## What The App Does

- Shows summary cards for temperature, pressure, power consumption, and output rate
- Lets the user switch facilities
- Lets the user change the chart metric
- Refreshes dashboard data every 5 seconds

## Tech Stack

- Backend: FastAPI
- Database: SQLite
- Frontend: React + Vite
- Charting: Recharts

## Repository Layout

```text
backend/
  database.py       SQLite connection and schema creation
  main.py           FastAPI routes
  requirements.txt  Backend dependencies
  seed.py           Sample data generator

frontend/
  src/
    App.jsx         Main dashboard component
    App.css         Component styles
    index.css       Global styles
    main.jsx        React entry point
```

## Quick Start

### 1. Start the backend with Conda

From the project root:

```bash
cd backend
conda create -n realtime-dashboard python=3.11 -y
conda activate realtime-dashboard
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

### 2. Start the frontend

In a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## How To Demo The App

1. Open the frontend in the browser.
2. Switch between `Plant A` and `Plant B`.
3. Change the chart metric.
4. Watch the summary cards and chart refresh every 5 seconds.

## Important Demo Note

The seed script generates readings for the two hours leading up to the moment `python seed.py` is run.

If the chart ever looks empty during a demo, rerun:

```bash
cd backend
conda activate realtime-dashboard
python seed.py
```

This refreshes the sample timestamps so they line up with the chart's time-range filters.

## Backend API

### Health check

```text
GET /
```

Returns a simple message confirming the API is running.

### Facilities

```text
GET /facilities
```

- `GET /facilities` returns all facilities.

### Assets

```text
GET /assets
GET /assets?facility_id=1
```

Returns all assets, or only the assets belonging to one facility.

### Metrics

```text
GET /metrics
```

Returns the available metric keys for the dashboard chart picker, along with the aggregation mode the frontend should use for each metric.

### Sensor readings

```text
GET /sensor-readings?facility_id=1
GET /sensor-readings?facility_id=1&metric_name=power_consumption
GET /sensor-readings?facility_id=1&metric_name=temperature&start_time=2026-05-02T18:00:00&end_time=2026-05-02T19:00:00
GET /sensor-readings?facility_id=1&asset_id=2&metric_name=temperature
GET /sensor-readings?facility_id=1&asset_type=boiler&metric_name=pressure
```

Supported filters:

- `facility_id` required
- `metric_name` optional
- `asset_id` optional
- `asset_type` optional
- `start_time` optional
- `end_time` optional

### Dashboard summary

```text
GET /dashboard-summary?facility_id=1
```

Returns one row per metric using the latest reading from each asset in the selected facility.

For each metric, the response includes:

- `metric_name`
- `unit`
- `total`
- `average`
- `last_updated`

## Database Model

The schema is intentionally simple and lives in SQLite.

- `facilities`: plant locations
- `assets`: equipment inside a facility
- `sensor_readings`: time-series metric data for each asset

Each reading stores:

- `facility_id`
- `asset_id`
- `metric_name`
- `value`
- `unit`
- `timestamp`
