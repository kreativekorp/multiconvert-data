const ls = require('./languagestring.js');
const unit = require('./unit.js');

const unitMap = {};

function loadUnits(obj) {
	if (typeof obj === 'object') {
		for (const key of Object.keys(obj)) {
			if (key === 'functions') {
				unit.loadFunctions(obj[key]);
			} else {
				unitMap[key] = obj[key];
			}
		}
	}
}

function uparse_ws(s) {
	return s.replace(/^\s+|\s+$/g, '');
}

function uparse_unit(s) {
	s = uparse_ws(s);
	if (s.startsWith('(')) {
		s = uparse_ws(s.substring(1));
		const p = uparse_div(s);
		s = uparse_ws(p.s);
		if (s.startsWith(')')) {
			s = uparse_ws(s.substring(1));
			return {u: p.u, s};
		} else {
			throw new Error('Expected ) but found "' + s + '"');
		}
	} else {
		const m = s.match(/^[A-Za-z][A-Za-z0-9]*/);
		if (!m) throw new Error('Expected unit ID but found "' + s + '"');
		const u = unitMap[m[0]];
		if (!u) throw new Error('There is no unit ID ' + m[0]);
		s = uparse_ws(s.substring(m[0].length));
		return {u, s};
	}
}

function uparse_exp(s) {
	const p = uparse_unit(s);
	const ch = (s = uparse_ws(p.s))[0];
	if (ch === '_' || ch === '.' || ch === ':') {
		s = uparse_ws(s.substring(1));
		const m = s.match(/^[+-]?[0-9]+/);
		if (!m) throw new Error('Expected integer but found "' + s + '"');
		const u = unit.exp(p.u, ((ch === '_') ? 10 : 2), +m[0]);
		if (!u) throw new Error('Cannot exponentiate the unit "' + ls.get(p.u.name) + '"');
		s = uparse_ws(s.substring(m[0].length));
		return {u, s};
	} else {
		return p;
	}
}

function uparse_pow(s) {
	const p = uparse_exp(s);
	const ch = (s = uparse_ws(p.s))[0];
	if (ch === '^') {
		s = uparse_ws(s.substring(1));
		const m = s.match(/^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)/);
		if (!m) throw new Error('Expected number but found "' + s + '"');
		const u = unit.pow(p.u, +m[0]);
		if (!u) throw new Error('Cannot exponentiate the unit "' + ls.get(p.u.name) + '"');
		s = uparse_ws(s.substring(m[0].length));
		return {u, s};
	} else {
		return p;
	}
}

function uparse_mul(s) {
	let p = uparse_pow(s);
	const pp = [p.u];
	let ch = (s = uparse_ws(p.s))[0];
	while (ch === '*') {
		s = uparse_ws(s.substring(1));
		p = uparse_pow(s);
		pp.push(p.u);
		ch = (s = uparse_ws(p.s))[0];
	}
	const u = unit.mul.apply(null, pp);
	if (u) return {u, s};
	throw new Error('Cannot multiply the units: ' + pp.map(u => ls.get(u.name)).join(', '));
}

function uparse_div(s) {
	let p = uparse_mul(s);
	const pp = [p.u];
	let ch = (s = uparse_ws(p.s))[0];
	while (ch === '/') {
		s = uparse_ws(s.substring(1));
		p = uparse_mul(s);
		pp.push(p.u);
		ch = (s = uparse_ws(p.s))[0];
	}
	const u = unit.div.apply(null, pp);
	if (u) return {u, s};
	throw new Error('Cannot divide the units: ' + pp.map(u => ls.get(u.name)).join(', '));
}

function uparse_frac(s) {
	const p = uparse_div(s);
	const ch = (s = uparse_ws(p.s))[0];
	if (ch === '%') {
		s = uparse_ws(s.substring(1));
		const m = s.match(/^([0-9]+)(\s*,\s*([0-9]+))?(\s*,\s*([0-9]+))?/);
		if (!m) throw new Error('Expected integer but found "' + s + '"');
		const mo = +m[1] || 1;
		const me = +m[3] || mo;
		const mp = +m[5] || me;
		const u = unit.frac(p.u, mo, me, mp);
		if (!u) throw new Error('Cannot fractionalize the unit "' + ls.get(p.u.name) + '"');
		s = uparse_ws(s.substring(m[0].length));
		return {u, s};
	} else {
		return p;
	}
}

function uparse_hier(s) {
	let p = uparse_frac(s);
	const pp = [p.u];
	let ch = (s = uparse_ws(p.s))[0];
	while (ch === ',') {
		s = uparse_ws(s.substring(1));
		p = uparse_frac(s);
		pp.push(p.u);
		ch = (s = uparse_ws(p.s))[0];
	}
	const u = unit.hier.apply(null, pp);
	if (u) return {u, s};
	throw new Error('Cannot compose the units: ' + pp.map(u => ls.get(u.name)).join(', '));
}

function uparse(s) {
	const p = uparse_hier(s);
	if (!(s = uparse_ws(p.s))) return p.u;
	throw new Error('Expected end of string but found "' + s + '"');
}

module.exports = {
	loadComposition: unit.loadComposition,
	loadDegrees: unit.loadDegrees,
	loadDimensions: unit.loadDimensions,
	loadPrefixes: unit.loadPrefixes,
	loadFunctions: unit.loadFunctions,
	loadUnits,
	parse: uparse
};
