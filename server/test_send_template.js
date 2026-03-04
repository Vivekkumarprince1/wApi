const http = require('http');

const body = JSON.stringify({
  contactId: "dummy123",
  templateId: "dummy456",
  variables: [],
  language: "en"
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/messages/template',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    // we need to set auth header, but this is just to verify if body paring is an issue.
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(body);
req.end();
