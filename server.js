require('dotenv').config();
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const path = require('path');
const db = require('./src/db/db');
const analyticsMiddleware = require('./src/middleware/analytics');
const langMiddleware = require('./src/middleware/lang');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Apply HTTP compression for faster page loads (SEO Optimization)
app.use(compression());

// Parse incoming requests bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Session Management
app.use(session({
  secret: process.env.SESSION_SECRET || 'evance_dionis_secret_key_102938',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours session duration
    secure: false // Set to true in production if using HTTPS
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Apply Visitor Analytics Tracking and Language Switcher Middlewares
app.use(analyticsMiddleware);
app.use(langMiddleware);

// Load Routers
const publicRouter = require('./src/routes/index');
const adminRouter = require('./src/routes/admin');

app.use('/admin', adminRouter);
app.use('/', publicRouter);

// Handle 404 - Page Not Found
app.use((req, res, next) => {
  res.status(404).render('pages/portfolio', {
    projects: [],
    categories: [],
    selectedCategory: '',
    searchQuery: '',
    error: '404 - Page Not Found'
  }); // Simple redirect/fallback page or EJS
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).send('Internal Server Error: ' + err.message);
});

// Connect to Database and start HTTP Server
async function startServer() {
  try {
    await db.connect();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`PORTFOLIO & CMS RUNNING AT: http://localhost:${PORT}`);
      console.log(`ADMIN CONTROL PANEL AT:     http://localhost:${PORT}/admin`);
      console.log(`ENVIRONMENT:                ${process.env.NODE_ENV || 'development'}`);
      console.log(`DATABASE ENGINE:            ${db.type.toUpperCase()}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to initialize database connection. Server cannot boot.', err.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
