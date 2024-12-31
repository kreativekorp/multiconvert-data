const da = require('./dimension.js');
const ls = require('./languagestring.js');
const unit = require('./unitparser.js');

// FUNCTION INVERSION AND POWER MANAGEMENT

const idfn = {
	'type': 'function',
	'function': (a => a),
	'inverse': (a => a),
	'name': 'id',
	'invname': 'id',
	'fname': [],
	'arity': 1
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

function fnameInit(n, e) {
	if (n.match(/\s/)) n = '(' + n + ')';
	return [[n, e]];
}

function fnameMul(a, b) {
	if (!a.length) return b;
	if (!b.length) return a;
	if (
		a[a.length-1][0] === b[0][0] &&
		Math.sign(a[a.length-1][1]) === Math.sign(b[0][1])
	) {
		return [
			...a.slice(0, a.length-1),
			[b[0][0], (b[0][1] + a[a.length-1][1])],
			...b.slice(1)
		];
	} else {
		return [...a, ...b];
	}
}

function fnameInv(a) {
	const b = [];
	for (let i = a.length-1; i >= 0; i--) {
		b.push([a[i][0], -a[i][1]]);
	}
	return b;
}

function fnameStr(a) {
	return a.map(e => (e[1] == 1) ? e[0] : (e[0] + sup(e[1]))).join('∘') || 'id';
}

function invfn(a) {
	if (a['function'] && a['inverse'] && (a['arity'] == 1)) {
		const b = {
			'type': 'function',
			'function': a['inverse'],
			'inverse': a['function'],
			'arity': 1
		};
		if (a['fname']) {
			b['fname'] = fnameInv(a['fname']);
			b['name'] = fnameStr(b['fname']);
			b['invname'] = fnameStr(a['fname']);
		} else if (a['invname']) {
			b['name'] = a['invname'];
			b['invname'] = a['name'];
		} else {
			b['fname'] = fnameInit(a['name'], -1);
			b['name'] = fnameStr(b['fname']);
			b['invname'] = a['name'];
		}
		return b;
	}
	throw new Error('Cannot invert ' + str(a) + '.');
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
	if (v['type'] === 'function') {
		if (v['fname']) return 'function `' + fnameStr(v['fname']) + '`';
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
				const r0 = row.length ? row[0] : 0;
				const b0 = b.length ? b[0] : [];
				let res = mul(r0, b0);
				for (let i = 1; i < row.length || i < b.length; i++) {
					const ri = (i < row.length) ? row[i] : 0;
					const bi = (i < b.length) ? b[i] : [];
					res = add(res, mul(ri, bi));
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
			if (a['arity'] != 1 || b['arity'] != 1) break;
			const af = a['function'];
			const bf = b['function'];
			const cf = function(x) { return af(bf(x)); }
			const an = a['fname'] ? a['fname'] : fnameInit(a['name'], 1);
			const bn = b['fname'] ? b['fname'] : fnameInit(b['name'], 1);
			const cn = fnameMul(an, bn);
			const ai = a['inverse'];
			const bi = b['inverse'];
			if (!ai || !bi) return {'type': 'function', 'function': cf, 'fname': cn, 'arity': 1};
			const ci = function(x) { return bi(ai(x)); }
			return {'type': 'function', 'function': cf, 'inverse': ci, 'fname': cn, 'arity': 1};
	}
	throw new Error('Cannot multiply ' + str(a) + ' and ' + str(b) + '.');
}

function div(a, b) {
	switch (types(a, b)) {
		case 'value value': return a / b;
		case 'array value': return a.map(e => div(e, b));
		case 'value array': case 'array array': return mul(a, inv(b));
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
		case 'function function': return mul(a, invfn(b));
	}
	throw new Error('Cannot divide ' + str(a) + ' and ' + str(b) + '.');
}

function idiv(a, b) {
	switch (types(a, b)) {
		case 'value value': return Math.trunc(a / b);
		case 'array value': return a.map(e => idiv(e, b));
	}
	throw new Error('Cannot take the integer division of ' + str(a) + ' and ' + str(b) + '.');
}

function mod(a, b) {
	switch (types(a, b)) {
		case 'value value': return a % b;
		case 'array value': return a.map(e => mod(e, b));
	}
	throw new Error('Cannot take the modulus of ' + str(a) + ' and ' + str(b) + '.');
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
			if (b < 0) { a = inv(a); b = -b; }
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
			if (b < 0) { a = invfn(a); b = -b; }
			if (b == 0) return idfn;
			if (b == 1) return a;
			return genpow(a, b);
	}
	throw new Error('Cannot exponentiate ' + str(a) + ' and ' + str(b) + '.');
}

function root(a, b) {
	if (type(a) === 'value' && type(b) === 'value') {
		if (b == 2) return Math.sqrt(a);
		if (b == 3) return Math.cbrt(a);
		return Math.pow(a, 1 / b);
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

function ln(a, b=0) {
	if (type(a) === 'value' && type(b) === 'value') {
		if (b == 0) return Math.log(a);
		if (b == 1) return Math.log1p(a);
		return Math.log(a + b);
	}
	throw new Error('Cannot take the natural logarithm of ' + str(a) + '.');
}

function exp(a, b=0) {
	if (type(a) === 'value' && type(b) === 'value') {
		if (b == 0) return Math.exp(a);
		if (b == 1) return Math.expm1(a);
		return Math.exp(a) - b;
	}
	throw new Error('Cannot take the natural exponential of ' + str(a) + '.');
}

function cat(a, b) {
	switch (types(a, b)) {
		case 'array array': for (const i of b) a = a[i]; return a;
		case 'function value': return a['function'](b);
		case 'function array': return (a['arity'] == 1) ? a['function'](b) : a['function'](...b);
		case 'function unit': return a['function'](b);
		case 'function value-unit': return a['function'](b);
		case 'element unit-type':
			const ep = a['element']['properties'][b['key']];
			if (!ep) throw new Error('Cannot get ' + str(b) + ' of ' + str(a) + '.');
			const epu = unit.parse(ep['unit']);
			if (!epu) throw new Error('Cannot get ' + str(b) + ' of ' + str(a) + '.');
			return {'type': 'value-unit', 'value': ep['value'], 'unit': epu};
	}
	return mul(a, b);
}

function vcmp(a, b) {
	return (a < b) ? -1 : (a > b) ? +1 : (a == b) ? 0 : NaN;
}

function cmp(a, b) {
	switch (types(a, b)) {
		case 'value value':
			return vcmp(a, b);
		case 'unit unit':
		case 'value-unit unit':
		case 'unit value-unit':
		case 'value-unit value-unit':
			if (!unit.composable(a['unit'], b['unit'])) break;
			if (!da.eq(a['unit']['dimension'], b['unit']['dimension'])) break;
			const u1value = ((a['type'] === 'value-unit') ? a['value'] : 1);
			const u2value = ((b['type'] === 'value-unit') ? b['value'] : 1);
			const u1pfn = unit.parserFor(a['unit']);
			const u2pfn = unit.parserFor(b['unit']);
			return vcmp(u1pfn(u1value), u2pfn(u2value));
	}
	throw new Error('Cannot compare ' + str(a) + ' and ' + str(b) + '.');
}

// UNARY FUNCTIONS

function mcvtIsNaN(a) {
	switch (type(a)) {
		case 'value': return isNaN(a);
		case 'array': for (e of a) if (mcvtIsNaN(e)) return true; return false;
		case 'value-unit': return mcvtIsNaN(a['value']);
	}
	return false;
}

function mcvtIsFinite(a) {
	switch (type(a)) {
		case 'value': return isFinite(a);
		case 'array': return !mcvtIsNaN(a) && !mcvtIsInfinite(a);
		case 'value-unit': return mcvtIsFinite(a['value']);
	}
	return false;
}

function mcvtIsInfinite(a) {
	switch (type(a)) {
		case 'value': return !isNaN(a) && !isFinite(a);
		case 'array': for (e of a) if (mcvtIsInfinite(e)) return true; return false;
		case 'value-unit': return mcvtIsInfinite(a['value']);
	}
	return false;
}

function ceil(a) {
	switch (type(a)) {
		case 'value': return Math.ceil(a);
		case 'array': return a.map(ceil);
		case 'value-unit': return {...a, 'value': ceil(a['value'])};
	}
	throw new Error('Cannot get the ceil of ' + str(a) + '.');
}

function floor(a) {
	switch (type(a)) {
		case 'value': return Math.floor(a);
		case 'array': return a.map(floor);
		case 'value-unit': return {...a, 'value': floor(a['value'])};
	}
	throw new Error('Cannot get the floor of ' + str(a) + '.');
}

function aug(a) {
	switch (type(a)) {
		case 'value': return (a < 0) ? Math.floor(a) : Math.ceil(a);
		case 'array': return a.map(aug);
		case 'value-unit': return {...a, 'value': aug(a['value'])};
	}
	throw new Error('Cannot get the aug of ' + str(a) + '.');
}

function trunc(a) {
	switch (type(a)) {
		case 'value': return (a < 0) ? Math.ceil(a) : Math.floor(a);
		case 'array': return a.map(trunc);
		case 'value-unit': return {...a, 'value': trunc(a['value'])};
	}
	throw new Error('Cannot get the trunc of ' + str(a) + '.');
}

function frac(a) {
	switch (type(a)) {
		case 'value': return a - Math.trunc(a);
		case 'array': return a.map(frac);
		case 'value-unit': return {...a, 'value': frac(a['value'])};
	}
	throw new Error('Cannot get the frac of ' + str(a) + '.');
}

function round(a) {
	switch (type(a)) {
		case 'value': return Math.round(a);
		case 'array': return a.map(round);
		case 'value-unit': return {...a, 'value': round(a['value'])};
	}
	throw new Error('Cannot round ' + str(a) + '.');
}

function abs(a) {
	if (type(a) === 'value') return Math.abs(a);
	throw new Error('Cannot get the absolute value of ' + str(a) + '.');
}

function sign(a) {
	if (type(a) === 'value') return Math.sign(a);
	throw new Error('Cannot get the sign of ' + str(a) + '.');
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

const u7 = {
	'type': 'unit',
	'unit': {
		'symbol': 'rad',
		'name': {
			'en': {
				'1': 'radian',
				'*': 'radians'
			}
		},
		'dimension': {
			'angle': 1
		}
	}
};

const u103 = {
	'type': 'unit',
	'unit': {
		'symbol': '\u00B0',
		'name': {
			'en': {
				'1': 'degree',
				'*': 'degrees'
			}
		},
		'instructions': 'C180',
		'dimension': {
			'angle': 1
		}
	}
};

function toDegrees(a) {
	switch (type(a)) {
		case 'value': return a * 180 / Math.PI;
		case 'value-unit': return convert(a, u103);
		default: return mul(a, 180 / Math.PI);
	}
}

function toRadians(a) {
	switch (type(a)) {
		case 'value': return a * Math.PI / 180;
		case 'value-unit': return convert(a, u7);
		default: return mul(a, Math.PI / 180);
	}
}

function sin(a) {
	switch (type(a)) {
		case 'value': return Math.sin(a);
		case 'value-unit': return Math.sin(convert(a, u7)['value']);
	}
	throw new Error('Cannot get the sine of ' + str(a) + '.');
}

function cos(a) {
	switch (type(a)) {
		case 'value': return Math.cos(a);
		case 'value-unit': return Math.cos(convert(a, u7)['value']);
	}
	throw new Error('Cannot get the cosine of ' + str(a) + '.');
}

function tan(a) {
	switch (type(a)) {
		case 'value': return Math.tan(a);
		case 'value-unit': return Math.tan(convert(a, u7)['value']);
	}
	throw new Error('Cannot get the tangent of ' + str(a) + '.');
}

function cot(a) {
	switch (type(a)) {
		case 'value': return 1 / Math.tan(a);
		case 'value-unit': return 1 / Math.tan(convert(a, u7)['value']);
	}
	throw new Error('Cannot get the cotangent of ' + str(a) + '.');
}

function sec(a) {
	switch (type(a)) {
		case 'value': return 1 / Math.cos(a);
		case 'value-unit': return 1 / Math.cos(convert(a, u7)['value']);
	}
	throw new Error('Cannot get the secant of ' + str(a) + '.');
}

function csc(a) {
	switch (type(a)) {
		case 'value': return 1 / Math.sin(a);
		case 'value-unit': return 1 / Math.sin(convert(a, u7)['value']);
	}
	throw new Error('Cannot get the cosecant of ' + str(a) + '.');
}

function asin(a) {
	if (type(a) === 'value') return Math.asin(a);
	throw new Error('Cannot get the arcsine of ' + str(a) + '.');
}

function acos(a) {
	if (type(a) === 'value') return Math.acos(a);
	throw new Error('Cannot get the arcosine of ' + str(a) + '.');
}

function atan(a) {
	if (type(a) === 'value') return Math.atan(a);
	throw new Error('Cannot get the arctangent of ' + str(a) + '.');
}

function acot(a) {
	if (type(a) === 'value') return Math.PI/2 - Math.atan(a);
	throw new Error('Cannot get the arcotangent of ' + str(a) + '.');
}

function asec(a) {
	if (type(a) === 'value') return Math.acos(1 / a);
	throw new Error('Cannot get the arcsecant of ' + str(a) + '.');
}

function acsc(a) {
	if (type(a) === 'value') return Math.asin(1 / a);
	throw new Error('Cannot get the arcosecant of ' + str(a) + '.');
}

function sinh(a) {
	if (type(a) === 'value') return Math.sinh(a);
	throw new Error('Cannot get the hyperbolic sine of ' + str(a) + '.');
}

function cosh(a) {
	if (type(a) === 'value') return Math.cosh(a);
	throw new Error('Cannot get the hyperbolic cosine of ' + str(a) + '.');
}

function tanh(a) {
	if (type(a) === 'value') return Math.tanh(a);
	throw new Error('Cannot get the hyperbolic tangent of ' + str(a) + '.');
}

function coth(a) {
	if (type(a) === 'value') return 1 / Math.tanh(a);
	throw new Error('Cannot get the hyperbolic cotangent of ' + str(a) + '.');
}

function sech(a) {
	if (type(a) === 'value') return 1 / Math.cosh(a);
	throw new Error('Cannot get the hyperbolic secant of ' + str(a) + '.');
}

function csch(a) {
	if (type(a) === 'value') return 1 / Math.sinh(a);
	throw new Error('Cannot get the hyperbolic cosecant of ' + str(a) + '.');
}

function asinh(a) {
	if (type(a) === 'value') return Math.asinh(a);
	throw new Error('Cannot get the hyperbolic arsine of ' + str(a) + '.');
}

function acosh(a) {
	if (type(a) === 'value') return Math.acosh(a);
	throw new Error('Cannot get the hyperbolic arcosine of ' + str(a) + '.');
}

function atanh(a) {
	if (type(a) === 'value') return Math.atanh(a);
	throw new Error('Cannot get the hyperbolic artangent of ' + str(a) + '.');
}

function acoth(a) {
	if (type(a) === 'value') return Math.atanh(1 / a);
	throw new Error('Cannot get the hyperbolic arcotangent of ' + str(a) + '.');
}

function asech(a) {
	if (type(a) === 'value') return Math.acosh(1 / a);
	throw new Error('Cannot get the hyperbolic arsecant of ' + str(a) + '.');
}

function acsch(a) {
	if (type(a) === 'value') return Math.asinh(1 / a);
	throw new Error('Cannot get the hyperbolic arcosecant of ' + str(a) + '.');
}

// MORE FUNCTIONS

function random(a=1) {
	return mul(a, Math.random());
}

function randomDecimal(a=1) {
	return mul(a, 1 - Math.random());
}

function randomRange(a, b) {
	return Math.floor((b - a + 1) * Math.random()) - (-a);
}

function hypot(a, b) {
	if (type(a) === 'value' && type(a) === 'value') return Math.hypot(a, b);
	return sqrt(add(pow(a, 2), pow(b, 2)));
}

function atan2(a, b) {
	if (type(a) === 'value' && type(a) === 'value') return Math.atan2(a, b);
	return atan(div(a, b));
}

function xcoord(r, t) {
	return mul(r, Math.cos(t));
}

function ycoord(r, t) {
	return mul(r, Math.sin(t));
}

function annuity(r, p) {
	return div(sub(1, pow(add(1, r), neg(p))), r);
}

function compound(r, p) {
	return pow(add(1, r), p);
}

function agm(a, b) {
	if (isNaN(a) || isNaN(b)) return NaN;
	while (Math.abs(a - b) > 1e-15) {
		const am = (a + b) / 2;
		const gm = Math.sqrt(a * b);
		a = am; b = gm;
	}
	return (a + b) / 2;
}

function gcd(a, b) {
	if (isNaN(a) || isNaN(b)) return NaN;
	if (a < 0) a = -a;
	if (b < 0) b = -b;
	for (;;) {
		if (b == 0) return a; a %= b;
		if (a == 0) return b; b %= a;
	}
}

function lcm(a, b) {
	return a / gcd(a, b) * b;
}

function gamma(z) {
	if (z <= 0 && Math.ceil(z) == Math.floor(z)) return NaN;
	if (z == 1 || z == 2) return 1;
	if (!isFinite(z)) return z;
	if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
	const G = 7;
	const P = [
		0.99999999999980993,
		676.5203681218851,
		-1259.1392167224028,
		771.32342877765313,
		-176.61502916214059,
		12.507343278686905,
		-0.13857109526572012,
		9.9843695780195716e-6,
		1.5056327351493116e-7
	];
	z--;
	let x = P[0];
	for (let i = 1; i < G+2; i++) x += P[i] / (z + i);
	const t = z + G + 0.5;
	return Math.sqrt(Math.PI * 2) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function lgamma(z) {
	return Math.log(gamma(z));
}

function beta(x, y) {
	return gamma(x) * gamma(y) / gamma(x + y);
}

function lbeta(x, y) {
	return lgamma(x) + lgamma(y) - lgamma(x + y);
}

function nCr(n, r) {
	return gamma(n + 1) / (gamma(r + 1) * gamma(n - r + 1));
}

function nPr(n, r) {
	return gamma(n + 1) / gamma(n - r + 1);
}

function reverseBits(v, w=32) {
	let r = (v & 1) ? (-1 << w) : 0;
	let ma = (1 << (w - 1));
	let mb = 1;
	for (let i = 0; i < w; i++) {
		if (v & ma) r |= mb;
		ma >>>= 1; mb <<= 1;
	}
	return r;
}

function reverseBytes(v, w=32) {
	let r = (v & 0x80) ? (-1 << (w << 3)) : 0;
	let sa = ((w - 1) << 3);
	let sb = 0;
	for (let i = 0; i < w; i++) {
		r |= (((v >> sa) & 0xFF) << sb);
		sa -= 8; sb += 8;
	}
	return r;
}

function bitLength(a) {
	let len = 0;
	while (~a && ~~a) {
		len++;
		a >>= 1;
	}
	return len;
}

function bitMingle(a, b) {
	const n = Math.max(bitLength(a), bitLength(b));
	let c;
	if (a < 0 && b < 0) c = (-1 << (n << 1));
	else if (a < 0 || b < 0) throw new Error('Cannot mingle ' + a + ' and ' + b + '.');
	else c = 0;
	for (let i = 0; i < n; i++) {
		if (b & (1 << i)) c |= (1 << (i + i));
		if (a & (1 << i)) c |= (1 << (i + i + 1));
	}
	return c;
}

function bitSelect(a, b) {
	const n = Math.max(bitLength(a), bitLength(b));
	let c = 0, ci = 0;
	for (let i = 0; i < n; i++) {
		if (b & (1 << i)) {
			if (a & (1 << i)) c |= (1 << ci);
			ci++;
		}
	}
	if (a < 0 && b < 0) c |= (-1 << ci);
	return c;
}

// VARARG FUNCTIONS

function sum(...a) {
	return (a.length === 0) ? 0 : a.reduce(add);
}

function altsum(...a) {
	return (a.length === 0) ? 0 : a.reduce((a,b,i) => (i&1)?sub(a,b):add(a,b));
}

function prod(...a) {
	return (a.length === 0) ? 1 : a.reduce(mul);
}

function altprod(...a) {
	return (a.length === 0) ? 1 : a.reduce((a,b,i) => (i&1)?div(a,b):mul(a,b));
}

function rsr(...a) {
	return pow(sum(...a.map(e => pow(e, -1))), -1);
}

function rms(...a) {
	return sqrt(div(sum(...a.map(e => pow(e, 2))), a.length));
}

function average(...a) {
	return div(sum(...a), a.length);
}

function geomean(...a) {
	return root(prod(...a), a.length);
}

function harmean(...a) {
	return div(a.length, sum(...a.map(e => pow(e, -1))));
}

function svariance(...a) {
	const avg = div(sum(...a), a.length);
	const ssd = sum(...a.map(e => pow(sub(e, avg), 2)));
	return div(ssd, a.length-1);
}

function pvariance(...a) {
	const avg = div(sum(...a), a.length);
	const ssd = sum(...a.map(e => pow(sub(e, avg), 2)));
	return div(ssd, a.length);
}

function sstddev(...a) {
	return sqrt(svariance(...a));
}

function pstddev(...a) {
	return sqrt(pvariance(...a));
}

function median(...a) {
	(a = a.slice()).sort(cmp);
	if (a.length & 1) return a[a.length >> 1];
	return div(add(a[(a.length >> 1) - 1], a[a.length >> 1]), 2);
}

function bitand(...a) {
	return (a.length === 0) ? -1 : a.reduce((a,b) => a & b);
}

function bitxor(...a) {
	return (a.length === 0) ? 0 : a.reduce((a,b) => a ^ b);
}

function bitor(...a) {
	return (a.length === 0) ? 0 : a.reduce((a,b) => a | b);
}

function and(...a) {
	return (a.length === 0) ? true : a.map(bool).reduce((a,b) => a && b);
}

function xor(...a) {
	return (a.length === 0) ? false : a.map(bool).reduce((a,b) => a != b);
}

function or(...a) {
	return (a.length === 0) ? false : a.map(bool).reduce((a,b) => a || b);
}

function equal(...a) {
	for (let i = 1; i < a.length; i++) if (!(a[i-1] == a[i])) return false;
	return true;
}

function ascending(...a) {
	for (let i = 1; i < a.length; i++) if (!(a[i-1] <= a[i])) return false;
	return true;
}

function descending(...a) {
	for (let i = 1; i < a.length; i++) if (!(a[i-1] >= a[i])) return false;
	return true;
}

function increasing(...a) {
	for (let i = 1; i < a.length; i++) if (!(a[i-1] < a[i])) return false;
	return true;
}

function decreasing(...a) {
	for (let i = 1; i < a.length; i++) if (!(a[i-1] > a[i])) return false;
	return true;
}

function concat(...a) {
	return (a.length === 0) ? '' : a.map(str).join('');
}

function concatsp(...a) {
	return (a.length === 0) ? '' : a.map(str).join(' ');
}

function ifFunction(...a) {
	let i = 1;
	while (i < a.length) {
		if (bool(a[i-1])) return a[i];
		i += 2;
	}
	return a[i-1];
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
	if (!d) throw new Error('Cannot invert the matrix ' + str(a) + '.');
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
			if (!da.eq(a['unit']['dimension'], b['unit']['dimension'])) {
				throw new Error('Cannot convert ' + str(a) + ' to ' + str(b) + '.');
			}
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
				const u1ffn = unit.formatterFor(a['unit']);
				const u2pfn = unit.parserFor(b['unit']);
				const forward = function(x) { return u2ffn(u1pfn(x,u1p2f),u2p2f); };
				const reverse = function(x) { return u1ffn(u2pfn(x,u2p2f),u1p2f); };
				let name1 = str(a); name1 = name1.substring(name1.indexOf('`') + 1, name1.lastIndexOf('`'));
				let name2 = str(b); name2 = name2.substring(name2.indexOf('`') + 1, name2.lastIndexOf('`'));
				return {
					'type': 'function', 'function': forward, 'inverse': reverse,
					'name': name1 + ' to ' + name2, 'invname': name2 + ' to ' + name1,
					'arity': 1
				};
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
	sin, cos, tan, cot, sec, csc,
	asin, acos, atan, acot, asec, acsc,
	sinh, cosh, tanh, coth, sech, csch,
	asinh, acosh, atanh, acoth, asech, acsch,
	cmp, invfn, type, bool, str, types,
	pos, neg, add, sub, mul, div, idiv, mod, pow, root, log, ln, exp, cat,
	isNaN:mcvtIsNaN, isFinite:mcvtIsFinite, isInfinite:mcvtIsInfinite,
	ceil, floor, aug, trunc, frac, round, toDegrees, toRadians,
	abs, sign, sqrt, cbrt, qtrt, random, randomDecimal, randomRange,
	hypot, atan2, xcoord, ycoord, annuity, compound,
	agm, gcd, lcm, gamma, lgamma, beta, lbeta, nCr, nPr,
	reverseBits, reverseBytes, bitLength, bitMingle, bitSelect,
	sum, altsum, prod, altprod, rsr, rms, average, geomean, harmean,
	svariance, pvariance, sstddev, pstddev, median,
	bitand, bitxor, bitor, and, xor, or, equal, ascending, descending,
	increasing, decreasing, concat, concatsp, ifFunction,
	idmatrix, transpose, det, minor, cofactor, comatrix, adj, inv,
	setiv, convert
};
