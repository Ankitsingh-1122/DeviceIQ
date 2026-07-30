const dbRepo = require('../db/database');

/**
 * Every insight below is derived from rows actually stored in battery_history
 * / charging_sessions for this device. If there isn't enough history yet,
 * we say so explicitly instead of inventing a number.
 */
function linearRegressionSlope(points) {
  // points: [{x, y}] — returns slope of y over x (least squares)
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

function generateInsights(deviceId) {
  const history = dbRepo.getBatteryHistory(deviceId, 24 * 90); // 90 days
  const insights = [];

  if (history.length < 5) {
    insights.push({
      level: 'info',
      key: 'not_enough_data',
      text: `DeviceIQ has collected ${history.length} data point(s) so far. Insights become statistically meaningful after a few days of background tracking.`,
    });
    return insights;
  }

  const t0 = new Date(history[0].timestamp).getTime();
  const healthPoints = history
    .filter((h) => h.design_capacity && h.max_capacity)
    .map((h) => ({
      x: (new Date(h.timestamp).getTime() - t0) / (1000 * 60 * 60 * 24), // days
      y: (h.max_capacity / h.design_capacity) * 100,
    }));

  if (healthPoints.length >= 3) {
    const slopePerDay = linearRegressionSlope(healthPoints);
    if (slopePerDay !== null) {
      const perSixMonths = slopePerDay * 182.5;
      const first = healthPoints[0].y;
      const last = healthPoints[healthPoints.length - 1].y;
      insights.push({
        level: perSixMonths < -3 ? 'bad' : perSixMonths < -1 ? 'warn' : 'good',
        key: 'health_trend',
        text: `Battery health has moved from ${first.toFixed(1)}% to ${last.toFixed(1)}% over the observed period (trend: ${perSixMonths >= 0 ? '+' : ''}${perSixMonths.toFixed(1)}% per 6 months at the current rate).`,
      });
    }
  }

  // temperature spikes (only meaningful once temperature sensor data exists)
  const temps = history.filter((h) => h.temperature !== null && h.temperature !== undefined);
  if (temps.length > 0) {
    const maxTemp = Math.max(...temps.map((h) => h.temperature));
    if (maxTemp >= 40) {
      insights.push({
        level: 'bad',
        key: 'overheat',
        text: `Battery temperature reached ${maxTemp.toFixed(1)}°C during the tracked period — sustained readings above 35°C accelerate long-term wear.`,
      });
    }
  } else {
    insights.push({
      level: 'info',
      key: 'no_temp_sensor',
      text: 'This device does not expose a live battery temperature sensor to Windows, so temperature-based insights are unavailable.',
    });
  }

  // overnight / fast-charge patterns from charging_sessions
  const sessions = dbRepo.db
    .prepare(`SELECT * FROM charging_sessions WHERE device_id = ? ORDER BY start_time DESC LIMIT 30`)
    .all(deviceId);
  if (sessions.length > 0) {
    const overnightCount = sessions.filter((s) => s.overnight).length;
    if (overnightCount / sessions.length > 0.5) {
      insights.push({
        level: 'warn',
        key: 'overnight_charging',
        text: `${overnightCount} of the last ${sessions.length} charging sessions ran overnight. Sitting at 100% for long periods adds cumulative wear.`,
      });
    }
    const highUnplug = sessions.filter((s) => s.end_percent && s.end_percent <= 85 && s.end_percent >= 75);
    if (highUnplug.length / sessions.length > 0.4) {
      insights.push({
        level: 'good',
        key: 'good_unplug_habit',
        text: `You frequently unplug in the 75–85% range — this is close to the ideal range for minimizing long-term battery wear.`,
      });
    }
  }

  return insights;
}

module.exports = { generateInsights };
