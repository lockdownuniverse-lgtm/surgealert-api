require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const alertsRouter = require('./routes/alerts');
const reportsRouter = require('./routes/reports');
const socialsRouter = require('./routes/socials');
const scoreRouter = require('./routes/score');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Routes
app.use('/api/alerts',  alertsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/socials', socialsRouter);
app.use('/api/score',   scoreRouter);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`SurgeAlert API running on port ${PORT}`));

module.exports = app;
