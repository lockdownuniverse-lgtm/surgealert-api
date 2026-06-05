// Validation helpers

function requireLatLon(req, res, next) {
  const lat = parseFloat(req.query.lat || req.body?.lat);
  const lon = parseFloat(req.query.lon || req.body?.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon are required numeric parameters' });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'lat/lon out of valid range' });
  }

  req.coords = { lat, lon };
  next();
}

function requireBody(fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => req.body[f] === undefined || req.body[f] === null);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    next();
  };
}

module.exports = { requireLatLon, requireBody };
