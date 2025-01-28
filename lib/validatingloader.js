const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const da = require('./dimension.js');
const fsutil = require('./fsutilities.js');
const index = require('./index.js');
const srmp = require('./srmp.js');
const unit = require('./unitparser.js');
const validate = require('./validate.js');

let compositionLoaded = false;
let compositionError = false;
function loadComposition(parent='.') {
	if (compositionError) return false;
	for (const file of fsutil.findFiles(parent, 'composition')) {
		if (compositionLoaded) {
			validate.error(file, 'multiple instances of composition.json; cannot continue');
			compositionError = true; return false;
		} else {
			const composition = JSON.parse(fs.readFileSync(file, 'utf8'));
			validate.start();
			validate.keys(file, composition, ['mul-joiner', 'mul-order', 'div-joiner', 'div-order', 'hier-joiner', 'hier-order', 'frac-format'], []);
			validate.ls(file, 'mul-joiner', composition['mul-joiner'], '@');
			validate.lsOrder(file, 'mul-order', composition['mul-order']);
			validate.ls(file, 'div-joiner', composition['div-joiner'], '@');
			validate.lsOrder(file, 'div-order', composition['div-order']);
			validate.ls(file, 'hier-joiner', composition['hier-joiner'], '@');
			validate.lsOrder(file, 'hier-order', composition['hier-order']);
			validate.ls(file, 'frac-format', composition['frac-format'], '@');
			if (validate.ok()) {
				unit.loadComposition(composition);
				compositionLoaded = true;
			} else {
				validate.error(file, 'errors in composition.json; cannot continue');
				compositionError = true; return false;
			}
		}
	}
	return true;
}
function loadCompositionOK() {
	if (compositionError) return false;
	if (!compositionLoaded) {
		validate.error('composition.json', 'cannot find composition.json; cannot continue');
		compositionError = true; return false;
	}
	return true;
}

const degreesMap = {};
function loadDegrees(parent='.') {
	for (const file of fsutil.findFiles(parent, 'degrees')) {
		const degrees = JSON.parse(fs.readFileSync(file, 'utf8'));
		const context = file;
		for (const item of degrees) {
			validate.start();
			validate.keys(context, item, ['degree', 'format'], ['alt-format']);
			if (Math.ceil(item['degree'] * 2) !== Math.floor(item['degree'] * 2)) {
				validate.error(context, 'value for "degree" must be a multiple of 0.5 but is ' + item['degree']);
			}
			validate.ls(context, 'format', item['format'], '@');
			if (item['alt-format'] !== undefined) {
				validate.ls(context, 'alt-format', item['alt-format'], '@');
			}
			validate.putIfOK(context, degreesMap, item['degree'], item);
		}
	}
	unit.loadDegrees(degreesMap);
	return degreesMap;
}

const dimensionsMap = {};
function loadDimensions(parent='.') {
	for (const file of fsutil.findFiles(parent, 'dimensions')) {
		const dimensions = JSON.parse(fs.readFileSync(file, 'utf8'));
		for (const id of Object.keys(dimensions)) {
			const context = file + ': dimension "' + id + '"';
			const item = dimensions[id];
			validate.start();
			validate.keys(context, item, ['legacy-id', 'name'], ['legacy-id-mc5', 'symbol', 'joke', 'composable', 'datatype', 'tuple-dimension']);
			validate.string(context, 'legacy-id', item['legacy-id']);
			if (item['legacy-id-mc5'] !== undefined) {
				if (!(
					(typeof item['legacy-id-mc5'] === 'string' && item['legacy-id-mc5']) ||
					(typeof item['legacy-id-mc5'] === 'number' && Math.ceil(item['legacy-id-mc5']) === Math.floor(item['legacy-id-mc5']))
				)) {
					validate.error(context, 'value for "legacy-id-mc5" must be an integer or a non-empty string');
				}
			}
			if (item['symbol'] !== undefined) {
				validate.string(context, 'symbol', item['symbol']);
			}
			if (item['joke'] !== undefined && typeof item['joke'] !== 'boolean') {
				validate.error(context, 'value for "joke" must be a boolean');
			}
			if (item['composable'] !== undefined && typeof item['composable'] !== 'boolean') {
				validate.error(context, 'value for "composable" must be a boolean');
			}
			if (item['datatype'] !== undefined && ['num', 'text', 'tuple'].indexOf(item['datatype']) < 0) {
				validate.error(context, 'value for "datatype" must be "num", "text", or "tuple" but is "' + item['datatype'] + '"');
			}
			if (item['datatype'] !== undefined && item['datatype'] !== 'num' && item['composable'] !== false) {
				validate.error(context, 'dimensions of non-numeric data types must be non-composable');
			}
			if (item['datatype'] === 'tuple') {
				if (Math.floor(item['tuple-dimension']) !== Math.ceil(item['tuple-dimension']) || item['tuple-dimension'] < 2) {
					validate.error(context, 'value for "tuple-dimension" must be an integer >= 2 but is ' + item['tuple-dimension']);
				}
			} else {
				if (item['tuple-dimension'] !== undefined) {
					validate.error(context, 'only dimensions of datatype "tuple" may have a tuple-dimension');
				}
			}
			validate.ls(context, 'name', item['name']);
			validate.putIfOK(context, dimensionsMap, id, item);
		}
	}
	unit.loadDimensions(dimensionsMap);
	return dimensionsMap;
}

