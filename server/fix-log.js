const fs = require('fs');
const file = '/Users/vivek/devlopment projects/wApi/wApi/server/src/services/messaging/contactService.js';
let code = fs.readFileSync(file, 'utf8');

const replaceStr = `      const contact = await contactRepository.findById(contactId);
      if (!contact || contact.workspace.toString() !== workspaceId.toString()) {
        logger.error('Delete Contact debug:', { 
          found: !!contact, 
          contactWorkspace: contact ? contact.workspace.toString() : null, 
          passedWorkspace: workspaceId ? workspaceId.toString() : null 
        });
        throw createError(ERROR_CODES.NOT_FOUND, 'Contact not found');
      }`;

code = code.replace(
`      const contact = await contactRepository.findById(contactId);
      if (!contact || contact.workspace.toString() !== workspaceId) {
        throw createError(ERROR_CODES.NOT_FOUND, 'Contact not found');
      }`,
replaceStr);

fs.writeFileSync(file, code);
