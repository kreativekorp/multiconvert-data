#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const ls = require('./lib/languagestring.js');
const srmp = require('./lib/srmp.js');
const test = require('./lib/testrunner.js');
const validate = require('./lib/validate.js');
const loader = require('./lib/validatingloader.js');

console.log('NOTICE: This script produces data files for an older version of');
console.log('MultiConvert which is no longer supported. DO NOT use these data');
console.log('files for new applications. Please use the JSON files directly.');
console.log();

// READ AND VALIDATE

if (!loader.load('.', 'en')) process.exit(1);
const degreesMap = loader.degreesMap;
const dimensionsMap = loader.dimensionsMap;
const prefixesMap = loader.prefixesMap;
const unitTypeMap = loader.unitTypeMap;
const unitMap = loader.unitMap;
const unitMapAll = loader.unitMapAll;
const includeMap = loader.includeMap;
const elementsMap = loader.elementsMap;
const solversMap = loader.solversMap;
loader.summarize();

// VALIDATE AND RUN TESTS

test.summarize(test.runAllDir('.'));
if (validate.totalErrorCount()) process.exit(1);

// FUNCTIONS USED TO BUILD DATA FILES

function headerLines() {
	return [
		'<?php header(\'Content-type: text/plain; charset=utf8\'); error_reporting(0); ?>',
		'COMMENT\tThis is a data file for an older version of MultiConvert which',
		'COMMENT\tis no longer supported. DO NOT use this data file for new',
		'COMMENT\tapplications. Please use the JSON files in this repository:',
		'COMMENT\thttps://github.com/kreativekorp/multiconvert-data',
		'', ''
	];
}

function dimensionString(d) {
	const indices = Object.values(dimensionsMap).map(v => v['legacy-id-mc5']).filter(isFinite);
	const fields = Array.from({length: Math.max(...indices) + 1}, () => '  0');
	if (d) {
		for (const k of Object.keys(d)) {
			if (Math.ceil(d[k]) !== Math.floor(d[k])) return null;
			const fn = (
				(dimensionsMap[k]['legacy-id-mc5'] !== undefined) ? dimensionsMap[k]['legacy-id-mc5'] :
				(dimensionsMap[k]['legacy-id'] !== undefined) ? dimensionsMap[k]['legacy-id'] : k
			);
			if (isFinite(fn)) {
				let v = String(d[k] || 0);
				while (v.length < 3) v = ' ' + v;
				fields[fn] = v;
			} else if (dimensionsMap[k]['composable'] === false) {
				fields.push(' xxx-no-compositing--' + fn + ':' + d[k]);
			} else {
				fields.push(' ' + fn + ':' + d[k]);
			}
		}
	}
	return fields.join(',');
}

function srmpToMcsmString(i) {
	return srmp.parseForward(i).map(([opcode,operand]) => {
		switch (opcode) {
			case 'A': case 'a': return ('+' + operand);
			case 'S': case 's': return ('-' + operand);
			case 'Z': case 'z': return ('~' + operand);
			case 'M': case 'm': return ('*' + operand);
			case 'D': case 'd': return ('/' + operand);
			case 'G': case 'g': return ('|' + operand);
			case 'C': case 'c': return ((operand == 1) ? 'P' : ('P /' + operand));
			case 'Q': case 'q': return ((operand == 1) ? 'd' : ('*' + operand + ' d'));
			case 'P': case 'p': return ('^' + operand);
			case 'R': case 'r': return ((operand == 2) ? '@9' : (operand == 3) ? '@8' : ('h' + operand));
			case 'X': case 'x': return ((operand == 2) ? '@28' : (operand == 10) ? '@27' : ('e' + operand));
			case 'L': case 'l': return ((operand == 2) ? '@18' : (operand == 10) ? '@17' : ('_' + operand));
			case 'E': case 'e': return ((operand == 0) ? '@26' : ('@26 -' + operand));
			case 'N': case 'n': return ((operand == 0) ? '@16' : ('+' + operand + ' @16'));
			case 'V': case 'v': operand = -operand; // fallthrough;
			case 'F': case 'f':
				if (operand ==  +1) return '@10';
				if (operand ==  +2) return '@11';
				if (operand ==  +3) return '@12';
				if (operand ==  +4) return '@13';
				if (operand ==  +5) return '@14';
				if (operand ==  +6) return '@15';
				if (operand ==  +7) return '@30';
				if (operand ==  +8) return '@31';
				if (operand ==  +9) return '@32';
				if (operand == +10) return '@33';
				if (operand == +11) return '@34';
				if (operand == +12) return '@35';
				if (operand ==  -1) return '@20';
				if (operand ==  -2) return '@21';
				if (operand ==  -3) return '@22';
				if (operand ==  -4) return '@23';
				if (operand ==  -5) return '@24';
				if (operand ==  -6) return '@25';
				if (operand ==  -7) return '@40';
				if (operand ==  -8) return '@41';
				if (operand ==  -9) return '@42';
				if (operand == -10) return '@43';
				if (operand == -11) return '@44';
				if (operand == -12) return '@45';
				return;
			default: return;
		}
	}).filter(x => x).join(' ');
}

