import sqlite3
from pathlib import Path

# Keep the SQLite database next to the backend modules so local setup stays simple.
DB_PATH = Path(__file__).parent / "dashboard.db"


def get_db():
    # Return rows as dict-like objects so API handlers can serialize them easily.
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_tables():
    # Bootstrap the three tables the dashboard depends on at startup and during seeding.
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS facilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            facility_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            facility_id INTEGER NOT NULL,
            asset_id INTEGER NOT NULL,
            metric_name TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_sensor_readings_lookup
        ON sensor_readings(facility_id, asset_id, metric_name, timestamp)
    """)

    # Persist the schema changes before releasing the connection.
    conn.commit()
    conn.close()


if __name__ == "__main__":
    create_tables()
    print("Database tables created.")
