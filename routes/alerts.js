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


// POST /api/alerts/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const { rows } = await pgStore.pool.query(
      'UPDATE alerts SET confirm_count = confirm_count + 1 WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, confirm_count: rows[0].confirm_count, deny_count: rows[0].deny_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/deny
router.post('/:id/deny', async (req, res) => {
  try {
    const { rows } = await pgStore.pool.query(
      'UPDATE alerts SET deny_count = deny_count + 1 WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, confirm_count: rows[0].confirm_count, deny_count: rows[0].deny_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
