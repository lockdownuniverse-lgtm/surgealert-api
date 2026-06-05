const express = require('express');
const router = express.Router();
const { requireLatLon } = require('../middleware/validate');
const { getAlertsNear } = require('../services/alertService');
const { store } = require('../models/store');

// GET /api/alerts?lat=&lon=&radius=
// Returns active alerts near a user's location
router.get('/', requireLatLon, (req, res) => {
  const { lat, lon } = req.coords;
  const radius = parseFloat(req.query.radius) || 1.5;
  const alerts = getAlertsNear(lat, lon, radius);
  res.json({ count: alerts.length, alerts });
});

// GET /api/alerts/:id
router.get('/:id', (req, res) => {
  const alert = store.alerts.find(a => a.id === parseInt(req.params.id));
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

// PATCH /api/alerts/:id/resolve  (admin/moderator use)
router.patch('/:id/resolve', (req, res) => {
  const alert = store.alerts.find(a => a.id === parseInt(req.params.id));
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  alert.resolved = true;
  alert.resolvedAt = Date.now();
  res.json({ success: true, alert });
});

module.exports = router;
