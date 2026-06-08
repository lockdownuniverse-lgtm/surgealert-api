const express = require('express');
const router = express.Router();
const { requireLatLon } = require('../middleware/validate');
const { computeScore } = require('../services/scoreEngine');

router.get('/', requireLatLon, async (req, res) => {
  const { lat, lon } = req.coords;
  const radius = parseFloat(req.query.radius) || 0.5;
  try {
    const result = await computeScore(lat, lon, radius);
    res.json({ lat, lon, radius, ...result, ts: Date.now() });
  } catch (err) {
    console.error('[score] Error:', err.message);
    res.json({ lat, lon, radius, score: 0, severity: 'NONE', components: { reportScore:0, spikeScore:0, reportCount:0, spikeCount:0 }, ts: Date.now() });
  }
});

module.exports = router;
