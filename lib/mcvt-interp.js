const da = require('./dimension.js');
const index = require('./index.js');
const ls = require('./languagestring.js');
const ops = require('./mcvt-ops.js');
const unit = require('./unitparser.js');

// LEXICALIZER FOR EXPRESSIONS

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

const tokenPattern = /(([0-9]+([.][0-9]*)?|[.][0-9]+)([Ee_][+-]?[0-9]+)?)|("((\\.|[^"])*)")|('((\\.|[^'])*)')|(`((\\.|[^`])*)`)|([\p{L}\p{M}][\p{L}\p{M}\p{N}]*|[\p{Sc}][\p{L}\p{M}\p{N}]+|[\p{Sc}][^\p{Cc}\p{Cf}\p{Z}]?)|(===|!==|:==|<<<|>>>|<=>|≠≠≠|==|!=|:=|<<|>>|<>|<=|>=|<-|->|=>|≠≠|##|&&|\*\*|\.\.|\/\/|\^\^|\|\||[^\p{Cc}\p{Cf}\p{Z}])/gu;
function lex(s) {
	const tokens = [];
	for (const m of s.matchAll(tokenPattern)) {
		if (m[1]) tokens.push({'type': 'value', 'value': Number(m[1].replaceAll('_', 'e')), 'image': m[0]});
		if (m[5]) tokens.push({'type': 'value', 'value': unescape(m[6]), 'image': m[0]});
		if (m[8]) tokens.push({'type': 'value', 'value': unescape(m[9]), 'image': m[0]});
		if (m[11]) tokens.push({'type': 'id', 'id': unescape(m[12]), 'image': m[0]});
		if (m[14]) {
			if (m[14].match(/^inf(inity)?$/i)) tokens.push({'type': 'value', 'value': Infinity, 'image': m[0]});
			else if (m[14].match(/^false$/i)) tokens.push({'type': 'value', 'value': false, 'image': m[0]});
			else if (m[14].match(/^true$/i)) tokens.push({'type': 'value', 'value': true, 'image': m[0]});
			else if (m[14].match(/^nan$/i)) tokens.push({'type': 'value', 'value': NaN, 'image': m[0]});
			else if (m[14].match(/^pi$/i)) tokens.push({'type': 'value', 'value': Math.PI, 'image': m[0]});
			else if (m[14].match(/^e$/i)) tokens.push({'type': 'value', 'value': Math.E, 'image': m[0]});
			else if (m[14] == '\u03C0') tokens.push({'type': 'value', 'value': Math.PI, 'image': m[0]});
			else if (m[14].match(/^at$/i)) tokens.push({'type': 'op', 'op': 'at', 'image': m[0]});
			else if (m[14].match(/^to$/i)) tokens.push({'type': 'op', 'op': 'to', 'image': m[0]});
			else tokens.push({'type': 'id', 'id': m[14], 'image': m[0]});
		}
		if (m[15]) {
			if (m[15] === '\u221E') tokens.push({'type': 'value', 'value': Infinity, 'image': m[0]});
			else tokens.push({'type': 'op', 'op': m[15], 'image': m[0]});
		}
	}
	return tokens;
}

// UTILITIES AND DATA FOR PARSING AND EVALUATING EXPRESSIONS

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

