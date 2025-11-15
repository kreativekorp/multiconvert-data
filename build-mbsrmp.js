#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const c64file = require('./lib/c64file.js');
const da = require('./lib/dimension.js');
const fsutil = require('./lib/fsutilities.js');
const ls = require('./lib/languagestring.js');
const mbsrmp = require('./lib/mbsrmp.js');
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

// READ AND VALIDATE CRISCO

const crisco = [];
for (const file of fsutil.findFiles('.', 'crisco')) {
	const rules = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const rule of rules) {
		validate.start();
		validate.keys(file, rule, ['pattern'], ['regexp', 'flags', 'replacement']);
		validate.string(file, 'pattern', rule['pattern']);
		if (rule['regexp'] !== undefined && typeof rule['regexp'] !== 'boolean') {
			validate.error(file, 'value for "regexp" must be a boolean');
		}
		if (rule['flags'] !== undefined) {
			if (rule['regexp']) {
				validate.string(file, 'flags', rule['flags']);
			} else {
				validate.error(file, 'only rules with regexp patterns may specify flags');
			}
		}
		if (rule['replacement'] !== undefined && typeof rule['replacement'] !== 'string') {
			validate.error(file, 'value for "replacement" must be a string');
		}
		if (validate.ok()) {
			const re = rule['regexp'];
			const ps = rule['pattern'];
			const rf = rule['flags'] || 'ug';
			const pattern = re ? new RegExp(ps, rf) : ps;
			const replacement = rule['replacement'] || '';
			crisco.push([pattern, replacement]);
		}
	}
}
if (validate.totalErrorCount()) process.exit(1);

// WRITE UNITS

function shorten(name) {
	for (const [pattern, replacement] of crisco) {
		name = name.replaceAll(pattern, replacement);
	}
	return name;
}

