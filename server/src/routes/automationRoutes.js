const express = require('express');
const auth = require('../middlewares/auth');
const { createRule } = require('../controllers/automationController');

const router = express.Router();
router.use(auth);
router.post('/', createRule);

module.exports = router;