let logger = console;
const assumed = {};
function lookup(id) {
	const items = index.lookup(id);
	if (items) {
		if (items.length == 1) return items[0];
		const di = items.filter(item => item['disambiguated']);
		if (di.length == 1) {
			if (assumed[id] !== di[0]) {
				if (logger) {
					const type = di[0]['type'].replaceAll('-', ' ');
					const name = di[0]['value']['name'] && ls.get(di[0]['value']['name'], 'en', '*') || di[0]['key'];
					const dimn = da.empty(di[0]['value']['dimension']) ? '' : (' of ' + fmtdim(di[0]['value']['dimension'], di[0]['type']));
					const msgs = (typeof di[0]['disambiguated'] === 'string') ? di[0]['disambiguated'].split('|') : [];
					if (msgs[2]) logger.log(msgs[2]);
					logger.log('Assuming `' + id + '` is the ' + type + dimn + ' `' + name + '`.');
					if (msgs[0]) logger.log(msgs[0]);
					logger.log('Look up `' + id + '` alone to see all ' + items.length + ' options.');
					if (msgs[1]) logger.log(msgs[1]);
				}
				assumed[id] = di[0];
			}
			return di[0];
		}
		const msg1 = ('The identifier `' + id + '` is ambiguous.');
		const msg2 = ('Look up `' + id + '` alone to see all ' + items.length + ' options.');
		throw new Error(msg1 + '\n' + msg2);
	}
	try {
		const u = unit.parse(id);
		index.build({'type': 'unit'}, 'en', {[id]: u});
		return index.lookup(id)[0];
	} catch (e) {
		const msg = ('The identifier `' + id + '` does not correspond to any known object.');
		throw new Error(msg);
	}
}

const parentheses = {'(':')', '[':']', '{':'}'};
const exponentiationOps = ['**', '^', '↑', '↓', '_', '√'];
const unaryOps = ['+', '-', '~', '!', '¬', '√', '∛', '∜'];
const independentVariableOps = ['@', 'at'];
const conversionOps = ['=>', '->', '→', 'in', 'to'];
const binaryOps = [
	['*', '/', '//', '\\', '%', '÷', '×', '·'],
	['+', '-'],
	['<<', '>>', '<<<', '>>>'],
	['&'], ['#'], ['|'],
	['.', '..'],
	['<', '>', '<=', '>=', '≤', '≥'],
	['=', '==', '===', '<>', '!=', '!==', '<=>', '⇔', '≠', '≠≠', '≠≠≠'],
	['&&'], ['##'], ['||']
];
const assignmentOps = [':', ':=', ':==', '<-', '←'];
const listOps = [',', ';', '::'];

