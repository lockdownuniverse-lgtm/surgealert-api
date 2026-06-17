const express = require('express');
const axios = require('axios');
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const router = express.Router();
const { requireLatLon, requireBody } = require('../middleware/validate');
const pgStore = require('../models/pgStore');
const { evaluateAndAlert } = require('../services/alertService');

async function reverseGeocode(lat, lon) {
  if (!GOOGLE_KEY) return null;
  try {
    const { data } = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat + ',' + lon + '&key=' + GOOGLE_KEY
    );
    const result = data.results[0];
    if (!result) return null;
    const comps = result.address_components;
    const neighborhood = comps.find(c => c.types.includes('neighborhood') || c.types.includes('sublocality'))?.long_name;
    const city = comps.find(c => c.types.includes('locality'))?.long_name;
    const state = comps.find(c => c.types.includes('administrative_area_level_1'))?.short_name;
    const county = comps.find(c => c.types.includes('administrative_area_level_2'))?.long_name;
    if (neighborhood && city) return neighborhood + ', ' + city;
    if (city && state) return city + ', ' + state;
    if (county && state) return county + ', ' + state;
    return result.formatted_address?.split(',').slice(0,2).join(',') || null;
  } catch (err) {
    return null;
  }
}

const VALID_TYPES = ['crowd', 'block', 'police', 'other'];

// POST /api/reports
// Body: { lat, lon, type, crowdSize (1-5), note? }
router.post('/',
  requireBody(['lat', 'lon', 'type', 'crowdSize']),
  async (req, res) => {
    let { lat, lon, type, crowdSize, note, locationLabel } = req.body;
    if (!locationLabel) {
      locationLabel = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    }
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
router.get('/', requireLatLon, async (req, res) => {
  try {
    const { lat, lon } = req.coords;
    const radius = parseFloat(req.query.radius) || 1.0;
    const reports = await pgStore.getReportsNear(lat, lon, radius, 60);
    res.json({ count: reports.length, reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/confirm  — community confirmation (Waze-style thumbs up)
router.post('/:id/confirm', (req, res) => {
  const report = store.reports.find(r => r.id === parseInt(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  report.confirmed += 1;
  res.json({ confirmed: report.confirmed });
});

module.exports = router;
