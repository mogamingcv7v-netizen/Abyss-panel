const { body, query, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const authValidation = {
  login: [
    body('username').trim().notEmpty().withMessage('Username is required').escape(),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  register: [
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 chars').escape(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format').normalizeEmail(),
    body('name').optional().trim().escape(),
    body('country').optional().trim().escape(),
    body('dev_code').optional().trim().escape(),
    validate
  ]
};

const userValidation = {
  create: [
    body('username').trim().isLength({ min: 3, max: 50 }).notEmpty().escape(),
    body('password').isLength({ min: 8 }).notEmpty(),
    body('role').isIn(['superadmin', 'dev', 'user']).withMessage('Invalid role'),
    validate
  ],
  update: [
    param('id').isInt().withMessage('Invalid user ID'),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('role').optional().isIn(['superadmin', 'dev', 'user']),
    validate
  ]
};

const rangeValidation = {
  upload: [
    body('name').optional().trim().escape(),
    body('default_payout').optional().isFloat({ min: 0 }),
    body('default_payterm').optional().isInt({ min: 0 }),
    validate
  ]
};

const trafficValidation = {
  log: [
    body('number_id').isInt().notEmpty(),
    body('number').trim().notEmpty().escape(),
    body('cli').trim().notEmpty().escape(),
    body('sms').optional().isInt({ min: 1 }),
    validate
  ]
};

module.exports = {
  authValidation,
  userValidation,
  rangeValidation,
  trafficValidation
};