// Built-in functions.
const builtins = {
	'abs':           {'function': ops.abs,                         'arity': 1},
	'sgn':           {'function': ops.sign,                        'arity': 1},
	'sign':          {'function': ops.sign,                        'arity': 1},
	'signum':        {'function': ops.sign,                        'arity': 1},
	'sqrt':          {'function': ops.sqrt,                        'arity': 1},
	'cbrt':          {'function': ops.cbrt,                        'arity': 1},
	'qtrt':          {'function': ops.qtrt,                        'arity': 1},
	'toDegrees':     {'function': ops.toDegrees,                   'arity': 1},
	'toRadians':     {'function': ops.toRadians,                   'arity': 1},
	'todegrees':     {'function': ops.toDegrees,                   'arity': 1},
	'toradians':     {'function': ops.toRadians,                   'arity': 1},
	'toDeg':         {'function': ops.toDegrees,                   'arity': 1},
	'toRad':         {'function': ops.toRadians,                   'arity': 1},
	'todeg':         {'function': ops.toDegrees,                   'arity': 1},
	'torad':         {'function': ops.toRadians,                   'arity': 1},
	'isFinite':      {'function': ops.isFinite,                    'arity': 1},
	'isfinite':      {'function': ops.isFinite,                    'arity': 1},
	'isInfinite':    {'function': ops.isInfinite,                  'arity': 1},
	'isinfinite':    {'function': ops.isInfinite,                  'arity': 1},
	'isInf':         {'function': ops.isInfinite,                  'arity': 1},
	'isinf':         {'function': ops.isInfinite,                  'arity': 1},
	'isNaN':         {'function': ops.isNaN,                       'arity': 1},
	'isnan':         {'function': ops.isNaN,                       'arity': 1},
	'sum':           {'function': ops.sum,                         'arity': Infinity},
	'altsum':        {'function': ops.altsum,                      'arity': Infinity},
	'prod':          {'function': ops.prod,                        'arity': Infinity},
	'product':       {'function': ops.prod,                        'arity': Infinity},
	'altprod':       {'function': ops.altprod,                     'arity': Infinity},
	'altproduct':    {'function': ops.altprod,                     'arity': Infinity},
	'rsr':           {'function': ops.rsr,                         'arity': Infinity},
	'rms':           {'function': ops.rms,                         'arity': Infinity},
	'random':        {'function': ops.random,                      'arity': 1},
	'randomDecimal': {'function': ops.randomDecimal,               'arity': 1},
	'randomdecimal': {'function': ops.randomDecimal,               'arity': 1},
	'randomRange':   {'function': ops.randomRange,                 'arity': 2},
	'randomrange':   {'function': ops.randomRange,                 'arity': 2},
	'ceil':          {'function': ops.ceil,                        'arity': 1},
	'floor':         {'function': ops.floor,                       'arity': 1},
	'aug':           {'function': ops.aug,                         'arity': 1},
	'trunc':         {'function': ops.trunc,                       'arity': 1},
	'round':         {'function': ops.round,                       'arity': 1},
	'rint':          {'function': ops.round,                       'arity': 1},
	'int':           {'function': ops.trunc,                       'arity': 1},
	'frac':          {'function': ops.frac,                        'arity': 1},
	'exp':           {'function': (a => ops.exp(a, 0)),            'arity': 1},
	'exp1':          {'function': (a => ops.exp(a, 1)),            'arity': 1},
	'expm1':         {'function': (a => ops.exp(a, 1)),            'arity': 1},
	'exp2':          {'function': (a => ops.pow(2, a)),            'arity': 1},
	'exp10':         {'function': (a => ops.pow(10, a)),           'arity': 1},
	'ln':            {'function': (a => ops.ln(a, 0)),             'arity': 1},
	'ln1':           {'function': (a => ops.ln(a, 1)),             'arity': 1},
	'ln1p':          {'function': (a => ops.ln(a, 1)),             'arity': 1},
	'log':           {'function': (a => ops.ln(a, 0)),             'arity': 1},
	'log1':          {'function': (a => ops.ln(a, 1)),             'arity': 1},
	'log1p':         {'function': (a => ops.ln(a, 1)),             'arity': 1},
	'log2':          {'function': (a => ops.log(a, 2)),            'arity': 1},
	'log10':         {'function': (a => ops.log(a, 10)),           'arity': 1},
	'pow':           {'function': ops.pow,                         'arity': 2},
	'root':          {'function': ops.root,                        'arity': 2},
	'sin':           {'function': ops.sin,   'inverse': ops.asin,  'fname': [['sin', 1]],   'arity': 1},
	'cos':           {'function': ops.cos,   'inverse': ops.acos,  'fname': [['cos', 1]],   'arity': 1},
	'tan':           {'function': ops.tan,   'inverse': ops.atan,  'fname': [['tan', 1]],   'arity': 1},
	'cot':           {'function': ops.cot,   'inverse': ops.acot,  'fname': [['cot', 1]],   'arity': 1},
	'sec':           {'function': ops.sec,   'inverse': ops.asec,  'fname': [['sec', 1]],   'arity': 1},
	'csc':           {'function': ops.csc,   'inverse': ops.acsc,  'fname': [['csc', 1]],   'arity': 1},
	'asin':          {'function': ops.asin,  'inverse': ops.sin,   'fname': [['sin', -1]],  'arity': 1},
	'acos':          {'function': ops.acos,  'inverse': ops.cos,   'fname': [['cos', -1]],  'arity': 1},
	'atan':          {'function': ops.atan,  'inverse': ops.tan,   'fname': [['tan', -1]],  'arity': 1},
	'acot':          {'function': ops.acot,  'inverse': ops.cot,   'fname': [['cot', -1]],  'arity': 1},
	'asec':          {'function': ops.asec,  'inverse': ops.sec,   'fname': [['sec', -1]],  'arity': 1},
	'acsc':          {'function': ops.acsc,  'inverse': ops.csc,   'fname': [['csc', -1]],  'arity': 1},
	'sinh':          {'function': ops.sinh,  'inverse': ops.asinh, 'fname': [['sinh', 1]],  'arity': 1},
	'cosh':          {'function': ops.cosh,  'inverse': ops.acosh, 'fname': [['cosh', 1]],  'arity': 1},
	'tanh':          {'function': ops.tanh,  'inverse': ops.atanh, 'fname': [['tanh', 1]],  'arity': 1},
	'coth':          {'function': ops.coth,  'inverse': ops.acoth, 'fname': [['coth', 1]],  'arity': 1},
	'sech':          {'function': ops.sech,  'inverse': ops.asech, 'fname': [['sech', 1]],  'arity': 1},
	'csch':          {'function': ops.csch,  'inverse': ops.acsch, 'fname': [['csch', 1]],  'arity': 1},
	'asinh':         {'function': ops.asinh, 'inverse': ops.sinh,  'fname': [['sinh', -1]], 'arity': 1},
	'acosh':         {'function': ops.acosh, 'inverse': ops.cosh,  'fname': [['cosh', -1]], 'arity': 1},
	'atanh':         {'function': ops.atanh, 'inverse': ops.tanh,  'fname': [['tanh', -1]], 'arity': 1},
	'acoth':         {'function': ops.acoth, 'inverse': ops.coth,  'fname': [['coth', -1]], 'arity': 1},
	'asech':         {'function': ops.asech, 'inverse': ops.sech,  'fname': [['sech', -1]], 'arity': 1},
	'acsch':         {'function': ops.acsch, 'inverse': ops.csch,  'fname': [['csch', -1]], 'arity': 1},
	'hypot':         {'function': ops.hypot,                       'arity': 2},
	'atan2':         {'function': ops.atan2,                       'arity': 2},
	'radius':        {'function': ops.hypot,                       'arity': 2},
	'theta':         {'function': ((a,b) => ops.atan2(b,a)),       'arity': 2},
	'xcoord':        {'function': ops.xcoord,                      'arity': 2},
	'ycoord':        {'function': ops.ycoord,                      'arity': 2},
	'avg':           {'function': ops.average,                     'arity': Infinity},
	'average':       {'function': ops.average,                     'arity': Infinity},
	'geom':          {'function': ops.geomean,                     'arity': Infinity},
	'geomean':       {'function': ops.geomean,                     'arity': Infinity},
	'harm':          {'function': ops.harmean,                     'arity': Infinity},
	'harmean':       {'function': ops.harmean,                     'arity': Infinity},
	'min':           {'function': ops.min,                         'arity': Infinity},
	'max':           {'function': ops.max,                         'arity': Infinity},
	'minimum':       {'function': ops.min,                         'arity': Infinity},
	'maximum':       {'function': ops.max,                         'arity': Infinity},
	'stddev':        {'function': ops.pstddev,                     'arity': Infinity},
	'pstddev':       {'function': ops.pstddev,                     'arity': Infinity},
	'sstddev':       {'function': ops.sstddev,                     'arity': Infinity},
	'variance':      {'function': ops.pvariance,                   'arity': Infinity},
	'pvariance':     {'function': ops.pvariance,                   'arity': Infinity},
	'svariance':     {'function': ops.svariance,                   'arity': Infinity},
	'median':        {'function': ops.median,                      'arity': Infinity},
	'annuity':       {'function': ops.annuity,                     'arity': 2},
	'compound':      {'function': ops.compound,                    'arity': 2},
	'fact':          {'function': (a => ops.gamma(a + 1)),         'arity': 1},
	'lfact':         {'function': (a => ops.lgamma(a + 1)),        'arity': 1},
	'lnfact':        {'function': (a => ops.lgamma(a + 1)),        'arity': 1},
	'factorial':     {'function': (a => ops.gamma(a + 1)),         'arity': 1},
	'lfactorial':    {'function': (a => ops.lgamma(a + 1)),        'arity': 1},
	'lnfactorial':   {'function': (a => ops.lgamma(a + 1)),        'arity': 1},
	'gamma':         {'function': ops.gamma,                       'arity': 1},
	'lgamma':        {'function': ops.lgamma,                      'arity': 1},
	'lngamma':       {'function': ops.lgamma,                      'arity': 1},
	'beta':          {'function': ops.beta,                        'arity': 2},
	'lbeta':         {'function': ops.lbeta,                       'arity': 2},
	'lnbeta':        {'function': ops.lbeta,                       'arity': 2},
	'nCr':           {'function': ops.nCr,                         'arity': 2},
	'ncr':           {'function': ops.nCr,                         'arity': 2},
	'choose':        {'function': ops.nCr,                         'arity': 2},
	'nPr':           {'function': ops.nPr,                         'arity': 2},
	'npr':           {'function': ops.nPr,                         'arity': 2},
	'pick':          {'function': ops.nPr,                         'arity': 2},
	'agm':           {'function': ops.agm,                         'arity': 2},
	'gcd':           {'function': ops.gcd,                         'arity': 2},
	'lcm':           {'function': ops.lcm,                         'arity': 2},
	'reverseBits':   {'function': ops.reverseBits,                 'arity': 2},
	'reversebits':   {'function': ops.reverseBits,                 'arity': 2},
	'reverseBytes':  {'function': ops.reverseBytes,                'arity': 2},
	'reversebytes':  {'function': ops.reverseBytes,                'arity': 2},
	'bitLength':     {'function': ops.bitLength,                   'arity': 1},
	'bitlength':     {'function': ops.bitLength,                   'arity': 1},
	'bitMingle':     {'function': ops.bitMingle,                   'arity': 2},
	'bitmingle':     {'function': ops.bitMingle,                   'arity': 2},
	'bitSelect':     {'function': ops.bitSelect,                   'arity': 2},
	'bitselect':     {'function': ops.bitselect,                   'arity': 2},
	'bitand':        {'function': ops.bitand,                      'arity': Infinity},
	'bitxor':        {'function': ops.bitxor,                      'arity': Infinity},
	'bitor':         {'function': ops.bitor,                       'arity': Infinity},
	'and':           {'function': ops.and,                         'arity': Infinity},
	'all':           {'function': ops.and,                         'arity': Infinity},
	'xor':           {'function': ops.xor,                         'arity': Infinity},
	'or':            {'function': ops.or,                          'arity': Infinity},
	'any':           {'function': ops.or,                          'arity': Infinity},
	'equal':         {'function': ops.equal,                       'arity': Infinity},
	'asc':           {'function': ops.ascending,                   'arity': Infinity},
	'ascending':     {'function': ops.ascending,                   'arity': Infinity},
	'desc':          {'function': ops.descending,                  'arity': Infinity},
	'descending':    {'function': ops.descending,                  'arity': Infinity},
	'inc':           {'function': ops.increasing,                  'arity': Infinity},
	'incr':          {'function': ops.increasing,                  'arity': Infinity},
	'increasing':    {'function': ops.increasing,                  'arity': Infinity},
	'dec':           {'function': ops.decreasing,                  'arity': Infinity},
	'decr':          {'function': ops.decreasing,                  'arity': Infinity},
	'decreasing':    {'function': ops.decreasing,                  'arity': Infinity},
	'if':            {'function': ops.ifFunction,                  'arity': Infinity},
	'between':       {'function': ops.ascending,                   'arity': Infinity},
	'minmax':        {'function': ops.median,                      'arity': Infinity},
	'clamp':         {'function': ops.median,                      'arity': Infinity},
	'len':           {'function': (a => ops.str(a).length),        'arity': 1},
	'length':        {'function': (a => ops.str(a).length),        'arity': 1},
	'concat':        {'function': ops.concat,                      'arity': Infinity},
	'concatenate':   {'function': ops.concat,                      'arity': Infinity},
	'concatsp':      {'function': ops.concatsp,                    'arity': Infinity},
	'concatenatesp': {'function': ops.concatsp,                    'arity': Infinity},
	// TODO reverse, implode
	// TODO strcmp, offset, instr, rinstr, explode, replace, replaceAll
	// TODO left, center, right, mid, substr, substring
	// TODO lpad, cpad, rpad, trim, ltrim, rtrim
	// TODO ucase, tcase, lcase, format
	// TODO numToChar, charToNum, numToUni, uniToNum
	// TODO binToChar, charToBin, binToUni, uniToBin
	// TODO hash, rot13, html/url/urlQuery encode/decode
	// TODO head, tail, number, lconcat, lreverse, llength, map, filter, reduce
	// TODO atob, btoa, pack, unpack
	'idmatrix':      {'function': ops.idmatrix,                    'arity': 1},
	'transpose':     {'function': ops.transpose,                   'arity': 1},
	'det':           {'function': ops.det,                         'arity': 1},
	'minor':         {'function': ops.minor,                       'arity': 3},
	'cofactor':      {'function': ops.cofactor,                    'arity': 3},
	'comatrix':      {'function': ops.comatrix,                    'arity': 1},
	'adj':           {'function': ops.adj,                         'arity': 1},
	'inv':           {'function': ops.inv,                         'arity': 1},
};

