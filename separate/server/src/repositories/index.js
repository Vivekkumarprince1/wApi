/**
 * REPOSITORIES INDEX
 * Centralized exports for all repositories
 */

const { Contact } = require('../models');
const contactRepository = new (require('./contactRepository'))();

module.exports = {
  contactRepository
};