const prefixesMap = {};
function loadPrefixes(parent='.') {
	for (const file of fsutil.findFiles(parent, 'prefixes')) {
		const prefixes = JSON.parse(fs.readFileSync(file, 'utf8'));
		const context = file;
		for (const item of prefixes) {
			validate.start();
			validate.keys(context, item, ['base', 'exponent', 'symbol', 'format'], []);
			if (Math.ceil(item['base']) !== Math.floor(item['base']) || item['base'] < 2) {
				validate.error(context, 'value for "base" must be an integer >= 2 but is ' + item['base']);
			}
			if (Math.ceil(item['exponent']) !== Math.floor(item['exponent'])) {
				validate.error(context, 'value for "exponent" must be an integer but is ' + item['exponent']);
			}
			validate.string(context, 'symbol', item['symbol']);
			validate.ls(context, 'format', item['format'], '@');
			validate.putIfOK(context, prefixesMap, item['base'] + '^' + item['exponent'], item);
		}
	}
	unit.loadPrefixes(prefixesMap);
	return prefixesMap;
}

const unitTypeMap = {};
function loadUnitTypes(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'unit-types')) {
		const unitTypes = JSON.parse(fs.readFileSync(file, 'utf8'));
		for (const id of Object.keys(unitTypes)) {
			const context = file + ': unit type "' + id + '"';
			const item = unitTypes[id];
			validate.start();
			if (!id.match(/^t[0-9]+$/)) {
				validate.warning(context, 'identifier does not follow recommended pattern of t[0-9]+');
			}
			validate.keys(context, item, ['name'], ['icon', 'name-priority', 'dimension']);
			if (item['icon'] !== undefined) {
				validate.string(context, 'icon', item['icon']);
				if (!fs.existsSync(path.join(parent, 'typeicons', item['icon']))) {
					// validate.warning(context, 'value for "icon" refers to non-existent file "' + item['icon'] + '"');
				}
			}
			validate.ls(context, 'name', item['name']);
			if (item['name-priority'] !== undefined) {
				if (typeof item['name-priority'] !== 'number' || !isFinite(item['name-priority'])) {
					validate.error(context, 'value for "name-priority" must be a finite number');
				}
			}
			if (item['dimension'] !== undefined) {
				validate.dimension(context, 'dimension', item['dimension'], dimensionsMap);
			}
			validate.putIfOK(context, unitTypeMap, id, item);
		}
	}
	unit.loadUnitTypes(unitTypeMap);
	index.build({'type': 'unit-type'}, lang, unitTypeMap);
	return unitTypeMap;
}