// PARSER FOR EXPRESSIONS

function parseFactor(tokens, i) {
	if (!tokens[i]) {
		throw new Error('Expected value but found end of input.');
	} else if (tokens[i]['type'] === 'value') {
		return [tokens[i], i+1];
	} else if (tokens[i]['type'] === 'id') {
		return [tokens[i], i+1];
	} else if (tokens[i]['op'] === '(') {
		const [expr, j] = parseExpression(tokens, i+1);
		if (tokens[j] && tokens[j]['op'] === ')') return [expr, j+1];
		throw new Error('Expected ) but found ' + (tokens[j] ? tokens[j]['image'] : 'end of input') + '.');
	} else if (tokens[i]['op'] === '[') {
		if (tokens[i+1] && tokens[i+1]['op'] === ']') return [{'type': 'value', 'value': []}, i+2];
		const list = [];
		do { const [item, j] = parseAssignment(tokens, i+1); list.push(item); i = j; }
		while (tokens[i] && listOps.indexOf(tokens[i]['op']) >= 0);
		if (tokens[i] && tokens[i]['op'] === ']') return [{'type': 'list', 'items': list}, i+1];
		throw new Error('Expected ] but found ' + (tokens[i] ? tokens[i]['image'] : 'end of input') + '.');
	} else if (tokens[i]['op'] === '{') {
		if (tokens[i+1] && tokens[i+1]['op'] === '}') return [{'type': 'value', 'value': []}, i+2];
		const list = [];
		do { const [item, j] = parseAssignment(tokens, i+1); list.push(item); i = j; }
		while (tokens[i] && listOps.indexOf(tokens[i]['op']) >= 0);
		if (tokens[i] && tokens[i]['op'] === '}') return [{'type': 'list', 'items': list}, i+1];
		throw new Error('Expected } but found ' + (tokens[i] ? tokens[i]['image'] : 'end of input') + '.');
	} else {
		throw new Error('Expected value but found ' + tokens[i]['image'] + '.');
	}
}

