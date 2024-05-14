#!/usr/bin/env node

const fs = require('node:fs');
const readline = require('node:readline');
const fsutil = require('./lib/fsutilities.js');
const index = require('./lib/index.js');
const ls = require('./lib/languagestring.js');
const unit = require('./lib/unitparser.js');

// READ DATA

const composition = JSON.parse(fs.readFileSync('composition.json', 'utf8'));
unit.loadComposition(composition);

for (const file of fsutil.findFiles('.', 'degrees')) {
	const degrees = JSON.parse(fs.readFileSync(file, 'utf8'));
	unit.loadDegrees(degrees);
}

for (const file of fsutil.findFiles('.', 'dimensions')) {
	const dimensions = JSON.parse(fs.readFileSync(file, 'utf8'));
	unit.loadDimensions(dimensions);
}

for (const file of fsutil.findFiles('.', 'prefixes')) {
	const prefixes = JSON.parse(fs.readFileSync(file, 'utf8'));
	unit.loadPrefixes(prefixes);
}

for (const file of fsutil.findFiles('.', 'unit-types')) {
	const unitTypes = JSON.parse(fs.readFileSync(file, 'utf8'));
	index.build({'type': 'unit-type'}, 'en', unitTypes);
}

for (const file of fsutil.findFiles('.', 'units')) {
	const units = JSON.parse(fs.readFileSync(file, 'utf8'));
	if (units['functions'] !== undefined) {
		unit.loadFunctions(units['functions']);
		index.build({'type': 'function'}, 'en', units['functions']);
		delete units['functions'];
	}
	unit.loadUnits(units);
	index.build({'type': 'unit'}, 'en', units);
}

for (const file of fsutil.findFiles('.', 'includes')) {
	const includes = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const key of Object.keys(includes)) {
		const categories = includes[key]['categories'];
		if (categories && typeof categories === 'object' && categories.length) {
			for (const cat of categories) {
				const units = cat['units'];
				if (units && typeof units === 'object' && units.length) {
					for (const us of units) {
						if (us && typeof us === 'string') {
							if (!(us === '-' || (us.startsWith('"') && us.endsWith('"')))) {
								if (!index.cslookup(us)) {
									try {
										const u = unit.parse(us);
										index.build({'type': 'unit'}, 'en', {[us]: u});
									} catch (e) {}
								}
							}
						}
					}
				}
			}
		}
	}
	index.build({'type': 'include'}, 'en', includes);
}

for (const file of fsutil.findFiles('.', 'elements')) {
	const elements = JSON.parse(fs.readFileSync(file, 'utf8'));
	const keyedElements = {};
	for (const key of Object.keys(elements)) {
		keyedElements['e' + key] = elements[key];
	}
	index.build({'type': 'element'}, 'en', keyedElements);
}

for (const file of fsutil.findFiles('.', 'solvers')) {
	const solvers = JSON.parse(fs.readFileSync(file, 'utf8'));
	index.build({'type': 'solver'}, 'en', solvers);
}

for (const file of fsutil.findFiles('.', 'disambiguation')) {
	const disambiguation = JSON.parse(fs.readFileSync(file, 'utf8'));
	index.disambiguate('en', disambiguation);
}

// PROCESS COMMANDS

function fmtsym(s) {
	return s ? (s.join ? s.join(',') : s) : '';
}

function fmtname(n) {
	return n ? ls.get(n, 'en', '*') : '';
}

function fmtdim(d) {
	return d ? Object.keys(d).map(
		k => ((d[k] == 1) ? k : (k + '^' + d[k]))
	).join(' ') : '';
}

function trunc(s, w) {
	if (s === undefined || s === null) return '';
	if (w <= 0) return '';
	if (s.length <= w) return s;
	if (w <= 3) return '...'.substring(0, w);
	return s.substring(0, w - 3) + '...';
}

function width(s, w) {
	if (w <= 0) {
		return '';
	} else if (s === undefined || s === null) {
		s = ' ';
		while (s.length < w) s += s;
		return s.substring(0, w);
	} else if (s.length < w) {
		return s + width(null, w - s.length);
	} else {
		return trunc(s, w);
	}
}

function rept(s, w) {
	if (!s.length) s = ' ';
	while (s.length < w) s += s;
	return s.substring(0, w);
}

function printItems(items) {
	console.log('');
	const cols = [
		['d', ...items.map(item => item['disambiguated'] ? '*' : ' ')],
		['id', ...items.map(item => item['key'])],
		['type', ...items.map(item => item['type'])],
		['sym', ...items.map(item => fmtsym(item['value']['symbol']))],
		['name', ...items.map(item => fmtname(item['value']['name']))],
		['dimension', ...items.map(item => fmtdim(item['value']['dimension']))]
	];
	const colWidths = cols.map(col => Math.max(...col.map(s => s.length)));
	for (let r = 0; r <= items.length; r++) {
		const row = [];
		for (let c = 0; c < cols.length; c++) {
			row.push(width(cols[c][r], colWidths[c] + 4));
		}
		console.log(row.join(''));
		if (r === 0) {
			const hr = [];
			for (let c = 0; c < cols.length; c++) {
				hr.push(width(rept('-', colWidths[c]), colWidths[c] + 4));
			}
			console.log(hr.join(''));
		}
	}
	console.log('');
}

