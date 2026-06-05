// In-memory store — replace with Postgres + Redis in production
// Structure mirrors what the mobile app expects

const store = {
  reports: [],       // User-submitted crowd reports
  alerts: [],        // Generated alerts (fired when score crosses threshold)
  socialSpikes: [],  // Detected social media spikes by geohash
  nextId: 1,
};

function getNextId() {
  return store.nextId++;
}

module.exports = { store, getNextId };
