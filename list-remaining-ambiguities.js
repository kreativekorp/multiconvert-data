#!/usr/bin/env node
const loader = require('./lib/validatingloader.js');
if (!loader.load('.', 'en')) process.exit(1);
loader.listRemainingAmbiguities();
