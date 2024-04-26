#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// FILE SYSTEM UTILITIES

function listFiles(paths, parent) {
	if (fs.statSync(parent).isDirectory()) {
		for (const child of fs.readdirSync(parent)) {
			if (!child.startsWith('.')) {
				listFiles(paths, path.join(parent, child));
			}
		}
	} else {
		paths.push(parent);
	}
}

function findFiles(prefix) {
	foundFiles = [];
	const ok = new RegExp('^' + prefix.replace(/\P{L}/gu, '[-._]') + '([-._]|$)', 'iu');
	for (const child of fs.readdirSync('.')) {
		if (ok.test(child)) {
			listFiles(foundFiles, child);
		}
	}
	return foundFiles;
}

// LOGGING AND VALIDATION UTILITIES

let totalErrorCount = 0;
let totalWarningCount = 0;
let localErrorCount = 0;
let localWarningCount = 0;

function error(context, message) {
	console.log('ERROR: ' + context + ': ' + message);
	totalErrorCount++;
	localErrorCount++;
}

function warning(context, message) {
	console.log('WARNING: ' + context + ': ' + message);
	totalWarningCount++;
	localWarningCount++;
}

function validateStart() {
	localErrorCount = 0;
	localWarningCount = 0;
}

function validateKeys(context, object, required, optional) {
	if (!(object && typeof object === 'object')) {
		error(context, 'value must be a non-null object');
		return;
	}
	const keys = Object.keys(object);
	for (const key of required) {
		if (keys.indexOf(key) < 0) {
			error(context, 'value must contain required key "' + key + '"');
		}
	}
	for (const key of keys) {
		if (required.indexOf(key) < 0 && optional.indexOf(key) < 0) {
			warning(context, 'value contains unknown key "' + key + '"');
		}
	}
}

function validateString(context, key, value) {
	if (!(value && typeof value === 'string')) {
		error(context, 'value for "' + key + '" must be a non-empty string');
	}
}

function validateLS(context, key, object, requiredSubstring) {
	if (!(object && typeof object === 'object')) {
		error(context, 'value for "' + key + '" must be a non-null object');
		return;
	}
	const keys = Object.keys(object);
	if (keys.indexOf('en') < 0) {
		error(context, 'value for "' + key + '" must contain required key "en"');
	}
	for (const lang of keys) {
		const value = object[lang];
		if (!value) {
			error(context, 'value for "' + key + '", language "' + lang + '", must be a non-empty string or non-null object');
		} else if (typeof value === 'string') {
			if (requiredSubstring && value.indexOf(requiredSubstring) < 0) {
				error(context, 'value for "' + key + '", language "' + lang + '", must contain required substring "' + requiredSubstring + '"');
			}
		} else if (typeof value === 'object') {
			const subkeys = Object.keys(value);
			if (subkeys.indexOf('*') < 0) {
				error(context, 'value for "' + key + '", language "' + lang + '", must contain required key "*"');
			}
			for (const number of subkeys) {
				if (number !== '*' && Math.ceil(number) !== Math.floor(number)) {
					error(context, 'value for "' + key + '", language "' + lang + '", contains key "' + number + '" that is not an integer or "*"');
				}
				const subvalue = value[number];
				if (!(subvalue && typeof subvalue === 'string')) {
					error(context, 'value for "' + key + '", language "' + lang + '", number "' + number + '", must be a non-empty string');
				} else if (requiredSubstring && subvalue.indexOf(requiredSubstring) < 0) {
					error(context, 'value for "' + key + '", language "' + lang + '", number "' + number + '", must contain required substring "' + requiredSubstring + '"');
				}
			}
		} else {
			error(context, 'value for "' + key + '", language "' + lang + '", must be a non-empty string or non-null object');
		}
	}
}

function validateDimension(context, key, object, dimensionsMap) {
	if (!(object && typeof object === 'object')) {
		error(context, 'value for "' + key + '" must be a non-null object');
		return;
	}
	const keys = Object.keys(object);
	for (const dim of keys) {
		if (!dimensionsMap[dim]) {
			error(context, 'value for "' + key + '" contains undefined dimension "' + dim + '"');
		}
		if (Math.ceil(object[dim] * 2) !== Math.floor(object[dim] * 2)) {
			error(context, 'value for "' + key + '", dimension "' + dim + '", must be a multiple of 0.5 but is ' + object[dim]);
		}
	}
}

function putIfOK(context, map, key, value) {
	if (!localErrorCount) {
		if (map[key]) {
			error(context, 'duplicate key "' + key + '"');
		} else {
			map[key] = value;
		}
	}
}

