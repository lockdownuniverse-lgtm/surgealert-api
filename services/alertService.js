const axios = require('axios');
const pgStore = require('../models/pgStore');
const { computeScore, THRESHOLDS } = require('./scoreEngine');

const PUSH_WEBHOOK_URL = process.env.PUSH_WEBHOOK_URL || '';
const COOLDOWN_MIN = 2;

const SEVERITY_MESSAGES = {
  HIGH: 'Large crowd surge detected nearby. Consider avoiding the area.',
  MED:  'Elevated crowd activity detected nearby. Use caution.',
  LOW:  'Unusual crowd activity reported nearby.',
};

async function evaluateAndAlert(lat, lon, locationLabel = null) {
  const result = await computeScore(lat, lon);
  const recentReports = await pgStore.getReportsNear(lat, lon, 0.5, 30);
  const recentNote = recentReports.find(r => r.note)?.note || null;
  if (result.severity === 'NONE') return null;

  const cooldown = await pgStore.recentAlertNear(lat, lon, 0.5, COOLDOWN_MIN);
  if (cooldown) return null;

  const alert = await pgStore.createAlert({
    lat, lon, locationLabel: locationLabel || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    severity: result.severity, score: result.score,
    message: SEVERITY_MESSAGES[result.severity],
    components: result.components,
    recentNote,
  });

  const apiAlert = {
    id: alert.id, lat, lon,
    locationLabel: alert.location_label,
    severity: alert.severity, score: alert.score,
    message: alert.message, components: result.components,
    createdAt: new Date(alert.created_at).getTime(),
  };

  if (PUSH_WEBHOOK_URL) {
    axios.post(PUSH_WEBHOOK_URL, { alert: apiAlert }).catch(err =>
      console.error('[push] Webhook error:', err.message)
    );
  }

  return apiAlert;
}

async function getAlertsNear(lat, lon, radiusKm = 1.5) {
  return pgStore.getAlertsNear(lat, lon, radiusKm, 120);
}

module.exports = { evaluateAndAlert, getAlertsNear };