const functionSourceMap = {};
const functionCompiledMap = {};
function parseFunctions(context, functions) {
	if (!(functions && typeof functions === 'object')) {
		validate.error(context, 'value for "functions" must be a non-null object');
		return;
	}
	for (const id of Object.keys(functions)) {
		const ctx = context + ': function "' + id + '"';
		if (!id.match(/^f[0-9]+$/)) {
			validate.warning(ctx, 'identifier does not follow recommended pattern of f[0-9]+');
		}
		let script = functions[id];
		if (script.join) script = script.join('\n');
		if (script && typeof script === 'string') {
			try {
				const fn = new vm.Script('(' + script + ')').runInNewContext(functionCompiledMap);
				if (typeof fn === 'function') {
					if (functionSourceMap[id] || functionCompiledMap[id]) {
						validate.error(ctx, 'duplicate function name');
					} else {
						functionSourceMap[id] = script;
						functionCompiledMap[id] = fn;
					}
				} else {
					validate.error(ctx, 'must compile to a JavaScript function');
				}
			} catch (e) {
				validate.error(ctx, 'must compile to a JavaScript function');
			}
		} else {
			validate.error(ctx, 'must be a non-empty string or array of strings');
		}
	}
}

const unitMap = {};
const unitMapAll = {};
function loadUnits(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'units')) {
		const units = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (units['functions'] !== undefined) {
			parseFunctions(file, units['functions']);
			delete units['functions'];
		}
		for (const id of Object.keys(units)) {
			const context = file + ': unit "' + id + '"';
			const item = units[id];
			validate.start();
			if (!id.match(/^[a-z][0-9]+$/)) {
				validate.warning(context, 'identifier does not follow recommended pattern of [a-z][0-9]+');
			} else if (id.startsWith('c')) {
				validate.warning(context, 'identifiers starting with "c" are reserved for units of currency');
			} else if (id.startsWith('e')) {
				validate.warning(context, 'identifiers starting with "e" are reserved for chemical element data');
			} else if (id.startsWith('f')) {
				validate.warning(context, 'identifiers starting with "f" are reserved for functions');
			} else if (id.startsWith('i')) {
				validate.warning(context, 'identifiers starting with "i" are reserved for includes');
			} else if (id.startsWith('s')) {
				validate.warning(context, 'identifiers starting with "s" are reserved for solvers and calculators');
			} else if (id.startsWith('t')) {
				validate.warning(context, 'identifiers starting with "t" are reserved for unit types');
			}
			if (item['datatype'] === undefined || item['datatype'] === 'num') {
				validate.keys(context, item, ['name'], ['symbol', 'datatype', 'multiplier', 'divisor', 'instructions', 'parser', 'formatter', 'legacy-mcsm-forward', 'legacy-mcsm-reverse', 'dimension']);
			} else if (item['datatype'] === 'text') {
				validate.keys(context, item, ['name', 'datatype', 'parser', 'formatter'], ['symbol', 'legacy-mc5-class', 'legacy-mc5-variant', 'dimension']);
			} else if (item['datatype'] === 'tuple') {
				validate.keys(context, item, ['name', 'datatype', 'tuple-dimension', 'parser', 'formatter'], ['symbol', 'legacy-mc5-class', 'legacy-mc5-variant', 'dimension']);
			} else if (item['datatype'] === 'dep') {
				validate.keys(context, item, ['name', 'datatype', 'dep-name', 'parser', 'formatter'], ['symbol', 'dep-dimension', 'legacy-mcsm-forward', 'legacy-mcsm-reverse', 'dimension']);
			} else if (item['datatype'] === 'cc') {
				validate.keys(context, item, ['name', 'datatype', 'cc-map', 'parser', 'formatter'], ['symbol', 'legacy-cc-stripe-configuration', 'dimension']);
			} else {
				validate.error(context, 'value for "datatype" must be "num", "text", "tuple", "dep", or "cc" but is "' + item['datatype'] + '"');
			}
			if (item['symbol'] !== undefined) {
				if (item['datatype'] === 'tuple') {
					if (item['symbol'] && typeof item['symbol'] === 'object' && item['symbol'].length === item['tuple-dimension']) {
						for (let i = 0; i < item['symbol'].length; i++) {
							if (!(item['symbol'][i] && typeof item['symbol'][i] === 'string')) {
								validate.error(context, 'value for "symbol", value at index ' + i + ' must be a non-empty string');
							}
						}
					} else {
						validate.error(context, 'value for "symbol" must be an array of length "tuple-dimension" (' + item['tuple-dimension'] + ')');
					}
				} else {
					validate.string(context, 'symbol', item['symbol']);
				}
			}
			validate.ls(context, 'name', item['name']);
			if (item['tuple-dimension'] !== undefined) {
				if (Math.floor(item['tuple-dimension']) !== Math.ceil(item['tuple-dimension']) || item['tuple-dimension'] < 2) {
					validate.error(context, 'value for "tuple-dimension" must be an integer >= 2 but is ' + item['tuple-dimension']);
				}
			}
			if (item['dep-name'] !== undefined) {
				validate.ls(context, 'dep-name', item['dep-name']);
			}
			if (item['dep-dimension'] !== undefined) {
				validate.dimension(context, 'dep-dimension', item['dep-dimension'], dimensionsMap);
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
									validate.error(ctx, 'key must be an integer');
								}
								const value = cc[key];
								if (value && typeof value === 'object') {
									validate.keys(ctx, value, ['color', 'name'], []);
									validate.string(ctx, 'color', value['color']);
									validate.ls(ctx, 'name', value['name']);
								} else {
									validate.error(ctx, 'value must be a non-null object');
								}
							}
						} else {
							validate.error(context, 'value for "cc-map", value at index ' + i + ' must be a non-null object');
						}
					}
				} else {
					validate.error(context, 'value for "cc-map" must be a non-empty array of non-null objects');
				}
			}
			if (item['multiplier'] !== undefined || item['divisor'] !== undefined) {
				if (item['instructions'] !== undefined) {
					validate.error(context, 'must not contain both "multiplier" and/or "divisor" and "instructions"');
				}
				if (item['parser'] !== undefined || item['formatter'] !== undefined) {
					validate.error(context, 'must not contain both "multiplier" and/or "divisor" and "parser" and/or "formatter"');
				}
				if (item['legacy-mcsm-forward'] !== undefined || item['legacy-mcsm-reverse'] !== undefined) {
					validate.error(context, 'must not contain both "multiplier" and/or "divisor" and "legacy-mcsm-forward" and/or "legacy-mcsm-reverse"');
				}
				const validateNumber = function(key) {
					if (item[key] !== undefined) {
						if (typeof item[key] === 'number') {
							if (Math.ceil(item[key]) !== Math.floor(item[key])) {
								validate.warning(context, 'value for "' + key + '" is a non-integer "' + item[key] + '" which may introduce rounding errors');
							} else if (Math.abs(item[key]) > 9007199254740991) {
								validate.warning(context, 'value for "' + key + '" is a large number "' + item[key] + '" which may introduce rounding errors');
							}
						} else if (typeof item[key] === 'string') {
							if (!Number.isFinite(+item[key])) {
								validate.error(context, 'value for "' + key + '" must be a string in number format but is "' + item[key] + '"');
							}
						} else {
							validate.error(context, 'value for "' + key + '" must be a number or string in number format');
						}
					}
				};
				validateNumber('multiplier');
				validateNumber('divisor');
			}
			if (item['instructions'] !== undefined) {
				if (item['parser'] !== undefined || item['formatter'] !== undefined) {
					validate.error(context, 'must not contain both "instructions" and "parser" and/or "formatter"');
				}
				if (item['legacy-mcsm-forward'] !== undefined || item['legacy-mcsm-reverse'] !== undefined) {
					validate.error(context, 'must not contain both "instructions" and "legacy-mcsm-forward" and/or "legacy-mcsm-reverse"');
				}
				if (srmp.validate(item['instructions'])) {
					const m = srmp.rationalize(item['instructions']);
					if (m) [item['multiplier'], item['divisor']] = m;
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
							validate.error(context, 'value for "instructions" failed to compile');
						}
					} catch (e) {
						validate.error(context, 'value for "instructions" failed to compile');
					}
				} else {
					validate.error(context, 'value for "instructions" must be a valid SRMP program but is "' + item['instructions'] + '"');
				}
			}
			if (item['parser'] !== undefined || item['formatter'] !== undefined) {
				if (item['parser'] === undefined || item['formatter'] === undefined) {
					validate.error(context, 'must contain both "parser" and "formatter"');
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
									validate.error(context, 'value for "' + key + '" must compile to a JavaScript function');
								}
							} catch (e) {
								validate.error(context, 'value for "' + key + '" must compile to a JavaScript function');
							}
						} else {
							validate.error(context, 'value for "' + key + '" must be a non-empty string or array of strings');
						}
					}
				};
				validateScript('parser');
				validateScript('formatter');
			}
			if (item['legacy-mcsm-forward'] !== undefined || item['legacy-mcsm-reverse'] !== undefined) {
				if (item['legacy-mcsm-forward'] === undefined || item['legacy-mcsm-reverse'] === undefined) {
					validate.error(context, 'must contain both "legacy-mcsm-forward" and "legacy-mcsm-reverse"');
				}
				const validateMCSM = function(key) {
					if (item[key] !== undefined) {
						const mcsm = item[key];
						if (mcsm && typeof mcsm === 'string') {
							const insts = mcsm.trim().split(/ +/);
							const vinsts = insts.filter(i => i.match(/^(&[!-~]|[!-~])([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([Ee][+-]?[0-9]+)?)?$/));
							if (insts.length !== vinsts.length) {
								validate.error(context, 'value for "' + key + '" must be a valid MCSM program but is "' + mcsm + '"');
							}
						} else {
							validate.error(context, 'value for "' + key + '" must be a non-empty string');
						}
					}
				};
				validateMCSM('legacy-mcsm-forward');
				validateMCSM('legacy-mcsm-reverse');
			}
			if (item['legacy-mc5-class'] !== undefined || item['legacy-mc5-variant'] !== undefined) {
				if (item['legacy-mc5-class'] === undefined || item['legacy-mc5-variant'] === undefined) {
					validate.error(context, 'must contain both "legacy-mc5-class" and "legacy-mc5-variant"');
				}
				if (!(typeof item['legacy-mc5-class'] === 'string' && item['legacy-mc5-class'].match(/^[A-Za-z_$][A-Za-z0-9_$]*$/))) {
					validate.error(context, 'value for "legacy-mc5-class" must be a valid Java identifier but is "' + item['legacy-mc5-class'] + '"');
				}
				if (!(typeof item['legacy-mc5-variant'] === 'number' && Math.ceil(item['legacy-mc5-variant']) === Math.floor(item['legacy-mc5-variant']))) {
					validate.error(context, 'value for "legacy-mc5-variant" must be an integer but is "' + item['legacy-mc5-variant'] + '"');
				}
			}
			if (item['legacy-cc-stripe-configuration'] !== undefined) {
				const ccStripeConfig = item['legacy-cc-stripe-configuration'];
				if (ccStripeConfig && typeof ccStripeConfig === 'object' && ccStripeConfig.length) {
					for (let i = 0; i < ccStripeConfig.length; i++) {
						const ccStripe = ccStripeConfig[i];
						if (ccStripe && typeof ccStripe === 'string') {
							if (!ccStripe.match(/^(d[0-9]+|e[+-]?[0-9]+)$/)) {
								validate.error(context, 'value for "legacy-cc-stripe-configuration", value at index ' + i + ' must be of the form d[0-9]+ or e[+-]?[0-9]+');
							}
						} else {
							validate.error(context, 'value for "legacy-cc-stripe-configuration", value at index ' + i + ' must be a non-empty string');
						}
					}
				} else {
					validate.error(context, 'value for "legacy-cc-stripe-configuration" must be a non-empty array of non-empty strings');
				}
			}
			if (item['dimension'] !== undefined) {
				validate.dimension(context, 'dimension', item['dimension'], dimensionsMap);
			}
			validate.putIfOK(context, unitMap, id, item);
			validate.putIfOK(context, unitMapAll, id, item);
		}
	}
	unit.loadFunctions(functionCompiledMap);
	unit.loadUnits(unitMap);
	index.build({'type': 'function'}, lang, functionSourceMap);
	index.build({'type': 'unit'}, lang, unitMap);
	return unitMap;
}

