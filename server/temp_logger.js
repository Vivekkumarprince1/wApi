const fs = require('fs');
const oldSend = global.resSend || false;

if (!oldSend) {
  const express = require('express');
  const originalSend = express.response.json;
  express.response.json = function(body) {
    if (this.statusCode === 400 && this.req.path.includes('/messages/template')) {
      const msg = `[${new Date().toISOString()}] 400 ERROR on ${this.req.path} - Body: ${JSON.stringify(body)} | ReqBody: ${JSON.stringify(this.req.body)}\n`;
      fs.appendFileSync('/tmp/400_intercept.log', msg);
    }
    return originalSend.call(this, body);
  };
  global.resSend = true;
}
