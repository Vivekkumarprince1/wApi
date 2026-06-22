#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const { randomBytes } = require('crypto');

const secret = () => randomBytes(32).toString('hex');

console.log(`JWT_SECRET=${secret()}`);
console.log(`INTERNAL_SERVICE_SECRET=${secret()}`);
console.log(`INTEGRATION_ENCRYPTION_KEY=${secret()}`);
NODE
