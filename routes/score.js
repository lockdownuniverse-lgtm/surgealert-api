const express = require('express');
const router = express.Router();
const { requireLatLon } = require('../middleware/validate');
const { computeScore } = require('../services/scoreEngine');

// GET /api/score?lat=&lon=&radius=
// Returns the current crowd danger score for a location
// The mobile app polls this every 60s for the user's current position
router.get('/', requireLatLon, (req, res) => {
  const { lat, lon } = req.coords;
  const radius = parseFloat(req.query.radius) || 0.5;
  const result = computeScore(lat, lon, radius);
  res.json({
    lat,
    lon,
    radius,
    ...result,
    ts: Date.now(),
  });
});

module.exports = router;
