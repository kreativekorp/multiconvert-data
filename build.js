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

// LANGUAGE STRING UTILITIES

function getLS(ls, lang, num) {
	if (typeof ls !== 'object') return ls;
	ls = (lang !== undefined && ls[lang] !== undefined) ? ls[lang] : ls['en'];
	if (typeof ls !== 'object') return ls;
	ls = (num !== undefined && ls[num] !== undefined) ? ls[num] : ls['*'];
	return ls;
}

function formatLSInner(fmt, ls) {
	if (typeof fmt !== 'object') fmt = {'*': fmt};
	if (typeof ls !== 'object') ls = {'*': ls};
	const rls = {};
	for (const k of Object.keys(fmt).concat(Object.keys(ls))) {
		rls[k] = (fmt[k] || fmt['*']).replaceAll('@', ls[k] || ls['*']);
	}
	return rls;
}

function formatLS(fmt, ls) {
	if (typeof fmt !== 'object') fmt = {'en': fmt};
	if (typeof ls !== 'object') ls = {'en': ls};
	const rls = {};
	for (const k of Object.keys(fmt).concat(Object.keys(ls))) {
		if (fmt[k] && ls[k]) rls[k] = formatLSInner(fmt[k], ls[k]);
	}
	return rls;
}

function joinLSInner(delimiter, ls1, ls2) {
	if (!ls1) return ls2;
	if (!ls2) return ls1;
	if (typeof ls1 !== 'object') ls1 = {'*': ls1};
	if (typeof ls2 !== 'object') ls2 = {'*': ls2};
	const rls = {};
	for (const k of Object.keys(ls1).concat(Object.keys(ls2))) {
		rls[k] = (ls1[k] || ls1['*']) + delimiter + (ls2[k] || ls2['*']);
	}
	return rls;
}

function joinLSOuter(delimiter, ls1, ls2) {
	if (!ls1) return ls2;
	if (!ls2) return ls1;
	if (typeof ls1 !== 'object') ls1 = {'en': ls1};
	if (typeof ls2 !== 'object') ls2 = {'en': ls2};
	const rls = {};
	for (const k of Object.keys(ls1).concat(Object.keys(ls2))) {
		if (ls1[k] && ls2[k]) rls[k] = joinLSInner(delimiter, ls1[k], ls2[k]);
	}
	return rls;
}

function joinLS(delimiter, arr) {
	let rls = null;
	for (const ls of arr) {
		rls = joinLSOuter(delimiter, rls, ls);
	}
	return rls;
}

// SIMPLE REVERSIBLE MATHEMATICAL PROCEDURE NOTATION

function srmpCodeGenValid(s) {
	s = s.replaceAll(/([A-Za-z])|([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)(_[+-]?[0-9]+)?)/g, '');
	return !s.replaceAll(/\s/g, '');
}

