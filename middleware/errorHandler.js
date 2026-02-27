const config = require('../config/index');

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found: ' + req.method + ' ' + req.originalUrl,
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message    = err.message    || 'Internal Server Error';

  if (config.nodeEnv === 'development') {
    console.error('ERROR:', message);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { notFound, errorHandler };
