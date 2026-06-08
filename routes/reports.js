const express = require('express');
const router = express.Router();
const { requireLatLon, requireBody } = require('../middleware/validate');
const pgStore = require('../models/pgStore');
const { evaluateAndAlert } = require('../services/alertService');

const VALID_TYPES = ['crowd', 'block', 'police', 'other'];

// POST /api/reports
// Body: { lat, lon, type, crowdSize (1-5), note? }
router.post('/',
  requireBody(['lat', 'lon', 'type', 'crowdSize']),
  async (req, res) => {
    const { lat, lon, type, crowdSize, note, locationLabel } = req.body;
    if (!['crowd','block','police','other'].includes(type)) {
      return res.status(400).json({ error: 'invalid type' });
    }
    const size = parseInt(crowdSize);
    if (isNaN(size) || size < 1 || size > 5) return res.status(400).json({ error: 'crowdSize must be 1-5' });
    
    const report = await pgStore.createReport({
      lat: parseFloat(lat), lon: parseFloat(lon),
      type, crowdSize: size, note, locationLabel
    });
    
    const alert = await evaluateAndAlert(parseFloat(lat), parseFloat(lon), locationLabel);
    res.status(201).json({ report, alertFired: alert !== null, alert: alert || undefined });
  }
);

// GET /api/reports?lat=&lon=&radius=
// Returns recent reports near location
router.get('/', requireLatLon, (req, res) => {
  const { haversine } = require('../services/scoreEngine');
  const { lat, lon } = req.coords;
  const radius = parseFloat(req.query.radius) || 1.0;
  const WINDOW_MS = 60 * 60 * 1000;
  const now = Date.now();

  const nearby = store.reports
    .filter(r => {
      if (now - r.createdAt > WINDOW_MS) return false;
      return haversine(lat, lon, r.lat, r.lon) <= radius;
    })
    .map(r => ({
      ...r,
      distanceKm: +haversine(lat, lon, r.lat, r.lon).toFixed(2),
      ageMinutes: Math.round((now - r.createdAt) / 60000),
    }));

  res.json({ count: nearby.length, reports: nearby });
});

// POST /api/reports/:id/confirm  — community confirmation (Waze-style thumbs up)
router.post('/:id/confirm', (req, res) => {
  const report = store.reports.find(r => r.id === parseInt(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  report.confirmed += 1;
  res.json({ confirmed: report.confirmed });
});

module.exports = router;