// SIMPLE REVERSIBLE MATHEMATICAL PROCEDURE NOTATION

function srmpCodeGenValid(s) {
	s = s.replaceAll(/([A-Za-z])|([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+))/g, '');
	return !s.replaceAll(/\s/g, '');
}

function srmpCodeGenParse(opcode, s) {
	const operations = [];
	for (const m of s.matchAll(/([A-Za-z])|([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+))/g)) {
		if (m[1]) opcode = m[1];
		if (m[2]) operations.push([opcode, m[2]]);
	}
	return operations;
}

function srmpCodeGenOperation(kernel, opcode, operand) {
	switch (opcode) {
		case 'A': case 'a': case '!S': case '!s': return '(' + kernel + ')+(' + operand + ')';
		case 'S': case 's': case '!A': case '!a': return '(' + kernel + ')-(' + operand + ')';
		case 'Z': case 'z': case '!Z': case '!z': return '(' + operand + ')-(' + kernel + ')';
		case 'M': case 'm': case '!D': case '!d': return '(' + kernel + ')*(' + operand + ')';
		case 'D': case 'd': case '!M': case '!m': return '(' + kernel + ')/(' + operand + ')';
		case 'G': case 'g': case '!G': case '!g': return '(' + operand + ')/(' + kernel + ')';
		case 'C': case 'c': case '!Q': case '!q': return '(' + kernel + ')*Math.PI/(' + operand + ')';
		case 'Q': case 'q': case '!C': case '!c': return '(' + kernel + ')*(' + operand + ')/Math.PI';
		case 'P': case 'p': case '!R': case '!r': return 'Math.pow(' + kernel + ',' + operand + ')';
		case 'X': case 'x': case '!L': case '!l': return 'Math.pow(' + operand + ',' + kernel + ')';
		case 'R': case 'r': case '!P': case '!p':
			if (operand.eq ? operand.eq(2) : operand == 2) return 'Math.sqrt(' + kernel + ')';
			if (operand.eq ? operand.eq(3) : operand == 3) return 'Math.cbrt(' + kernel + ')';
			return 'Math.pow(' + kernel + ',1/(' + operand + '))';
		case 'L': case 'l': case '!X': case '!x':
			if (operand.eq ? operand.eq(2) : operand == 2) return 'Math.log2(' + kernel + ')';
			if (operand.eq ? operand.eq(10) : operand == 10) return 'Math.log10(' + kernel + ')';
			return 'Math.log(' + kernel + ')/Math.log(' + operand + ')';
		case 'E': case 'e': case '!N': case '!n':
			if (operand.eq ? operand.eq(0) : operand == 0) return 'Math.exp(' + kernel + ')';
			if (operand.eq ? operand.eq(1) : operand == 1) return 'Math.expm1(' + kernel + ')';
			return 'Math.exp(' + kernel + ')-(' + operand + ')';
		case 'N': case 'n': case '!E': case '!e':
			if (operand.eq ? operand.eq(0) : operand == 0) return 'Math.log(' + kernel + ')';
			if (operand.eq ? operand.eq(1) : operand == 1) return 'Math.log1p(' + kernel + ')';
			return 'Math.log((' + kernel + ')+(' + operand + '))';
		case 'V': case 'v': case '!F': case '!f':
			operand = operand.neg ? operand.neg() : -operand;
			// fallthrough;
		case 'F': case 'f': case '!V': case '!v':
			if (operand.eq ? operand.eq( +1) : operand ==  +1) return 'Math.sin(' + kernel + ')';
			if (operand.eq ? operand.eq( +2) : operand ==  +2) return 'Math.cos(' + kernel + ')';
			if (operand.eq ? operand.eq( +3) : operand ==  +3) return 'Math.tan(' + kernel + ')';
			if (operand.eq ? operand.eq( +4) : operand ==  +4) return '1/Math.tan(' + kernel + ')';
			if (operand.eq ? operand.eq( +5) : operand ==  +5) return '1/Math.cos(' + kernel + ')';
			if (operand.eq ? operand.eq( +6) : operand ==  +6) return '1/Math.sin(' + kernel + ')';
			if (operand.eq ? operand.eq( +7) : operand ==  +7) return 'Math.sinh(' + kernel + ')';
			if (operand.eq ? operand.eq( +8) : operand ==  +8) return 'Math.cosh(' + kernel + ')';
			if (operand.eq ? operand.eq( +9) : operand ==  +9) return 'Math.tanh(' + kernel + ')';
			if (operand.eq ? operand.eq(+10) : operand == +10) return '1/Math.tanh(' + kernel + ')';
			if (operand.eq ? operand.eq(+11) : operand == +11) return '1/Math.cosh(' + kernel + ')';
			if (operand.eq ? operand.eq(+12) : operand == +12) return '1/Math.sinh(' + kernel + ')';
			if (operand.eq ? operand.eq( -1) : operand ==  -1) return 'Math.asin(' + kernel + ')';
			if (operand.eq ? operand.eq( -2) : operand ==  -2) return 'Math.acos(' + kernel + ')';
			if (operand.eq ? operand.eq( -3) : operand ==  -3) return 'Math.atan(' + kernel + ')';
			if (operand.eq ? operand.eq( -4) : operand ==  -4) return 'Math.PI/2-Math.atan(' + kernel + ')';
			if (operand.eq ? operand.eq( -5) : operand ==  -5) return 'Math.acos(1/(' + kernel + '))';
			if (operand.eq ? operand.eq( -6) : operand ==  -6) return 'Math.asin(1/(' + kernel + '))';
			if (operand.eq ? operand.eq( -7) : operand ==  -7) return 'Math.asinh(' + kernel + ')';
			if (operand.eq ? operand.eq( -8) : operand ==  -8) return 'Math.acosh(' + kernel + ')';
			if (operand.eq ? operand.eq( -9) : operand ==  -9) return 'Math.atanh(' + kernel + ')';
			if (operand.eq ? operand.eq(-10) : operand == -10) return 'Math.atanh(1/(' + kernel + '))';
			if (operand.eq ? operand.eq(-11) : operand == -11) return 'Math.acosh(1/(' + kernel + '))';
			if (operand.eq ? operand.eq(-12) : operand == -12) return 'Math.asinh(1/(' + kernel + '))';
			return kernel;
		default: return kernel;
	}
}

