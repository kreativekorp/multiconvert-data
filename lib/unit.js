const vm = require('node:vm');
const da = require('./dimension.js');
const ls = require('./languagestring.js');
const srmp = require('./srmp.js');

const composition = {};
const degreesMap = {};
const dimensionsMap = {};
const prefixesMap = {};
const functionMap = {};

function compileScript(script) {
	if (script.join) script = script.join('\n');
	if (script && typeof script === 'string') {
		try {
			const fn = new vm.Script('(' + script + ')').runInNewContext(functionMap);
			return (typeof fn === 'function') ? fn : null;
		} catch (e) {
			return null;
		}
	} else {
		return null;
	}
}

function loadComposition(obj) {
	if (typeof obj === 'object') {
		for (const key of Object.keys(obj)) {
			composition[key] = obj[key];
		}
	}
}

function loadDegrees(obj) {
	if (typeof obj === 'object') {
		if (obj['degree'] !== undefined) {
			degreesMap[obj['degree']] = obj;
		} else {
			for (const key of Object.keys(obj)) {
				loadDegrees(obj[key]);
			}
		}
	}
}

function loadDimensions(obj) {
	if (typeof obj === 'object') {
		for (const key of Object.keys(obj)) {
			dimensionsMap[key] = obj[key];
		}
	}
}

function loadPrefixes(obj) {
	if (typeof obj === 'object') {
		if (obj['base'] !== undefined && obj['exponent'] !== undefined) {
			prefixesMap[obj['base'] + '^' + obj['exponent']] = obj;
		} else {
			for (const key of Object.keys(obj)) {
				loadPrefixes(obj[key]);
			}
		}
	}
}

function loadFunctions(obj) {
	if (typeof obj === 'object') {
		for (const key of Object.keys(obj)) {
			const value = obj[key];
			if (typeof value === 'function') {
				functionMap[key] = value;
			} else {
				const fn = compileScript(value);
				if (fn) functionMap[key] = fn;
			}
		}
	}
}

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

function identity(a) {
	return a;
}

function uparsefn(u) {
	if (u['multiplier'] !== undefined || u['divisor'] !== undefined) {
		const multiplier = (u['multiplier'] !== undefined) ? u['multiplier'] : 1;
		const divisor = (u['divisor'] !== undefined) ? u['divisor'] : 1;
		return function(a) { return a * multiplier / divisor; };
	} else if (u['instructions.forward.compiled'] !== undefined) {
		return u['instructions.forward.compiled'];
	} else if (u['instructions'] !== undefined) {
		const fn = srmp.compileForward(u['instructions']);
		return fn ? (u['instructions.forward.compiled'] = fn) : identity;
	} else if (u['parser.compiled'] !== undefined) {
		return u['parser.compiled'];
	} else if (u['parser'] !== undefined) {
		const fn = compileScript(u['parser']);
		return fn ? (u['parser.compiled'] = fn) : identity;
	} else {
		return identity;
	}
}

function uformatfn(u) {
	if (u['multiplier'] !== undefined || u['divisor'] !== undefined) {
		const multiplier = (u['multiplier'] !== undefined) ? u['multiplier'] : 1;
		const divisor = (u['divisor'] !== undefined) ? u['divisor'] : 1;
		return function(a) { return a * divisor / multiplier; };
	} else if (u['instructions.reverse.compiled'] !== undefined) {
		return u['instructions.reverse.compiled'];
	} else if (u['instructions'] !== undefined) {
		const fn = srmp.compileReverse(u['instructions']);
		return fn ? (u['instructions.reverse.compiled'] = fn) : identity;
	} else if (u['formatter.compiled'] !== undefined) {
		return u['formatter.compiled'];
	} else if (u['formatter'] !== undefined) {
		const fn = compileScript(u['formatter']);
		return fn ? (u['formatter.compiled'] = fn) : identity;
	} else {
		return identity;
	}
}

function urationalize(u) {
	if (u['multiplier'] !== undefined || u['divisor'] !== undefined) {
		const multiplier = (u['multiplier'] !== undefined) ? u['multiplier'] : 1;
		const divisor = (u['divisor'] !== undefined) ? u['divisor'] : 1;
		return [multiplier, divisor];
	} else if (u['instructions.rationalized'] !== undefined) {
		return u['instructions.rationalized'];
	} else if (u['instructions'] !== undefined) {
		const md = srmp.rationalize(u['instructions']);
		return md ? (u['instructions.rationalized'] = md) : null;
	} else if (u['parser'] !== undefined || u['formatter'] !== undefined) {
		return null;
	} else {
		return [1, 1];
	}
}