const includeMap = {};
function loadIncludes(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'includes')) {
		const includes = JSON.parse(fs.readFileSync(file, 'utf8'));
		for (const id of Object.keys(includes)) {
			const context = file + ': include "' + id + '"';
			const item = includes[id];
			validate.start();
			if (!id.match(/^i[0-9]+$/)) {
				validate.warning(context, 'identifier does not follow recommended pattern of i[0-9]+');
			} else if (String.fromCharCode(id.substring(1)).match(/\p{Sc}/u)) {
				validate.warning(context, 'identifier "' + id + '" is reserved for the currency category');
			}
			validate.keys(context, item, ['name', 'categories']);
			validate.ls(context, 'name', item['name']);
			if (item['categories'] && typeof item['categories'] === 'object' && item['categories'].length) {
				for (const cat of item['categories']) {
					if (cat['include'] !== undefined) {
						validate.keys(context, cat, ['include']);
						if (!includeMap[cat['include']] && ['i36','i162'].indexOf(cat['include']) < 0) {
							validate.error(context, 'value for "include" references undefined include "' + cat['include'] + '"');
						}
					} else {
						validate.keys(context, cat, ['type', 'units']);
						const catType = unitTypeMap[cat['type']];
						if (!catType) {
							validate.error(context, 'value for "type" references undefined unit type "' + cat['type'] + '"');
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
													index.build({'type': 'unit'}, lang, {[us]: u});
												}
											} else {
												validate.error(context, 'unit "' + us + '" is being included in an incompatible category');
											}
										} catch (e) {
											validate.error(context, 'unit "' + us + '" could not be compiled: ' + e);
										}
									}
								} else {
									validate.error(context, 'value for "units" must be a non-empty array of non-empty strings');
								}
							}
						} else {
							validate.error(context, 'value for "units" must be a non-empty array of non-empty strings');
						}
					}
				}
			} else {
				validate.error(context, 'value for "categories" must be a non-empty array');
			}
			validate.putIfOK(context, includeMap, id, item);
		}
	}
	index.build({'type': 'include'}, lang, includeMap);
	return includeMap;
}