function srmpCodeGenForward(s) {
	let kernel = 'a';
	const operations = srmpCodeGenParse('M', s);
	for (let i = 0; i < operations.length; i++) {
		const [opcode, operand] = operations[i];
		kernel = srmpCodeGenOperation(kernel, opcode, operand);
	}
	return 'function(a){return(' + kernel + ');}';
}

function srmpCodeGenReverse(s) {
	let kernel = 'a';
	const operations = srmpCodeGenParse('M', s);
	for (let i = operations.length - 1; i >= 0; i--) {
		const [opcode, operand] = operations[i];
		kernel = srmpCodeGenOperation(kernel, '!' + opcode, operand);
	}
	return 'function(a){return(' + kernel + ');}';
}

// READ AND VALIDATE

const degreesMap = {};
for (const file of findFiles('degrees')) {
	const degrees = JSON.parse(fs.readFileSync(file, 'utf8'));
	const context = file;
	for (const item of degrees) {
		validateStart();
		validateKeys(context, item, ['degree', 'format'], []);
		if (Math.ceil(item['degree'] * 2) !== Math.floor(item['degree'] * 2)) {
			error(context, 'value for "degree" must be a multiple of 0.5 but is ' + item['degree']);
		}
		validateLS(context, 'format', item['format'], '@');
		putIfOK(context, degreesMap, item['degree'], item);
	}
}

const dimensionsMap = {};
for (const file of findFiles('dimensions')) {
	const dimensions = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const id of Object.keys(dimensions)) {
		const context = file + ': dimension "' + id + '"';
		const item = dimensions[id];
		validateStart();
		validateKeys(context, item, ['legacy-id', 'name'], ['symbol', 'composable']);
		validateString(context, 'legacy-id', item['legacy-id']);
		if (item['symbol'] !== undefined) {
			validateString(context, 'symbol', item['symbol']);
		}
		if (item['composable'] === undefined) {
			item['composable'] = true;
		} else if (typeof item['composable'] !== 'boolean') {
			error(context, 'value for "composable" must be a boolean');
		}
		validateLS(context, 'name', item['name']);
		putIfOK(context, dimensionsMap, id, item);
	}
}