function srmpCodeGenParse(opcode, s) {
	const operations = [];
	for (const m of s.matchAll(/([A-Za-z])|([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)(_[+-]?[0-9]+)?)/g)) {
		if (m[1]) opcode = m[1];
		if (m[2]) operations.push([opcode, m[2].replaceAll('_', 'e')]);
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

// OTHER UTILITIES

function solverSolutionKeyValid(key) {
	const reg = key.split ? key.split(',') : key;
	if (!reg.length) return false;
	for (let i = 0; i < reg.length; i++) {
		if (reg[i] < 0) return false;
		if (Math.ceil(reg[i]) !== Math.floor(reg[i])) return false;
		if (i > 0 && reg[i] <= reg[i-1]) return false;
	}
	return true;
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

const functionSourceMap = {};
const functionCompiledMap = {};
function parseFunctions(context, functions) {
	if (!(functions && typeof functions === 'object')) {
		error(context, 'value for "functions" must be a non-null object');
		return;
	}
	for (const id of Object.keys(functions)) {
		const ctx = context + ': function "' + id + '"';
		if (!id.match(/^f[0-9]+$/)) {
			warning(ctx, 'identifier does not follow recommended pattern of f[0-9]+');
		}
		let script = functions[id];
		if (script.join) script = script.join('\n');
		if (script && typeof script === 'string') {
			try {
				const fn = new vm.Script('(' + script + ')').runInNewContext(functionCompiledMap);
				if (typeof fn === 'function') {
					if (functionSourceMap[id] || functionCompiledMap[id]) {
						error(ctx, 'duplicate function name');
					} else {
						functionSourceMap[id] = script;
						functionCompiledMap[id] = fn;
					}
				} else {
					error(ctx, 'must compile to a JavaScript function');
				}
			} catch (e) {
				error(ctx, 'must compile to a JavaScript function');
			}
		} else {
			error(ctx, 'must be a non-empty string or array of strings');
		}
	}
}

const unitMap = {};
for (const file of findFiles('units')) {
	const units = JSON.parse(fs.readFileSync(file, 'utf8'));
	if (units['functions'] !== undefined) {
		parseFunctions(file, units['functions']);
		delete units['functions'];
	}
	for (const id of Object.keys(units)) {
		const context = file + ': unit "' + id + '"';
		const item = units[id];
		validateStart();
		if (!id.match(/^[a-z][0-9]+$/)) {
			warning(context, 'identifier does not follow recommended pattern of [a-z][0-9]+');
		} else if (id.startsWith('c')) {
			warning(context, 'identifiers starting with "c" are reserved for units of currency');
		} else if (id.startsWith('f')) {
			warning(context, 'identifiers starting with "f" are reserved for functions');
		} else if (id.startsWith('i')) {
			warning(context, 'identifiers starting with "i" are reserved for includes');
		} else if (id.startsWith('s')) {
			warning(context, 'identifiers starting with "s" are reserved for solvers and calculators');
		} else if (id.startsWith('t')) {
			warning(context, 'identifiers starting with "t" are reserved for unit types');
		}
		if (item['datatype'] === undefined || item['datatype'] === 'num') {
			validateKeys(context, item, ['name'], ['symbol', 'datatype', 'multiplier', 'divisor', 'instructions', 'parser', 'formatter', 'dimension']);
		} else if (item['datatype'] === 'text') {
			validateKeys(context, item, ['name', 'datatype', 'parser', 'formatter'], ['symbol', 'dimension']);
		} else if (item['datatype'] === 'tuple') {
			validateKeys(context, item, ['name', 'datatype', 'tuple-dimension', 'parser', 'formatter'], ['symbol', 'dimension']);
		} else if (item['datatype'] === 'dep') {
			validateKeys(context, item, ['name', 'datatype', 'dep-name', 'parser', 'formatter'], ['symbol', 'dep-dimension', 'dimension']);
		} else if (item['datatype'] === 'cc') {
			validateKeys(context, item, ['name', 'datatype', 'cc-map', 'parser', 'formatter'], ['symbol', 'dimension']);
		} else {
			error(context, 'value for "datatype" must be "num", "text", "tuple", "dep", or "cc" but is "' + item['datatype'] + '"');
		}
		if (item['symbol'] !== undefined) {
			if (item['datatype'] === 'tuple') {
				if (item['symbol'] && typeof item['symbol'] === 'object' && item['symbol'].length === item['tuple-dimension']) {
					for (let i = 0; i < item['symbol'].length; i++) {
						if (!(item['symbol'][i] && typeof item['symbol'][i] === 'string')) {
							error(context, 'value for "symbol", value at index ' + i + ' must be a non-empty string');
						}
					}
				} else {
					error(context, 'value for "symbol" must be an array of length "tuple-dimension" (' + item['tuple-dimension'] + ')');
				}
			} else {
				validateString(context, 'symbol', item['symbol']);
			}
		}
		validateLS(context, 'name', item['name']);
		if (item['tuple-dimension'] !== undefined) {
			if (Math.floor(item['tuple-dimension']) !== Math.ceil(item['tuple-dimension']) || item['tuple-dimension'] < 2) {
				error(context, 'value for "tuple-dimension" must be an integer >= 2 but is ' + item['tuple-dimension']);
			}
		}
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
				const m = item['instructions'].match(/^\s*([MmDdCcQq])\s*([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+))\s*$/);
				if (m) {
					switch (m[1]) {
						case 'M': case 'm': item['multiplier'] = m[2]; break;
						case 'D': case 'd': item['divisor'] = m[2]; break;
						case 'C': case 'c': item['multiplier'] = Math.PI; item['divisor'] = m[2]; break;
						case 'Q': case 'q': item['multiplier'] = m[2]; item['divisor'] = Math.PI; break;
					}
					delete item['instructions'];
				} else {
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
					if (script.join) script = script.join('\n');
					if (script && typeof script === 'string') {
						try {
							const fn = new vm.Script('(' + script + ')').runInNewContext(functionCompiledMap);
							if (typeof fn === 'function') {
								item[key + '.source'] = script;
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

const unitMapAll = {};
for (const id of Object.keys(unitMap)) {
	unitMapAll[id] = unitMap[id];
}

const includeMap = {};
for (const file of findFiles('includes')) {
	const includes = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const id of Object.keys(includes)) {
		const context = file + ': include "' + id + '"';
		const item = includes[id];
		validateStart();
		if (!id.match(/^i[0-9]+$/)) {
			warning(context, 'identifier does not follow recommended pattern of i[0-9]+');
		} else if (id === 'i36') {
			warning(context, 'identifier "i36" is reserved for the currency category');
		}
		validateKeys(context, item, ['name', 'categories']);
		validateLS(context, 'name', item['name']);
		if (item['categories'] && typeof item['categories'] === 'object' && item['categories'].length) {
			for (const cat of item['categories']) {
				if (cat['include'] !== undefined) {
					validateKeys(context, cat, ['include']);
					if (!(cat['include'] === 'i36' || includeMap[cat['include']])) {
						error(context, 'value for "include" references undefined include "' + cat['include'] + '"');
					}
				} else {
					validateKeys(context, cat, ['type', 'units']);
					const catType = unitTypeMap[cat['type']];
					if (!catType) {
						error(context, 'value for "type" references undefined unit type "' + cat['type'] + '"');
					}
					const units = cat['units'];
					if (units && typeof units === 'object' && units.length) {
						for (const unit of units) {
							if (unit && typeof unit === 'string') {
								if (!(unit === '-' || (unit.startsWith('"') && unit.endsWith('"')))) {
									try {
										const u = uparse(unit);
										if (deq(catType['dimension'], u['dimension']) || dcomp(catType['dimension'], u['dimension'])) {
											unitMapAll[unit] = u;
										} else {
											error(context, 'unit "' + unit + '" is being included in an incompatible category');
										}
									} catch (e) {
										error(context, 'unit "' + unit + '" could not be compiled: ' + e);
									}
								}
							} else {
								error(context, 'value for "units" must be a non-empty array of non-empty strings');
							}
						}
					} else {
						error(context, 'value for "units" must be a non-empty array of non-empty strings');
					}
				}
			}
		} else {
			error(context, 'value for "categories" must be a non-empty array');
		}
		putIfOK(context, includeMap, id, item);
	}
}

const elementsMap = {};
for (const file of findFiles('elements')) {
	const elements = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const id of Object.keys(elements)) {
		const context = file + ': element "' + id + '"';
		const item = elements[id];
		validateStart();
		if (Math.ceil(id) !== Math.floor(id)) {
			error(context, 'identifier must be an integer');
		}
		validateKeys(context, item, ['symbol', 'name'], ['properties']);
		validateString(context, 'symbol', item['symbol']);
		validateLS(context, 'name', item['name']);
		if (item['properties'] !== undefined) {
			if (item['properties'] && typeof item['properties'] === 'object') {
				for (const key of Object.keys(item['properties'])) {
					const unitType = unitTypeMap[key];
					if (unitType) {
						const ctx = context + ': property "' + key + '"';
						const unitValue = item['properties'][key];
						validateKeys(ctx, unitValue, ['value', 'unit']);
						try {
							const u = uparse(unitValue['unit']);
							if (!deq(unitType['dimension'], u['dimension'])) {
								error(ctx, 'unit "' + unitValue['unit'] + '" is not compatible with unit type "' + key + '"');
							}
						} catch (e) {
							error(ctx, 'unit "' + unitValue['unit'] + '" could not be compiled: ' + e);
						}
					} else {
						error(context, 'property declared for nonexistent unit type "' + key + '"');
					}
				}
			} else {
				error(context, 'value for "properties" must be a non-null object');
			}
		}
		putIfOK(context, elementsMap, id, item);
	}
}

const solversMap = {};
for (const file of findFiles('solvers')) {
	const solvers = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const id of Object.keys(solvers)) {
		const context = file + ': solver "' + id + '"';
		const item = solvers[id];
		validateStart();
		if (!id.match(/^s[0-9]+$/)) {
			warning(context, 'identifier does not follow recommended pattern of s[0-9]+');
		}
		validateKeys(context, item, ['name', 'variables', 'solutions'], []);
		validateLS(context, 'name', item['name']);
		if (item['variables'] && typeof item['variables'] === 'object' && item['variables'].length) {
			for (let i = 0; i < item['variables'].length; i++) {
				const ctx = context + ': variable at index ' + i;
				const v = item['variables'][i];
				validateKeys(ctx, v, ['type', 'register', 'name', 'unit'], ['dimension']);
				if (!(v['type'] === 'independent' || v['type'] === 'dependent')) {
					error(ctx, 'value for "type" must be "independent" or "dependent" but is "' + v['type'] + '"');
				}
				if (Math.ceil(v['register']) !== Math.floor(v['register']) || v['register'] < 0) {
					error(ctx, 'value for "register" must be a non-negative integer but is "' + v['register'] + '"');
				}
				validateLS(ctx, 'name', v['name']);
				if (v['dimension'] !== undefined) {
					validateDimension(ctx, 'dimension', v['dimension'], dimensionsMap);
				}
				try {
					const u = uparse(v['unit']);
					if (!deq(v['dimension'], u['dimension'])) {
						error(ctx, 'unit "' + v['unit'] + '" is not compatible with this variable');
					}
				} catch (e) {
					if (v['unit'] && v['unit'].startsWith('c')) {
						if (!deq(v['dimension'], {'currency': 1})) {
							error(ctx, 'unit "' + v['unit'] + '" is not compatible with this variable');
						}
					} else {
						error(ctx, 'unit "' + v['unit'] + '" could not be compiled: ' + e);
					}
				}
			}
		} else {
			error(context, 'value for "variables" must be a non-empty array of non-null objects');
		}
		if (item['solutions'] && typeof item['solutions'] === 'object') {
			item['solutions.source'] = {};
			item['solutions.compiled'] = {};
			for (const key of Object.keys(item['solutions'])) {
				const ctx = context + ': solution "' + key + '"';
				if (!solverSolutionKeyValid(key)) {
					error(ctx, 'key must be a comma-separated list of monotonically-increasing non-negative integers');
				}
				let script = item['solutions'][key];
				if (script.join) script = script.join('\n');
				if (script && typeof script === 'string') {
					try {
						const fn = new vm.Script('(' + script + ')').runInNewContext();
						if (typeof fn === 'function') {
							item['solutions.source'][key] = script;
							item['solutions.compiled'][key] = fn;
						} else {
							error(ctx, 'value must compile to a JavaScript function');
						}
					} catch (e) {
						error(ctx, 'value must compile to a JavaScript function');
					}
				} else {
					error(ctx, 'value must be a non-empty string or array of strings');
				}
			}
		} else {
			error(context, 'value for "solutions" must be a non-null object');
		}
		putIfOK(context, solversMap, id, item);
	}
}

console.log(Object.keys(unitTypeMap).length + ' unit types defined');
console.log(Object.keys(functionSourceMap).length + ' functions defined');
console.log(Object.keys(unitMap).length + ' units defined');
console.log(Object.keys(unitMapAll).length + ' units defined or included');
console.log(Object.keys(includeMap).length + ' includes defined');
console.log(Object.keys(elementsMap).length + ' elements defined');
console.log(Object.keys(solversMap).length + ' solvers or calculators defined');
console.log(totalErrorCount + ' errors in data');
console.log(totalWarningCount + ' warnings in data');

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

function uccLoose() {
	for (let i = 0; i < arguments.length; i++) {
		if (!arguments[i]) return false;
		if ((arguments[i]['datatype'] || 'num') !== 'num') return false;
		if (!dcc(arguments[i]['dimension'])) return false;
	}
	return true;
}

function uccStrict() {
	for (let i = 0; i < arguments.length; i++) {
		if (!arguments[i]) return false;
		if ((arguments[i]['datatype'] || 'num') !== 'num') return false;
		if (!dcc(arguments[i]['dimension'])) return false;
		if (arguments[i]['instructions'] !== undefined) return false;
		if (arguments[i]['parser'] !== undefined) return false;
		if (arguments[i]['formatter'] !== undefined) return false;
	}
	return true;
}

function allHaveKey(key, items) {
	for (const item of items) {
		if (!item[key]) {
			return false;
		}
	}
	return true;
}

function sup(n) {
	let t = '';
	const s = n.toString();
	for (let i = 0; i < s.length; i++) {
		switch (s[i]) {
			case '0': t += '\u2070'; break; case '1': t += '\u00B9'; break;
			case '2': t += '\u00B2'; break; case '3': t += '\u00B3'; break;
			case '4': t += '\u2074'; break; case '5': t += '\u2075'; break;
			case '6': t += '\u2076'; break; case '7': t += '\u2077'; break;
			case '8': t += '\u2078'; break; case '9': t += '\u2079'; break;
			case '+': t += '\u207A'; break; case '-': t += '\u207B'; break;
			case '.': t += '\u2E33'; break; case ',': t += '\u2E34'; break;
			case 'E': t += '\u1D31'; break; case 'e': t += '\u1D49'; break;
			default: t += s[i];
		}
	}
	return t;
}

function identity(a) {
	return a;
}

function uparsefn(u) {
	if (u['multiplier'] !== undefined || u['divisor'] !== undefined) {
		const multiplier = (u['multiplier'] !== undefined) ? u['multiplier'] : 1;
		const divisor = (u['divisor'] !== undefined) ? u['divisor'] : 1;
		return function(a) { return a * multiplier / divisor; };
	} else if (u['instructions.forward.compiled'] !== undefined) {
		return u['instructions.forward.compiled'];
	} else if (u['parser.compiled'] !== undefined) {
		return u['parser.compiled'];
	} else {
		return identity;
	}
}

function uformatfn(u) {
	if (u['multiplier'] !== undefined || u['divisor'] !== undefined) {
		const multiplier = (u['multiplier'] !== undefined) ? u['multiplier'] : 1;
		const divisor = (u['divisor'] !== undefined) ? u['divisor'] : 1;
		return function(a) { return a * divisor / multiplier; };
	} else if (u['instructions.reverse.compiled'] !== undefined) {
		return u['instructions.reverse.compiled'];
	} else if (u['formatter.compiled'] !== undefined) {
		return u['formatter.compiled'];
	} else {
		return identity;
	}
}

function uexp(u, b, e) {
	if (e.eq ? e.eq(0) : e == 0) return u;
	if (b.eq ? b.eq(1) : b == 1) return u;
	if (!uccLoose(u)) return null;
	const prefix = prefixesMap[b+'^'+e];
	if (!prefix) return null;
	const n = {};
	if (prefix['symbol'] && u['symbol']) {
		n['symbol'] = prefix['symbol'] + u['symbol'];
	}
	if (prefix['format'] && u['name']) {
		n['name'] = formatLS(prefix['format'], u['name']);
	}
	if (u['instructions'] !== undefined || u['parser'] !== undefined || u['formatter'] !== undefined) {
		const pf = uparsefn(u), ff = uformatfn(u), base = b, exp = e;
		n['parser.compiled'] = function(a) { return pf(a * Math.pow(base, exp)); };
		n['formatter.compiled'] = function(a) { return ff(a) / Math.pow(base, exp); };
	} else {
		let m = (u['multiplier'] !== undefined) ? u['multiplier'] : 1;
		let d = (u['divisor'] !== undefined) ? u['divisor'] : 1;
		if (e > 0) m *= Math.pow(b, e);
		if (e < 0) d *= Math.pow(b, -e);
		if (m != d) {
			if (m != 1) n['multiplier'] = m;
			if (d != 1) n['divisor'] = d;
		}
	}
	if (u['dimension']) n['dimension'] = u['dimension'];
	return n;
}

function umul() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	if (!uccStrict.apply(null, arguments)) return null;
	const n = {};
	const args = Array.from(arguments);
	if (allHaveKey('symbol', args)) {
		n['symbol'] = args.map(a => a['symbol']).join('\u00B7');
	}
	if (allHaveKey('name', args)) {
		n['name'] = joinLS(' ', args.map(a => a['name']));
	}
	n['multiplier'] = (args[0]['multiplier'] !== undefined) ? args[0]['multiplier'] : 1;
	n['divisor'] = (args[0]['divisor'] !== undefined) ? args[0]['divisor'] : 1;
	for (let i = 1; i < args.length; i++) {
		if (args[i]['multiplier'] !== undefined) n['multiplier'] *= args[i]['multiplier'];
		if (args[i]['divisor'] !== undefined) n['divisor'] *= args[i]['divisor'];
	}
	const d = dmul.apply(null, args.map(a => a['dimension']));
	if (!dempty(d)) n['dimension'] = d;
	return n;
}

function udiv() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	if (!uccStrict.apply(null, arguments)) return null;
	const n = {};
	const args = Array.from(arguments);
	if (allHaveKey('symbol', args)) {
		n['symbol'] = args.map(a => a['symbol']).join('/');
	}
	if (allHaveKey('name', args)) {
		n['name'] = joinLS(' per ', args.map(a => a['name']));
	}
	n['multiplier'] = (args[0]['multiplier'] !== undefined) ? args[0]['multiplier'] : 1;
	n['divisor'] = (args[0]['divisor'] !== undefined) ? args[0]['divisor'] : 1;
	for (let i = 1; i < args.length; i++) {
		if (args[i]['multiplier'] !== undefined) n['divisor'] *= args[i]['multiplier'];
		if (args[i]['divisor'] !== undefined) n['multiplier'] *= args[i]['divisor'];
	}
	const d = ddiv.apply(null, args.map(a => a['dimension']));
	if (!dempty(d)) n['dimension'] = d;
	return n;
}

function upow(u, e) {
	if (e.eq ? e.eq(0) : e == 0) return null;
	if (e.eq ? e.eq(1) : e == 1) return u;
	if (!uccStrict(u)) return null;
	const degree = degreesMap[e];
	if (!degree) return null;
	const n = {};
	if (u['symbol']) {
		n['symbol'] = u['symbol'] + sup(e);
	}
	if (degree['format'] && u['name']) {
		n['name'] = formatLS(degree['format'], u['name']);
	}
	n['multiplier'] = (u['multiplier'] !== undefined) ? Math.pow(u['multiplier'], e) : 1;
	n['divisor'] = (u['divisor'] !== undefined) ? Math.pow(u['divisor'], e) : 1;
	if (isNaN(n['multiplier']) || isNaN(n['divisor'])) return null;
	const d = dpow(u['dimension'], e);
	if (!dempty(d)) n['dimension'] = d;
	return n;
}

function ufrac(u, mo, me, mp) {
	if (!uccLoose(u)) return null;
	const n = {};
	if (u['symbol']) n['symbol'] = u['symbol'];
	if (u['name']) n['name'] = formatLS('fractional @', u['name']);
	n['datatype'] = 'text';
	const pf = uparsefn(u), ff = uformatfn(u), mod = mo, med = me, mpd = mp;
	n['parser.compiled'] = function(a) {
		if (!(a = a.replace(/^\s+|\s+$/g, ''))) return NaN;
		if (a === '\u221E' || a === '+\u221E') return Infinity;
		if (a === '-\u221E') return -Infinity;
		const s = (a[0] === '-') ? (-1) : 1;
		if (a[0] === '-' || a[0] === '+') a = a.substring(1);
		let v = 0;
		for (const p of a.split(/\s+/)) {
			const b = p.split('/');
			for (let i = 1; i < b.length; i++) b[0] /= b[i];
			v += +b[0];
		}
		return pf(v * s);
	};
	n['formatter.compiled'] = function(a) {
		if (isNaN((a = ff(a)))) return '';
		if (!isFinite(a)) return ((a < 0) ? '-\u221E' : '\u221E');
		const s = (a < 0) ? '-' : '';
		const i = Math.floor((a = Math.abs(a)));
		const f = a - i;
		if (!f) return s + i;
		let bestDen = 1, bestNum = 0, bestVal = 0, bestDif = f;
		for (let den = 1; den <= mod || den <= med || den <= mpd; den++) {
			if (
				(den <= mod) ||
				(den <= med && !(den & 1)) ||
				(den <= mpd && !(den & (den - 1)))
			) {
				const num = Math.round(f * den);
				const val = num / den;
				const dif = Math.abs(val - f);
				if (dif < bestDif) {
					bestDen = den;
					bestNum = num;
					bestVal = val;
					bestDif = dif;
				}
			}
		}
		if (!bestNum) return s + i;
		if (bestNum == bestDen) return s + (i + 1);
		return s + i + ' ' + bestNum + '/' + bestDen;
	};
	if (u['dimension']) n['dimension'] = u['dimension'];
	return n;
}

function uhier() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	if (!uccLoose.apply(null, arguments)) return null;
	const n = {};
	const args = Array.from(arguments);
	n['symbol'] = args.map(a => a['symbol']);
	n['name'] = joinLS(', ', args.map(a => a['name']));
	n['datatype'] = 'tuple';
	n['tuple-dimension'] = args.length;
	const td = args.length;
	const pf = args.map(uparsefn);
	const ff = args.map(uformatfn);
	n['parser.compiled'] = function(a) {
		if (!(a && typeof a === 'object' && a.length === td)) return NaN;
		let d = 0;
		for (let i = 0; i < td; i++) {
			d += pf[i](a[i]);
		}
		return d;
	};
	n['formatter.compiled'] = function(a) {
		if (!isFinite(a)) return null;
		const d = [];
		for (let i = 0; i < td; i++) {
			const iv = ff[i](a);
			const last = (i == td - 1);
			d[i] = (i === (td - 1)) ? iv : ((iv < 0) ? Math.ceil(iv) : Math.floor(iv));
			a = pf[i](iv - d[i]);
		}
		return d;
	};
	const d = args[0]['dimension'];
	for (const arg of args) if (!deq(d, arg['dimension'])) return null;
	if (!dempty(d)) n['dimension'] = d;
	return n;
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
		if (!u) throw new Error('Cannot exponentiate the unit "' + getLS(p.u.name) + '"');
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
		if (!u) throw new Error('Cannot exponentiate the unit "' + getLS(p.u.name) + '"');
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
	throw new Error('Cannot multiply the units: ' + pp.map(u => getLS(u.name)).join(', '));
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
	throw new Error('Cannot divide the units: ' + pp.map(u => getLS(u.name)).join(', '));
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
		if (!u) throw new Error('Cannot fractionalize the unit "' + getLS(p.u.name) + '"');
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
	throw new Error('Cannot compose the units: ' + pp.map(u => getLS(u.name)).join(', '));
}

function uparse(s) {
	const p = uparse_hier(s);
	if (!(s = uparse_ws(p.s))) return p.u;
	throw new Error('Expected end of string but found "' + s + '"');
}

// UNIT CONVERSION UTILITIES

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

// VALIDATE AND RUN TESTS

function testValue(v) {
	if (v === '$$UNDEFINED$$') return undefined;
	if (v === '$$NULL$$') return null;
	if (v === '$$NAN$$') return NaN;
	if (v === '$$INFINITY$$') return Infinity;
	if (v === '$$+INFINITY$$') return +Infinity;
	if (v === '$$-INFINITY$$') return -Infinity;
	return v;
}

function testEqual(a, b, e) {
	if (a === undefined) return (b === undefined);
	if (b === undefined) return (a === undefined);
	if (a === null) return (b === null);
	if (b === null) return (a === null);
	// Equality for NaN
	if (a !== a) return (b !== b);
	if (b !== b) return (a !== a);
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
			if (!testEqual(a[ak[i]], b[bk[i]], e)) return false;
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

let testsTotal = 0;
let testsFailed = 0;
let testsPassed = 0;
for (const file of findFiles('tests')) {
	const tests = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const item of tests) {
		let context = file;
		let epsilon = 0;
		validateStart();
		if (item['solver'] !== undefined) {
			validateKeys(context, item, ['solver', 'solution-sets'], ['name', 'epsilon', 'ignore-solutions']);
			const solver = solversMap[item['solver']];
			const solutionSets = [];
			const ignoreSolutions = {};
			for (const key of Object.keys(item)) {
				const value = item[key];
				if (key === 'name') {
					context += ': ' + value;
				} else if (key === 'epsilon') {
					epsilon = Math.abs(value);
				} else if (key === 'solver') {
					if (!solver) {
						error(context, 'solver "' + value + '" does not exist');
					}
				} else if (key === 'solution-sets') {
					if (value && typeof value === 'object' && value.length) {
						for (let i = 0; i < value.length; i++) {
							if (value[i] && typeof value[i] === 'object' && value[i].length) {
								solutionSets.push(value[i]);
							} else {
								error(context, 'value for "solution-sets" at index ' + i + ' must be a non-empty array');
							}
						}
					} else {
						error(context, 'value for "solution-sets" must be a non-empty array');
					}
				} else if (key === 'ignore-solutions') {
					if (value && typeof value === 'object' && value.length) {
						for (let i = 0; i < value.length; i++) {
							if (solverSolutionKeyValid(value[i])) {
								ignoreSolutions[value[i].join ? value[i].join(',') : value[i]] = true;
							} else {
								error(context, 'value for "ignore-solutions" at index ' + i + ' must be a list of monotonically-increasing non-negative integers');
							}
						}
					} else {
						error(context, 'value for "ignore-solutions" must be a non-empty array');
					}
				} else {
					error(context, 'unknown key "' + key + '"');
				}
			}
			if (solver && solutionSets.length) {
				const ivr = solver['variables'].filter(v => v['type'] !== 'dependent').map(v => +v['register']);
				for (const ss of solutionSets) {
					for (const sk of Object.keys(solver['solutions'])) {
						if (!ignoreSolutions[sk]) {
							const inr = ivr.concat(sk.split(',').map(v => +v));
							const r = []; for (const ir of inr) r[ir] = ss[ir];
							solver['solutions.compiled'][sk](r);
							if (!testEqual(r, ss, epsilon)) {
								error(context, 'solution for [' + inr.join(',') + '] given [' + inr.map(ir => ss[ir]).join(',') + '] should be [' + ss.join(',') + '] but test produced [' + r.join(',') + ']');
							}
						}
					}
				}
			}
		} else {
			const inputs = [];
			const outputs = [];
			const depInputs = {};
			for (const key of Object.keys(item)) {
				const value = item[key];
				if (key === 'name') {
					context += ': ' + value;
				} else if (key === 'epsilon') {
					epsilon = Math.abs(value);
				} else if (key === 'inputs') {
					if (value && typeof value === 'object') {
						for (const k of Object.keys(value)) {
							const v = testValue(value[k]);
							if (k === 'base') {
								inputs.push([null, v]);
							} else {
								try {
									const u = uparse(k);
									inputs.push([u, v]);
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
							const v = testValue(value[k]);
							if (k === 'base') {
								outputs.push([null, v]);
							} else {
								try {
									const u = uparse(k);
									outputs.push([u, v]);
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
							const v = testValue(value[k]);
							try {
								const u = uparse(k);
								if (u['dep-name']) {
									depInputs[getLS(u['dep-name'])] = v;
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
				} else {
					const v = testValue(value);
					if (key === 'base') {
						inputs.push([null, v]);
						outputs.push([null, v]);
					} else {
						try {
							const u = uparse(key);
							inputs.push([u, v]);
							outputs.push([u, v]);
						} catch (e) {
							error(context, 'unit "' + key + '" could not be compiled: ' + e);
						}
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
							if (testEqual(v, ov, epsilon)) {
								// console.log('PASS: ' + context + ': ' + iv + ' ' + inputName + ' = ' + ov + ' ' + outputName);
							} else {
								error(context, iv + ' ' + inputName + ' should be ' + ov + ' ' + outputName + ' but test produced ' + v + ' ' + outputName);
							}
						} else if (dcomp(iu['dimension'], ou['dimension'])) {
							const v = mcformat(ou, 1 / baseValue, depInputs);
							if (testEqual(v, ov, epsilon)) {
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
		testsTotal++;
		if (localErrorCount) testsFailed++;
		if (!localErrorCount) testsPassed++;
	}
}

console.log(testsTotal + ' tests executed');
console.log(testsPassed + ' tests passed');
console.log(testsFailed + ' tests failed');
console.log(totalErrorCount + ' errors total');
console.log(totalWarningCount + ' warnings total');
if (totalErrorCount) process.exit(1);

// WRITE MCDBMAIN.JS

function dimObj(dim) {
	const obj = {};
	if (dim) {
		for (const key of Object.keys(dim)) {
			obj[dimensionsMap[key]['legacy-id']] = dim[key];
		}
	}
	return obj;
}

function catObj(cat) {
	if (cat['include']) return {'i': cat['include']};
	return {'t': cat['type'], 'u': cat['units']};
}

function incObj(inc) {
	const name = getLS(inc['name'], 'en', '*');
	const categories = inc['categories'].map(catObj);
	return {'n': name, 'c': categories};
}

let lines = [];
lines.push('/* Anything worth doing is worth overdoing. -- Mick Jagger */');
lines.push('if(typeof m!==\'object\')m={};(function(m){');

const mp = {};
for (const key of Object.keys(degreesMap)) {
	const item = degreesMap[key];
	const nameLS = formatLS(item['format'], ' ');
	const name = getLS(nameLS, 'en', '*').trim();
	mp[key] = name;
}
lines.push('m.mp=' + JSON.stringify(mp) + ';');

const dp = {};
const bp = {};
for (const key of Object.keys(prefixesMap)) {
	const item = prefixesMap[key];
	const symbol = item['symbol'];
	const nameLS = formatLS(item['format'], ' ');
	const name = getLS(nameLS, 'en', '*').trim();
	const obj = {'s': symbol, 'n': name};
	if (key.startsWith('10^')) dp[key.substring(3)] = obj;
	if (key.startsWith('2^')) bp[key.substring(2)] = obj;
}
lines.push('m.dp=' + JSON.stringify(dp) + ';');
lines.push('m.bp=' + JSON.stringify(bp) + ';');

const t = {};
for (const key of Object.keys(unitTypeMap)) {
	const item = unitTypeMap[key];
	const name = getLS(item['name'], 'en', '*');
	const dim = dimObj(item['dimension']);
	const obj = {'n': name};
	if (!dempty(dim)) obj['d'] = dim;
	t[key] = obj;
}
lines.push('m.t=' + JSON.stringify(t) + ';');

for (const key of Object.keys(functionSourceMap)) {
	lines.push('var ' + key + '=' + functionSourceMap[key] + ';');
}

const colorCodes = [];
for (const key of Object.keys(unitMap)) {
	const item = unitMap[key];
	if (item['cc-map'] !== undefined) {
		const ncc = [];
		for (const cc of item['cc-map']) {
			const obj = {};
			for (const k of Object.keys(cc)) {
				const h = cc[k]['color'];
				const n = getLS(cc[k]['name'], 'en', '*');
				obj[k] = {'h': h, 'n': n};
			}
			const s = JSON.stringify(obj);
			let i = colorCodes.indexOf(s);
			if (i < 0) {
				i = colorCodes.length;
				colorCodes.push(s);
			}
			ncc.push('cc' + i);
		}
		item['cc-map.source'] = '[' + ncc.join(',') + ']';
	}
}
for (const key of Object.keys(colorCodes)) {
	lines.push('var cc' + key + '=' + colorCodes[key] + ';');
}

lines.push('if(!m.r)m.r={};if(!m.u)m.u={};var uu={');
for (const key of Object.keys(unitMap)) {
	const item = unitMap[key];
	const obj = {};
	if (item['symbol'] !== undefined) {
		obj['s'] = item['symbol'];
	}
	if (item['name'] !== undefined) {
		const n = getLS(item['name'], 'en', 1);
		const p = getLS(item['name'], 'en', '*');
		obj['n'] = n; if (n !== p) obj['p'] = p;
	}
	if ((item['datatype'] || 'num') !== 'num') {
		obj['k'] = item['datatype'];
	}
	if (item['tuple-dimension'] !== undefined) {
		obj['td'] = item['tuple-dimension'];
	}
	if (item['dep-name'] !== undefined) {
		obj['dn'] = getLS(item['dep-name'], 'en', '*');
	}
	if (item['dep-dimension'] !== undefined) {
		obj['dd'] = dimObj(item['dep-dimension']);
	}
	if (item['cc-map'] !== undefined) {
		obj['cc'] = '@@@@cc-map.source@@@@';
	}
	if (item['multiplier'] !== undefined || item['divisor'] !== undefined) {
		if (item['multiplier'] !== undefined && item['multiplier'] != 1) {
			obj['m'] = +item['multiplier'];
		}
		if (item['divisor'] !== undefined && item['divisor'] != 1) {
			obj['w'] = +item['divisor'];
		}
	} else if (item['instructions'] !== undefined) {
		obj['t'] = '@@@@instructions.forward.source@@@@';
		obj['f'] = '@@@@instructions.reverse.source@@@@';
	} else if (item['parser'] !== undefined || item['formatter'] !== undefined) {
		obj['t'] = '@@@@parser.source@@@@';
		obj['f'] = '@@@@formatter.source@@@@';
	}
	if (item['dimension'] !== undefined) {
		obj['d'] = dimObj(item['dimension']);
	}
	let s = JSON.stringify(obj);
	s = s.replaceAll(/("(cc|t|f)":)"@@@@([-a-z.]+)@@@@"/g, (g0, g1, g2, g3) => g1 + item[g3]);
	lines.push('"' + key + '":' + s + ',');
}
lines.push('};for(var k in uu)m.u[k]=uu[k];m.r[\'main\']=true;');

lines.push('if(!m.i)m.i={};var ii={');
for (const key of Object.keys(includeMap)) {
	const item = includeMap[key];
	const obj = incObj(item);
	lines.push('"' + key + '":' + JSON.stringify(obj) + ',');
}
lines.push('};for(var k in ii)m.i[k]=ii[k];m.r[\'defaults\']=true;');

lines.push('})(m);')
fs.writeFileSync('mcdbmain.js', lines.join('\n'));
console.log('Wrote mcdbmain.js');

// WRITE MCDBMISC.JS

lines = [];
lines.push('/* Anything worth doing is worth overdoing. -- Mick Jagger */');
lines.push('if(typeof m!==\'object\')m={};(function(m){');

lines.push('if(!m.r)m.r={};if(!m.e)m.e={};var ee={');
for (const key of Object.keys(elementsMap)) {
	const item = elementsMap[key];
	const obj = {};
	if (item['symbol'] !== undefined) {
		obj['s'] = item['symbol'];
	}
	if (item['name'] !== undefined) {
		const n = getLS(item['name'], 'en', '*');
		const l = getLS(item['name'], 'la', '*');
		obj['n'] = n; if (n !== l) obj['l'] = l;
	}
	if (item['properties'] !== undefined) {
		obj['a'] = {};
		for (const key of Object.keys(item['properties'])) {
			obj['a'][key] = {};
			const prop = item['properties'][key];
			if (prop['value'] !== undefined) {
				obj['a'][key]['v'] = prop['value'];
			}
			if (prop['unit'] !== undefined) {
				obj['a'][key]['u'] = prop['unit'];
			}
		}
	}
	lines.push('"' + key + '":' + JSON.stringify(obj) + ',');
}
lines.push('};for(var k in ee)m.e[k]=ee[k];m.r[\'elements\']=true;');

lines.push('if(!m.s)m.s={};var ss={');
for (const key of Object.keys(solversMap)) {
	const item = solversMap[key];
	const obj = {};
	if (item['name'] !== undefined) {
		obj['n'] = getLS(item['name'], 'en', '*');
	}
	if (item['variables'] !== undefined) {
		obj['v'] = [];
		for (const v of item['variables']) {
			const vo = {};
			switch (v['type']) {
				case 'independent': vo['vt'] = 'iv'; break;
				case 'dependent': vo['vt'] = 'dv'; break;
			}
			if (v['register'] !== undefined) {
				vo['r'] = v['register'];
			}
			if (v['name'] !== undefined) {
				vo['n'] = getLS(v['name'], 'en', '*');
			}
			if (v['dimension'] !== undefined) {
				vo['d'] = dimObj(v['dimension']);
			}
			if (v['unit'] !== undefined) {
				vo['u'] = v['unit'];
			}
			obj['v'].push(vo);
		}
	}
	if (item['solutions'] !== undefined) {
		obj['ng'] = 0;
		obj['g'] = {};
		for (const k of Object.keys(item['solutions'])) {
			const n = k.split(',').length;
			if (obj['ng'] < n) obj['ng'] = n;
			obj['g'][k] = '@@@@' + k + '@@@@';
		}
	}
	let s = JSON.stringify(obj);
	s = s.replaceAll(/("([0-9,]+)":)"@@@@\2@@@@"/g, (g0, g1, g2) => g1 + item['solutions.source'][g2]);
	lines.push('"' + key + '":' + s + ',');
}
lines.push('};for(var k in ss)m.s[k]=ss[k];m.r[\'solvers\']=true;');

lines.push('})(m);')
fs.writeFileSync('mcdbmisc.js', lines.join('\n'));
console.log('Wrote mcdbmisc.js');