function ucc() {
	for (let i = 0; i < arguments.length; i++) {
		if (!arguments[i]) return false;
		if ((arguments[i]['datatype'] || 'num') !== 'num') return false;
		if (arguments[i]['dimension']) {
			for (const dim of Object.keys(arguments[i]['dimension'])) {
				if (dimensionsMap[dim] && dimensionsMap[dim]['composable'] === false) {
					return false;
				}
			}
		}
	}
	return true;
}

function uexp(u, b, e) {
	if (e == 0) return u;
	if (b == 1) return u;
	if (!ucc(u)) return null;
	const prefix = prefixesMap[b + '^' + e];
	if (!prefix) return null;
	const n = {};
	if (prefix['symbol'] && u['symbol']) {
		n['symbol'] = prefix['symbol'] + u['symbol'];
	}
	if (prefix['format'] && u['name']) {
		n['name'] = ls.format(prefix['format'], u['name']);
	}
	const md = urationalize(u);
	if (md) {
		let [m, d] = md;
		if (e > 0) m *= Math.pow(b, e);
		if (e < 0) d *= Math.pow(b, -e);
		if (m != d) {
			if (m != 1) n['multiplier'] = m;
			if (d != 1) n['divisor'] = d;
		}
	} else {
		const pf = uparsefn(u), ff = uformatfn(u), base = b, exp = e;
		n['parser.compiled'] = function(a) { return pf(a * Math.pow(base, exp)); };
		n['formatter.compiled'] = function(a) { return ff(a) / Math.pow(base, exp); };
	}
	if (u['dimension']) n['dimension'] = u['dimension'];
	return n;
}

function umul() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	if (!ucc.apply(null, arguments)) return null;
	const n = {};
	const args = Array.from(arguments);
	if (!args.filter(a => !a['symbol']).length) {
		n['symbol'] = args.map(a => a['symbol']).join('\u00B7');
	}
	if (!args.filter(a => !a['name']).length) {
		n['name'] = ls.join(
			composition['mul-joiner'],
			composition['mul-order'],
			args.map(a => a['name'])
		);
	}
	for (const md of args.map(urationalize)) {
		if (!md) return null;
		n['multiplier'] = ((n['multiplier'] === undefined) ? md[0] : (n['multiplier'] * md[0]));
		n['divisor'] = ((n['divisor'] === undefined) ? md[1] : (n['divisor'] * md[1]));
	}
	const d = da.mul.apply(null, args.map(a => a['dimension']));
	if (!da.empty(d)) n['dimension'] = d;
	return n;
}

function udiv() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	if (!ucc.apply(null, arguments)) return null;
	const n = {};
	const args = Array.from(arguments);
	if (!args.filter(a => !a['symbol']).length) {
		n['symbol'] = args.map(a => a['symbol']).join('/');
	}
	if (!args.filter(a => !a['name']).length) {
		n['name'] = ls.join(
			composition['div-joiner'],
			composition['div-order'],
			args.map(a => a['name'])
		);
	}
	for (const md of args.map(urationalize)) {
		if (!md) return null;
		n['multiplier'] = ((n['multiplier'] === undefined) ? md[0] : (n['multiplier'] * md[1]));
		n['divisor'] = ((n['divisor'] === undefined) ? md[1] : (n['divisor'] * md[0]));
	}
	const d = da.div.apply(null, args.map(a => a['dimension']));
	if (!da.empty(d)) n['dimension'] = d;
	return n;
}

function upow(u, e) {
	if (e == 0) return null;
	if (e == 1) return u;
	if (!ucc(u)) return null;
	const degree = degreesMap[e];
	if (!degree) return null;
	const n = {};
	if (u['symbol']) {
		n['symbol'] = u['symbol'] + sup(e);
	}
	if (degree['format'] && u['name']) {
		n['name'] = ls.format(degree['format'], u['name']);
	}
	const md = urationalize(u);
	if (md) {
		n['multiplier'] = Math.pow(md[0], e);
		n['divisor'] = Math.pow(md[1], e);
		if (isNaN(n['multiplier']) || isNaN(n['divisor'])) return null;
	} else {
		return null;
	}
	const d = da.pow(u['dimension'], e);
	if (!da.empty(d)) n['dimension'] = d;
	return n;
}