function parseExponentiation(tokens, i) {
	const [left, j] = parseFactor(tokens, i);
	if (tokens[j] && exponentiationOps.indexOf(tokens[j]['op']) >= 0) {
		const [right, k] = parseExponentiation(tokens, j+1);
		const item = {'type': 'binary', 'op': tokens[j]['op'], 'arg1': left, 'arg2': right};
		return [item, k];
	} else {
		return [left, j];
	}
}

function parseConcatenation(tokens, i) {
	const [left, j] = parseExponentiation(tokens, i);
	if (tokens[j] && (!tokens[j]['op'] || parentheses[tokens[j]['op']])) {
		const [right, k] = parseConcatenation(tokens, j);
		const item = {'type': 'binary', 'op': '', 'arg1': left, 'arg2': right};
		return [item, k];
	} else {
		return [left, j];
	}
}

function parseUnary(tokens, i) {
	if (tokens[i] && unaryOps.indexOf(tokens[i]['op']) >= 0) {
		const [arg, j] = parseUnary(tokens, i+1);
		const item = {'type': 'unary', 'op': tokens[i]['op'], 'arg': arg};
		return [item, j];
	} else {
		return parseConcatenation(tokens, i);
	}
}

function parseIndependentVariable(tokens, i) {
	const [left, j] = parseUnary(tokens, i);
	if (tokens[j] && independentVariableOps.indexOf(tokens[j]['op']) >= 0) {
		const [right, k] = parseUnary(tokens, j+1);
		const item = {'type': 'binary', 'op': tokens[j]['op'], 'arg1': left, 'arg2': right};
		return [item, k];
	} else {
		return [left, j];
	}
}