const prefixesMap = {};
for (const file of findFiles('prefixes')) {
	const prefixes = JSON.parse(fs.readFileSync(file, 'utf8'));
	const context = file;
	for (const item of prefixes) {
		validateStart();
		validateKeys(context, item, ['base', 'exponent', 'symbol', 'format'], []);
		if (Math.ceil(item['base']) !== Math.floor(item['base']) || item['base'] < 2) {
			error(context, 'value for "base" must be an integer >= 2 but is ' + item['base']);
		}
		if (Math.ceil(item['exponent']) !== Math.floor(item['exponent'])) {
			error(context, 'value for "exponent" must be an integer but is ' + item['exponent']);
		}
		validateString(context, 'symbol', item['symbol']);
		validateLS(context, 'format', item['format'], '@');
		putIfOK(context, prefixesMap, item['base'] + '^' + item['exponent'], item);
	}
}

const unitTypeMap = {};
for (const file of findFiles('unit-types')) {
	const unitTypes = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const id of Object.keys(unitTypes)) {
		const context = file + ': unit type "' + id + '"';
		const item = unitTypes[id];
		validateStart();
		if (!id.match(/^t[0-9]+$/)) {
			warning(context, 'identifier does not follow recommended pattern of t[0-9]+');
		}
		validateKeys(context, item, ['name'], ['icon', 'dimension']);
		if (item['icon'] !== undefined) {
			validateString(context, 'icon', item['icon']);
			if (!fs.existsSync(path.join('typeicons', item['icon']))) {
				// warning(context, 'value for "icon" refers to non-existent file "' + item['icon'] + '"');
			}
		}
		validateLS(context, 'name', item['name']);
		if (item['dimension'] !== undefined) {
			validateDimension(context, 'dimension', item['dimension'], dimensionsMap);
		}
		putIfOK(context, unitTypeMap, id, item);
	}
}

