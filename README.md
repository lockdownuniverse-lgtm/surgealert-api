# SurgeAlert API

Backend for the SurgeAlert mobile app. Combines user-submitted crowd reports and social media spike signals into a unified crowd danger score, fires alerts when thresholds are crossed.

## Quick Start

```bash
npm install
cp .env.example .env
node server.js
```

API runs on `http://localhost:3000`

---

## Architecture

```
Mobile App
    │
    ├── GET  /api/score       ← Poll every 60s for current position
    ├── GET  /api/alerts      ← Fetch active alerts near user
    ├── POST /api/reports     ← Submit a crowd report
    │
Social Scraper (cron/webhook)
    └── POST /api/socials/spike  ← Ingest social media spikes
```

### Scoring Engine

Scores are 0–100, combining two components:

| Component | Max Points | Source |
|-----------|-----------|--------|
| User reports | 60 | POST /api/reports |
| Social spike | 40 | POST /api/socials/spike |

**Severity thresholds:**
- `LOW` ≥ 30
- `MED` ≥ 55  
- `HIGH` ≥ 75

Both components decay over time (reports: 30 min, spikes: 20 min). Alerts have a 15-minute cooldown per location to prevent spam.

---

## Endpoints

### GET /api/score
Get the current crowd score for a location.

**Query params:** `lat`, `lon`, `radius` (km, default 0.5)

**Response:**
```json
{
  "lat": 41.8827,
  "lon": -87.6233,
  "radius": 0.5,
  "score": 68,
  "severity": "MED",
  "components": {
    "reportScore": 35,
    "spikeScore": 33,
    "reportCount": 4,
    "spikeCount": 1
  },
  "ts": 1717200000000
}
```

---

### GET /api/alerts
Get active alerts near a location.

**Query params:** `lat`, `lon`, `radius` (km, default 1.5)

**Response:**
```json
{
  "count": 1,
  "alerts": [{
    "id": 3,
    "lat": 41.8827,
    "lon": -87.6233,
    "locationLabel": "Downtown Market St",
    "severity": "HIGH",
    "score": 81,
    "message": "Large crowd surge detected nearby. Consider avoiding the area.",
    "components": { "reportScore": 48, "spikeScore": 33, "reportCount": 6, "spikeCount": 1 },
    "createdAt": 1717199500000,
    "resolved": false,
    "distanceKm": 0.31,
    "ageMinutes": 4
  }]
}
```

---

### POST /api/reports
Submit a user crowd report.

**Body:**
```json
{
  "lat": 41.8827,
  "lon": -87.6233,
  "type": "crowd",
  "crowdSize": 4,
  "locationLabel": "Market St & 5th",
  "note": "Hundreds of teens, moving fast"
}
```

`type`: `crowd` | `block` | `police` | `other`  
`crowdSize`: 1 (tiny) → 5 (massive)

**Response:**
```json
{
  "report": { "id": 7, "lat": 41.8827, ... },
  "alertFired": true,
  "alert": { "id": 3, "severity": "HIGH", ... }
}
```

---

### POST /api/socials/spike
Ingest a social media spike (called by your scraper).

**Body:**
```json
{
  "lat": 41.8827,
  "lon": -87.6233,
  "spikeMultiplier": 8.2,
  "platform": "twitter",
  "keywords": ["downtown", "crowd", "running"],
  "locationLabel": "Downtown Market St"
}
```

`spikeMultiplier`: ratio vs baseline volume. Below 2.0 is ignored as noise.

---

### POST /api/reports/:id/confirm
Community confirmation (thumbs up a report, Waze-style).

---

### PATCH /api/alerts/:id/resolve
Mark an alert as resolved (moderator/admin).

---

## Production Checklist

- [ ] Replace in-memory store with **PostgreSQL** (reports, alerts) + **Redis** (scores cache, cooldowns)  
- [ ] Add **Firebase Cloud Messaging** in `alertService.js` to push to nearby devices  
- [ ] Build social media scraper (Twitter/X filtered stream API, or a keyword monitor)  
- [ ] Add rate limiting per IP/device on POST /api/reports  
- [ ] Add auth middleware (JWT) for moderator routes  
- [ ] Deploy scraper as a separate cron service that POSTs to /api/socials/spike  
- [ ] Add geohash-based spatial indexing for faster radius queries at scale  

---

## Tech Stack

- Node.js + Express
- In-memory store (swap → Postgres + Redis)
- No external dependencies for core scoring logic