function ufrac(u, mo, me, mp) {
	if (!ucc(u)) return null;
	const n = {};
	if (u['symbol']) n['symbol'] = u['symbol'];
	if (u['name']) n['name'] = ls.format(composition['frac-format'], u['name']);
	n['datatype'] = 'text';
	const pf = uparsefn(u), ff = uformatfn(u), mod = mo, med = me, mpd = mp;
	n['parser.compiled'] = function(a) {
		if (!(a = a.replace(/^\s+|\s+$/g, ''))) return NaN;
		if (a === '\u221E' || a === '+\u221E') return Infinity;
		if (a === '-\u221E') return -Infinity;
		const s = (a[0] === '-') ? (-1) : 1;
		if (a[0] === '-' || a[0] === '+') a = a.substring(1);
		let v = 0;
		for (const p of a.split(/\s+/)) {
			const b = p.split('/');
			for (let i = 1; i < b.length; i++) b[0] /= b[i];
			v += +b[0];
		}
		return pf(v * s);
	};
	n['formatter.compiled'] = function(a) {
		if (isNaN((a = ff(a)))) return '';
		if (!isFinite(a)) return ((a < 0) ? '-\u221E' : '\u221E');
		const s = (a < 0) ? '-' : '';
		const i = Math.floor((a = Math.abs(a)));
		const f = a - i;
		if (!f) return s + i;
		let bestDen = 1, bestNum = 0, bestVal = 0, bestDif = f;
		for (let den = 1; den <= mod || den <= med || den <= mpd; den++) {
			if (
				(den <= mod) ||
				(den <= med && !(den & 1)) ||
				(den <= mpd && !(den & (den - 1)))
			) {
				const num = Math.round(f * den);
				const val = num / den;
				const dif = Math.abs(val - f);
				if (dif < bestDif) {
					bestDen = den;
					bestNum = num;
					bestVal = val;
					bestDif = dif;
				}
			}
		}
		if (!bestNum) return s + i;
		if (bestNum == bestDen) return s + (i + 1);
		return s + i + ' ' + bestNum + '/' + bestDen;
	};
	if (u['dimension']) n['dimension'] = u['dimension'];
	return n;
}

function uhier() {
	if (arguments.length === 0) return null;
	if (arguments.length === 1) return arguments[0];
	if (!ucc.apply(null, arguments)) return null;
	const n = {};
	const args = Array.from(arguments);
	if (!args.filter(a => !a['symbol']).length) {
		n['symbol'] = args.map(a => a['symbol']);
	}
	if (!args.filter(a => !a['name']).length) {
		n['name'] = ls.join(
			composition['hier-joiner'],
			composition['hier-order'],
			args.map(a => a['name'])
		);
	}
	n['datatype'] = 'tuple';
	n['tuple-dimension'] = args.length;
	const td = args.length;
	const pf = args.map(uparsefn);
	const ff = args.map(uformatfn);
	n['parser.compiled'] = function(a) {
		if (!(a && typeof a === 'object' && a.length === td)) return NaN;
		let d = 0;
		for (let i = 0; i < td; i++) {
			d += pf[i](a[i]);
		}
		return d;
	};
	n['formatter.compiled'] = function(a) {
		if (!isFinite(a)) return null;
		const d = [];
		for (let i = 0; i < td; i++) {
			const iv = ff[i](a);
			const last = (i == td - 1);
			d[i] = (i === (td - 1)) ? iv : ((iv < 0) ? Math.ceil(iv) : Math.floor(iv));
			a = pf[i](iv - d[i]);
		}
		return d;
	};
	const d = args[0]['dimension'];
	for (const arg of args) if (!da.eq(d, arg['dimension'])) return null;
	if (!da.empty(d)) n['dimension'] = d;
	return n;
}

module.exports = {
	loadComposition, loadDegrees, loadDimensions, loadPrefixes, loadFunctions,
	exp: uexp, mul: umul, div: udiv, pow: upow, frac: ufrac, hier: uhier
};
