const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const segmentController = require('../../controllers/campaign/segmentController');

router.use(auth);

router.get('/', segmentController.listSegments);
router.post('/', segmentController.createSegment);

module.exports = router;
