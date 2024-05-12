#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const da = require('./lib/dimension.js');
const fsutil = require('./lib/fsutilities.js');
const index = require('./lib/index.js');
const ls = require('./lib/languagestring.js');
const srmp = require('./lib/srmp.js');
const unit = require('./lib/unitparser.js');

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

function validateLSOrder(context, key, object) {
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
		if (!(value === 'ltr' || value === 'rtl')) {
			error(context, 'value for "' + key + '", language "' + lang + '", must be "ltr" or "rtl"');
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

const composition = JSON.parse(fs.readFileSync('composition.json', 'utf8'));
validateStart();
validateKeys('composition.json', composition, ['mul-joiner', 'mul-order', 'div-joiner', 'div-order', 'hier-joiner', 'hier-order', 'frac-format'], []);
validateLS('composition.json', 'mul-joiner', composition['mul-joiner'], '@');
validateLSOrder('composition.json', 'mul-order', composition['mul-order']);
validateLS('composition.json', 'div-joiner', composition['div-joiner'], '@');
validateLSOrder('composition.json', 'div-order', composition['div-order']);
validateLS('composition.json', 'hier-joiner', composition['hier-joiner'], '@');
validateLSOrder('composition.json', 'hier-order', composition['hier-order']);
validateLS('composition.json', 'frac-format', composition['frac-format'], '@');
if (totalErrorCount) process.exit(1);
unit.loadComposition(composition);

const degreesMap = {};
for (const file of fsutil.findFiles('.', 'degrees')) {
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
unit.loadDegrees(degreesMap);

const dimensionsMap = {};
for (const file of fsutil.findFiles('.', 'dimensions')) {
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
unit.loadDimensions(dimensionsMap);

const prefixesMap = {};
for (const file of fsutil.findFiles('.', 'prefixes')) {
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
unit.loadPrefixes(prefixesMap);

const unitTypeMap = {};
for (const file of fsutil.findFiles('.', 'unit-types')) {
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
index.build({'type': 'unit-type'}, 'en', unitTypeMap);

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
for (const file of fsutil.findFiles('.', 'units')) {
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
		} else if (id.startsWith('e')) {
			warning(context, 'identifiers starting with "e" are reserved for chemical element data');
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
			if (srmp.validate(item['instructions'])) {
				const m = srmp.rationalize(item['instructions']);
				if (m) {
					[item['multiplier'], item['divisor']] = m;
					delete item['instructions'];
				} else {
					try {
						const forwardCode = srmp.codegenForward(item['instructions']);
						const reverseCode = srmp.codegenReverse(item['instructions']);
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
unit.loadFunctions(functionCompiledMap);
unit.loadUnits(unitMap);
index.build({'type': 'function'}, 'en', functionSourceMap);
index.build({'type': 'unit'}, 'en', unitMap);

const unitMapAll = {};
for (const id of Object.keys(unitMap)) {
	unitMapAll[id] = unitMap[id];
}

const includeMap = {};
for (const file of fsutil.findFiles('.', 'includes')) {
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
						for (const us of units) {
							if (us && typeof us === 'string') {
								if (!(us === '-' || (us.startsWith('"') && us.endsWith('"')))) {
									try {
										const u = unit.parse(us);
										if (da.eq(catType['dimension'], u['dimension']) || da.comp(catType['dimension'], u['dimension'])) {
											unitMapAll[us] = u;
											if (!index.cslookup(us)) {
												index.build({'type': 'unit'}, 'en', {[us]: u});
											}
										} else {
											error(context, 'unit "' + us + '" is being included in an incompatible category');
										}
									} catch (e) {
										error(context, 'unit "' + us + '" could not be compiled: ' + e);
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
index.build({'type': 'include'}, 'en', includeMap);

const elementsMap = {};
const keyedElementsMap = {};
for (const file of fsutil.findFiles('.', 'elements')) {
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
							const u = unit.parse(unitValue['unit']);
							if (!da.eq(unitType['dimension'], u['dimension'])) {
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
		putIfOK(context, keyedElementsMap, 'e' + id, item);
	}
}
index.build({'type': 'element'}, 'en', keyedElementsMap);

const solversMap = {};
for (const file of fsutil.findFiles('.', 'solvers')) {
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
					const u = unit.parse(v['unit']);
					if (!da.eq(v['dimension'], u['dimension'])) {
						error(ctx, 'unit "' + v['unit'] + '" is not compatible with this variable');
					}
				} catch (e) {
					if (v['unit'] && v['unit'].startsWith('c')) {
						if (!da.eq(v['dimension'], {'currency': 1})) {
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
index.build({'type': 'solver'}, 'en', solversMap);

for (const file of fsutil.findFiles('.', 'disambiguation')) {
	const disambiguation = JSON.parse(fs.readFileSync(file, 'utf8'));
	const context = file;
	validateStart();
	const langs = Object.keys(disambiguation);
	if (langs.indexOf('en') < 0) {
		error(context, 'must contain required key "en"');
	}
	for (const lang of langs) {
		const entries = disambiguation[lang];
		if (entries && typeof entries === 'object') {
			for (const indexKey of Object.keys(entries)) {
				if (!(entries[indexKey] && typeof entries[indexKey] === 'object')) {
					error(context, 'value for "' + lang + '", index "' + indexKey + '", must be a non-null object');
				}
			}
		} else {
			error(context, 'value for "' + lang + '" must be a non-null object');
		}
	}
	if (localErrorCount) continue;
	const results = index.disambiguate('en', disambiguation);
	for (const indexKey of Object.keys(disambiguation['en'])) {
		if (results[indexKey] === undefined) {
			warning(context, 'key "' + indexKey + '" did not match an ambiguous index entry');
		} else if (results[indexKey] === false) {
			error(context, 'key "' + indexKey + '" failed to match exactly one candidate');
		} else if (results[indexKey] !== true) {
			error(context, 'key "' + indexKey + '" caused an impossible condition');
		}
	}
}

console.log(Object.keys(unitTypeMap).length + ' unit types defined');
console.log(Object.keys(functionSourceMap).length + ' functions defined');
console.log(Object.keys(unitMap).length + ' units defined');
console.log(Object.keys(unitMapAll).length + ' units defined or included');
console.log(Object.keys(includeMap).length + ' includes defined');
console.log(Object.keys(elementsMap).length + ' elements defined');
console.log(Object.keys(solversMap).length + ' solvers or calculators defined');
console.log(Object.keys(index.index).length + ' terms in search index');
console.log(Object.keys(index.index).filter(k => index.index[k].length > 1).length + ' ambiguous terms originally in search index');
console.log(Object.keys(index.index).filter(k => index.index[k].length > 1 && index.index[k].filter(e => e.disambiguated).length == 1).length + ' ambiguous terms resolved by disambiguation');
console.log(Object.keys(index.index).filter(k => index.index[k].length > 1 && index.index[k].filter(e => e.disambiguated).length != 1).length + ' ambiguous terms remaining in search index');
console.log(totalErrorCount + ' errors in data');
console.log(totalWarningCount + ' warnings in data');

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
		if (depInputs && u['dep-name'] && depInputs[ls.get(u['dep-name'])] !== undefined) {
			a = u['parser.compiled'](a, depInputs[ls.get(u['dep-name'])]);
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
		if (depInputs && u['dep-name'] && depInputs[ls.get(u['dep-name'])] !== undefined) {
			a = u['formatter.compiled'](a, depInputs[ls.get(u['dep-name'])]);
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
for (const file of fsutil.findFiles('.', 'tests')) {
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
									const u = unit.parse(k);
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
									const u = unit.parse(k);
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
								const u = unit.parse(k);
								if (u['dep-name']) {
									depInputs[ls.get(u['dep-name'])] = v;
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
							const u = unit.parse(key);
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
					const inputName = iu ? ls.get(iu.name) : 'base units';
					const baseValue = iu ? mcparse(iu, iv, depInputs) : iv;
					for (const [ou, ov] of outputs) {
						const outputName = ou ? ls.get(ou.name) : 'base units';
						if (!iu || !ou || da.eq(iu['dimension'], ou['dimension'])) {
							const v = ou ? mcformat(ou, baseValue, depInputs) : baseValue;
							if (testEqual(v, ov, epsilon)) {
								// console.log('PASS: ' + context + ': ' + iv + ' ' + inputName + ' = ' + ov + ' ' + outputName);
							} else {
								error(context, iv + ' ' + inputName + ' should be ' + ov + ' ' + outputName + ' but test produced ' + v + ' ' + outputName);
							}
						} else if (da.comp(iu['dimension'], ou['dimension'])) {
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
	const name = ls.get(inc['name'], 'en', '*');
	const categories = inc['categories'].map(catObj);
	return {'n': name, 'c': categories};
}

let lines = [];
lines.push('/* Anything worth doing is worth overdoing. -- Mick Jagger */');
lines.push('if(typeof m!==\'object\')m={};(function(m){');

const mp = {};
for (const key of Object.keys(degreesMap)) {
	const item = degreesMap[key];
	const nameLS = ls.format(item['format'], ' ');
	const name = ls.get(nameLS, 'en', '*').trim();
	mp[key] = name;
}
lines.push('m.mp=' + JSON.stringify(mp) + ';');

const dp = {};
const bp = {};
for (const key of Object.keys(prefixesMap)) {
	const item = prefixesMap[key];
	const symbol = item['symbol'];
	const nameLS = ls.format(item['format'], ' ');
	const name = ls.get(nameLS, 'en', '*').trim();
	const obj = {'s': symbol, 'n': name};
	if (key.startsWith('10^')) dp[key.substring(3)] = obj;
	if (key.startsWith('2^')) bp[key.substring(2)] = obj;
}
lines.push('m.dp=' + JSON.stringify(dp) + ';');
lines.push('m.bp=' + JSON.stringify(bp) + ';');

const t = {};
for (const key of Object.keys(unitTypeMap)) {
	const item = unitTypeMap[key];
	const name = ls.get(item['name'], 'en', '*');
	const dim = dimObj(item['dimension']);
	const obj = {'n': name};
	if (!da.empty(dim)) obj['d'] = dim;
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
				const n = ls.get(cc[k]['name'], 'en', '*');
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
		const n = ls.get(item['name'], 'en', 1);
		const p = ls.get(item['name'], 'en', '*');
		obj['n'] = n; if (n !== p) obj['p'] = p;
	}
	if ((item['datatype'] || 'num') !== 'num') {
		obj['k'] = item['datatype'];
	}
	if (item['tuple-dimension'] !== undefined) {
		obj['td'] = item['tuple-dimension'];
	}
	if (item['dep-name'] !== undefined) {
		obj['dn'] = ls.get(item['dep-name'], 'en', '*');
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
		const n = ls.get(item['name'], 'en', '*');
		const l = ls.get(item['name'], 'la', '*');
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
		obj['n'] = ls.get(item['name'], 'en', '*');
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
				vo['n'] = ls.get(v['name'], 'en', '*');
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