const elementsMap = {};
const keyedElementsMap = {};
function loadElements(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'elements')) {
		const elements = JSON.parse(fs.readFileSync(file, 'utf8'));
		for (const id of Object.keys(elements)) {
			const context = file + ': element "' + id + '"';
			const item = elements[id];
			validate.start();
			if (Math.ceil(id) !== Math.floor(id)) {
				validate.error(context, 'identifier must be an integer');
			}
			validate.keys(context, item, ['symbol', 'name'], ['properties']);
			validate.string(context, 'symbol', item['symbol']);
			validate.ls(context, 'name', item['name']);
			if (item['properties'] !== undefined) {
				if (item['properties'] && typeof item['properties'] === 'object') {
					for (const key of Object.keys(item['properties'])) {
						const unitType = unitTypeMap[key];
						if (unitType) {
							const ctx = context + ': property "' + key + '"';
							const unitValue = item['properties'][key];
							validate.keys(ctx, unitValue, ['value', 'unit']);
							try {
								const u = unit.parse(unitValue['unit']);
								if (!da.eq(unitType['dimension'], u['dimension'])) {
									validate.error(ctx, 'unit "' + unitValue['unit'] + '" is not compatible with unit type "' + key + '"');
								}
							} catch (e) {
								validate.error(ctx, 'unit "' + unitValue['unit'] + '" could not be compiled: ' + e);
							}
						} else {
							validate.error(context, 'property declared for nonexistent unit type "' + key + '"');
						}
					}
				} else {
					validate.error(context, 'value for "properties" must be a non-null object');
				}
			}
			validate.putIfOK(context, elementsMap, id, item);
			validate.putIfOK(context, keyedElementsMap, 'e' + id, item);
		}
	}
	index.build({'type': 'element'}, lang, keyedElementsMap);
	return elementsMap;
}

