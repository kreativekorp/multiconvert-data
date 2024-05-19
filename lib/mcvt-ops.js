const da = require('./dimension.js');
const ls = require('./languagestring.js');
const unit = require('./unit.js');

// SUPPLEMENT TO MATH OBJECT

function cot(a) { return 1 / Math.tan(a); }
function sec(a) { return 1 / Math.cos(a); }
function csc(a) { return 1 / Math.sin(a); }
function coth(a) { return 1 / Math.tanh(a); }
function sech(a) { return 1 / Math.cosh(a); }
function csch(a) { return 1 / Math.sinh(a); }
function acot(a) { return Math.PI/2 - Math.atan(a); }
function asec(a) { return Math.acos(1 / a); }
function acsc(a) { return Math.asin(1 / a); }
function acoth(a) { return Math.atanh(1 / a); }
function asech(a) { return Math.acosh(1 / a); }
function acsch(a) { return Math.asinh(1 / a); }

const inverseFunctions = {
	'sin': {'type': 'function', 'name': 'asin', 'key': 'asin', 'function': Math.asin},
	'cos': {'type': 'function', 'name': 'acos', 'key': 'acos', 'function': Math.acos},
	'tan': {'type': 'function', 'name': 'atan', 'key': 'atan', 'function': Math.atan},
	'cot': {'type': 'function', 'name': 'acot', 'key': 'acot', 'function': acot},
	'sec': {'type': 'function', 'name': 'asec', 'key': 'asec', 'function': asec},
	'csc': {'type': 'function', 'name': 'acsc', 'key': 'acsc', 'function': acsc},
	'sinh': {'type': 'function', 'name': 'asinh', 'key': 'asinh', 'function': Math.asinh},
	'cosh': {'type': 'function', 'name': 'acosh', 'key': 'acosh', 'function': Math.acosh},
	'tanh': {'type': 'function', 'name': 'atanh', 'key': 'atanh', 'function': Math.atanh},
	'coth': {'type': 'function', 'name': 'acoth', 'key': 'acoth', 'function': acoth},
	'sech': {'type': 'function', 'name': 'asech', 'key': 'asech', 'function': asech},
	'csch': {'type': 'function', 'name': 'acsch', 'key': 'acsch', 'function': acsch},
	'asin': {'type': 'function', 'name': 'sin', 'key': 'sin', 'function': Math.sin},
	'acos': {'type': 'function', 'name': 'cos', 'key': 'cos', 'function': Math.cos},
	'atan': {'type': 'function', 'name': 'tan', 'key': 'tan', 'function': Math.tan},
	'acot': {'type': 'function', 'name': 'cot', 'key': 'cot', 'function': cot},
	'asec': {'type': 'function', 'name': 'sec', 'key': 'sec', 'function': sec},
	'acsc': {'type': 'function', 'name': 'csc', 'key': 'csc', 'function': csc},
	'asinh': {'type': 'function', 'name': 'sinh', 'key': 'sinh', 'function': Math.sinh},
	'acosh': {'type': 'function', 'name': 'cosh', 'key': 'cosh', 'function': Math.cosh},
	'atanh': {'type': 'function', 'name': 'tanh', 'key': 'tanh', 'function': Math.tanh},
	'acoth': {'type': 'function', 'name': 'coth', 'key': 'coth', 'function': coth},
	'asech': {'type': 'function', 'name': 'sech', 'key': 'sech', 'function': sech},
	'acsch': {'type': 'function', 'name': 'csch', 'key': 'csch', 'function': csch},
};

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

// TYPE CONVERSION

function type(v) {
	if (v === null || typeof v !== 'object') return 'value';
	if (v instanceof Array) return 'array';
	return v['type'] || 'object';
}

function bool(v) {
	if (v === null || typeof v !== 'object') return !!v;
	if (v instanceof Array) return v.filter(bool).length > 0;
	return Object.keys(v).filter(k => bool(v[k])).length > 0;
}

