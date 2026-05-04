import { Router } from 'express';
import { body } from 'express-validator';
import { supportController } from '../controllers/supportController';
import { authenticate } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validationMiddleware';
import { requirePermission } from '../middlewares/permissionMiddleware';

const router = Router();

router.use(authenticate);

// Tickets
router.get('/tickets', requirePermission('support.view'), supportController.listTickets);

router.post('/tickets', 
  requirePermission('support.view'),
  validate([
    body('subject').notEmpty().isString(),
    body('contactId').notEmpty().isMongoId()
  ]),
  supportController.createTicket
);

router.put('/tickets/:id', 
  requirePermission('support.manage'),
  validate([
    body('status').optional().isIn(['open', 'pending', 'resolved', 'closed']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
  ]),
  supportController.updateTicket
);

// Macros
router.get('/macros', requirePermission('support.view'), supportController.listMacros);

router.post('/macros', 
  requirePermission('support.manage'),
  validate([
    body('name').notEmpty().isString(),
    body('content').notEmpty().isString()
  ]),
  supportController.createMacro
);

router.patch('/macros/:id', 
  requirePermission('support.manage'),
  supportController.updateMacro
);

router.put('/macros/:id', 
  requirePermission('support.manage'),
  supportController.updateMacro
);

router.delete('/macros/:id', requirePermission('support.manage'), supportController.deleteMacro);

export default router;
