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
  body('name').optional().isString().isLength({ min: 2 }),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('tags').optional().isArray(),
];

router.get('/', authenticate, requirePermission('contacts.view'), contactController.listContacts);

router.post('/', 
  authenticate, 
  requirePermission('contacts.create'), 
  validate(contactValidation),
  contactController.createContact
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

export default router;
