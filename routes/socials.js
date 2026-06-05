const express = require('express');
const router = express.Router();
const { requireBody } = require('../middleware/validate');
const { store, getNextId } = require('../models/store');
const { evaluateAndAlert } = require('../services/alertService');

// POST /api/socials/spike
// Called by your social media scraper/webhook when a spike is detected
// Body: { lat, lon, spikeMultiplier, platform, keywords[], locationLabel? }
//
// spikeMultiplier: ratio of current volume vs baseline (e.g. 5.2 = 520% above normal)
// Minimum useful value is ~2.0 (double baseline); below that = noise

router.post(
  '/spike',
  requireBody(['lat', 'lon', 'spikeMultiplier']),
  (req, res) => {
    const { lat, lon, spikeMultiplier, platform, keywords, locationLabel } = req.body;

    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    const multiplier = parseFloat(spikeMultiplier);

    if (isNaN(latN) || isNaN(lonN) || isNaN(multiplier)) {
      return res.status(400).json({ error: 'lat, lon, spikeMultiplier must be numeric' });
    }
    if (multiplier < 1) {
      return res.status(400).json({ error: 'spikeMultiplier must be >= 1' });
    }

    // Ignore low-signal noise
    if (multiplier < 2.0) {
      return res.json({ accepted: false, reason: 'Below noise threshold (2.0x)' });
    }

    const spike = {
      id: getNextId(),
      lat: latN,
      lon: lonN,
      spikeMultiplier: multiplier,
      platform: platform || 'unknown',
      keywords: keywords || [],
      locationLabel: locationLabel || null,
      createdAt: Date.now(),
    };

    store.socialSpikes.unshift(spike);

    // Re-evaluate — may trigger alert
    const alert = evaluateAndAlert(latN, lonN, locationLabel);

    res.status(201).json({
      spike,
      alertFired: alert !== null,
      alert: alert || undefined,
    });
  }
);

// GET /api/socials/spikes?lat=&lon=&radius=
router.get('/spikes', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon required' });
  }
  const { haversine } = require('../services/scoreEngine');
  const radius = parseFloat(req.query.radius) || 1.0;
  const WINDOW_MS = 30 * 60 * 1000;
  const now = Date.now();

  const nearby = store.socialSpikes.filter(s => {
    if (now - s.createdAt > WINDOW_MS) return false;
    return haversine(lat, lon, s.lat, s.lon) <= radius;
  });

  res.json({ count: nearby.length, spikes: nearby });
});

module.exports = router;
