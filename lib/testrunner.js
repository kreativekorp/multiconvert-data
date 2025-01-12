const fs = require('node:fs');
const da = require('./dimension.js');
const fsutil = require('./fsutilities.js');
const index = require('./index.js');
const ls = require('./languagestring.js');
const unit = require('./unitparser.js');
const validate = require('./validate.js');

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

function testGetSolver(id) {
	for (const item of index.index[id]) {
		if (item['type'] === 'solver' && item['key'] === id) {
			return item['value'];
		}
	}
	return null;
}

function testRun(context, test) {
	let epsilon = 0;
	validate.start();
	if (test['solver'] !== undefined) {
		validate.keys(context, test, ['solver', 'solution-sets'], ['name', 'epsilon', 'ignore-solutions']);
		const solver = testGetSolver(test['solver']);
		const solutionSets = [];
		const ignoreSolutions = {};
		for (const key of Object.keys(test)) {
			const value = test[key];
			if (key === 'name') {
				context += ': ' + value;
			} else if (key === 'epsilon') {
				epsilon = Math.abs(value);
			} else if (key === 'solver') {
				if (!solver) {
					validate.error(context, 'solver "' + value + '" does not exist');
				}
			} else if (key === 'solution-sets') {
				if (value && typeof value === 'object' && value.length) {
					for (let i = 0; i < value.length; i++) {
						if (value[i] && typeof value[i] === 'object' && value[i].length) {
							solutionSets.push(value[i]);
						} else {
							validate.error(context, 'value for "solution-sets" at index ' + i + ' must be a non-empty array');
						}
					}
				} else {
					validate.error(context, 'value for "solution-sets" must be a non-empty array');
				}
			} else if (key === 'ignore-solutions') {
				if (value && typeof value === 'object' && value.length) {
					for (let i = 0; i < value.length; i++) {
						if (validate.solverSolutionKeyValid(value[i])) {
							ignoreSolutions[value[i].join ? value[i].join(',') : value[i]] = true;
						} else {
							validate.error(context, 'value for "ignore-solutions" at index ' + i + ' must be a list of monotonically-increasing non-negative integers');
						}
					}
				} else {
					validate.error(context, 'value for "ignore-solutions" must be a non-empty array');
				}
			} else {
				validate.error(context, 'unknown key "' + key + '"');
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
							validate.error(context, 'solution for [' + inr.join(',') + '] given [' + inr.map(ir => ss[ir]).join(',') + '] should be [' + ss.join(',') + '] but test produced [' + r.join(',') + ']');
						}
					}
				}
			}
		}
	} else {
		const inputs = [];
		const outputs = [];
		const depInputs = {};
		for (const key of Object.keys(test)) {
			const value = test[key];
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
								validate.error(context, 'unit "' + k + '" could not be compiled: ' + e);
							}
						}
					}
				} else {
					validate.error(context, 'value for "inputs" must be a non-null object');
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
								validate.error(context, 'unit "' + k + '" could not be compiled: ' + e);
							}
						}
					}
				} else {
					validate.error(context, 'value for "outputs" must be a non-null object');
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
								validate.error(context, 'unit "' + k + '" should not have a dep-input');
							}
						} catch (e) {
							validate.error(context, 'unit "' + k + '" could not be compiled: ' + e);
						}
					}
				} else {
					validate.error(context, 'value for "dep-inputs" must be a non-null object');
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
						validate.error(context, 'unit "' + key + '" could not be compiled: ' + e);
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
							validate.error(context, iv + ' ' + inputName + ' should be ' + ov + ' ' + outputName + ' but test produced ' + v + ' ' + outputName);
						}
					} else if (da.comp(iu['dimension'], ou['dimension'])) {
						const v = mcformat(ou, 1 / baseValue, depInputs);
						if (testEqual(v, ov, epsilon)) {
							// console.log('PASS: ' + context + ': ' + iv + ' ' + inputName + ' = ' + ov + ' ' + outputName);
						} else {
							validate.error(context, iv + ' ' + inputName + ' should be ' + ov + ' ' + outputName + ' but test produced ' + v + ' ' + outputName);
						}
					} else {
						validate.error(context, 'input unit "' + inputName + '" and output unit "' + outputName + '" are not compatible');
					}
				}
			}
		} else {
			validate.error(context, 'test case must have at least one input and at least one output');
		}
	}
	return validate.ok();
}

function testRunAll(context, tests) {
	let testsPassed = 0;
	let testsFailed = 0;
	let testsTotal = 0;
	for (const test of tests) {
		const ok = testRun(context, test);
		if (ok) testsPassed++;
		else testsFailed++;
		testsTotal++;
	}
	return [testsPassed, testsFailed, testsTotal];
}

function testRunAllFiles(files) {
	let testsPassed = 0;
	let testsFailed = 0;
	let testsTotal = 0;
	for (const file of files) {
		const tests = JSON.parse(fs.readFileSync(file, 'utf8'));
		const [p,f,t] = testRunAll(file, tests);
		testsPassed += p;
		testsFailed += f;
		testsTotal += t;
	}
	return [testsPassed, testsFailed, testsTotal];
}

function testRunAllDir(parent) {
	return testRunAllFiles(fsutil.findFiles(parent, 'tests'));
}

function summarize(testResults, logger) {
	if (logger === undefined) { logger = validate.logger(); } if (!logger) return;
	const [testsPassed, testsFailed, testsTotal] = testResults;
	logger.log(testsTotal + ' tests executed');
	logger.log(testsPassed + ' tests passed');
	logger.log(testsFailed + ' tests failed');
	logger.log(validate.totalErrorCount() + ' errors total');
	logger.log(validate.totalWarningCount() + ' warnings total');
}

module.exports = {
	run: testRun,
	runAll: testRunAll,
	runAllFiles: testRunAllFiles,
	runAllDir: testRunAllDir,
	summarize
};
