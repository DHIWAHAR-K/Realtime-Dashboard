import random
from datetime import datetime, timedelta

from database import create_tables, get_db


def seed_data():
    # Ensure the schema exists before we try to repopulate it.
    create_tables()
    conn = get_db()

    # Clear old data so we can run this file again safely
    conn.execute("DELETE FROM sensor_readings")
    conn.execute("DELETE FROM assets")
    conn.execute("DELETE FROM facilities")

    # Insert facilities
    conn.execute("INSERT INTO facilities (id, name) VALUES (1, 'Plant A')")
    conn.execute("INSERT INTO facilities (id, name) VALUES (2, 'Plant B')")

    # Insert assets
    conn.execute("INSERT INTO assets (id, facility_id, name, type) VALUES (1, 1, 'Boiler 1', 'boiler')")
    conn.execute("INSERT INTO assets (id, facility_id, name, type) VALUES (2, 1, 'Turbine 1', 'turbine')")
    conn.execute("INSERT INTO assets (id, facility_id, name, type) VALUES (3, 1, 'Pump 1', 'pump')")

    conn.execute("INSERT INTO assets (id, facility_id, name, type) VALUES (4, 2, 'Boiler 2', 'boiler')")
    conn.execute("INSERT INTO assets (id, facility_id, name, type) VALUES (5, 2, 'Turbine 2', 'turbine')")
    conn.execute("INSERT INTO assets (id, facility_id, name, type) VALUES (6, 2, 'Pump 2', 'pump')")

    metrics = [
        ("temperature", "F", 140, 190),
        ("pressure", "psi", 50, 90),
        ("power_consumption", "MW", 5, 25),
        ("output_rate", "units/hr", 300, 800),
    ]

    # Map each facility to the asset ids that will emit seeded readings.
    facility_assets = {
        1: [1, 2, 3],
        2: [4, 5, 6],
    }

    now = datetime.now()

    for facility_id, asset_ids in facility_assets.items():
        for asset_id in asset_ids:
            for metric_name, unit, low, high in metrics:
                # Backfill a two-hour history in 10-minute steps for the chart and summary views.
                for minutes_ago in range(120, -1, -10):
                    timestamp = now - timedelta(minutes=minutes_ago)
                    value = round(random.uniform(low, high), 2)

                    conn.execute(
                        """
                        INSERT INTO sensor_readings
                        (facility_id, asset_id, metric_name, value, unit, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            facility_id,
                            asset_id,
                            metric_name,
                            value,
                            unit,
                            timestamp.isoformat(timespec="seconds"),
                        ),
                    )

    conn.commit()
    conn.close()

    print("Database seeded with sample data.")


if __name__ == "__main__":
    seed_data()
