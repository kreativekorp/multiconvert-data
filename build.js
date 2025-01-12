#!/usr/bin/env node

const fs = require('node:fs');
const da = require('./lib/dimension.js');
const ls = require('./lib/languagestring.js');
const test = require('./lib/testrunner.js');
const validate = require('./lib/validate.js');
const loader = require('./lib/validatingloader.js');

// READ AND VALIDATE

if (!loader.load('.', 'en')) process.exit(1);
const degreesMap = loader.degreesMap;
const dimensionsMap = loader.dimensionsMap;
const prefixesMap = loader.prefixesMap;
const unitTypeMap = loader.unitTypeMap;
const functionSourceMap = loader.functionSourceMap;
const unitMap = loader.unitMap;
const includeMap = loader.includeMap;
const elementsMap = loader.elementsMap;
const solversMap = loader.solversMap;
loader.summarize();

// VALIDATE AND RUN TESTS

test.summarize(test.runAllDir('.'));
if (validate.totalErrorCount()) process.exit(1);

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

function buildMainJS() {
	const lines = [];
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

	lines.push('})(m);');
	return lines;
}

fs.writeFileSync('mcdbmain.js', buildMainJS().join('\n'));
console.log('Wrote mcdbmain.js');

// WRITE MCDBMISC.JS

function buildMiscJS() {
	const lines = [];
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

	lines.push('})(m);');
	return lines;
}

fs.writeFileSync('mcdbmisc.js', buildMiscJS().join('\n'));
console.log('Wrote mcdbmisc.js');
