import { Router } from 'express';
import { body } from 'express-validator';
import { contactController } from '../controllers/contactController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { requirePermission } from '../middlewares/permissionMiddleware';

const router = Router();

// Validation chains
const contactValidation = [
  body('phone').notEmpty().withMessage('Phone number is required').isString(),
  body('name').optional({ values: 'falsy' }).isString().isLength({ min: 2 }),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email format'),
  body('tags').optional({ values: 'falsy' }).isArray(),
];

router.get('/', authenticate, requirePermission('contacts.view'), contactController.listContacts);

router.get('/export', authenticate, requirePermission('contacts.view'), contactController.exportContacts);

router.post('/', 
  authenticate, 
  requirePermission('contacts.create'), 
  validate(contactValidation),
  contactController.createContact
);

router.get(
  '/:id/form-submissions',
  authenticate,
  requirePermission('contacts.view'),
  contactController.listFormSubmissions
);

router.get('/:id', authenticate, requirePermission('contacts.view'), contactController.getContact);

router.patch('/:id', 
  authenticate, 
  requirePermission('contacts.edit'), 
  validate(contactValidation.map(v => v.optional())),
  contactController.updateContact
);

router.delete('/:id', authenticate, requirePermission('contacts.delete'), contactController.deleteContact);

router.post('/import', 
  authenticate, 
  requirePermission('contacts.import'), 
  validate([body('contacts').isArray().notEmpty()]),
  contactController.importContacts
);

router.post('/:id/send-template', 
  authenticate, 
  requirePermission('messaging.send'), 
  validate([body('templateName').notEmpty()]),
  contactController.sendTemplate
);

// CSV Import routes
router.post('/csv-import/upload',
  authenticate,
  requirePermission('contacts.import'),
  contactController.uploadCSV
);

router.get('/csv-import/:jobId/progress',
  authenticate,
  contactController.getImportProgress
);

router.delete('/csv-import/:jobId/cancel',
  authenticate,
  contactController.cancelImport
);

router.get('/csv-import/list/active',
  authenticate,
  contactController.listActiveImports
);

export default router;
