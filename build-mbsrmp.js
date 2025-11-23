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

function loadAddress(addr) {
	const buffer = new ArrayBuffer(2);
	const view = new DataView(buffer);
	view.setUint16(0, addr, true);
	return view;
}

function relocHeader(page) {
	return new Uint8Array([
		0x4C, 0x03, page, // $pg00 jmp $pg03
		0xA2, 0x0C,       // $pg03 ldx #$0C
		0xA0, page,       // $pg05 ldy #$pg
		0x86, 0xFB,       // $pg07 stx $FB
		0x84, 0xFC,       // $pg09 sty $FC
		0x60              // $pg0B rts
	]);
}

function unusedByte(pageCount, preferred, ...blocks) {
	if (pageCount <= 0) {
		pageCount = 255;
		for (const block of blocks) pageCount += block.byteLength;
		pageCount >>= 8;
	}
	const histogram = new Array(256).fill(0);
	for (const block of blocks) {
		const bs = new Uint8Array(block.buffer, block.byteOffset, block.byteLength);
		for (const b of bs) histogram[b]++;
	}
	for (const b of preferred) {
		let ok = (b + pageCount <= 256);
		for (let p = 0; p < pageCount; p++) {
			if (histogram[b + p]) ok = false;
		}
		if (ok) return b;
	}
	for (let b = 255; b >= 0; b--) {
		let ok = (b + pageCount <= 256);
		for (let p = 0; p < pageCount; p++) {
			if (histogram[b + p]) ok = false;
		}
		if (ok) return b;
	}
	return null;
}

const preferredRelocPages = [
	0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xCB, 0xCC, 0xCD,
	0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F,
	0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
	0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F,
	0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F,
	0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x5B, 0x5C, 0x5D, 0x5E, 0x5F,
	0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F,
	0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F,
	0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F
];

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

function writeFile(destPath, hfname, ext, ...blocks) {
	if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, {'recursive': true});
	const filePath = path.join(destPath, hfname + ext);
	const fd = fs.openSync(filePath, 'w');
	for (const block of blocks) fs.writeSync(fd, block);
	fs.closeSync(fd);
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
					writeFile(destPath, hfname, '.bin', data);
				}
				if (options['makeUnitSeq']) {
					writeFile(destPath, hfname, '.seq', data);
				}
				if (options['makeUnitPrg']) {
					writeFile(destPath, hfname, '.prg', loadAddress(0xC000), data);
				}
				if (options['makeUnitRelocPrg']) {
					const b = unusedByte(0, preferredRelocPages, relocHeader(0), data);
					if (b === null) console.warn('Cannot port ' + id + ' (' + name + '): Could not find a free byte value.');
					else writeFile(destPath, hfname, '.r.prg', loadAddress(b << 8), relocHeader(b), data);
				}
				if (options['makeUnitS00']) {
					if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
					writeFile(destPath, hfname, '.S00', c64file.header(tfname), data);
				}
				if (options['makeUnitP00']) {
					if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
					writeFile(destPath, hfname, '.P00', c64file.header(tfname), loadAddress(0xC000), data);
				}
				if (options['makeUnitRelocP00']) {
					if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
					const b = unusedByte(0, preferredRelocPages, relocHeader(0), data);
					if (b === null) console.warn('Cannot port ' + id + ' (' + name + '): Could not find a free byte value.');
					else writeFile(destPath, hfname, '.r.P00', c64file.header(tfname), loadAddress(b << 8), relocHeader(b), data);
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
				writeFile(destPath, hfname, '.bin', asciiData);
			}
			if (options['makeCategorySeq']) {
				writeFile(destPath, hfname, '.seq', c64data);
			}
			if (options['makeCategoryPrg']) {
				writeFile(destPath, hfname, '.prg', loadAddress(0xC000), c64data);
			}
			if (options['makeCategoryRelocPrg']) {
				const b = unusedByte(0, preferredRelocPages, relocHeader(0), c64data);
				if (b === null) console.warn('Cannot port ' + id + ' (' + name + '): Could not find a free byte value.');
				else writeFile(destPath, hfname, '.r.prg', loadAddress(b << 8), relocHeader(b), c64data);
			}
			if (options['makeCategoryS00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				writeFile(destPath, hfname, '.S00', c64file.header(tfname), c64data);
			}
			if (options['makeCategoryP00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				writeFile(destPath, hfname, '.P00', c64file.header(tfname), loadAddress(0xC000), c64data);
			}
			if (options['makeCategoryRelocP00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				const b = unusedByte(0, preferredRelocPages, relocHeader(0), c64data);
				if (b === null) console.warn('Cannot port ' + id + ' (' + name + '): Could not find a free byte value.');
				else writeFile(destPath, hfname, '.r.P00', c64file.header(tfname), loadAddress(b << 8), relocHeader(b), c64data);
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
				writeFile(destPath, hfname, '.bin', asciiData);
			}
			if (options['makeIncludeSeq']) {
				writeFile(destPath, hfname, '.seq', c64data);
			}
			if (options['makeIncludePrg']) {
				writeFile(destPath, hfname, '.prg', loadAddress(0xC000), c64data);
			}
			if (options['makeIncludeRelocPrg']) {
				const b = unusedByte(0, preferredRelocPages, relocHeader(0), c64data);
				if (b === null) console.warn('Cannot port ' + id + ' (' + name + '): Could not find a free byte value.');
				else writeFile(destPath, hfname, '.r.prg', loadAddress(b << 8), relocHeader(b), c64data);
			}
			if (options['makeIncludeS00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				writeFile(destPath, hfname, '.S00', c64file.header(tfname), c64data);
			}
			if (options['makeIncludeP00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				writeFile(destPath, hfname, '.P00', c64file.header(tfname), loadAddress(0xC000), c64data);
			}
			if (options['makeIncludeRelocP00']) {
				if (tfname.length > 16) console.log('Long file name will be truncated: ' + tfname);
				const b = unusedByte(0, preferredRelocPages, relocHeader(0), c64data);
				if (b === null) console.warn('Cannot port ' + id + ' (' + name + '): Could not find a free byte value.');
				else writeFile(destPath, hfname, '.r.P00', c64file.header(tfname), loadAddress(b << 8), relocHeader(b), c64data);
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
	'makeUnitPrg': true,
	'makeUnitRelocPrg': true,
	'makeUnitS00': true,
	'makeUnitP00': true,
	'makeUnitRelocP00': true,
	'sortUnits': true,
	'makeCategorySeq': true,
	'makeCategoryPrg': true,
	'makeCategoryRelocPrg': false,
	'makeCategoryS00': true,
	'makeCategoryP00': true,
	'makeCategoryRelocP00': false,
	'sortCategories': true,
	'makeIncludeSeq': true,
	'makeIncludePrg': true,
	'makeIncludeRelocPrg': false,
	'makeIncludeS00': true,
	'makeIncludeP00': true,
	'makeIncludeRelocP00': false
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
