/**
 * CONSTANTS INDEX
 * Centralized exports for all constants
 */

const errors = require('./errors');
const messages = require('./messages');
const limits = require('./limits');
const templates = require('./templates');

module.exports = {
  ...errors,
  ...messages,
  ...limits,
  ...templates
};