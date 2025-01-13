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

function fmtdim(d, t) {
	if (da.empty(d)) return '';
	const ds = da.str(d);
	if (t === 'unit-type') return ds;
	const tn = unit.type({'dimension': d})['name'];
	const ts = tn ? ls.get(tn, 'en', '*') : '';
	if (!ts || ts === ds) return ds;
	if (ds.replaceAll('-',' ') === ts) return ts;
	return ts + ' (' + ds + ')';
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
		['dimension', ...items.map(item => fmtdim(item['value']['dimension'], item['type']))]
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

// COMMANDS AND THEIR UTILITIES

function glob(s) {
	let r = '^';
	for (let i = 0; i < s.length; i++) {
		switch (s[i]) {
			case '?': r += '.'; break;
			case '*': r += '.*'; break;
			case '.': case '+': case '^': case '$': r += '\\' + s[i]; break;
			case '(': case ')': case '[': case ']': r += '\\' + s[i]; break;
			case '{': case '}': case '|': case '\\': r += '\\' + s[i]; break;
			default: r += s[i]; break;
		}
	}
	return new RegExp(r + '$');
}

function listItems(regexp, logerr) {
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const compare = (a,b) => collator.compare(a['type'], b['type']) || collator.compare(a['key'], b['key']);
	const keys = Object.keys(index.index).filter(k => k.match(regexp));
	const arrays = keys.map(k => index.index[k].filter(v => v['key'] === k));
	const items = arrays.reduce((a,b) => a.concat(b), []).sort(compare);
	if (items.length) {
		printItems(items);
		return true;
	} else {
		if (logerr) console.log('Found no objects with matching ids.');
		return false;
	}
}

function lookupItems(q, logerr, trace) {
	const items = index.lookup(q);
	if (items) {
		printItems(items);
		return true;
	} else try {
		const u = unit.parse(q);
		index.build({'type': 'unit'}, 'en', {[q]: u});
		printItems(index.lookup(q));
		return true;
	} catch (e) {
		if (logerr) console.log(trace ? e : e.message);
		return false;
	}
}

function tokenToId(token) {
	if ('id' in token) return token['id'];
	if ('value' in token) return token['value'];
	return token['image'];
}

const idPattern = /^([\p{L}\p{M}][\p{L}\p{M}\p{N}]*|[\p{Sc}][\p{L}\p{M}\p{N}]+|[\p{Sc}][^\p{Cc}\p{Cf}\p{Z}]?)$/u;
function printContext(context) {
	const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
	const keys = Object.keys(context).sort(collator.compare);
	for (const k of keys) {
		const ks = k.match(idPattern) ? k : ('`' + k + '`');
		console.log(ks + ' := ' + ops.str(context[k]));
	}
}

function evaluateArray(tokens, context, trace) {
	try {
		const expr = interp.parse(tokens);
		const result = interp.evaluate(expr, context);
		const values = (ops.type(result) === 'array') ? result : [result];
		let i = 0; for (const v of values) context['$' + (++i)] = v;
		context['$0'] = result; context['$*'] = ops.str(result);
		context['$@'] = values; context['$#'] = i;
		while (('$' + (++i)) in context) delete context['$' + i];
	} catch (e) {
		console.log(trace ? e : e.message);
	}
}

function evaluate(tokens, context, trace) {
	try {
		const expr = interp.parse(tokens);
		const result = interp.evaluate(expr, context);
		console.log(ops.str(result));
	} catch (e) {
		console.log(trace ? e : e.message);
	}
}

// COMMAND LINE INTERPRETER

function execute(command, context) {
	if (command === 'q' || command === 'quit' || command === 'exit') {
		process.exit(0);
		return;
	}
	if (command === 'list' || command.startsWith('list ')) {
		listItems(glob(command.substring(5).trim() || '*'), true);
		return;
	}
	if (command === 'lookup' || command.startsWith('lookup ')) {
		const q = command.substring(7).trim();
		if (!q) listItems(glob('*'), true);
		else lookupItems(q, true, ops.bool(context['trace']));
		return;
	}
	if (command === 'clear' || command.startsWith('clear ')) {
		const tokens = interp.lex(command.substring(6).trim());
		if (!tokens.length) {
			for (const k of Object.keys(context)) delete context[k];
		} else {
			for (const token of tokens) delete context[tokenToId(token)];
		}
		return;
	}
	if (command === 'unset' || command.startsWith('unset ')) {
		const tokens = interp.lex(command.substring(6).trim());
		for (const token of tokens) delete context[tokenToId(token)];
		return;
	}
	if (command === 'set' || command.startsWith('set ')) {
		const tokens = interp.lex(command.substring(4).trim());
		if (!tokens.length) printContext(context);
		else evaluateArray(tokens, context, ops.bool(context['trace']));
		return;
	}
	if (command === 'print' || command.startsWith('print ')) {
		const tokens = interp.lex(command.substring(6).trim());
		if (!tokens.length) console.log();
		else evaluate(tokens, context, ops.bool(context['trace']));
		return;
	}
	if (command.startsWith('?') || command.startsWith('=')) {
		const tokens = interp.lex(command.substring(1).trim());
		if (!tokens.length) console.log();
		else evaluate(tokens, context, ops.bool(context['trace']));
		return;
	}
	if (lookupItems(command)) return;
	const tokens = interp.lex(command);
	if (!tokens.length) return;
	if (tokens.length === 1 && tokens[0]['id'] && lookupItems(tokens[0]['id'])) return;
	evaluate(tokens, context, ops.bool(context['trace']));
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