function str(v) {
	if (v === null || typeof v !== 'object') return String(v);
	if (v instanceof Array) return '[ ' + v.map(str).join(', ') + ' ]';
	if (v['type'] === 'unit') {
		const unitName = ls.get(v['unit']['name'], 'en', '*');
		if (!v['depunit']) return 'unit `' + unitName + '`';
		const depValue = str(v['depvalue']);
		const depName = ls.get(v['depunit']['name'], 'en', v['depvalue']);
		return 'unit `' + unitName + ' at ' + depValue + ' ' + depName + '`';
	}
	if (v['type'] === 'value-unit') {
		const unitValue = str(v['value']);
		const unitName = ls.get(v['unit']['name'], 'en', v['value']);
		if (!v['depunit']) return unitValue + ' ' + unitName;
		const depValue = str(v['depvalue']);
		const depName = ls.get(v['depunit']['name'], 'en', v['depvalue']);
		return unitValue + ' ' + unitName + ' at ' + depValue + ' ' + depName;
	}
	const type = v['type'].replaceAll('-', ' ');
	const name = ls.get(v['name'], 'en', '*');
	return type + ' `' + name + '`';
}

function types(...args) {
	return args.map(type).join(' ');
}

// BASIC OPERATIONS

function pos(a) {
	switch (type(a)) {
		case 'value': return -(-a);
		case 'array': return a.map(pos);
		case 'unit': return {...a, 'type': 'value-unit', 'value': +1};
		case 'value-unit': return {...a, 'value': pos(a['value'])};
	}
	throw new Error('Cannot posit ' + str(a) + '.');
}

function neg(a) {
	switch (type(a)) {
		case 'value': return -a;
		case 'array': return a.map(neg);
		case 'unit': return {...a, 'type': 'value-unit', 'value': -1};
		case 'value-unit': return {...a, 'value': neg(a['value'])};
	}
	throw new Error('Cannot negate ' + str(a) + '.');
}

function add(a, b) {
	switch (types(a, b)) {
		case 'value value': return a - (-b);
		case 'array value': return a.map(e => add(e, b));
		case 'value array': return b.map(e => add(a, e));
		case 'array array':
			const c = [];
			for (let i = 0; i < a.length || i < b.length; i++) {
				const ai = (i < a.length) ? a[i] : 0;
				const bi = (i < b.length) ? b[i] : 0;
				c.push(add(ai, bi));
			}
			return c;
		case 'unit unit':
		case 'value-unit unit':
		case 'unit value-unit':
		case 'value-unit value-unit':
			if (!unit.composable(a['unit'], b['unit'])) break;
			if (!da.eq(a['unit']['dimension'], b['unit']['dimension'])) break;
			const u2value = ((b['type'] === 'value-unit') ? b['value'] : 1);
			const u2pfn = unit.parserFor(b['unit']);
			const u1ffn = unit.formatterFor(a['unit']);
			const u1value = ((a['type'] === 'value-unit') ? a['value'] : 1);
			const nu1value = add(u1value, u1ffn(u2pfn(u2value)));
			return {...a, 'type': 'value-unit', 'value': nu1value};
	}
	throw new Error('Cannot add ' + str(a) + ' and ' + str(b) + '.');
}

function sub(a, b) {
	switch (types(a, b)) {
		case 'value value': return a - b;
		case 'array value': return a.map(e => sub(e, b));
		case 'value array': return b.map(e => sub(a, e));
		case 'array array':
			const c = [];
			for (let i = 0; i < a.length || i < b.length; i++) {
				const ai = (i < a.length) ? a[i] : 0;
				const bi = (i < b.length) ? b[i] : 0;
				c.push(sub(ai, bi));
			}
			return c;
		case 'unit unit':
		case 'value-unit unit':
		case 'unit value-unit':
		case 'value-unit value-unit':
			if (!unit.composable(a['unit'], b['unit'])) break;
			if (!da.eq(a['unit']['dimension'], b['unit']['dimension'])) break;
			const u2value = ((b['type'] === 'value-unit') ? b['value'] : 1);
			const u2pfn = unit.parserFor(b['unit']);
			const u1ffn = unit.formatterFor(a['unit']);
			const u1value = ((a['type'] === 'value-unit') ? a['value'] : 1);
			const nu1value = sub(u1value, u1ffn(u2pfn(u2value)));
			return {...a, 'type': 'value-unit', 'value': nu1value};
	}
	throw new Error('Cannot subtract ' + str(a) + ' and ' + str(b) + '.');
}