function ratioToMcsmString(m, d) {
	m = (m === undefined || m == 1) ? '' : (m == Math.PI) ? 'P' : ('*' + m);
	d = (d === undefined || d == 1) ? '' : (d == Math.PI) ? 'd' : ('/' + d);
	return (m && d) ? (m + ' ' + d) : (m || d || '*1');
}

const builtUnitTypes = {};
function buildUnitTypes(lines, heading, filter) {
	lines.push('COMMENT\t' + heading);
	lines.push('');
	lines.push('COMMENT\tTYPE NAME\t  m, kg,  s,  A,  K,mol, cd,rad,  b');
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const keys = Object.keys(unitTypeMap).filter(filter).sort(collator.compare);
	for (const key of keys) {
		if (builtUnitTypes[key]) continue;
		const item = unitTypeMap[key];
		const name = ls.get(item['name'], 'en', '*');
		const dims = dimensionString(item['dimension']);
		if (!dims) continue;
		const fields = ['BASETYPE ' + key, name, dims];
		lines.push((builtUnitTypes[key] = fields.join('\t')));
	}
	lines.push('');
	lines.push('');
}

const builtUnits = {};
function buildUnits(lines, heading, filter, derived) {
	lines.push('COMMENT\t' + heading);
	lines.push('');
	lines.push(
		(derived === 'z') ? 'COMMENT\tCLASS\tSINGULAR\tPLURAL\tSYMBOL\tVARIANT' :
		(derived === 'k') ? 'COMMENT\tNAME\tSTRIPE CONFIGURATION\t  m, kg,  s,  A,  K,mol, cd,rad,  b' :
		(derived === 'd') ? 'COMMENT\tSINGULAR\tPLURAL\tSYMBOL\tDEPENDENCY NAME\t  m, kg,  s,  A,  K,mol, cd,rad,  b (DEPENDENCY DIM)\tBASE-TO-MINE\tMINE-TO-BASE\t  m, kg,  s,  A,  K,mol, cd,rad,  b (UNIT DIM)' :
		(derived === 'n') ? 'COMMENT\tSINGULAR\tPLURAL\tSYMBOL\tBASE-TO-MINE\tMINE-TO-BASE\t  m, kg,  s,  A,  K,mol, cd,rad,  b' :
		derived ? 'COMMENT\tSINGULAR\tPLURAL\tSYMBOL\tMINE-TO-BASE\t  m, kg,  s,  A,  K,mol, cd,rad,  b' :
		'COMMENT\tSINGULAR\tPLURAL\tSYMB\t  m, kg,  s,  A,  K,mol, cd,rad,  b'
	);
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const keys = Object.keys(unitMap).filter(filter).sort(collator.compare);
	for (const key of keys) {
		if (builtUnits[key]) continue;
		const item = unitMap[key];
		const symb = item['symbol'] || '';
		const sname = ls.get(item['name'], 'en', '1');
		const pname = ls.get(item['name'], 'en', '*');
		const dims = dimensionString(item['dimension']);
		if (!dims) continue;
		switch (item['datatype'] || 'num') {
			case 'num':
				if (item['legacy-mcsm-forward'] !== undefined || item['legacy-mcsm-reverse'] !== undefined) {
					const f = item['legacy-mcsm-forward'] || '*1';
					const r = item['legacy-mcsm-reverse'] || '*1';
					const fields = ['NONINVUNIT ' + key, sname, pname, symb, f, r, dims];
					lines.push((builtUnits[key] = fields.join('\t')));
				} else if (item['parser'] !== undefined || item['formatter'] !== undefined) {
					continue;
				} else if (item['instructions'] !== undefined) {
					const i = srmpToMcsmString(item['instructions']);
					const fields = ['NONSIUNIT ' + key, sname, pname, symb, i, dims];
					lines.push((builtUnits[key] = fields.join('\t')));
				} else if (derived || item['multiplier'] !== undefined || item['divisor'] !== undefined) {
					const i = ratioToMcsmString(item['multiplier'], item['divisor']);
					const fields = ['NONSIUNIT ' + key, sname, pname, symb, i, dims];
					lines.push((builtUnits[key] = fields.join('\t')));
				} else {
					const fields = ['BASEUNIT ' + key, sname, pname, symb, dims];
					lines.push((builtUnits[key] = fields.join('\t')));
				}
				break;
			case 'text': case 'tuple':
				if (item['legacy-mc5-class']) {
					const c = item['legacy-mc5-class'];
					const v = item['legacy-mc5-variant'] || 0;
					const fields = ['SPECIALUNIT ' + key, c, sname, pname, symb, v];
					lines.push((builtUnits[key] = fields.join('\t')));
				}
				break;
			case 'dep':
				if (item['legacy-mcsm-forward'] !== undefined || item['legacy-mcsm-reverse'] !== undefined) {
					const f = item['legacy-mcsm-forward'] || '*1';
					const r = item['legacy-mcsm-reverse'] || '*1';
					const dname = ls.get(item['dep-name'], 'en', '*');
					const ddims = dimensionString(item['dep-dimension']);
					const fields = ['DEPUNIT ' + key, sname, pname, symb, dname, ddims, f, r, dims];
					lines.push((builtUnits[key] = fields.join('\t')));
				}
				break;
			case 'cc':
				if (item['legacy-cc-stripe-configuration'] !== undefined) {
					const sc = item['legacy-cc-stripe-configuration'].join(' : ');
					const fields = ['COLORCODE ' + key, pname, sc, dims];
					lines.push((builtUnits[key] = fields.join('\t')));
				}
				break;
		}
	}
	lines.push('');
	lines.push('');
}

