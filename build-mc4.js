#!/usr/bin/env node

const fs = require('node:fs');
const da = require('./lib/dimension.js');
const ls = require('./lib/languagestring.js');
const srmp = require('./lib/srmp.js');
const test = require('./lib/testrunner.js');
const validate = require('./lib/validate.js');
const loader = require('./lib/validatingloader.js');

console.log('NOTICE: This script produces data files for an older version of');
console.log('MultiConvert which is no longer supported. DO NOT use these data');
console.log('files for new applications. Please use the JSON files directly.');
console.log();

console.log('NOTICE: Backporting to MultiConvert 4 is incomplete.');
console.log('The generated data file cannot be used as a wholesale');
console.log('replacement for the original data file.');
console.log();

// READ AND VALIDATE

if (!loader.load('.', 'en')) process.exit(1);
const dimensionsMap = loader.dimensionsMap;
const unitTypeMap = loader.unitTypeMap;
const functionSourceMap = loader.functionSourceMap;
const unitMapAll = loader.unitMapAll;
const includeMap = loader.includeMap;
const solversMap = loader.solversMap;
loader.summarize();

// VALIDATE AND RUN TESTS

test.summarize(test.runAllDir('.'));
if (validate.totalErrorCount()) process.exit(1);

// FUNCTIONS USED TO BUILD DATA FILES

function headerLines() {
	return [
		'<?php header(\'Content-type: text/plain; charset=utf8\'); error_reporting(0); ?>',
		'C\tThis is a data file for an older version of MultiConvert which',
		'C\tis no longer supported. DO NOT use this data file for new',
		'C\tapplications. Please use the JSON files in this repository:',
		'C\thttps://github.com/kreativekorp/multiconvert-data',
		'',
		'',
		'Important Announcement!',
		'BASECOMP\t0,0,0,0,0,0,0,0,0,foo1',
		'',
		'L\tMultiConvert 4 is no longer supported.',
		'-',
		'L\tPlease use MultiConvert 6,',
		'L\tavailable at the following URL:',
		'L\thttps://multiconvert.app',
		'-',
		'L\tYou can add MultiConvert 6 to your',
		'L\thome screen by tapping the Share',
		'L\tbutton (looks like a rectangle with',
		'L\tan arrow pointing upward) then the',
		'L\tAdd to Home Screen button (looks',
		'L\tlike a rectangle with a plus sign).',
		''
	];
}