function mul(a, b) {
	switch (types(a, b)) {
		case 'value value': return a * b;
		case 'array value': return a.map(e => mul(e, b));
		case 'value array': return b.map(e => mul(a, e));
		case 'array array':
			return a.map(row => {
				if (!row.length && !b.length) return [];
				let res = mul(row[0], b[0]);
				for (let i = 1; i < row.length || i < b.length; i++) {
					res = add(res, mul(row[i], b[i]));
				}
				return res;
			});
		case 'unit value': case 'unit array': return {...a, 'type': 'value-unit', 'value': b};
		case 'value unit': case 'array unit': return {...b, 'type': 'value-unit', 'value': a};
		case 'value-unit value': case 'value-unit array': return {...a, 'value': mul(a['value'], b)};
		case 'value value-unit': case 'array value-unit': return {...b, 'value': mul(a, b['value'])};
		case 'unit unit':
			const uu = unit.mul(a['unit'], b['unit']);
			if (uu) return {'type': 'unit', 'unit': uu};
			break;
		case 'value-unit unit':
			const vu = unit.mul(a['unit'], b['unit']);
			if (vu) return {'type': 'value-unit', 'unit': vu, 'value': a['value']};
			break;
		case 'unit value-unit':
			const uv = unit.mul(a['unit'], b['unit']);
			if (uv) return {'type': 'value-unit', 'unit': uv, 'value': b['value']};
			break;
		case 'value-unit value-unit':
			const vv = unit.mul(a['unit'], b['unit']);
			if (vv) return {'type': 'value-unit', 'unit': vv, 'value': mul(a['value'], b['value'])};
			break;
		case 'function function':
			const af = a['function'];
			const bf = b['function'];
			const cf = function(x) { return af(bf(x)); }
			return {'type': 'function', 'name': a['name'] + '*' + b['name'], 'function': cf};
	}
	throw new Error('Cannot multiply ' + str(a) + ' and ' + str(b) + '.');
}

function div(a, b) {
	switch (types(a, b)) {
		case 'value value': return a / b;
		case 'array value': return a.map(e => div(e, b));
		case 'value array':
			const vai = inv(b);
			if (!vai) throw new Error('Cannot invert the matrix ' + str(b) + '.');
			return mul(a, vai);
		case 'array array':
			const aai = inv(b);
			if (!aai) throw new Error('Cannot invert the matrix ' + str(b) + '.');
			return mul(a, aai);
		case 'unit value': case 'unit array': return {...a, 'type': 'value-unit', 'value': pow(b, -1)};
		case 'value unit': case 'array unit': return {...pow(b, -1), 'type': 'value-unit', 'value': a};
		case 'value-unit value': case 'value-unit array': return {...a, 'value': div(a['value'], b)};
		case 'value value-unit': case 'array value-unit': return {...pow(b, -1), 'value': div(a, b['value'])};
		case 'unit unit':
			const uu = unit.div(a['unit'], b['unit']);
			if (uu) return {'type': 'unit', 'unit': uu};
			break;
		case 'value-unit unit':
			const vu = unit.div(a['unit'], b['unit']);
			if (vu) return {'type': 'value-unit', 'unit': vu, 'value': a['value']};
			break;
		case 'unit value-unit':
			const uv = unit.div(a['unit'], b['unit']);
			if (uv) return {'type': 'value-unit', 'unit': uv, 'value': pow(b['value'], -1)};
			break;
		case 'value-unit value-unit':
			const vv = unit.div(a['unit'], b['unit']);
			if (vv) return {'type': 'value-unit', 'unit': vv, 'value': div(a['value'], b['value'])};
			break;
		case 'function function':
			const ffi = inverseFunctions[b['name']];
			if (!ffi) throw new Error('Cannot invert the function `' + b['name'] + '`.');
			return mul(a, ffi);
	}
	throw new Error('Cannot divide ' + str(a) + ' and ' + str(b) + '.');
}

function genpow(a, b, c) {
	if (!b) return c;
	let first = true;
	for (;;) {
		if (b & 1) {
			if (first) {
				first = false;
				c = a;
			} else {
				c = mul(c, a);
			}
		}
		b >>= 1;
		if (!b) return c;
		a = mul(a, a);
	}
}

