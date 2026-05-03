import { useCallback, useEffect, useState } from "react";
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import "./App.css";

// Base URL for the FastAPI backend.
const API_URL = "http://127.0.0.1:8000";

const CHART_TIME_RANGE_HOURS = 2;
const CHART_TIME_RANGE_LABEL = "last two hours";

// Converts a backend metric key into a readable display label.
function formatMetricName(metricName) {
  if (!metricName) {
    return "";
  }

  return metricName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getMetricAggregationMode(metricName, metricMetadata) {
  return metricMetadata[metricName]?.aggregation_mode || "sum";
}

function getMetricSummaryValue(metric, metricMetadata) {
  return getMetricAggregationMode(metric.metric_name, metricMetadata) === "average"
    ? metric.average
    : metric.total;
}

function getMetricSummaryLabel(metricName, metricMetadata) {
  return getMetricAggregationMode(metricName, metricMetadata) === "average"
    ? "Current facility average"
    : "Current facility total";
}

function getChartHeading(metricName, metricMetadata) {
  return getMetricAggregationMode(metricName, metricMetadata) === "average"
    ? `Facility average ${formatMetricName(metricName).toLowerCase()} over ${CHART_TIME_RANGE_LABEL}.`
    : `Facility total ${formatMetricName(metricName).toLowerCase()} over ${CHART_TIME_RANGE_LABEL}.`;
}

// Converts timestamps from the API into short local times for the chart.
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLocalTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Builds the fixed chart window timestamps for the API query.
function getTimeRangeBounds(hours) {
  const end = new Date();
  const start = new Date(end);
  start.setHours(start.getHours() - hours);

  return {
    startTime: formatLocalTimestamp(start),
    endTime: formatLocalTimestamp(end),
  };
}

// Renders the line chart for the currently selected metric.
function MetricChart({ readings, metricName, metricMetadata }) {
  // Show a friendly message if the API returned no readings.
  if (readings.length === 0) {
    return <p className="empty-message">No chart data available.</p>;
  }

  const aggregationMode = getMetricAggregationMode(metricName, metricMetadata);

  // Combine asset-level readings into one facility-level point at each timestamp.
  const chartData = Array.from(
    readings
      .reduce((readingsByTimestamp, reading) => {
        const existingReading = readingsByTimestamp.get(reading.timestamp);

        if (existingReading) {
          existingReading.total += reading.value;
          existingReading.count += 1;
          return readingsByTimestamp;
        }

        readingsByTimestamp.set(reading.timestamp, {
          timestamp: reading.timestamp,
          time: formatTime(reading.timestamp),
          unit: reading.unit,
          total: reading.value,
          count: 1,
        });

        return readingsByTimestamp;
      }, new Map())
      .values()
  ).map((reading) => ({
    ...reading,
    value: aggregationMode === "average" ? reading.total / reading.count : reading.total,
  }));

  const tooltipLabel =
    aggregationMode === "average"
      ? `${formatMetricName(metricName)} (facility average)`
      : `${formatMetricName(metricName)} (facility total)`;

  // The API returns the unit with each reading, so the y-axis can label itself.
  const unit = chartData[0].unit;
  const yAxisLabel = `${formatMetricName(metricName)} (${unit})`;

  return (
    <div className="chart-wrapper">
      {/* ResponsiveContainer makes the chart resize with the dashboard layout. */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 16, right: 20, bottom: 36, left: 20 }}>
          <CartesianGrid stroke="#e3eaee" strokeDasharray="4 4" />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            label={{ value: "Time", position: "insideBottom", offset: -18 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={58}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: "insideLeft",
              offset: -4,
            }}
          />
          <Tooltip
            labelFormatter={(label) => `Time: ${label}`}
            formatter={(value, name, item) => [
              `${Number(value).toFixed(2)} ${item.payload.unit}`,
              tooltipLabel,
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#227c69"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Main dashboard component: fetches API data and renders the full page.
function App() {
  // React state for API data and current UI selections.
  const [facilities, setFacilities] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(1);
  const [selectedMetricName, setSelectedMetricName] = useState("");
  const [summary, setSummary] = useState([]);
  const [readings, setReadings] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const metricMetadata = Object.fromEntries(
    metrics.map((metric) => [metric.metric_name, metric])
  );
  const [timeRangeHours, setTimeRangeHours] = useState(2);
  const [metricRanges, setMetricRanges] = useState([]);

  // Load the facility list and available metrics once when the page first opens.
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/facilities`).then((response) => response.json()),
      fetch(`${API_URL}/metrics`).then((response) => response.json()),
    ])
      .then(([facilitiesData, metricsData]) => {
        setFacilities(facilitiesData);
        setMetrics(metricsData);

        if (metricsData.length === 0) {
          setError("No metrics are available yet. Run the seed script and refresh the page.");
          setIsLoading(false);
          return;
        }

        setError("");
        setSelectedMetricName((currentMetricName) =>
          metricsData.some((metric) => metric.metric_name === currentMetricName)
            ? currentMetricName
            : (metricsData[0]?.metric_name ?? "")
        );
      })
      .catch(() => setError("Could not load dashboard options. Is the backend running?"));
  }, []);

  // Load the minimum values for the metrics from the database
  useEffect(() => {
    if (metrics.length === 0) return;

    Promise.all(
       metrics.map(metric =>
        fetch(`${API_URL}/metric-value?facility_id=${selectedFacilityId}&metric_name=${metric.metric_name}`).then(
        (response) => response.json())
       )
    )
        .then((results) => {
          setMetricRanges(results);
     })
      .catch(() => {
        setError("Could not load dashboard data. Is the backend running?");
      });

  }, [selectedFacilityId, metrics]);

  // Fetch both the summary cards and chart readings for the selected filters.
  const fetchDashboardData = useCallback(() => {
    if (!selectedMetricName) {
      return;
    }

    let readingUrl = `${API_URL}/sensor-readings?facility_id=${selectedFacilityId}&metric_name=${selectedMetricName}`;
    const { startTime, endTime } = getTimeRangeBounds(timeRangeHours);
    readingUrl += `&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;

    // Promise.all runs both API requests at the same time.
    Promise.all([
      fetch(`${API_URL}/dashboard-summary?facility_id=${selectedFacilityId}`).then(
        (response) => response.json()
      ),
      fetch(readingUrl).then((response) => response.json()),
    ])
      .then(([summaryData, readingsData]) => {
        // Saving new data in state automatically re-renders the dashboard.
        setSummary(summaryData);
        setReadings(readingsData);
        setLastUpdated(new Date());
        setError("");
        setIsLoading(false);
      })
      .catch(() => {
        setError("Could not load dashboard data. Is the backend running?");
        setIsLoading(false);
      });
  }, [selectedFacilityId, selectedMetricName, timeRangeHours]);

  // Fetch immediately, then refresh the dashboard every 5 seconds.
  useEffect(() => {
    fetchDashboardData();

    const intervalId = setInterval(fetchDashboardData, 5000);

    // Cleanup prevents duplicate timers when selected filters change.
    return () => clearInterval(intervalId);
  }, [fetchDashboardData]);

  return (
    <main className="dashboard">
      {/* Header area with title and facility selector. */}
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Plant operations</p>
          <h1>Industrial Dashboard</h1>
          <p className="header-copy">Live facility status and recent sensor activity.</p>
        </div>

        <label className="facility-picker">
          Facility
          <select
            value={selectedFacilityId}
            onChange={(event) => {
              setIsLoading(true);
              setSelectedFacilityId(Number(event.target.value));
            }}
          >
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* Show backend/API errors when a fetch fails. */}
      {error && <p className="error-message">{error}</p>}

      {/* Summary cards for the latest facility metrics. */}
      <section className="metric-grid">
        {summary.map((metric, index) => {
          const metricRange = metricRanges[index];

          return (
            <article className="metric-card" key={metric.metric_name}>
              <p className="metric-name">{formatMetricName(metric.metric_name)}</p>
              <h2 className="metric-value">
                {getMetricSummaryValue(metric, metricMetadata).toFixed(1)}
                <span>{metric.unit}</span>
              </h2>
              <p className="metric-average">
                {getMetricSummaryLabel(metric.metric_name, metricMetadata)}
              </p>
              {metricRange && (
                <p>
                  Min: {metricRange.min.toFixed(1)} | Max: {metricRange.max.toFixed(1)}
                </p>
              )}
            </article>
          );
        })}
      </section>

      {/* Chart section for the selected facility metric over time. */}
      <section className="chart-panel">
        <div className="section-heading">
          <div>
            <h2>{formatMetricName(selectedMetricName)}</h2>
            <p>{getChartHeading(selectedMetricName, metricMetadata)}</p>
          </div>

          <div className="chart-actions">
            
            <label className="chart-metric-picker">
              Chart metric
              <select
                value={selectedMetricName}
                disabled={metrics.length === 0}
                onChange={(event) => {
                  setIsLoading(true);
                  setSelectedMetricName(event.target.value);
                }}
              >
                {metrics.map((metric) => (
                  <option key={metric.metric_name} value={metric.metric_name}>
                    {formatMetricName(metric.metric_name)}
                  </option>
                ))}
              </select>
            </label>

            <label className="chart-metric-picker">
              Time Range
              <select
                value={timeRangeHours}
                onChange={(event) => {
                  setTimeRangeHours(Number(event.target.value));
                }}
              >
                <option value={0.5}>Last 30 min</option>
                <option value={1}>Last 1 hour</option>
                <option value={2}>Last 2 hour</option>
              </select>
            </label>

            <p className="refresh-time">
              {lastUpdated ? `Updated ${formatTime(lastUpdated)}` : "Loading..."}
            </p>
          </div>
        </div>

        {/* Pass the fetched readings into the reusable chart component. */}
        {isLoading ? (
          <p className="empty-message">Loading chart...</p>
        ) : (
          <MetricChart
            readings={readings}
            metricName={selectedMetricName}
            metricMetadata={metricMetadata}
          />
        )}
      </section>
    </main>
  );
}

export default App;