function titleCase(name) {
	return (name
		.replaceAll(/\b\p{L}/gu, s => s.toUpperCase())
		.replaceAll(/\b(of|['ʼ’]s)\b/giu, s => s.toLowerCase())
	);
}

function dimensionString(d) {
	const indices = Object.values(dimensionsMap).map(v => v['legacy-id-mc5']).filter(isFinite);
	const fields = Array.from({length: Math.max(...indices) + 1}, () => '0');
	if (d) {
		for (const k of Object.keys(d)) {
			if (Math.ceil(d[k]) !== Math.floor(d[k])) return null;
			const fn = (
				(dimensionsMap[k]['legacy-id-mc5'] !== undefined) ? dimensionsMap[k]['legacy-id-mc5'] :
				(dimensionsMap[k]['legacy-id'] !== undefined) ? dimensionsMap[k]['legacy-id'] : k
			);
			if (isFinite(fn)) {
				fields[fn] = String(d[k] || 0);
			} else if (dimensionsMap[k]['composable'] === false) {
				return null;
			} else {
				fields.push([fn, d[k]].join(''));
			}
		}
	}
	return fields.join(',');
}

function dimensionDataType(d) {
	if (d) {
		for (const k of Object.keys(d)) {
			const dt = dimensionsMap[k]['datatype'];
			if (dt !== undefined && dt !== 'num') return dt;
		}
	}
	return 'num';
}

function srmpToMcsmString(i, reverse=false) {
	const operations = (reverse ? srmp.parseReverse(i) : srmp.parseForward(i));
	return operations.map(([opcode,operand]) => {
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

function unitToHString(id, item) {
	const tu = id.split(',');
	const ts = item['symbol'];
	const td = item['tuple-dimension'];
	if (tu && tu.length === td && ts && ts.length === td) {
		for (let i = 0; i < td; i++) {
			if (!(unitMapAll[tu[i]] && unitMapAll[tu[i]]['symbol'] === ts[i])) {
				return null;
			}
		}
		return ts.join(' ');
	}
	return null;
}

const mcnnvs = "(window.mcnnvs||(window.mcnnvs={}))";
const castNum = "function(n){return(n===undefined||n===null)?NaN:+n}";
const castText = "function(s){return(s===undefined||s===null)?'':s.join?s.join(','):(''+s)}";
const castTuple = "function(t){return(t===undefined||t===null)?[]:t.join?t:(''+t).split(',')}";

function addFunction(script, id, body) {
	script['ctx'][id] = body.join ? (body = body.join('\n')) : body;
	for (const m of body.matchAll(/\b(f[0-9]+)\b/g)) {
		if (functionSourceMap[m[1]] && !script['ctx'][m[1]]) {
			addFunction(script, m[1], functionSourceMap[m[1]]);
		}
	}
}

function addUnitFunctions(script, id, item) {
	// The MC4 parser (myUnitsToBaseUnits; script['p']) must accept a string and return a number.
	// The unit parser (item['parser']; id+'p') accepts <item['datatype']> and returns <script['utdt']>.
	if (item['parser'] !== undefined) {
		// function argument; most likely a string
		const arg = script['arg'];
		// parser input; must be <item['datatype']>
		let pin = arg;
		switch (item['datatype'] || 'num') {
			case 'num': script['ctx']['_n'] = castNum; pin = '_n(' + arg + ')'; break;
			case 'text': script['ctx']['_s'] = castText; pin = '_s(' + arg + ')'; break;
			case 'tuple': script['ctx']['_t'] = castTuple; pin = '_t(' + arg + ')'; break;
		}
		// parser output; most likely <script['utdt']>
		addFunction(script, id + 'p', item['parser']);
		const pout = id + 'p(' + pin + ')';
		// stored value; must be <script['utdt']>
		let base = pout;
		switch (script['utdt']) {
			case 'num': script['ctx']['_n'] = castNum; base = '_n(' + pout + ')'; break;
			case 'text': script['ctx']['_s'] = castText; base = '_s(' + pout + ')'; break;
			case 'tuple': script['ctx']['_t'] = castTuple; base = '_t(' + pout + ')'; break;
		}
		// return value; must be a number
		if (script['utdt'] !== 'num') script['ctx']['_a'] = mcnnvs;
		script['p'][script['i']] = (
			(script['utdt'] === 'num') ? ('return ' + base) :
			('_a[\'' + script['utid'] + '\']=' + base + ';return 0')
		);
	}
	// The MC4 formatter (baseUnitsToMyUnits; script['f']) must accept a number and return a string.
	// The unit formatter (item['formatter']; id+'f') accepts <script['utdt']> and returns <item['datatype']>.
	if (item['formatter'] !== undefined) {
		// function argument; most likely a number
		// or stored value; most likely <script['utdt']>
		if (script['utdt'] !== 'num') script['ctx']['_a'] = mcnnvs;
		const arg = (
			(script['utdt'] === 'num') ? script['arg'] :
			('_a[\'' + script['utid'] + '\']')
		);
		// formatter input; must be <script['utdt']>
		let fin = arg;
		switch (script['utdt']) {
			case 'num': script['ctx']['_n'] = castNum; fin = '_n(' + arg + ')'; break;
			case 'text': script['ctx']['_s'] = castText; fin = '_s(' + arg + ')'; break;
			case 'tuple': script['ctx']['_t'] = castTuple; fin = '_t(' + arg + ')'; break;
		}
		// formatter output; most likely <item['datatype']>
		addFunction(script, id + 'f', item['formatter']);
		const fout = id + 'f(' + fin + ')';
		// return value; must be a string
		script['ctx']['_s'] = castText;
		script['f'][script['i']] = 'return _s(' + fout + ')';
	}
	return script['file'] + ' ' + (script['i']++);
}

function buildUnit(script, units, id, dim) {
	if (id === '-') {
		units.push(id);
	} else if (id.startsWith('"') && id.endsWith('"')) {
		units.push('L\t' + id.substring(1, id.length-1));
	} else {
		const item = unitMapAll[id];
		const symb = item['symbol'] || '\u00A0';
		const sname = ls.get(item['name'], 'en', '1') || '\u00A0';
		const pname = ls.get(item['name'], 'en', '*') || '\u00A0';
		const comp = !da.eq(item['dimension'], dim);
		switch (item['datatype'] || 'num') {
			case 'num':
				if (item['legacy-mcsm-forward'] !== undefined || item['legacy-mcsm-reverse'] !== undefined) {
					const f = item['legacy-mcsm-forward'] || '*1';
					const r = item['legacy-mcsm-reverse'] || '*1';
					const f2 = (comp ? ((f === '*1') ? '|1' : ('|1 ' + f)) : f);
					const r2 = (comp ? ((r === '*1') ? '|1' : (r + ' |1')) : r);
					const fields = [sname, pname, symb, f2, r2];
					units.push(fields.join('\t'));
				} else if (item['parser'] !== undefined || item['formatter'] !== undefined) {
					const k = addUnitFunctions(script, id, item);
					const fields = [sname, pname, symb, k];
					units.push(fields.join('\t'));
				} else if (item['instructions'] !== undefined) {
					const i = srmpToMcsmString(item['instructions'], false);
					const j = srmpToMcsmString(item['instructions'], true);
					const j2 = (comp ? ((j === '*1') ? '|1' : ('|1 ' + j)) : j);
					const i2 = (comp ? ((i === '*1') ? '|1' : (i + ' |1')) : i);
					const fields = [sname, pname, symb, j2, i2];
					units.push(fields.join('\t'));
				} else if (item['multiplier'] !== undefined || item['divisor'] !== undefined) {
					const i = ratioToMcsmString(item['multiplier'], item['divisor']);
					const j = ratioToMcsmString(item['divisor'], item['multiplier']);
					const j2 = (comp ? ((j === '*1') ? '|1' : ('|1 ' + j)) : j);
					const i2 = (comp ? ((i === '*1') ? '|1' : (i + ' |1')) : i);
					const fields = [sname, pname, symb, j2, i2];
					units.push(fields.join('\t'));
				} else {
					const k = (comp ? '|1' : '*1');
					const fields = [sname, pname, symb, k, k];
					units.push(fields.join('\t'));
				}
				break;
			case 'text':
				if (item['parser'] !== undefined || item['formatter'] !== undefined) {
					const k = addUnitFunctions(script, id, item);
					const fields = [sname, pname, symb, k];
					units.push(fields.join('\t'));
				} else {
					units.push('C\tTODO ' + id);
				}
				break;
			case 'tuple':
				const hs = unitToHString(id, item);
				if (hs) {
					units.push('H\t' + hs);
				} else if (item['parser'] !== undefined || item['formatter'] !== undefined) {
					const k = addUnitFunctions(script, id, item);
					const fields = [sname, pname, symb, k];
					units.push(fields.join('\t'));
				} else {
					units.push('C\tTODO ' + id);
				}
				break;
			default:
				units.push('C\tTODO ' + id);
				break;
		}
	}
}

function buildInclude(linesets, id, cmp) {
	if (includeMap[id]) {
		for (const cat of includeMap[id]['categories']) {
			if (cat['include']) {
				if (includeMap[cat['include']]) {
					buildInclude(linesets, cat['include'], cmp);
				} else if (['i36','i162'].indexOf(cat['include']) >= 0) {
					const lines = [''];
					lines.push('Currency');
					lines.push('BASECOMP\t0,0,0,0,0,0,0,0,0,euro1');
					lines.push('');
					lines.push('<?php');
					lines.push('require_once dirname(__FILE__).\'/multiconvert-curr.php\';');
					lines.push('print_currency_mc4();');
					lines.push('?>');
					lines.push('');
					linesets['currency'] = lines;
				}
			} else {
				const name = ls.get(unitTypeMap[cat['type']]['name'], 'en', '*');
				const dim = unitTypeMap[cat['type']]['dimension'];
				const dims = dimensionString(dim), dimt = dimensionDataType(dim);
				const joke = dim && Object.keys(dim).filter(k => dimensionsMap[k]['joke']).length > 0;
				const script = {
					'file':cat['type']+'.mcjs',
					'utid':cat['type'], 'utdt':dimt,
					'ctx':{}, 'arg':'a', 'f':{}, 'p':{}, 'i':1
				};
				const units = [];
				for (const id of cat['units']) {
					buildUnit(script, units, id, dim);
				}
				if (units.length) {
					const lines = [''];
					if (joke) lines.push('<?php if (date("md") == \'0401\') { ?>');
					if (name) lines.push(titleCase(name));
					if (dims && !joke) lines.push('BASECOMP\t' + dims);
					const fkeys = Object.keys(script['f']).sort(cmp);
					const pkeys = Object.keys(script['p']).sort(cmp);
					if (fkeys.length || pkeys.length) {
						lines.push('', 'JAVASCRIPT\t' + script['file']);
						for (const k of Object.keys(script['ctx']).sort(cmp)) {
							lines.push('var ' + k + '=' + script['ctx'][k] + ';');
						}
						switch (fkeys.length) {
							case 0: lines.push('function baseUnitsToMyUnits(){return\'\'}'); break;
							case 1: lines.push('function baseUnitsToMyUnits(a){' + script['f'][fkeys[0]] + '}'); break;
							default:
								lines.push('function baseUnitsToMyUnits(a,b){switch(b){');
								for (const k of fkeys) lines.push('case ' + k + ':' + script['f'][k] + ';');
								lines.push('default:return\'\'}}'); break;
						}
						switch (pkeys.length) {
							case 0: lines.push('function myUnitsToBaseUnits(){return NaN}'); break;
							case 1: lines.push('function myUnitsToBaseUnits(a){' + script['p'][pkeys[0]] + '}'); break;
							default:
								lines.push('function myUnitsToBaseUnits(a,b){switch(b){');
								for (const k of pkeys) lines.push('case ' + k + ':' + script['p'][k] + ';');
								lines.push('default:return NaN}}'); break;
						}
						lines.push('/JAVASCRIPT');
					}
					lines.push('', ...units);
					if (joke) lines.push('<?php } ?>');
					lines.push('');
					linesets[name] = lines;
				}
			}
		}
	}
}

function buildSolver(linesets, id, cmp) {
	if (solversMap[id]) {
		const item = solversMap[id];
		const name = ls.get(item['name'], 'en', '*');
		const lines = [''];
		lines.push(titleCase(name));
		lines.push('');
		lines.push('C\tTODO ' + id);
		lines.push('');
		linesets[name] = lines;
	}
}

function buildMultiConvertPHP() {
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const linesets = {};
	buildInclude(linesets, 'i1', collator.compare);
	for (const key of Object.keys(solversMap)) {
		buildSolver(linesets, key, collator.compare);
	}
	const lines = headerLines();
	for (const key of Object.keys(linesets).sort(collator.compare)) {
		lines.push(...linesets[key]);
	}
	return lines;
}

fs.writeFileSync('multiconvert.php', buildMultiConvertPHP().join('\n'));
console.log('Wrote multiconvert.php');