function pow(a, b) {
	switch (types(a, b)) {
		case 'value value':
			return a ** b;
		case 'array value':
			if (!isFinite(b) || Math.ceil(b) !== Math.floor(b)) {
				throw new Error('Cannot raise a matrix to a non-integer power.');
			}
			if (b < 0) {
				const i = inv(a);
				if (!i) throw new Error('Cannot invert the matrix ' + str(a) + '.');
				a = i; b = -b;
			}
			if (b == 0) return idmatrix(a.length);
			if (b == 1) return a;
			return genpow(a, b);
		case 'unit value':
			const u = unit.pow(a['unit'], b);
			if (u) return {'type': 'unit', 'unit': u};
			break;
		case 'value-unit value':
			const v = unit.pow(a['unit'], b);
			if (v) return {'type': 'value-unit', 'unit': v, 'value': pow(a['value'], b)};
			break;
		case 'function value':
			if (!isFinite(b) || Math.ceil(b) !== Math.floor(b)) {
				throw new Error('Cannot raise a function to a non-integer power.');
			}
			if (b < 0) {
				const i = inverseFunctions[a['name']];
				if (!i) throw new Error('Cannot invert the function `' + a['name'] + '`.');
				a = i; b = -b;
			}
			if (b == 0) return {'type': 'function', 'name': 'id', 'function': (a => a)};
			if (b == 1) return a;
			return genpow(a, b);
	}
	throw new Error('Cannot exponentiate ' + str(a) + ' and ' + str(b) + '.');
}

function root(a, b) {
	if (type(a) === 'value' && type(b) === 'value') {
		if (b == 2) return Math.sqrt(a);
		if (b == 3) return Math.cbrt(a);
	}
	return pow(a, pow(b, -1));
}

function log(a, b) {
	if (type(a) === 'value' && type(b) === 'value') {
		if (b == 2 && Math.log2) return Math.log2(a);
		if (b == 10 && Math.log10) return Math.log10(a);
		return Math.log(a) / Math.log(b);
	}
	throw new Error('Cannot take the logarithm of ' + str(a) + ' in base ' + str(b) + '.');
}

function cat(a, b) {
	switch (types(a, b)) {
		case 'array array': for (const i of b) a = a[i]; return a;
		case 'function value': return a['function'](b);
		case 'function array': return a['function'](...b);
	}
	return mul(a, b);
}

// UNARY FUNCTIONS

function toDegrees(a) {
	return mul(a, 180/Math.PI);
}

function toRadians(a) {
	return mul(a, Math.PI/180);
}

function abs(a) {
	if (type(a) === 'value') return Math.abs(a);
	throw new Error('Cannot get the absolute value of ' + str(a) + '.');
}

function sqrt(a) {
	if (type(a) === 'value') return Math.sqrt(a);
	return pow(a, 0.5);
}

function cbrt(a) {
	if (type(a) === 'value') return Math.cbrt(a);
	return pow(a, 1/3);
}

function qtrt(a) {
	if (type(a) === 'value') return Math.sqrt(Math.sqrt(a));
	return pow(a, 0.25);
}

// VARARG FUNCTIONS

function sum() {
	if (arguments.length === 0) return 0;
	let v = arguments[0];
	for (let i = 1; i < arguments.length; i++) {
		v = add(v, arguments[i]);
	}
	return v;
}

function altsum() {
	if (arguments.length === 0) return 0;
	let v = arguments[0];
	for (let i = 1; i < arguments.length; i++) {
		v = (i & 1) ? sub(v, arguments[i]) : add(v, arguments[i]);
	}
	return v;
}

function prod() {
	if (arguments.length === 0) return 1;
	let v = arguments[0];
	for (let i = 1; i < arguments.length; i++) {
		v = mul(v, arguments[i]);
	}
	return v;
}

function rsr() {
	if (arguments.length === 0) return 0;
	const r = Array.from(arguments).map(e => pow(e, -1));
	return pow(sum(...r), -1);
}

// MATRIX OPERATIONS

function idmatrix(n) {
	const a = [];
	for (let i = 0; i < n; i++) {
		const b = [];
		for (let j = 0; j < n; j++) {
			b.push((i == j) ? 1 : 0);
		}
		a.push(b);
	}
	return a;
}

function transpose(a) {
	const t = [];
	const n = Math.max(...a.map(e => e.length));
	for (let i = 0; i < n; i++) t.push(a.map(e => e[i]));
	return t;
}

function det(a) {
	if (a.length === 0) return 1;
	if (a.length === 1) return a[0][0];
	const rows = a.slice(1);
	let d1 = mul(a[0][0], det(rows.map(r => { (r = r.slice()).splice(0,1); return r; })));
	for (let i = 1; i < a.length; i++) {
		const d2 = mul(a[0][i], det(rows.map(r => { (r = r.slice()).splice(i,1); return r; })));
		d1 = (i & 1) ? sub(d1, d2) : add(d1, d2);
	}
	return d1;
}

function minor(a, i, j) {
	(a = a.slice()).splice(i,1);
	return det(a.map(r => { (r = r.slice()).splice(j,1); return r; }));
}

