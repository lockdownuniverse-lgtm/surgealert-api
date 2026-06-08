const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      lat DOUBLE PRECISION, lon DOUBLE PRECISION,
      type TEXT, crowd_size INT, note TEXT, location_label TEXT,
      confirmed INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      lat DOUBLE PRECISION, lon DOUBLE PRECISION,
      location_label TEXT, severity TEXT, score INT,
      message TEXT, report_score INT, spike_score INT,
      report_count INT, spike_count INT,
      resolved BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[db] Tables ready');
}

async function getReportsNear(lat, lon, radiusKm, windowMin) {
  const { rows } = await pool.query(`
    SELECT *, EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS age_minutes
    FROM reports
    WHERE created_at > NOW() - ($4 || ' minutes')::INTERVAL
    AND (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lon) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) < $3
    ORDER BY created_at DESC
  `, [lat, lon, radiusKm, windowMin]);
  return rows;
}

async function createReport({ lat, lon, type, crowdSize, note, locationLabel }) {
  const { rows } = await pool.query(
    `INSERT INTO reports (lat, lon, type, crowd_size, note, location_label) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [lat, lon, type, crowdSize, note || null, locationLabel || null]
  );
  return rows[0];
}

async function confirmReport(id) {
  const { rows } = await pool.query('UPDATE reports SET confirmed = confirmed + 1 WHERE id = $1 RETURNING confirmed', [id]);
  return rows[0];
}

async function getAlertsNear(lat, lon, radiusKm, windowMin) {
  const { rows } = await pool.query(`
    SELECT *, EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS age_minutes
    FROM alerts
    WHERE resolved = FALSE
    AND created_at > NOW() - ($4 || ' minutes')::INTERVAL
    AND (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lon) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) < $3
    ORDER BY score DESC
  `, [lat, lon, radiusKm, windowMin]);
  return rows.map(r => ({
    id: r.id, lat: parseFloat(r.lat), lon: parseFloat(r.lon),
    locationLabel: r.location_label, severity: r.severity,
    score: r.score, message: r.message, resolved: r.resolved,
    createdAt: new Date(r.created_at).getTime(),
    ageMinutes: Math.round(r.age_minutes),
    distanceKm: 0,
    components: { reportScore: r.report_score, spikeScore: r.spike_score, reportCount: r.report_count, spikeCount: r.spike_count }
  }));
}

async function createAlert({ lat, lon, locationLabel, severity, score, message, components }) {
  const { rows } = await pool.query(
    `INSERT INTO alerts (lat, lon, location_label, severity, score, message, report_score, spike_score, report_count, spike_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [lat, lon, locationLabel, severity, score, message,
     components.reportScore, components.spikeScore, components.reportCount, components.spikeCount]
  );
  return rows[0];
}

async function resolveAlert(id) {
  const { rows } = await pool.query('UPDATE alerts SET resolved = TRUE WHERE id = $1 RETURNING *', [id]);
  return rows[0];
}

async function recentAlertNear(lat, lon, radiusKm, cooldownMin) {
  const { rows } = await pool.query(`
    SELECT id FROM alerts
    WHERE resolved = FALSE
    AND created_at > NOW() - ($4 || ' minutes')::INTERVAL
    AND (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lon) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) < $3
    LIMIT 1
  `, [lat, lon, radiusKm, cooldownMin]);
  return rows.length > 0;
}

module.exports = { init, getReportsNear, createReport, confirmReport, getAlertsNear, createAlert, resolveAlert, recentAlertNear };
