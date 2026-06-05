const express = require('express');
const router = express.Router();
const { requireLatLon, requireBody } = require('../middleware/validate');
const { store, getNextId } = require('../models/store');
const { evaluateAndAlert } = require('../services/alertService');

const VALID_TYPES = ['crowd', 'block', 'police', 'other'];

// POST /api/reports
// Body: { lat, lon, type, crowdSize (1-5), note? }
router.post(
  '/',
  requireBody(['lat', 'lon', 'type', 'crowdSize']),
  (req, res) => {
    const { lat, lon, type, crowdSize, note, locationLabel } = req.body;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    const size = parseInt(crowdSize);
    if (isNaN(size) || size < 1 || size > 5) {
      return res.status(400).json({ error: 'crowdSize must be 1–5' });
    }
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    if (isNaN(latN) || isNaN(lonN)) {
      return res.status(400).json({ error: 'lat and lon must be numeric' });
    }

    const report = {
      id: getNextId(),
      lat: latN,
      lon: lonN,
      type,
      crowdSize: size,
      note: note || null,
      locationLabel: locationLabel || null,
      createdAt: Date.now(),
      confirmed: 0,   // Other users can +1 confirm
      disputed: 0,
    };

    store.reports.unshift(report);

    // Re-evaluate the area — may trigger a new alert
    const alert = evaluateAndAlert(latN, lonN, locationLabel);

    res.status(201).json({
      report,
      alertFired: alert !== null,
      alert: alert || undefined,
    });
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