function parseConversion(tokens, i) {
	const [left, j] = parseIndependentVariable(tokens, i);
	if (tokens[j] && conversionOps.indexOf(tokens[j]['op']) >= 0) {
		const [right, k] = parseIndependentVariable(tokens, j+1);
		const item = {'type': 'binary', 'op': tokens[j]['op'], 'arg1': left, 'arg2': right};
		return [item, k];
	} else {
		return [left, j];
	}
}

function parseBinary(tokens, i, prec) {
	let [left, j] = prec ? parseBinary(tokens, i, prec-1) : parseConversion(tokens, i);
	while (tokens[j] && binaryOps[prec].indexOf(tokens[j]['op']) >= 0) {
		const [right, k] = prec ? parseBinary(tokens, j+1, prec-1) : parseConversion(tokens, j+1);
		const item = {'type': 'binary', 'op': tokens[j]['op'], 'arg1': left, 'arg2': right};
		left = item; j = k;
	}
	return [left, j];
}

function parseAssignment(tokens, i) {
	const [lvalue, j] = parseBinary(tokens, i, binaryOps.length-1);
	if (tokens[j] && assignmentOps.indexOf(tokens[j]['op']) >= 0) {
		const [rvalue, k] = parseAssignment(tokens, j+1);
		const item = {'type': 'assignment', 'lvalue': lvalue, 'rvalue': rvalue};
		return [item, k];
	} else {
		return [lvalue, j];
	}
}