const unitMap = {};
for (const file of findFiles('units')) {
	const units = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const id of Object.keys(units)) {
		const context = file + ': unit "' + id + '"';
		const item = units[id];
		validateStart();
		if (!id.match(/^[a-z][0-9]+$/)) {
			warning(context, 'identifier does not follow recommended pattern of [a-z][0-9]+');
		} else if (id.startsWith('c')) {
			warning(context, 'identifiers starting with "c" are reserved for units of currency');
		} else if (id.startsWith('i')) {
			warning(context, 'identifiers starting with "i" are reserved for includes');
		} else if (id.startsWith('t')) {
			warning(context, 'identifiers starting with "t" are reserved for unit types');
		}
		if (item['datatype'] === undefined || item['datatype'] === 'num') {
			validateKeys(context, item, ['name'], ['symbol', 'datatype', 'multiplier', 'divisor', 'instructions', 'parser', 'formatter', 'dimension']);
		} else if (item['datatype'] === 'text' || item['datatype'] === 'tuple') {
			validateKeys(context, item, ['name', 'datatype', 'parser', 'formatter'], ['symbol', 'dimension']);
		} else if (item['datatype'] === 'dep') {
			validateKeys(context, item, ['name', 'datatype', 'dep-name', 'parser', 'formatter'], ['symbol', 'dep-dimension', 'dimension']);
		} else if (item['datatype'] === 'cc') {
			validateKeys(context, item, ['name', 'datatype', 'cc-map', 'parser', 'formatter'], ['symbol', 'dimension']);
		} else {
			error(context, 'value for "datatype" must be "num", "text", "tuple", "dep", or "cc" but is "' + item['datatype'] + '"');
		}
		if (item['symbol'] !== undefined) {
			validateString(context, 'symbol', item['symbol']);
		}
		validateLS(context, 'name', item['name']);
		if (item['dep-name'] !== undefined) {
			validateLS(context, 'dep-name', item['dep-name']);
		}
		if (item['dep-dimension'] !== undefined) {
			validateDimension(context, 'dep-dimension', item['dep-dimension'], dimensionsMap);
		}
		if (item['cc-map'] !== undefined) {
			const ccMap = item['cc-map'];
			if (ccMap && typeof ccMap === 'object' && ccMap.length) {
				for (let i = 0; i < ccMap.length; i++) {
					const cc = ccMap[i];
					if (cc && typeof cc === 'object') {
						for (const key of Object.keys(cc)) {
							const ctx = context + ': color code map entry "' + key + '"';
							if (Math.floor(key) !== Math.ceil(key)) {
								error(ctx, 'key must be an integer');
							}
							const value = cc[key];
							if (value && typeof value === 'object') {
								validateKeys(ctx, value, ['color', 'name'], []);
								validateString(ctx, 'color', value['color']);
								validateLS(ctx, 'name', value['name']);
							} else {
								error(ctx, 'value must be a non-null object');
							}
						}
					} else {
						error(context, 'value for "cc-map", value at index ' + i + ' must be a non-null object');
					}
				}
			} else {
				error(context, 'value for "cc-map" must be a non-empty array of non-null objects');
			}
		}
		if (item['multiplier'] !== undefined || item['divisor'] !== undefined) {
			if (item['instructions'] !== undefined) {
				error(context, 'must not contain both "multiplier" and/or "divisor" and "instructions"');
			}
			if (item['parser'] !== undefined || item['formatter'] !== undefined) {
				error(context, 'must not contain both "multiplier" and/or "divisor" and "parser" and/or "formatter"');
			}
			const validateNumber = function(key) {
				if (item[key] !== undefined) {
					if (typeof item[key] === 'number') {
						if (Math.ceil(item[key]) !== Math.floor(item[key])) {
							warning(context, 'value for "' + key + '" is a non-integer "' + item[key] + '" which may introduce rounding errors');
						} else if (Math.abs(item[key]) > 9007199254740991) {
							warning(context, 'value for "' + key + '" is a large number "' + item[key] + '" which may introduce rounding errors');
						}
					} else if (typeof item[key] === 'string') {
						if (!Number.isFinite(+item[key])) {
							error(context, 'value for "' + key + '" must be a string in number format but is "' + item[key] + '"');
						}
					} else {
						error(context, 'value for "' + key + '" must be a number or string in number format');
					}
				}
			};
			validateNumber('multiplier');
			validateNumber('divisor');
		}
		if (item['instructions'] !== undefined) {
			if (item['parser'] !== undefined || item['formatter'] !== undefined) {
				error(context, 'must not contain both "instructions" and "parser" and/or "formatter"');
			}
			if (srmpCodeGenValid(item['instructions'])) {
				try {
					const forwardCode = srmpCodeGenForward(item['instructions']);
					const reverseCode = srmpCodeGenReverse(item['instructions']);
					const forwardFn = new vm.Script('(' + forwardCode + ')').runInNewContext();
					const reverseFn = new vm.Script('(' + reverseCode + ')').runInNewContext();
					if (typeof forwardFn === 'function' && typeof reverseFn === 'function') {
						item['instructions.forward.source'] = forwardCode;
						item['instructions.reverse.source'] = reverseCode;
						item['instructions.forward.compiled'] = forwardFn;
						item['instructions.reverse.compiled'] = reverseFn;
					} else {
						error(context, 'value for "instructions" failed to compile');
					}
				} catch (e) {
					error(context, 'value for "instructions" failed to compile');
				}
			} else {
				error(context, 'value for "instructions" must be a valid SRMP program but is "' + item['instructions'] + '"');
			}
		}
		if (item['parser'] !== undefined || item['formatter'] !== undefined) {
			if (item['parser'] === undefined || item['formatter'] === undefined) {
				error(context, 'must contain both "parser" and "formatter"');
			}
			const validateScript = function(key) {
				if (item[key] !== undefined) {
					let script = item[key];
					if (script.join) script = script.join(' ');
					if (script && typeof script === 'string') {
						try {
							const fn = new vm.Script('(' + script + ')').runInNewContext();
							if (typeof fn === 'function') {
								item[key + '.compiled'] = fn;
							} else {
								error(context, 'value for "' + key + '" must compile to a JavaScript function');
							}
						} catch (e) {
							error(context, 'value for "' + key + '" must compile to a JavaScript function');
						}
					} else {
						error(context, 'value for "' + key + '" must be a non-empty string or array of strings');
					}
				}
			};
			validateScript('parser');
			validateScript('formatter');
		}
		if (item['dimension'] !== undefined) {
			validateDimension(context, 'dimension', item['dimension'], dimensionsMap);
		}
		putIfOK(context, unitMap, id, item);
	}
}

// DIMENSIONAL ANALYSIS UTILITIES

function dempty() {
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i]) {
			for (const dim of Object.keys(arguments[i])) {
				if (+arguments[i][dim]) {
					return false;
				}
			}
		}
	}
	return true;
}

function dcc() {
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i]) {
			for (const dim of Object.keys(arguments[i])) {
				if (dimensionsMap[dim] && dimensionsMap[dim]['composable'] === false) {
					return false;
				}
			}
		}
	}
	return true;
}

function dmul() {
	const r = {};
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i]) {
			for (const dim of Object.keys(arguments[i])) {
				const deg = +arguments[i][dim];
				if (deg) {
					if (r[dim]) {
						if (!(r[dim] += deg)) delete r[dim];
					} else {
						r[dim] = deg;
					}
				}
			}
		}
	}
	return r;
}