const solversMap = {};
function loadSolvers(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'solvers')) {
		const solvers = JSON.parse(fs.readFileSync(file, 'utf8'));
		for (const id of Object.keys(solvers)) {
			const context = file + ': solver "' + id + '"';
			const item = solvers[id];
			validate.start();
			if (!id.match(/^s[0-9]+$/)) {
				validate.warning(context, 'identifier does not follow recommended pattern of s[0-9]+');
			}
			validate.keys(context, item, ['name', 'variables', 'solutions'], ['legacy-solutions-mcsm']);
			validate.ls(context, 'name', item['name']);
			if (item['variables'] && typeof item['variables'] === 'object' && item['variables'].length) {
				for (let i = 0; i < item['variables'].length; i++) {
					const ctx = context + ': variable at index ' + i;
					const v = item['variables'][i];
					validate.keys(ctx, v, ['type', 'register', 'name', 'unit'], ['dimension']);
					if (!(v['type'] === 'independent' || v['type'] === 'dependent')) {
						validate.error(ctx, 'value for "type" must be "independent" or "dependent" but is "' + v['type'] + '"');
					}
					if (Math.ceil(v['register']) !== Math.floor(v['register']) || v['register'] < 0) {
						validate.error(ctx, 'value for "register" must be a non-negative integer but is "' + v['register'] + '"');
					}
					validate.ls(ctx, 'name', v['name']);
					if (v['dimension'] !== undefined) {
						validate.dimension(ctx, 'dimension', v['dimension'], dimensionsMap);
					}
					try {
						const u = unit.parse(v['unit']);
						if (!da.eq(v['dimension'], u['dimension'])) {
							validate.error(ctx, 'unit "' + v['unit'] + '" is not compatible with this variable');
						}
					} catch (e) {
						if (v['unit'] && v['unit'].startsWith('c')) {
							if (!da.eq(v['dimension'], {'currency': 1})) {
								validate.error(ctx, 'unit "' + v['unit'] + '" is not compatible with this variable');
							}
						} else {
							validate.error(ctx, 'unit "' + v['unit'] + '" could not be compiled: ' + e);
						}
					}
				}
			} else {
				validate.error(context, 'value for "variables" must be a non-empty array of non-null objects');
			}
			if (item['solutions'] && typeof item['solutions'] === 'object') {
				item['solutions.source'] = {};
				item['solutions.compiled'] = {};
				for (const key of Object.keys(item['solutions'])) {
					const ctx = context + ': solution "' + key + '"';
					if (!validate.solverSolutionKeyValid(key)) {
						validate.error(ctx, 'key must be a comma-separated list of monotonically-increasing non-negative integers');
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
								validate.error(ctx, 'value must compile to a JavaScript function');
							}
						} catch (e) {
							validate.error(ctx, 'value must compile to a JavaScript function');
						}
					} else {
						validate.error(ctx, 'value must be a non-empty string or array of strings');
					}
				}
			} else {
				validate.error(context, 'value for "solutions" must be a non-null object');
			}
			if (item['legacy-solutions-mcsm'] !== undefined) {
				if (item['legacy-solutions-mcsm'] && typeof item['legacy-solutions-mcsm'] === 'object') {
					for (const key of Object.keys(item['legacy-solutions-mcsm'])) {
						const ctx = context + ': legacy solution "' + key + '"';
						if (!validate.solverSolutionKeyValid(key)) {
							validate.error(ctx, 'key must be a comma-separated list of monotonically-increasing non-negative integers');
						}
						const mcsm = item['legacy-solutions-mcsm'][key];
						if (mcsm && typeof mcsm === 'string') {
							const insts = mcsm.trim().split(/ +/);
							const vinsts = insts.filter(i => i.match(/^(&[!-~]|[!-~])([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([Ee][+-]?[0-9]+)?)?$/));
							if (insts.length !== vinsts.length) {
								validate.error(ctx, 'value for "' + key + '" must be a valid MCSM program but is "' + mcsm + '"');
							}
						} else {
							validate.error(ctx, 'value for "' + key + '" must be a non-empty string');
						}
					}
				} else {
					validate.error(context, 'value for "legacy-solutions-mcsm" must be a non-null object');
				}
			}
			validate.putIfOK(context, solversMap, id, item);
		}
	}
	index.build({'type': 'solver'}, lang, solversMap);
	return solversMap;
}

