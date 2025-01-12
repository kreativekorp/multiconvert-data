const fs = require('node:fs');
const fsutil = require('./fsutilities.js');
const index = require('./index.js');
const unit = require('./unitparser.js');

function load(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'composition')) {
		const composition = JSON.parse(fs.readFileSync(file, 'utf8'));
		unit.loadComposition(composition);
	}
	for (const file of fsutil.findFiles(parent, 'degrees')) {
		const degrees = JSON.parse(fs.readFileSync(file, 'utf8'));
		unit.loadDegrees(degrees);
	}
	for (const file of fsutil.findFiles(parent, 'dimensions')) {
		const dimensions = JSON.parse(fs.readFileSync(file, 'utf8'));
		unit.loadDimensions(dimensions);
	}
	for (const file of fsutil.findFiles(parent, 'prefixes')) {
		const prefixes = JSON.parse(fs.readFileSync(file, 'utf8'));
		unit.loadPrefixes(prefixes);
	}
	for (const file of fsutil.findFiles(parent, 'unit-types')) {
		const unitTypes = JSON.parse(fs.readFileSync(file, 'utf8'));
		index.build({'type': 'unit-type'}, lang, unitTypes);
	}
	for (const file of fsutil.findFiles(parent, 'units')) {
		const units = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (units['functions'] !== undefined) {
			unit.loadFunctions(units['functions']);
			index.build({'type': 'function'}, lang, units['functions']);
			delete units['functions'];
		}
		unit.loadUnits(units);
		index.build({'type': 'unit'}, lang, units);
	}
	for (const file of fsutil.findFiles(parent, 'includes')) {
		const includes = JSON.parse(fs.readFileSync(file, 'utf8'));
		for (const key of Object.keys(includes)) {
			const categories = includes[key]['categories'];
			if (categories && typeof categories === 'object' && categories.length) {
				for (const cat of categories) {
					const units = cat['units'];
					if (units && typeof units === 'object' && units.length) {
						for (const us of units) {
							if (us && typeof us === 'string') {
								if (!(us === '-' || (us.startsWith('"') && us.endsWith('"')))) {
									if (!index.cslookup(us)) {
										try {
											const u = unit.parse(us);
											index.build({'type': 'unit'}, lang, {[us]: u});
										} catch (e) {}
									}
								}
							}
						}
					}
				}
			}
		}
		index.build({'type': 'include'}, lang, includes);
	}
	for (const file of fsutil.findFiles(parent, 'elements')) {
		const elements = JSON.parse(fs.readFileSync(file, 'utf8'));
		const keyedElements = {};
		for (const key of Object.keys(elements)) {
			keyedElements['e' + key] = elements[key];
		}
		index.build({'type': 'element'}, lang, keyedElements);
	}
	for (const file of fsutil.findFiles(parent, 'solvers')) {
		const solvers = JSON.parse(fs.readFileSync(file, 'utf8'));
		index.build({'type': 'solver'}, lang, solvers);
	}
	for (const file of fsutil.findFiles(parent, 'disambiguation')) {
		const disambiguation = JSON.parse(fs.readFileSync(file, 'utf8'));
		index.disambiguate(lang, disambiguation);
	}
}

module.exports = { load };