function parseExpression(tokens, i) {
	let [item, j] = parseAssignment(tokens, i);
	if (tokens[j] && listOps.indexOf(tokens[j]['op']) >= 0) {
		const list = [item];
		do { [item, j] = parseAssignment(tokens, j+1); list.push(item); }
		while (tokens[j] && listOps.indexOf(tokens[j]['op']) >= 0);
		return [{'type': 'list', 'items': list}, j];
	} else {
		return [item, j];
	}
}

function parse(tokens) {
	const [expr, i] = parseExpression(tokens, 0);
	if (i < tokens.length) throw new Error('Expected end of input but found ' + tokens[i]['image'] + '.');
	return expr;
}

// EVALUATOR FOR EXPRESSIONS

function evaluateUnary(op, a) {
	switch (op) {
		case '+': return ops.pos(a);
		case '-': return ops.neg(a);
		case '~': return ~a;
		case '!': return !ops.bool(a);
		case '¬': return !ops.bool(a);
		case '√': return ops.sqrt(a);
		case '∛': return ops.cbrt(a);
		case '∜': return ops.qtrt(a);
	}
	throw new Error('Cannot apply the operation ' + op + ' to ' + op.str(a) + '.');
}

function evaluateBinary(op, a, b) {
	switch (op) {
		case '**': case '^': case '↑':  return ops.pow(a, b);
		case '↓': case '_':             return ops.log(a, b);
		case '√':                       return ops.root(b, a);
		case '':                        return ops.cat(a, b);
		case '@': case 'at':            return ops.setiv(a, b);
		case '=>': case '->': case '→': return ops.convert(a, b);
		case 'in': case 'to':           return ops.convert(a, b);
		case '*': case '×': case '·':   return ops.mul(a, b);
		case '/': case '÷':             return ops.div(a, b);
		case '//': case '\\':           return ops.idiv(a, b);
		case '%':                       return ops.mod(a, b);
		case '+':                       return ops.add(a, b);
		case '-':                       return ops.sub(a, b);
		case '<<': case '<<<':          return a << b;
		case '>>':                      return a >> b;
		case '>>>':                     return a >>> b;
		case '&':                       return a & b;
		case '#':                       return a ^ b;
		case '|':                       return a | b;
		case '.':                       return ops.str(a) + ops.str(b);
		case '..':                      return ops.str(a) + ' ' + ops.str(b);
		case '<':                       return ops.cmp(a, b) < 0;
		case '>':                       return ops.cmp(a, b) > 0;
		case '<=': case '≤':            return ops.cmp(a, b) <= 0;
		case '>=': case '≥':            return ops.cmp(a, b) >= 0;
		case '=': case '==':            return ops.cmp(a, b) == 0;
		case '≠': case '≠≠':            return ops.cmp(a, b) != 0;
		case '<>': case '!=':           return ops.cmp(a, b) != 0;
		case '<=>': case '⇔':           return ops.cmp(a, b);
		case '===':                     return a === b;
		case '!==': case '≠≠≠':         return a !== b;
		case '&&':                      return ops.bool(a) && ops.bool(b);
		case '##':                      return ops.bool(a) != ops.bool(b);
		case '||':                      return ops.bool(a) || ops.bool(b);
	}
	throw new Error('Cannot apply the operation ' + op + ' to ' + op.str(a) + ' and ' + op.str(b) + '.');
}

