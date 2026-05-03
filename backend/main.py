from fastapi import FastAPI
from database import create_tables, get_db
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

# Average-style metrics should stay normalized, while throughput metrics roll up as totals.
METRIC_AGGREGATION_MODES = {
    "temperature": "average",
    "pressure": "average",
    "power_consumption": "sum",
    "output_rate": "sum",
}

# Keep the demo frontend unblocked during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the schema when the API boots so first-run setup is forgiving.
create_tables()


# Root health check: confirms the API process is running.
@app.get("/")
def home():
    return {"message": "Industrial Dashboard API is running"}


# Lists all facilities (e.g. dropdowns and facility switching).
@app.get("/facilities")
def get_facilities():
    conn = get_db()
    rows = conn.execute("SELECT * FROM facilities").fetchall()
    conn.close()

    return [dict(row) for row in rows]


# Lists assets fleet-wide, or filters by optional facility_id query parameter.
@app.get("/assets")
def get_assets(facility_id: int | None = None):
    conn = get_db()

    if facility_id:
        rows = conn.execute(
            "SELECT * FROM assets WHERE facility_id = ?",
            (facility_id,),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM assets").fetchall()

    conn.close()

    return [dict(row) for row in rows]


# Lists the available sensor metrics for frontend selectors and aggregation behavior.
@app.get("/metrics")
def get_metrics():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT DISTINCT metric_name
        FROM sensor_readings
        ORDER BY metric_name
        """
    ).fetchall()
    conn.close()

    return [
        {
            "metric_name": row["metric_name"],
            "aggregation_mode": METRIC_AGGREGATION_MODES.get(row["metric_name"], "sum"),
        }
        for row in rows
    ]


# Raw sensor rows for a facility; optional filters: metric, asset, start/end time.
@app.get("/sensor-readings")
def get_sensor_readings(
    facility_id: int,
    metric_name: str | None = None,
    asset_id: int | None = None,
    asset_type: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
):
    conn = get_db()

    # Start with the facility constraint, then layer in whichever optional filters were provided.
    query = "SELECT * FROM sensor_readings WHERE facility_id = ?"
    params = [facility_id]

    if metric_name:
        query += " AND metric_name = ?"
        params.append(metric_name)

    if asset_id:
        query += " AND asset_id = ?"
        params.append(asset_id)

    if start_time:
        query += " AND timestamp >= ?"
        params.append(start_time)

    if end_time:
        query += " AND timestamp <= ?"
        params.append(end_time)

    if asset_type:
        query += " AND asset_id IN (SELECT id FROM assets WHERE facility_id = ? AND type = ?)"
        params.extend([facility_id, asset_type])

    query += " ORDER BY timestamp"

    rows = conn.execute(query, params).fetchall()

    conn.close()

    return [dict(row) for row in rows]


# Per-metric aggregates using the latest reading from each asset in a facility.
@app.get("/dashboard-summary")
def get_dashboard_summary(facility_id: int):
    conn = get_db()

    rows = conn.execute(
        """
        WITH latest_asset_metrics AS (
            SELECT sr.metric_name, sr.unit, sr.value, sr.timestamp
            FROM sensor_readings sr
            JOIN (
                SELECT asset_id, metric_name, MAX(timestamp) AS latest_timestamp
                FROM sensor_readings
                WHERE facility_id = ?
                GROUP BY asset_id, metric_name
            ) latest
              ON sr.asset_id = latest.asset_id
             AND sr.metric_name = latest.metric_name
             AND sr.timestamp = latest.latest_timestamp
            WHERE sr.facility_id = ?
        )
        SELECT metric_name,
               unit,
               SUM(value) AS total,
               AVG(value) AS average,
               MAX(timestamp) AS last_updated
        FROM latest_asset_metrics
        GROUP BY metric_name, unit
        ORDER BY metric_name
        """,
        (facility_id, facility_id),
    ).fetchall()

    conn.close()

    return [dict(row) for row in rows]
