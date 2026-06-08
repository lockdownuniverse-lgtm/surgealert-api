const pgStore = require('../models/pgStore');
// CrowdScore Engine
// Combines user reports + social media spike data into a unified severity score.
// Score 0–100. Thresholds: LOW=30, MED=55, HIGH=75

const { store } = require('../models/store');

const THRESHOLDS = { LOW: 5, MED: 55, HIGH: 75 };
const REPORT_DECAY_MS = 30 * 60 * 1000;   // Reports older than 30 min lose weight
const SPIKE_DECAY_MS  = 20 * 60 * 1000;   // Social spikes decay after 20 min
const RADIUS_KM = 0.5;                     // Default scoring radius

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Decay factor: 1.0 at creation, 0.0 at maxAge
function decayFactor(createdAt, maxAgeMs) {
  const age = Date.now() - createdAt;
  return Math.max(0, 1 - age / maxAgeMs);
}

// Crowd size bucket → base score contribution
const SIZE_SCORES = { 1: 5, 2: 12, 3: 22, 4: 35, 5: 50 };

async function computeScore(lat, lon, radiusKm = 0.5) {
  const SIZE_SCORES = { 1:5, 2:12, 3:22, 4:35, 5:50 };
  const DECAY_MS_REPORTS = 30 * 60 * 1000;
  const DECAY_MS_SPIKES  = 20 * 60 * 1000;

  const reports = await pgStore.getReportsNear(lat, lon, radiusKm, 30);
  
  let reportScore = 0;
  for (const r of reports) {
    const base  = SIZE_SCORES[r.crowd_size] || 10;
    const age   = Date.now() - new Date(r.created_at).getTime();
    const decay = Math.max(0, 1 - age / DECAY_MS_REPORTS);
    reportScore += base * decay;
  }
  reportScore = Math.min(60, reportScore);

  const total = Math.round(reportScore);
  let severity = 'NONE';
  if (total >= THRESHOLDS.HIGH) severity = 'HIGH';
  else if (total >= THRESHOLDS.MED)  severity = 'MED';
  else if (total >= THRESHOLDS.LOW)  severity = 'LOW';

  return {
    score: total, severity,
    components: { reportScore: Math.round(reportScore), spikeScore: 0, reportCount: reports.length, spikeCount: 0 }
  };
}

// Check if a new alert should be fired for a location
// Prevents duplicate alerts within 15 minutes for the same area
function shouldFireAlert(lat, lon) {
  const COOLDOWN_MS = 15 * 60 * 1000;
  const recent = store.alerts.filter(a => {
    if (Date.now() - a.createdAt > COOLDOWN_MS) return false;
    return haversine(lat, lon, a.lat, a.lon) <= RADIUS_KM;
  });
  return recent.length === 0;
}

module.exports = { computeScore, shouldFireAlert, haversine, THRESHOLDS };