function cofactor(a, i, j) {
	const m = minor(a, i, j);
	return ((i+j) & 1) ? neg(m) : m;
}

function comatrix(a) {
	const b = [];
	for (let i = 0; i < a.length; i++) {
		const c = [];
		for (let j = 0; j < a.length; j++) {
			c.push(cofactor(a, i, j));
		}
		b.push(c);
	}
	return b;
}

function adj(a) {
	return transpose(comatrix(a));
}

function inv(a) {
	const d = det(a);
	if (!d) return null;
	return div(adj(a), d);
}

// CONVERSION OPERATIONS

function setiv(a, b) {
	if (b && typeof b === 'object' && b['type'] === 'value-unit') {
		if (a && typeof a === 'object' && (a['type'] === 'unit' || a['type'] === 'value-unit')) {
			if (a['unit']['datatype'] !== 'dep') {
				throw new Error(
					'Cannot set independent variable ' + str(b) + ' on ' + str(a) + '.' +
					' The unit `' + ls.get(a['unit']['name'], 'en', '*') +
					'` does not take an independent variable.'
				);
			}
			if (!da.eq(a['unit']['dep-dimension'], b['unit']['dimension'])) {
				throw new Error(
					'Cannot set independent variable ' + str(b) + ' on ' + str(a) + '.' +
					' The unit `' + ls.get(b['unit']['name'], 'en', '*') +
					'` does not have the required dimensions.'
				);
			}
			return {...a, 'depvalue': b['value'], 'depunit': b['unit']};
		}
	}
	throw new Error('Cannot set independent variable ' + str(b) + ' on ' + str(a) + '.');
}

function convert(a, b) {
	if (b && typeof b === 'object' && b['type'] === 'unit') {
		if (a && typeof a === 'object' && (a['type'] === 'unit' || a['type'] === 'value-unit')) {
			let u1p2 = undefined;
			let u2p2 = undefined;
			let err1 = undefined;
			let err2 = undefined;
			if (a['unit']['datatype'] === 'dep') {
				if (a['depunit']) {
					u1p2 = unit.parserFor(a['depunit'])(a['depvalue']);
				} else {
					err1 = ' The unit `' + ls.get(a['unit']['name'], 'en', '*') + '` must take an independent variable.';
				}
			}
			if (b['unit']['datatype'] === 'dep') {
				if (b['depunit']) {
					u2p2 = unit.parserFor(b['depunit'])(b['depvalue']);
				} else {
					err2 = ' The unit `' + ls.get(b['unit']['name'], 'en', '*') + '` must take an independent variable.';
				}
			}
			if (err1 && err2) throw new Error('Cannot convert ' + str(a) + ' to ' + str(b) + '.' + err1 + err2);
			if (err1 || err2) throw new Error('Cannot convert ' + str(a) + ' to ' + str(b) + '.' + (err1 || err2));
			const u1pfn = unit.parserFor(a['unit']);
			const u2ffn = unit.formatterFor(b['unit']);
			if (a['type'] === 'unit') {
				const u1p2f = u1p2;
				const u2p2f = u2p2;
				const cvfn = function(x) { return u2ffn(u1pfn(x,u1p2f),u2p2f); };
				let name1 = str(a);
				let name2 = str(b);
				name1 = name1.substring(name1.indexOf('`') + 1, name1.lastIndexOf('`'));
				name2 = name2.substring(name2.indexOf('`') + 1, name2.lastIndexOf('`'));
				const cvname = name1 + ' to ' + name2;
				return { 'type': 'function', 'name': cvname, 'function': cvfn };
			}
			if (a['type'] === 'value-unit') {
				const value = u2ffn(u1pfn(a['value'],u1p2),u2p2);
				return {...b, 'type': 'value-unit', 'value': value};
			}
		}
	}
	throw new Error('Cannot convert ' + str(a) + ' to ' + str(b) + '.');
}

// MODULE EXPORTS

module.exports = {
	cot, sec, csc, coth, sech, csch,
	acot, asec, acsc, acoth, asech, acsch,
	type, bool, str, types,
	pos, neg, add, sub, mul, div, pow, root, log, cat,
	toDegrees, toRadians, abs, sqrt, cbrt, qtrt,
	sum, altsum, prod, rsr,
	idmatrix, transpose, det, minor, cofactor, comatrix, adj, inv,
	setiv, convert
};
