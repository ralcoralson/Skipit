const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const listingsRoutes = require('./modules/listings/listings.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const wishlistRoutes = require('./modules/wishlist/wishlist.routes');
const reviewsRoutes = require('./modules/reviews/reviews.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const rentalsRoutes = require('./modules/rentals/rentals.routes');
const ticketsRoutes = require('./modules/tickets/tickets.routes');
const usersRoutes = require('./modules/users/users.routes');
const geoRoutes = require('./modules/geo/geo.routes');

const app = express();

// Trust reverse proxy (e.g. Render, Railway, Cloudflare)
app.set('trust proxy', 1);

// Security & utility middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (mobile applications, native clients, server-to-server)
    if (!origin) return callback(null, true);
    if (config.corsOrigin.includes('*') || config.corsOrigin.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: Origin '${origin}' is not in the allowed list`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Global rate limiting
app.use(generalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    product: 'SkipIt 3.0 Peer-to-Peer Rental Marketplace',
    tagline: 'Skip Buying. Rent Smarter.',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    api: 'v1',
    mode: 'Zero Commission P2P',
    timestamp: new Date().toISOString(),
  });
});

// API Routes (mounted on both /api/v1 and root prefixes for universal client compatibility)
app.use('/api/v1/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/v1/categories', categoriesRoutes);
app.use('/categories', categoriesRoutes);

app.use('/api/v1/listings', listingsRoutes);
app.use('/listings', listingsRoutes);

app.use('/api/v1/chat', chatRoutes);
app.use('/chat', chatRoutes);

app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/wishlist', wishlistRoutes);

app.use('/api/v1/reviews', reviewsRoutes);
app.use('/reviews', reviewsRoutes);

app.use('/api/v1/notifications', notificationsRoutes);
app.use('/notifications', notificationsRoutes);

app.use('/api/v1/reports', reportsRoutes);
app.use('/reports', reportsRoutes);

app.use('/api/v1/admin', adminRoutes);
app.use('/admin', adminRoutes);

app.use('/api/v1/rentals', rentalsRoutes);
app.use('/rentals', rentalsRoutes);

app.use('/api/v1/tickets', ticketsRoutes);
app.use('/tickets', ticketsRoutes);

app.use('/api/v1/users', usersRoutes);
app.use('/users', usersRoutes);

app.use('/api/v1/geo', geoRoutes);
app.use('/geo', geoRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