function evaluate(expr, context) {
	switch (expr['type']) {
		case 'value':
			return expr['value'];
		case 'id':
			const id = expr['id'];
			if (context[id] !== undefined && context[id] !== null) return context[id];
			if (builtins[id]) return {'type': 'function', 'name': id, ...builtins[id]};
			return evaluate(lookup(id), context);
		case 'unary':
			const arg = evaluate(expr['arg'], context);
			return evaluateUnary(expr['op'], arg);
		case 'binary':
			const arg1 = evaluate(expr['arg1'], context);
			const arg2 = evaluate(expr['arg2'], context);
			return evaluateBinary(expr['op'], arg1, arg2);
		case 'assignment':
			const lvalue = expr['lvalue'];
			if (lvalue['type'] === 'id') {
				const rvalue = evaluate(expr['rvalue'], context);
				return context[lvalue['id']] = rvalue;
			} else {
				const lvalue = evaluate(expr['lvalue'], context);
				throw new Error('Cannot assign to ' + ops.str(lvalue) + '.');
			}
		case 'list':
			return expr['items'].map(e => evaluate(e, context));
		case 'function':
			if (expr['function']) return expr;
			return {'type': 'function', 'name': expr['key'], 'key': expr['key'], 'function': unit.functions[expr['key']]};
		case 'unit':
			return {'type': 'unit', 'name': expr['value']['name'] || expr['key'], 'key': expr['key'], 'unit': expr['value']};
		case 'unit-type':
			return {'type': 'unit-type', 'name': expr['value']['name'] || expr['key'], 'key': expr['key'], 'unit-type': expr['value']};
		case 'include':
			return {'type': 'include', 'name': expr['value']['name'] || expr['key'], 'key': expr['key'], 'include': expr['value']};
		case 'element':
			return {'type': 'element', 'name': expr['value']['name'] || expr['key'], 'key': expr['key'], 'element': expr['value']};
		case 'solver':
			return {'type': 'solver', 'name': expr['value']['name'] || expr['key'], 'key': expr['key'], 'solver': expr['value']};
	}
	throw new Error('Cannot evaluate this mystery object: ' + JSON.stringify(expr));
}

module.exports = {
	logger: (a => ((a === undefined) ? logger : (logger = a))),
	lex, parse, evaluate
};
