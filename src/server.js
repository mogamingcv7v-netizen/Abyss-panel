const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const logger = require('./config/logger');
const { authenticate, authorize } = require('./middleware/auth');
const { authValidation, userValidation, rangeValidation, trafficValidation } = require('./middleware/validation');

// Controllers
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const rangeController = require('./controllers/rangeController');
const numberController = require('./controllers/numberController');
const trafficController = require('./controllers/trafficController');
const adminController = require('./controllers/adminController');
const targetController = require('./controllers/targetController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// File upload configuration with security hardening
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // Sanitize filename to prevent directory traversal or malicious names
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${Date.now()}-${sanitizedName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow .txt files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.txt') {
      return cb(new Error('Only .txt files are allowed'));
    }
    cb(null, true);
  },
});

// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// --- API Routes ---

// Health Check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Auth Routes
app.post('/api/auth/login', authValidation.login, authController.login);
app.post('/api/auth/register', authValidation.register, authController.register);
app.get('/api/auth/me', authenticate, authController.me);
app.put('/api/auth/profile', authenticate, authController.updateProfile);
app.put('/api/auth/password', authenticate, authController.changePassword);

// User Management (Admin only)
app.get('/api/users', authenticate, authorize(['superadmin', 'dev']), userController.getAllUsers);
app.get('/api/users/performance', authenticate, authorize(['superadmin', 'dev']), userController.getUserPerformance);
app.post('/api/users', authenticate, authorize(['superadmin', 'dev']), userValidation.create, userController.createUser);
app.get('/api/users/:id', authenticate, authorize(['superadmin', 'dev']), userController.getUserById);
app.put('/api/users/:id', authenticate, authorize(['superadmin', 'dev']), userValidation.update, userController.updateUser);
app.patch('/api/users/:id/toggle', authenticate, authorize(['superadmin', 'dev']), userController.toggleUserActive);
app.delete('/api/users/:id', authenticate, authorize(['superadmin', 'dev']), userController.deleteUser);

// Range Management (Admin only)
app.get('/api/ranges', authenticate, authorize(['superadmin', 'dev']), rangeController.getAllRanges);
app.get('/api/ranges/:id', authenticate, authorize(['superadmin', 'dev']), rangeController.getRangeById);
app.post('/api/ranges/upload', authenticate, authorize(['superadmin', 'dev']), upload.single('file'), rangeValidation.upload, rangeController.uploadRange);
app.put('/api/ranges/:id', authenticate, authorize(['superadmin', 'dev']), rangeValidation.upload, rangeController.updateRange);
app.delete('/api/ranges/:id', authenticate, authorize(['superadmin', 'dev']), rangeController.deleteRange);

// Number Management
app.get('/api/numbers', authenticate, numberController.getNumbers);
app.post('/api/numbers/allocate', authenticate, authorize(['superadmin', 'dev']), numberController.allocateNumbers);
app.get('/api/numbers/alloc-log', authenticate, authorize(['superadmin', 'dev']), numberController.getAllocationLog);
app.patch('/api/numbers/:id/unassign', authenticate, authorize(['superadmin', 'dev']), numberController.unassignNumber);
app.delete('/api/numbers/:id', authenticate, authorize(['superadmin', 'dev']), numberController.deleteNumber);

// Traffic/CDR
app.post('/api/traffic', authenticate, trafficValidation.log, trafficController.logTraffic);
app.get('/api/traffic', authenticate, trafficController.getTraffic);
app.get('/api/traffic/stats/dashboard', authenticate, trafficController.getDashboardStats);
app.get('/api/traffic/stats/chart', authenticate, trafficController.getChartData);
app.get('/api/traffic/stats/hourly', authenticate, trafficController.getHourlyHeatmap);
app.get('/api/traffic/stats/numbers', authenticate, trafficController.getTopNumbers);
app.get('/api/traffic/stats/cli', authenticate, authorize(['superadmin', 'dev']), trafficController.getTopClis);
app.delete('/api/traffic/:id', authenticate, authorize(['superadmin', 'dev']), trafficController.deleteTrafficRecord);
app.delete('/api/traffic/all', authenticate, authorize(['superadmin']), trafficController.clearAllTraffic);

// Admin Features (Superadmin)
app.get('/api/admin/dev-codes', authenticate, authorize(['superadmin']), adminController.getDevCodes);
app.post('/api/admin/dev-codes', authenticate, authorize(['superadmin']), adminController.generateDevCode);
app.delete('/api/admin/dev-codes/:id', authenticate, authorize(['superadmin']), adminController.deleteDevCode);
app.get('/api/admin/system-info', authenticate, authorize(['superadmin', 'dev']), adminController.getSystemInfo);

// Targets
app.get('/api/targets', authenticate, authorize(['superadmin', 'dev']), targetController.getTargets);
app.get('/api/targets/:user_id', authenticate, authorize(['superadmin', 'dev']), targetController.getTargets);
app.put('/api/targets/:user_id/:type', authenticate, authorize(['superadmin', 'dev']), targetController.updateTarget);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
