require('dotenv').config();
const mongoose = require('mongoose');
const { Message, Template } = require('./src/models');

function renderTemplatePreview(template, variables) {
  let preview = '';

  const headerComponent = template.components?.find(c => c.type === 'HEADER');
  let rawHeaderText = headerComponent?.text || template.header?.text || template.headerText || '';
  
  const bodyComponent = template.components?.find(c => c.type === 'BODY');
  let rawBodyText = bodyComponent?.text || template.body?.text || template.bodyText || template.preview || '';
  
  const footerComponent = template.components?.find(c => c.type === 'FOOTER');
  let rawFooterText = footerComponent?.text || template.footer?.text || template.footerText || '';

  if (rawHeaderText) {
    if (variables?.header) {
      const headerVars = Array.isArray(variables.header) ? variables.header : [variables.header];
      headerVars.forEach((v, i) => {
        rawHeaderText = rawHeaderText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), v);
      });
    }
    preview += `${rawHeaderText}\n\n`;
  }

  if (rawBodyText) {
    if (variables?.body && Array.isArray(variables.body)) {
      variables.body.forEach((v, i) => {
        rawBodyText = rawBodyText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), v);
      });
    }
    preview += rawBodyText;
  }

  if (rawFooterText) {
    preview += `\n\n${rawFooterText}`;
  }

  return preview.trim() || 'Template message';
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const msgs = await Message.find({ type: 'template', body: 'Template message' });
  
  let count = 0;
  for (const msg of msgs) {
    if (!msg.meta || !msg.meta.templateId) continue;
    
    const template = await Template.findById(msg.meta.templateId);
    if (!template) continue;
    
    const variables = msg.meta.variables || {};
    const renderedBody = renderTemplatePreview(template, variables);
    
    if (renderedBody !== 'Template message') {
      msg.body = renderedBody;
      await msg.save();
      count++;
    }
  }
  
  console.log('Fixed bodies for', count, 'template messages');
  process.exit(0);
}).catch(console.error);