function ddiv() {
	const r = {};
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i]) {
			for (const dim of Object.keys(arguments[i])) {
				const deg = i ? -arguments[i][dim] : +arguments[i][dim];
				if (deg) {
					if (r[dim]) {
						if (!(r[dim] += deg)) delete r[dim];
					} else {
						r[dim] = deg;
					}
				}
			}
		}
	}
	return r;
}

function dpow(d, e) {
	const r = {};
	if (d) {
		for (const dim of Object.keys(d)) {
			const deg = d[dim] * e;
			if (deg) r[dim] = deg;
		}
	}
	return r;
}

function deq(d1, d2) {
	return dempty(ddiv(d1, d2));
}

function dcomp(d1, d2) {
	return dempty(dmul(d1, d2));
}

// UNIT COMPOSITION UTILITIES

function uexp(u, b, e) {
	if (e.eq ? e.eq(0) : e == 0) return u;
	if (b.eq ? b.eq(1) : b == 1) return u;
	// stub
}

function umul() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	// stub
}

function udiv() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	// stub
}

function upow(u, e) {
	if (e.eq ? e.eq(0) : e == 0) return null;
	if (e.eq ? e.eq(1) : e == 1) return u;
	// stub
}

function ufrac(u, mo, me, mp) {
	// stub
}

function uhier() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	// stub
}

function uparse_ws(s) {
	return s.replace(/^\s+|\s+$/g, '');
}

function uparse_unit(s) {
	s = uparse_ws(s);
	if (s.startsWith('(')) {
		s = uparse_ws(s.substring(1));
		const p = uparse_div(s);
		s = uparse_ws(p.s);
		if (s.startsWith(')')) {
			s = uparse_ws(s.substring(1));
			return {'u': p.u, 's': s};
		} else {
			throw new Error('Expected ) but found "' + s + '"');
		}
	} else {
		const m = s.match(/^[A-Za-z][A-Za-z0-9]*/);
		if (!m) throw new Error('Expected unit ID but found "' + s + '"');
		const u = unitMap[m[0]];
		if (!u) throw new Error('There is no unit ID ' + m[0]);
		s = uparse_ws(s.substring(m[0].length));
		return {'u': u, 's': s};
	}
}

function uparse_exp(s) {
	const p = uparse_unit(s);
	const ch = (s = uparse_ws(p.s)).substring(0,1);
	if (ch === '_' || ch === '.' || ch === ':') {
		s = uparse_ws(s.substring(1));
		const m = s.match(/^[+-]?[0-9]+/);
		if (!m) throw new Error('Expected integer but found "' + s + '"');
		const u = uexp(p.u, ((ch === '_') ? 10 : 2), +m[0]);
		if (!u) throw new Error('Cannot exponentiate the unit "' + p.u.name.en['*'] + '"');
		s = uparse_ws(s.substring(m[0].length));
		return {'u': u, 's': s};
	} else {
		return p;
	}
}

function uparse_pow(s) {
	const p = uparse_exp(s);
	const ch = (s = uparse_ws(p.s)).substring(0,1);
	if (ch === '^') {
		s = uparse_ws(s.substring(1));
		const m = s.match(/^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)/);
		if (!m) throw new Error('Expected number but found "' + s + '"');
		const u = upow(p.u, +m[0]);
		if (!u) throw new Error('Cannot exponentiate the unit "' + p.u.name.en['*'] + '"');
		s = uparse_ws(s.substring(m[0].length));
		return {'u': u, 's': s};
	} else {
		return p;
	}
}

function uparse_mul(s) {
	let p = uparse_pow(s);
	const pp = [p.u];
	let ch = (s = uparse_ws(p.s)).substring(0,1);
	while (ch === '*') {
		s = uparse_ws(s.substring(1));
		p = uparse_pow(s);
		pp.push(p.u);
		ch = (s = uparse_ws(p.s)).substring(0,1);
	}
	const u = umul.apply(null, pp);
	if (u) return {'u': u, 's': s};
	throw new Error('Cannot multiply the units: ' + pp.map(u => u.name.en['*']).join(', '));
}

function uparse_div(s) {
	let p = uparse_mul(s);
	const pp = [p.u];
	let ch = (s = uparse_ws(p.s)).substring(0,1);
	while (ch === '/') {
		s = uparse_ws(s.substring(1));
		p = uparse_mul(s);
		pp.push(p.u);
		ch = (s = uparse_ws(p.s)).substring(0,1);
	}
	const u = udiv.apply(null, pp);
	if (u) return {'u': u, 's': s};
	throw new Error('Cannot divide the units: ' + pp.map(u => u.name.en['*']).join(', '));
}