const builtIncludeUnits = {};
function unitCompatible(us) {
	if (us in builtIncludeUnits) {
		return builtIncludeUnits[us];
	}
	if (us === '-' || (us.startsWith('"') && us.endsWith('"'))) {
		return (builtIncludeUnits[us] = true);
	}
	for (const m of us.matchAll(/[A-Za-z][A-Za-z0-9]*/g)) {
		if (!builtUnits[m[0]]) {
			return (builtIncludeUnits[us] = false);
		}
	}
	if (unitMapAll[us]['dimension']) {
		for (const v of Object.values(unitMapAll[us]['dimension'])) {
			if (Math.ceil(v) !== Math.floor(v)) {
				return (builtIncludeUnits[us] = false);
			}
		}
	}
	return (builtIncludeUnits[us] = true);
}

const builtIncludeUnitTypes = {};
function buildInclude(lines, id, comment, typeComments) {
	if (includeMap[id]) {
		const iname = ls.get(includeMap[id]['name'], 'en', '*');
		lines.push('NEWINSTDEF ' + id + '\tNEWINSTDEF\t' + iname);
		if (comment) lines.push('COMMENT\t' + comment);
		for (const cat of includeMap[id]['categories']) {
			if (cat['include']) {
				if (includeMap[cat['include']]) {
					builtIncludeUnitTypes[cat['include']] = true;
					if (typeComments) {
						const tname = ls.get(includeMap[cat['include']]['name'], 'en', '*');
						lines.push('COMMENT\t--- ' + tname + ' ---');
					}
					lines.push('NEWINSTDEF ' + id + '\t' + cat['include']);
				} else if (['i36','i162'].indexOf(cat['include']) >= 0) {
					builtIncludeUnitTypes[cat['include']] = true;
					if (typeComments) lines.push('COMMENT\t--- currency ---');
					lines.push('NEWINSTDEF ' + id + '\t' + cat['include']);
				} else {
					builtIncludeUnitTypes[cat['include']] = false;
				}
			} else {
				builtIncludeUnitTypes[cat['type']] = !!builtUnitTypes[cat['type']];
				if (builtIncludeUnitTypes[cat['type']]) {
					const units = cat['units'].filter(unitCompatible).join('; ');
					if (units) {
						if (typeComments) {
							const tname = ls.get(unitTypeMap[cat['type']]['name'], 'en', '*');
							lines.push('COMMENT\t--- ' + tname + ' ---');
						}
						lines.push('NEWINSTDEF ' + id + '\t' + cat['type'] + '; ' + units);
					}
				}
			}
		}
		lines.push('');
	}
}

