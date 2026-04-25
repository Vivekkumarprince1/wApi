// This file now delegates bootstrapping to the new `src/server.js` implementation.
// Keeping this small shim preserves compatibility with existing start scripts.
require('dotenv').config();
module.exports = require('./src/server');