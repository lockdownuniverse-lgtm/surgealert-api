// Alert generation service
// In production: push alerts via Firebase Cloud Messaging (FCM) / APNs
// Here we store them in memory and return them via REST

const { store, getNextId } = require('../models/store');
const { computeScore, shouldFireAlert } = require('./scoreEngine');

const SEVERITY_MESSAGES = {
  HIGH: 'Large crowd surge detected nearby. Consider avoiding the area.',
  MED:  'Elevated crowd activity detected nearby. Use caution.',
  LOW:  'Unusual crowd activity reported nearby.',
};

// Evaluate a location and create an alert if threshold is crossed
function evaluateAndAlert(lat, lon, locationLabel = null) {
  const result = computeScore(lat, lon);

  if (result.severity === 'NONE') return null;
  if (!shouldFireAlert(lat, lon)) return null;

  const alert = {
    id: getNextId(),
    lat,
    lon,
    locationLabel: locationLabel || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    severity: result.severity,
    score: result.score,
    message: SEVERITY_MESSAGES[result.severity],
    components: result.components,
    createdAt: Date.now(),
    resolved: false,
  };

  store.alerts.unshift(alert);

  // TODO: Push via FCM to subscribers near (lat, lon)
  // await pushService.sendToNearbyDevices(lat, lon, alert);

  return alert;
}

// Get active alerts near a user location within radiusKm
function getAlertsNear(lat, lon, radiusKm = 1.5) {
  const { haversine } = require('./scoreEngine');
  const ACTIVE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const now = Date.now();

  return store.alerts
    .filter(a => {
      if (a.resolved) return false;
      if (now - a.createdAt > ACTIVE_WINDOW_MS) return false;
      return haversine(lat, lon, a.lat, a.lon) <= radiusKm;
    })
    .map(a => ({
      ...a,
      distanceKm: +haversine(lat, lon, a.lat, a.lon).toFixed(2),
      ageMinutes: Math.round((now - a.createdAt) / 60000),
    }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { evaluateAndAlert, getAlertsNear };