const builtSolvers = {};
function buildSolver(lines, id) {
	if (solversMap[id] && solversMap[id]['legacy-solutions-mcsm']) {
		const prefix = 'SOLVER ' + id;
		const name = ls.get(solversMap[id]['name'], 'en', '*');
		lines.push([prefix, 'SOLVER', name].join('\t'));
		for (const v of solversMap[id]['variables']) {
			const vt = (v['type'][0] + 'v').toUpperCase();
			const vr = v['register'] || 0;
			const vn = ls.get(v['name'], 'en', '*');
			const vd = dimensionString(v['dimension']);
			const vu = v['unit'] || 'u2000';
			lines.push([prefix, vt, vr, vn, vd, vu].join('\t'));
		}
		const ss = solversMap[id]['legacy-solutions-mcsm'];
		const dvreqd = Math.max(...Object.keys(ss).map(k => k.split(',').length));
		lines.push([prefix, 'DVREQD', dvreqd].join('\t'));
		for (const k of Object.keys(ss)) {
			lines.push([prefix, 'GIVEN', k, ss[k]].join('\t'));
		}
		lines.push('');
		builtSolvers[id] = true;
	}
}

function buildMainPHP() {
	const lines = headerLines();

	lines.push('COMMENT\tPREFIX TABLE FOR UNIT MULTIPLICITY');
	lines.push('');
	lines.push('COMMENT\tPREFIX\tMULT');
	const basempfxKeys = Object.keys(degreesMap).map(d => +d).sort((a,b) => a-b);
	for (const key of basempfxKeys.filter(d => d < 0 && Math.ceil(d) === Math.floor(d))) {
		const item = degreesMap[key];
		const nameLS = ls.format(item['format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASEMPFX\t' + name + '\t' + key);
	}
	lines.push('BASEMPFX\t\t1');
	for (const key of basempfxKeys.filter(d => d > 1 && Math.ceil(d) === Math.floor(d))) {
		const item = degreesMap[key];
		const nameLS = ls.format(item['format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASEMPFX\t' + name + '\t' + key);
	}
	lines.push('');
	lines.push('');

	lines.push('COMMENT\tSUFFIX TABLE FOR UNIT MULTIPLICITY');
	lines.push('');
	lines.push('COMMENT\tSUFFIX\tMULT');
	const basemsfxKeys = Object.keys(degreesMap).filter(d => degreesMap[d]['alt-format']).map(d => +d).sort((a,b) => a-b);
	for (const key of basemsfxKeys.filter(d => d < 0 && Math.ceil(d) === Math.floor(d))) {
		const item = degreesMap[key];
		const nameLS = ls.format(item['alt-format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASEMSFX\t' + name + '\t' + key);
	}
	lines.push('BASEMSFX\t\t1');
	for (const key of basemsfxKeys.filter(d => d > 1 && Math.ceil(d) === Math.floor(d))) {
		const item = degreesMap[key];
		const nameLS = ls.format(item['alt-format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASEMSFX\t' + name + '\t' + key);
	}
	lines.push('');
	lines.push('');

	lines.push('COMMENT\tPREFIX TABLE FOR BASE 10 EXPONENTS');
	lines.push('');
	lines.push('COMMENT\tPREFIX\tSYMB\tEXP');
	const base10pfxKeys = Object.keys(prefixesMap).filter(p => p.startsWith('10^')).map(d => +d.substring(3)).sort((a,b) => a-b);
	for (const key of base10pfxKeys.filter(d => d < 0)) {
		const item = prefixesMap['10^' + key];
		const nameLS = ls.format(item['format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASE10PFX\t' + name + '\t' + item['symbol'] + '\t' + key);
	}
	lines.push('BASE10PFX\t\t\t0');
	for (const key of base10pfxKeys.filter(d => d > 0)) {
		const item = prefixesMap['10^' + key];
		const nameLS = ls.format(item['format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASE10PFX\t' + name + '\t' + item['symbol'] + '\t' + key);
	}
	lines.push('');
	lines.push('');

	lines.push('COMMENT\tPREFIX TABLE FOR BASE 2 EXPONENTS');
	lines.push('');
	lines.push('COMMENT\tPREFIX\tSYMB\tEXP');
	const base2pfxKeys = Object.keys(prefixesMap).filter(p => p.startsWith('2^')).map(d => +d.substring(2)).sort((a,b) => a-b);
	for (const key of base2pfxKeys.filter(d => d < 0)) {
		const item = prefixesMap['2^' + key];
		const nameLS = ls.format(item['format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASE2PFX\t' + name + '\t' + item['symbol'] + '\t' + key);
	}
	lines.push('BASE2PFX\t\t\t0');
	for (const key of base2pfxKeys.filter(d => d > 0)) {
		const item = prefixesMap['2^' + key];
		const nameLS = ls.format(item['format'], ' ');
		const name = ls.get(nameLS, 'en', '*').trim();
		lines.push('BASE2PFX\t' + name + '\t' + item['symbol'] + '\t' + key);
	}
	lines.push('');
	lines.push('');

	buildUnitTypes(lines, 'MEASUREMENTS WITH DIMENSIONS DEFINED BY THE S.I. SYSTEM', t => t.match(/^t[0-9]{0,3}$/));
	buildUnitTypes(lines, 'MEASUREMENTS WITH NON-S.I. DIMENSIONS', t => !t.match(/^t[0-9]{0,3}$/));

	buildUnits(lines, 'S.I. BASE UNITS AND NAMED DERIVED UNITS', u => u.match(/^(u[0-4][0-9]|u[0-9]?)$/), false);
	buildUnits(lines, 'NON-S.I. BASE UNITS AND NAMED DERIVED UNITS INCLUDED FOR COMPLETENESS', u => u.match(/^u[5-9][0-9]$/), false);

	buildUnits(lines, 'NON-S.I. UNITS APPROVED FOR USE WITH THE S.I. SYSTEM', u => u.match(/^u1[01][0-9]$/), true);
	buildUnits(lines, 'NON-S.I. UNITS NOT FORMALLY ADOPTED BY THE CGPM', u => u.match(/^u1[23][0-9]$/), true);
	buildUnits(lines, 'NON-S.I. UNITS WITH EXPERIMENTALLY-DETERMINED VALUES APPROVED FOR USE WITH THE S.I. SYSTEM', u => u.match(/^u1[45][0-9]$/), true);
	buildUnits(lines, 'NON-S.I. UNITS APPROVED BUT DISCOURAGED FOR USE WITH THE S.I. SYSTEM', u => u.match(/^u1[6-9][0-9]$/), true);

	buildUnits(lines, 'NON-S.I. UNITS OF LENGTH', u => u.match(/^u2[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF AREA', u => u.match(/^u3[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF VOLUME', u => u.match(/^u4[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF VELOCITY AND ACCELERATION', u => u.match(/^u5[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF MASS', u => u.match(/^u6[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF FORCE AND WEIGHT', u => u.match(/^u7[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF TIME', u => u.match(/^u8[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF TEMPERATURE', u => u.match(/^u9[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF ANGLE', u => u.match(/^u10[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF ENERGY AND POWER', u => u.match(/^u11[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF PRESSURE', u => u.match(/^u12[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF FREQUENCY', u => u.match(/^u13[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF VOLTAGE', u => u.match(/^u14[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF CURRENT', u => u.match(/^u15[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF INFORMATION', u => u.match(/^u16[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF PAPER', u => u.match(/^u17[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. UNITS OF HARDNESS', u => u.match(/^u18[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. MISCELLANEOUS UNITS', u => u.match(/^u19[0-9]{2}$/), true);
	buildUnits(lines, 'NON-S.I. DIMENSIONLESS UNITS', u => u.startsWith('u') && !u.match(/^(u1[0-9]{3}|u[0-9]{0,3})$/), true);

	buildUnits(lines, 'PLANCK UNITS', u => u.startsWith('p'), true);
	buildUnits(lines, 'AMA MEDICAL UNITS', u => u.startsWith('m'), true);

	buildUnits(lines, 'VISCOSITY CUPS', u => u.match(/^n1[0-9]{2}$/), 'n');
	buildUnits(lines, 'SHOE SIZES', u => u.match(/^n2[0-9]{2}$/), true);
	buildUnits(lines, 'MISCELLANEOUS NON-INVERTIBLE UNITS', u => u.startsWith('n') && !u.match(/^n[12][0-9]{2}$/), 'n');

	buildUnits(lines, 'DEPENDENT UNITS - DEPEND ON A SECOND VALUE IN ANOTHER UNIT', u => u.startsWith('d'), 'd');
	buildUnits(lines, 'COLOR CODES', u => u.startsWith('k'), 'k');

	buildUnits(lines, 'SPECIAL UNITS - THE RULES FOR CONVERTING THESE HAVE TO BE BUILT INTO THE MULTICONVERT PROGRAM ITSELF!', u => u.match(/^z[0-9]{0,3}$/), 'z');
	buildUnits(lines, 'SPECIAL UNITS FOR TIME ZONES', u => u.startsWith('z') && !u.match(/^z[0-9]{0,3}$/), 'z');

	buildInclude(lines, 'i68', 'derived units that should always be listed regardless of whether they appear in any installation default', false);

	return lines;
}

function buildDefaultsPHP() {
	const lines = headerLines();
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const ids = Object.keys(includeMap).filter(i => (i !== 'i68')).sort(collator.compare);
	for (const id of ids) buildInclude(lines, id, null, true);
	return lines;
}

function buildElementsPHP() {
	const lines = headerLines();
	const keys = Object.keys(elementsMap).sort((a,b) => a-b);
	lines.push('COMMENT     atomic number\tsymbol\tname\tlatin name');
	for (const key of keys) {
		const item = elementsMap[key];
		const symb = item['symbol'] || '';
		const ename = ls.get(item['name'], 'en', '*');
		const lname = ls.get(item['name'], 'la', '*');
		const fields = ['ELEMENTNAME ' + key, symb, ename];
		if (ename !== lname) fields.push(lname);
		lines.push(fields.join('\t'));
	}
	lines.push('');
	lines.push('COMMENT     atomic number\tmass\tmelting point\tboiling point\telectronegativity\telectron affinity');
	for (const key of keys) {
		const props = elementsMap[key]['properties'];
		if (!props) continue;
		const ta = Object.keys(props);
		if (!ta.length) continue;
		const fields = ['ELEMENTINFO ' + key];
		for (const t of ta) {
			const v = props[t]['value'];
			const u = props[t]['unit'];
			fields.push([t,v,u].join(' '));
		}
		lines.push(fields.join('\t'));
	}
	lines.push('');
	return lines;
}

function buildSolversPHP() {
	const lines = headerLines();
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const ids = Object.keys(solversMap).sort(collator.compare);
	for (const id of ids) buildSolver(lines, id);
	return lines;
}

function buildMC5Dir(dir) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir);
	fs.writeFileSync(path.join(dir, 'main.php'), buildMainPHP().join('\n'));
	console.log('Wrote main.php');
	fs.writeFileSync(path.join(dir, 'defaults.php'), buildDefaultsPHP().join('\n'));
	console.log('Wrote defaults.php');
	fs.writeFileSync(path.join(dir, 'elements.php'), buildElementsPHP().join('\n'));
	console.log('Wrote elements.php');
	fs.writeFileSync(path.join(dir, 'solvers.php'), buildSolversPHP().join('\n'));
	console.log('Wrote solvers.php');
}

function summarize() {
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const missingTypes = Object.keys(unitTypeMap).filter(t => !builtUnitTypes[t]).sort(collator.compare);
	if (missingTypes.length) {
		console.log();
		console.log('The following unit types could not be backported:');
		for (const t of missingTypes) console.log(t + '\t' + ls.get(unitTypeMap[t]['name'], 'en', '*'));
	}
	const missingUnits = Object.keys(unitMap).filter(u => !builtUnits[u]).sort(collator.compare);
	if (missingUnits.length) {
		console.log();
		console.log('The following units could not be backported:');
		for (const u of missingUnits) console.log(u + '\t' + ls.get(unitMap[u]['name'], 'en', '*'));
	}
	const missingIncludeUnitTypes = Object.keys(builtIncludeUnitTypes).filter(t => !builtIncludeUnitTypes[t]).sort(collator.compare);
	const missingIncludeUnits = Object.keys(builtIncludeUnits).filter(u => !builtIncludeUnits[u]).sort(collator.compare);
	if (missingIncludeUnitTypes.length || missingIncludeUnits.length) {
		console.log();
		console.log('The following items could not be included in defaults:');
		for (const t of missingIncludeUnitTypes) console.log(t + '\t' + ls.get(unitTypeMap[t]['name'], 'en', '*'));
		for (const u of missingIncludeUnits) console.log(u + '\t' + ls.get(unitMapAll[u]['name'], 'en', '*'));
	}
	const missingSolvers = Object.keys(solversMap).filter(s => !builtSolvers[s]).sort(collator.compare);
	if (missingSolvers.length) {
		console.log();
		console.log('The following solvers could not be backported:');
		for (const s of missingSolvers) console.log(s + '\t' + ls.get(solversMap[s]['name'], 'en', '*'));
	}
}

// WRITE DATA FILES

buildMC5Dir('mc5');
summarize();