function saneName(name) {
	return name.replaceAll(/[<>:"/\\|?*-]+/g, '-');
}

function buildUnitData(item, complement=false) {
	if ((item['datatype'] || 'num') === 'num') {
		if (item['parser'] !== undefined || item['formatter'] !== undefined) {
			return;
		} else if (item['instructions'] !== undefined) {
			return mbsrmp.compileInstructions(item['instructions'], complement);
		} else if (item['multiplier'] !== undefined || item['divisor'] !== undefined) {
			const p = (item['multiplier'] !== undefined) ? item['multiplier'] : 1;
			const q = (item['divisor'] !== undefined) ? item['divisor'] : 1;
			return mbsrmp.compileRational(p, q, complement);
		} else {
			return mbsrmp.compileBase(complement);
		}
	}
}

function buildUnit(id, dim, destPath, options) {
	if (id === '-') {
		return;
	} else if (id.startsWith('"') && id.endsWith('"')) {
		return;
	} else {
		const item = unitMapAll[id];
		const comp = !da.eq(item['dimension'], dim);
		const name = ls.get(item['name'], 'en', '*');
		const tname = options['toTargetString'] ? options['toTargetString'](name) : name;
		const tfname = options['toTargetFilename'] ? options['toTargetFilename'](tname, name) : tname;
		const hfname = options['toHostFilename'] ? options['toHostFilename'](tfname, tname, name) : saneName(tfname);
		try {
			const data = buildUnitData(item, comp);
			if (data && data.byteLength > 255) {
				console.warn('Cannot port ' + id + ' (' + name + '): The compiled object exceeds 255 bytes.');
			} else if (data && data.byteLength > 0) {
				if (options['makeUnitBin']) {
					if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
					const binfile = path.join(destPath, hfname + '.bin');
					fs.writeFileSync(binfile, data);
				}
				if (options['makeUnitSeq']) {
					if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
					const seqfile = path.join(destPath, hfname + '.seq');
					fs.writeFileSync(seqfile, data);
				}
				if (options['makeUnitS00']) {
					if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
					if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
					const s00file = path.join(destPath, hfname + '.S00');
					const fd = fs.openSync(s00file, 'w');
					fs.writeSync(fd, c64file.header(tfname));
					fs.writeSync(fd, data);
					fs.closeSync(fd);
				}
				return {
					'id': id,
					'name': name,
					'tname': tname,
					'tfname': tfname,
					'hfname': hfname,
					'data': data
				};
			} else {
				console.warn('Cannot port ' + id + ' (' + name + '): The datatype is not compatible.');
			}
		} catch (error) {
			if (error instanceof RangeError) {
				console.warn('Cannot port ' + id + ' (' + name + '): A constant is too large.');
			} else {
				throw error;
			}
		}
	}
}

function buildCategory(cat, destPath, options) {
	if (cat['include']) {
		return;
	} else {
		const id = cat['type'];
		const dim = unitTypeMap[id]['dimension'];
		const name = ls.get(unitTypeMap[id]['name'], 'en', '*');
		const tname = options['toTargetString'] ? options['toTargetString'](name) : name;
		const tfname = options['toTargetFilename'] ? options['toTargetFilename'](tname, name) : tname;
		const hfname = options['toHostFilename'] ? options['toHostFilename'](tfname, tname, name) : saneName(tfname);
		const unitDestPath = path.join(destPath, hfname);
		const units = [];
		for (const uid of cat['units']) {
			const u = buildUnit(uid, dim, unitDestPath, options);
			if (u) units.push(u);
		}
		if (units.length > 255) {
			console.warn('Cannot port ' + id + ' (' + name + '): The category contains more than 255 units.');
		} else if (units.length > 0) {
			if (options['sortUnits']) {
				const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
				units.sort((a,b) => collator.compare(a['tname'], b['tname']));
			}
			const asciiEncoder = new TextEncoder('US-ASCII');
			const asciiData = mbsrmp.compileCategory(units, u => mbsrmp.cwrap(asciiEncoder.encode(u['tname'])));
			const c64data = mbsrmp.compileCategory(units, u => mbsrmp.cwrap(c64file.encode(u['tname'])));
			if (options['makeCategoryBin']) {
				if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
				const binfile = path.join(destPath, hfname + '.bin');
				fs.writeFileSync(binfile, asciiData);
			}
			if (options['makeCategorySeq']) {
				if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
				const seqfile = path.join(destPath, hfname + '.seq');
				fs.writeFileSync(seqfile, c64data);
			}
			if (options['makeCategoryS00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
				const s00file = path.join(destPath, hfname + '.S00');
				const fd = fs.openSync(s00file, 'w');
				fs.writeSync(fd, c64file.header(tfname));
				fs.writeSync(fd, c64data);
				fs.closeSync(fd);
			}
			return {
				'id': id,
				'name': name,
				'tname': tname,
				'tfname': tfname,
				'hfname': hfname,
				'units': units,
				'data': asciiData,
				'c64data': c64data
			};
		} else {
			console.warn('Cannot port ' + id + ' (' + name + '): The category contains no portable units.');
		}
	}
}

function buildInclude(id, destPath, options) {
	if (includeMap[id]) {
		const name = ls.get(includeMap[id]['name'], 'en', '*');
		const tname = options['toTargetString'] ? options['toTargetString'](name) : name;
		const tfname = options['toTargetFilename'] ? options['toTargetFilename'](tname, name) : tname;
		const hfname = options['toHostFilename'] ? options['toHostFilename'](tfname, tname, name) : saneName(tfname);
		const categories = [];
		for (const cat of includeMap[id]['categories']) {
			const c = buildCategory(cat, destPath, options);
			if (c) categories.push(c);
		}
		if (categories.length > 255) {
			console.warn('Cannot port ' + id + ' (' + name + '): The include contains more than 255 categories.');
		} else if (categories.length > 0) {
			if (options['sortCategories']) {
				const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
				categories.sort((a,b) => collator.compare(a['tname'], b['tname']));
			}
			const asciiEncoder = new TextEncoder('US-ASCII');
			const asciiData = mbsrmp.compileInclude(categories, c => mbsrmp.cwrap(asciiEncoder.encode(c['tname'])));
			const c64data = mbsrmp.compileInclude(categories, c => mbsrmp.cwrap(c64file.encode(c['tname'])), c => c['c64data']);
			if (options['makeIncludeBin']) {
				if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
				const binfile = path.join(destPath, hfname + '.bin');
				fs.writeFileSync(binfile, asciiData);
			}
			if (options['makeIncludeSeq']) {
				if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
				const seqfile = path.join(destPath, hfname + '.seq');
				fs.writeFileSync(seqfile, c64data);
			}
			if (options['makeIncludeS00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
				const s00file = path.join(destPath, hfname + '.S00');
				const fd = fs.openSync(s00file, 'w');
				fs.writeSync(fd, c64file.header(tfname));
				fs.writeSync(fd, c64data);
				fs.closeSync(fd);
			}
			return {
				'id': id,
				'name': name,
				'tname': tname,
				'tfname': tfname,
				'hfname': hfname,
				'categories': categories,
				'data': asciiData,
				'c64data': c64data
			};
		} else {
			console.warn('Cannot port ' + id + ' (' + name + '): The include contains no portable categories.');
		}
	}
}

buildInclude('i1', path.join('os', 'measures'), {
	'toTargetString': c64file.asciify,
	'toTargetFilename': shorten,
	'toHostFilename': saneName,
	'makeUnitSeq': true,
	'makeUnitS00': true,
	'sortUnits': true,
	'makeCategorySeq': true,
	'makeCategoryS00': true,
	'sortCategories': true,
	'makeIncludeSeq': true,
	'makeIncludeS00': true
});

function prodosName(name) {
	name = shorten(name);
	name = name.replaceAll(/[^0-9A-Za-z]+/g, '.');
	name = name.replaceAll(/^[.]+|[.]+$/g, '');
	name = name.replaceAll(/^([0-9])/g, 'z$1');
	return name;
}

buildInclude('i1', path.join('prodos', 'measures'), {
	'toTargetString': c64file.asciify,
	'toTargetFilename': prodosName,
	'toHostFilename': saneName,
	'makeUnitBin': true,
	'sortUnits': true,
	'makeCategoryBin': true,
	'sortCategories': true,
	'makeIncludeBin': true
});
