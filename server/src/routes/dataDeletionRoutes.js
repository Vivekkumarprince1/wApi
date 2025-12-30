const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { deleteAccount, metaDataDeletionCallback } = require('../controllers/dataDeletionController');

// Authenticated user deletes own account
router.delete('/delete-account', auth, deleteAccount);

// Public endpoint for Meta or other privacy callbacks
router.post('/data-deletion-callback', metaDataDeletionCallback);

module.exports = router;
