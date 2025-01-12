#!/usr/bin/env node

const readline = require('node:readline');
const da = require('./lib/dimension.js');
const index = require('./lib/index.js');
const ls = require('./lib/languagestring.js');
const loader = require('./lib/loader.js');
const interp = require('./lib/mcvt-interp.js');
const ops = require('./lib/mcvt-ops.js');
const unit = require('./lib/unitparser.js');

// UTILITIES FOR PRINTING ITEMS FROM SEARCH INDEX

function fmtsym(s) {
	return s ? (s.join ? s.join(',') : s) : '';
}

function fmtname(n) {
	return n ? ls.get(n, 'en', '*') : '';
}

function rept(s, w) {
	let r = '';
	while (w > 0) { r += s; w--; }
	return r;
}

function width(s, w) {
	if (w <= 0) return '';
	if (s === undefined || s === null) return rept(' ', w);
	if (s.length < w) return s + rept(' ', w - s.length);
	if (w <= 3) return '...'.substring(0, w);
	return s.substring(0, w - 3) + '...';
}

function printItems(items) {
	console.log('');
	const cols = [
		['d', ...items.map(item => item['disambiguated'] ? '*' : ' ')],
		['id', ...items.map(item => item['key'])],
		['type', ...items.map(item => item['type'])],
		['sym', ...items.map(item => fmtsym(item['value']['symbol']))],
		['name', ...items.map(item => fmtname(item['value']['name']))],
		['dimension', ...items.map(item => da.str(item['value']['dimension']))]
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

// COMMAND LINE INTERPRETER

function execute(command, context) {
	if (command === 'q' || command === 'quit' || command === 'exit') {
		process.exit(0);
		return;
	}
	if (command.match(/^[a-z]?[*]$/)) {
		const prefix = command.substring(0, command.length - 1);
		const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
		const compare = (a,b) => collator.compare(a['type'], b['type']) || collator.compare(a['key'], b['key']);
		const keys = Object.keys(index.index).filter(k => k.startsWith(prefix));
		const arrays = keys.map(k => index.index[k].filter(v => v['key'] === k));
		const items = arrays.reduce((a,b) => a.concat(b), []).sort(compare);
		if (items.length) printItems(items);
		else console.log('Found no objects whose ids start with \'' + prefix + '\'.');
		return;
	}
	// First try to look up objects directly.
	const items = index.lookup(command);
	if (items) {
		printItems(items);
		return;
	} else try {
		const u = unit.parse(command);
		index.build({'type': 'unit'}, 'en', {[command]: u});
		printItems(index.lookup(command));
		return;
	} catch (e) {
		// ignore
	}
	// Lexicalize the input. If the input is a single identifier, try again to look up objects directly.
	const tokens = interp.lex(command);
	if (tokens.length === 0) {
		return;
	} else if (tokens.length === 1 && tokens[0]['id']) {
		const items2 = index.lookup(tokens[0]['id']);
		if (items2) {
			printItems(items2);
			return;
		} else try {
			const u = unit.parse(tokens[0]['id']);
			index.build({'type': 'unit'}, 'en', {[tokens[0]['id']]: u});
			printItems(index.lookup(tokens[0]['id']));
			return;
		} catch (e) {
			// ignore
		}
	}
	// Parse the input as an expression.
	try {
		const expr = interp.parse(tokens);
		const result = interp.evaluate(expr, context);
		console.log(ops.str(result));
	} catch (e) {
		console.log(ops.bool(context['trace']) ? e : e.message);
	}
}

function shell(context) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: 'mcvt> '
	});
	rl.prompt();
	rl.on('line', line => {
		if (line = line.trim()) execute(line, context);
		rl.prompt();
	}).on('close', () => {
		console.log('');
		process.exit(0);
	});
}

function main(argv, context) {
	if (argv.length > 2) {
		for (let i = 2; i < argv.length; i++) {
			execute(argv[i], context);
		}
	} else {
		shell(context);
	}
}

loader.load('.', 'en');
main(process.argv, {});