function uparse_frac(s) {
	const p = uparse_div(s);
	const ch = (s = uparse_ws(p.s)).substring(0,1);
	if (ch === '%') {
		s = uparse_ws(s.substring(1));
		const m = s.match(/^([0-9]+)(\s*,\s*([0-9]+))?(\s*,\s*([0-9]+))?/);
		if (!m) throw new Error('Expected integer but found "' + s + '"');
		const mo = +m[1] || 1;
		const me = +m[3] || mo;
		const mp = +m[5] || me;
		const u = ufrac(p.u, mo, me, mp);
		if (!u) throw new Error('Cannot fractionalize the unit "' + p.u.name.en['*'] + '"');
		s = uparse_ws(s.substring(m[0].length));
		return {'u': u, 's': s};
	} else {
		return p;
	}
}

function uparse_hier(s) {
	let p = uparse_frac(s);
	const pp = [p.u];
	let ch = (s = uparse_ws(p.s)).substring(0,1);
	while (ch === ',') {
		s = uparse_ws(s.substring(1));
		p = uparse_frac(s);
		pp.push(p.u);
		ch = (s = uparse_ws(p.s)).substring(0,1);
	}
	const u = uhier.apply(null, pp);
	if (u) return {'u': u, 's': s};
	throw new Error('Cannot compose the units: ' + pp.map(u => u.name.en['*']).join(', '));
}

function uparse(s) {
	const p = uparse_hier(s);
	if (!(s = uparse_ws(p.s))) return p.u;
	throw new Error('Expected end of string but found "' + s + '"');
}

// UNIT CONVERSION UTILITIES

function getLS(ls, lang, num) {
	if (typeof ls !== 'object') return ls;
	ls = (lang !== undefined && ls[lang] !== undefined) ? ls[lang] : ls['en'];
	if (typeof ls !== 'object') return ls;
	ls = (num !== undefined && ls[num] !== undefined) ? ls[num] : ls['*'];
	return ls;
}

function mcparse(u, a, depInputs) {
	if (u['multiplier'] !== undefined || u['divisor'] !== undefined) {
		if (u['multiplier'] !== undefined) {
			a = a.mul ? a.mul(u['multiplier']) : (a * u['multiplier']);
		}
		if (u['divisor'] !== undefined) {
			a = a.div ? a.div(u['divisor']) : (a / u['divisor']);
		}
	} else if (u['instructions.forward.compiled'] !== undefined) {
		a = u['instructions.forward.compiled'](a);
	} else if (u['parser.compiled'] !== undefined) {
		if (depInputs && u['dep-name'] && depInputs[getLS(u['dep-name'])] !== undefined) {
			a = u['parser.compiled'](a, depInputs[getLS(u['dep-name'])]);
		} else {
			a = u['parser.compiled'](a);
		}
	}
	return a;
}

function mcformat(u, a, depInputs) {
	if (u['multiplier'] !== undefined || u['divisor'] !== undefined) {
		if (u['divisor'] !== undefined) {
			a = a.mul ? a.mul(u['divisor']) : (a * u['divisor']);
		}
		if (u['multiplier'] !== undefined) {
			a = a.div ? a.div(u['multiplier']) : (a / u['multiplier']);
		}
	} else if (u['instructions.reverse.compiled'] !== undefined) {
		a = u['instructions.reverse.compiled'](a);
	} else if (u['formatter.compiled'] !== undefined) {
		if (depInputs && u['dep-name'] && depInputs[getLS(u['dep-name'])] !== undefined) {
			a = u['formatter.compiled'](a, depInputs[getLS(u['dep-name'])]);
		} else {
			a = u['formatter.compiled'](a);
		}
	}
	return a;
}

function fpequal(a, b, e) {
	if (a === undefined) return (b === undefined);
	if (b === undefined) return (a === undefined);
	if (a === null) return (b === null);
	if (b === null) return (a === null);
	// Equality for Decimal objects
	if (a.eq) return a.eq(b);
	if (b.eq) return b.eq(a);
	// Equality for arrays and objects
	if (typeof a === 'object' && typeof b === 'object') {
		const ak = Object.keys(a).sort();
		const bk = Object.keys(b).sort();
		if (ak.length !== bk.length) return false;
		for (let i = 0; i < ak.length; i++) {
			if (ak[i] !== bk[i]) return false;
			if (!fpequal(a[ak[i]], b[bk[i]], e)) return false;
		}
		return true;
	}
	if (typeof a === 'object' || typeof b === 'object') {
		return false;
	}
	// Equality for primitives
	if (a == b) return true;
	if (e <= 0) return false;
	const norm = Math.min(Math.abs(a) + Math.abs(b), Number.MAX_VALUE);
	// console.log("using epsilon " + Math.max(e * norm, e));
	return Math.abs(a - b) < Math.max(e * norm, e);
}

