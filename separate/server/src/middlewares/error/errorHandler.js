const { env } = require('../../config');

function errorHandler(err, req, res, next) {
  if (env === 'development') {
    console.error(err);
  }
  
  const status = err.status || 500;
  const message = (env === 'production' && status === 500) 
    ? 'Internal Server Error' 
    : err.message || 'Internal Server Error';

  res.status(status).json({ 
    success: false, 
    message 
  });
}

module.exports = errorHandler;

