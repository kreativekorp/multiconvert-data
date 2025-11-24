#!/usr/bin/env node

const fs = require('node:fs');
const fsutil = require('./lib/fsutilities.js');
const ls = require('./lib/languagestring.js');
const test = require('./lib/testrunner.js');
const validate = require('./lib/validate.js');
const loader = require('./lib/validatingloader.js');

// READ AND VALIDATE

if (!loader.load('.', 'en')) process.exit(1);
const unitTypeMap = loader.unitTypeMap;
const unitMapAll = loader.unitMapAll;
const includeMap = loader.includeMap;
loader.summarize();

// VALIDATE AND RUN TESTS

test.summarize(test.runAllDir('.'));
if (validate.totalErrorCount()) process.exit(1);

// ANNOTATE INCLUDES

function annotateIncludes(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'includes')) {
		const includes = JSON.parse(fs.readFileSync(file, 'utf8'));
		for (const key of Object.keys(includes)) {
			const categories = includes[key]['categories'];
			if (categories && typeof categories === 'object' && categories.length) {
				for (const cat of categories) {
					if (cat['include'] !== undefined) {
						const includeId = (cat['include'] = String(cat['include']).replace(/\s*#.*$/g, ''));
						if (includeMap[includeId]) {
							cat['include'] += ' # ' + ls.get(includeMap[includeId]['name'], lang, '*');
						} else if (includeId === 'i36') {
							cat['include'] += ' # Currency Advanced';
						} else if (includeId === 'i162') {
							cat['include'] += ' # Currency Basic';
						}
					}
					if (cat['type'] !== undefined) {
						const unitTypeId = (cat['type'] = String(cat['type']).replace(/\s*#.*$/g, ''));
						if (unitTypeMap[unitTypeId]) {
							cat['type'] += ' # ' + ls.get(unitTypeMap[unitTypeId]['name'], lang, '*');
						}
					}
					const units = cat['units'];
					if (units && typeof units === 'object' && units.length) {
						for (let ui = 0; ui < units.length; ui++) {
							let us = units[ui];
							if (us && typeof us === 'string') {
								if (!(us === '-' || (us.startsWith('"') && us.endsWith('"')))) {
									units[ui] = us = us.replace(/\s*#.*$/g, '');
									if (unitMapAll[us]) {
										units[ui] = us = us + ' # ' + ls.get(unitMapAll[us]['name'], lang, '*');
									}
								}
							}
						}
					}
				}
			}
		}
		fs.writeFileSync(file, JSON.stringify(includes, null, '\t'), 'utf8');
	}
}

annotateIncludes();