let ambiguities = [];
let resolvedAmbiguities = [];
let remainingAmbiguities = [];
function loadDisambiguation(parent='.', lang='en') {
	for (const file of fsutil.findFiles(parent, 'disambiguation')) {
		const disambiguation = JSON.parse(fs.readFileSync(file, 'utf8'));
		const context = file;
		validate.start();
		const langs = Object.keys(disambiguation);
		if (langs.indexOf(lang) < 0) {
			validate.error(context, 'must contain required key "' + lang + '"');
		}
		for (const lang of langs) {
			const entries = disambiguation[lang];
			if (entries && typeof entries === 'object') {
				for (const indexKey of Object.keys(entries)) {
					if (!(entries[indexKey] && typeof entries[indexKey] === 'object')) {
						validate.error(context, 'value for "' + lang + '", index "' + indexKey + '", must be a non-null object');
					}
				}
			} else {
				validate.error(context, 'value for "' + lang + '" must be a non-null object');
			}
		}
		if (!validate.ok()) continue;
		const results = index.disambiguate(lang, disambiguation);
		for (const indexKey of Object.keys(disambiguation[lang])) {
			if (results[indexKey] === undefined) {
				validate.warning(context, 'key "' + indexKey + '" did not match an ambiguous index entry');
			} else if (results[indexKey] === false) {
				validate.error(context, 'key "' + indexKey + '" failed to match exactly one candidate');
			} else if (results[indexKey] !== true) {
				validate.error(context, 'key "' + indexKey + '" caused an impossible condition');
			}
		}
	}
	ambiguities = Object.keys(index.index).filter(k => index.index[k].length > 1);
	resolvedAmbiguities = ambiguities.filter(k => index.index[k].filter(e => e.disambiguated).length == 1);
	remainingAmbiguities = ambiguities.filter(k => index.index[k].filter(e => e.disambiguated).length != 1);
}