// VALIDATE AND RUN TESTS

for (const file of findFiles('tests')) {
	const tests = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const item of tests) {
		let context = file;
		let epsilon = 0;
		const inputs = [];
		const outputs = [];
		const depInputs = {};
		validateStart();
		for (const key of Object.keys(item)) {
			const value = item[key];
			if (key === 'name') {
				context += ': ' + value;
			} else if (key === 'epsilon') {
				epsilon = Math.abs(value);
			} else if (key === 'inputs') {
				if (value && typeof value === 'object') {
					for (const k of Object.keys(value)) {
						if (k === 'base') {
							inputs.push([null, value[k]]);
						} else {
							try {
								const u = uparse(k);
								inputs.push([u, value[k]]);
							} catch (e) {
								error(context, 'unit "' + k + '" could not be compiled: ' + e);
							}
						}
					}
				} else {
					error(context, 'value for "inputs" must be a non-null object');
				}
			} else if (key === 'outputs') {
				if (value && typeof value === 'object') {
					for (const k of Object.keys(value)) {
						if (k === 'base') {
							outputs.push([null, value[k]]);
						} else {
							try {
								const u = uparse(k);
								outputs.push([u, value[k]]);
							} catch (e) {
								error(context, 'unit "' + k + '" could not be compiled: ' + e);
							}
						}
					}
				} else {
					error(context, 'value for "outputs" must be a non-null object');
				}
			} else if (key === 'dep-inputs') {
				if (value && typeof value === 'object') {
					for (const k of Object.keys(value)) {
						try {
							const u = uparse(k);
							if (u['dep-name']) {
								depInputs[getLS(u['dep-name'])] = value[k];
							} else {
								error(context, 'unit "' + k + '" should not have a dep-input');
							}
						} catch (e) {
							error(context, 'unit "' + k + '" could not be compiled: ' + e);
						}
					}
				} else {
					error(context, 'value for "dep-inputs" must be a non-null object');
				}
			} else if (key === 'base') {
				inputs.push([null, value]);
				outputs.push([null, value]);
			} else {
				try {
					const u = uparse(key);
					inputs.push([u, value]);
					outputs.push([u, value]);
				} catch (e) {
					error(context, 'unit "' + key + '" could not be compiled: ' + e);
				}
			}
		}
		// console.log("test: " + context);
		if (inputs.length && outputs.length) {
			for (const [iu, iv] of inputs) {
				const inputName = iu ? getLS(iu.name) : 'base units';
				const baseValue = iu ? mcparse(iu, iv, depInputs) : iv;
				for (const [ou, ov] of outputs) {
					const outputName = ou ? getLS(ou.name) : 'base units';
					if (!iu || !ou || deq(iu['dimension'], ou['dimension'])) {
						const v = ou ? mcformat(ou, baseValue, depInputs) : baseValue;
						if (fpequal(v, ov, epsilon)) {
							// console.log('PASS: ' + context + ': ' + iv + ' ' + inputName + ' = ' + ov + ' ' + outputName);
						} else {
							error(context, iv + ' ' + inputName + ' should be ' + ov + ' ' + outputName + ' but test produced ' + v + ' ' + outputName);
						}
					} else if (dcomp(iu['dimension'], ou['dimension'])) {
						const v = mcformat(ou, 1 / baseValue, depInputs);
						if (fpequal(v, ov, epsilon)) {
							// console.log('PASS: ' + context + ': ' + iv + ' ' + inputName + ' = ' + ov + ' ' + outputName);
						} else {
							error(context, iv + ' ' + inputName + ' should be ' + ov + ' ' + outputName + ' but test produced ' + v + ' ' + outputName);
						}
					} else {
						error(context, 'input unit "' + inputName + '" and output unit "' + outputName + '" are not compatible');
					}
				}
			}
		} else {
			error(context, 'test case must have at least one input and at least one output');
		}
	}
}

console.log(totalErrorCount + ' errors');
console.log(totalWarningCount + ' warnings');