function unescape(s) {
	let r = '';
	for (let i = 0; i < s.length; i++) {
		if (s[i] === '\\' && (i + 1) < s.length) {
			i++;
			switch (s[i]) {
				case 'a': r += '\u0007'; break;
				case 'b': r += '\u0008'; break;
				case 't': r += '\u0009'; break;
				case 'n': r += '\n'; break;
				case 'v': r += '\u000B'; break;
				case 'f': r += '\u000C'; break;
				case 'r': r += '\r'; break;
				case 'o': r += '\u000E'; break;
				case 'i': r += '\u000F'; break;
				case 'z': r += '\u001A'; break;
				case 'e': r += '\u001B'; break;
				case 'd': r += '\u007F'; break;
				default: r += s[i]; break;
			}
		} else {
			r += s[i];
		}
	}
	return r;
}

const tokenPattern = /(([0-9]+([.][0-9]*)?|[.][0-9]+)([Ee_][+-]?[0-9]+)?)|("((\\.|[^"])*)")|('((\\.|[^'])*)')|(`((\\.|[^`])*)`)|([\p{L}\p{M}][\p{L}\p{M}\p{N}]*)|(==|!=|<=|>=|<>|<<|>>|[*][*]|[^\p{Cc}\p{Cf}\p{Z}])/gu;
function lex(s) {
	const tokens = [];
	for (const m of s.matchAll(tokenPattern)) {
		if (m[1]) tokens.push({'value': m[1].replaceAll('_', 'e')});
		if (m[5]) tokens.push({'value': unescape(m[6])});
		if (m[8]) tokens.push({'value': unescape(m[9])});
		if (m[11]) tokens.push({'id': unescape(m[12])});
		if (m[14]) {
			if (m[14].match(/^inf(inity)?$/i)) tokens.push({'value': 1/0});
			else if (m[14].match(/^nan$/i)) tokens.push({'value': NaN});
			else if (m[14].match(/^pi$/i)) tokens.push({'value': Math.PI});
			else if (m[14].match(/^e$/i)) tokens.push({'value': Math.E});
			else if (m[14] == '\u03C0') tokens.push({'value': Math.PI});
			else tokens.push({'id': m[14]});
		}
		if (m[15]) {
			if (m[15] === '\u221E') tokens.push({'value': 1/0});
			else tokens.push({'op': m[15]});
		}
	}
	return tokens;
}

const assumed = {};
function lookup(id) {
	const items = index.lookup(id);
	if (items) {
		if (items.length == 1) return items[0];
		const di = items.filter(item => item['disambiguated']);
		if (di.length == 1) {
			if (assumed[id] !== di[0]) {
				const type = di[0]['type'].replaceAll('-', ' ');
				const name = di[0]['value']['name'] && ls.get(di[0]['value']['name'], 'en', '*') || di[0]['id'];
				const dimn = di[0]['value']['dimension'] ? (' of ' + fmtdim(di[0]['value']['dimension'])) : '';
				console.log('Assuming `' + id + '` is the ' + type + dimn + ' `' + name + '`.');
				console.log('Look up `' + id + '` alone to see all ' + items.length + ' options.');
				assumed[id] = di[0];
			}
			return di[0];
		}
		console.log('The identifier `' + id + '` is ambiguous.');
		console.log('Look up `' + id + '` alone to see all ' + items.length + ' options.');
		return null;
	}
	try {
		const u = unit.parse(id);
		index.build({'type': 'unit'}, 'en', {[id]: u});
		return index.lookup(id)[0];
	} catch (e) {
		console.log('The identifier `' + id + '` does not correspond to any known object.');
		return null;
	}
}

function parse(tokens) {
	throw new Error('I can\'t evaluate expressions yet.');
}

function execute(command) {
	if (command === 'q' || command === 'quit' || command === 'exit') {
		process.exit(0);
		return;
	}
	// First try to look up objects directly.
	const items = index.lookup(command);
	if (items) {
		printItems(items);
		return;
	}
	try {
		const u = unit.parse(command);
		index.build({'type': 'unit'}, 'en', {[command]: u});
		printItems(index.lookup(command));
		return;
	} catch (e) {
		// ignore
	}
	// Lexicalize the input. If the input is a single identifier, try again to look up objects directly.
	const tokens = lex(command);
	if (tokens.length === 0) {
		return;
	} else if (tokens.length === 1 && tokens[0]['id']) {
		const items2 = index.lookup(tokens[0]['id']);
		if (items2) {
			printItems(items2);
			return;
		}
		try {
			const u = unit.parse(tokens[0]['id']);
			index.build({'type': 'unit'}, 'en', {[tokens[0]['id']]: u});
			printItems(index.lookup(tokens[0]['id']));
			return;
		} catch (e) {
			console.log('The identifier `' + tokens[0]['id'] + '` does not correspond to any known object.');
			return;
		}
	}
	// Parse the input as an expression.
	try {
		const r = parse(tokens);
		if (!(r === undefined || r === null)) {
			console.log(r);
		}
	} catch (e) {
		console.log(e.message);
	}
}

function shell() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: 'mcvt> '
	});
	rl.prompt();
	rl.on('line', line => {
		if (line = line.trim()) execute(line);
		rl.prompt();
	}).on('close', () => {
		console.log('');
		process.exit(0);
	});
}

if (process.argv.length > 2) {
	for (let i = 2; i < process.argv.length; i++) {
		execute(process.argv[i]);
	}
} else {
	shell();
}
