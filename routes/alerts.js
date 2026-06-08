const express = require('express');
const router = express.Router();
const { requireLatLon } = require('../middleware/validate');
const { getAlertsNear } = require('../services/alertService');
const pgStore = require('../models/pgStore');

router.get('/', requireLatLon, async (req, res) => {
  const { lat, lon } = req.coords;
  const radius = parseFloat(req.query.radius) || 1.5;
  const alerts = await getAlertsNear(lat, lon, radius);
  res.json({ count: alerts.length, alerts });
});

router.get('/:id', async (req, res) => {
  res.json({ error: 'Use GET /alerts with lat/lon' });
});

router.patch('/:id/resolve', async (req, res) => {
  const alert = await pgStore.resolveAlert(parseInt(req.params.id));
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true, alert });
});

module.exports = router;