function load(parent='.', lang='en') {
	if (!loadComposition(parent) || !loadCompositionOK()) return false;
	loadDegrees(parent); loadDimensions(parent); loadPrefixes(parent);
	loadUnitTypes(parent, lang); loadUnits(parent, lang);
	loadIncludes(parent, lang); loadElements(parent, lang);
	loadSolvers(parent, lang); loadDisambiguation(parent, lang);
	return true;
}

function summarize(logger) {
	if (logger === undefined) { logger = validate.logger(); } if (!logger) return;
	logger.log(Object.keys(unitTypeMap).length + ' unit types defined');
	logger.log(Object.keys(functionSourceMap).length + ' functions defined');
	logger.log(Object.keys(unitMap).length + ' units defined');
	logger.log(Object.keys(unitMapAll).length + ' units defined or included');
	logger.log(Object.keys(includeMap).length + ' includes defined');
	logger.log(Object.keys(elementsMap).length + ' elements defined');
	logger.log(Object.keys(solversMap).length + ' solvers or calculators defined');
	logger.log(Object.keys(index.index).length + ' terms in search index');
	logger.log(ambiguities.length + ' ambiguous terms originally in search index');
	logger.log(resolvedAmbiguities.length + ' ambiguous terms resolved by disambiguation');
	logger.log(remainingAmbiguities.length + ' ambiguous terms remaining in search index');
	logger.log(validate.totalErrorCount() + ' errors in data');
	logger.log(validate.totalWarningCount() + ' warnings in data');
}

module.exports = {
	degreesMap, dimensionsMap, prefixesMap, unitTypeMap,
	functionSourceMap, functionCompiledMap, unitMap, unitMapAll,
	includeMap, elementsMap, keyedElementsMap, solversMap,
	loadComposition, loadCompositionOK,
	loadDegrees, loadDimensions, loadPrefixes, loadUnitTypes,
	loadUnits, loadIncludes, loadElements, loadSolvers,
	loadDisambiguation, load, summarize
};
