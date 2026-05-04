/**
 * Bulk Operations Routes
 */

import { Router } from 'express';
import { bulkOperationsController } from '../controllers/bulkOperationsController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Bulk contact operations
router.post('/contacts/create', bulkOperationsController.bulkCreateContacts);
router.put('/contacts/update', bulkOperationsController.bulkUpdateContacts);
router.delete('/contacts/delete', bulkOperationsController.bulkDeleteContacts);
router.post('/contacts/tag', bulkOperationsController.bulkTagContacts);
router.get('/contacts/export', bulkOperationsController.exportContacts);

// Job status
router.get('/jobs/:jobId/status', bulkOperationsController.getBulkOperationStatus);

export default router;
