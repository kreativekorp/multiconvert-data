function dempty() {
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i]) {
			for (const dim of Object.keys(arguments[i])) {
				if (+arguments[i][dim]) {
					return false;
				}
			}
		}
	}
	return true;
}

function dmul() {
	const r = {};
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i]) {
			for (const dim of Object.keys(arguments[i])) {
				const deg = +arguments[i][dim];
				if (deg) {
					if (r[dim]) {
						if (!(r[dim] += deg)) delete r[dim];
					} else {
						r[dim] = deg;
					}
				}
			}
		}
	}
	return r;
}

function ddiv() {
	const r = {};
	for (let i = 0; i < arguments.length; i++) {
		if (arguments[i]) {
			for (const dim of Object.keys(arguments[i])) {
				const deg = i ? -arguments[i][dim] : +arguments[i][dim];
				if (deg) {
					if (r[dim]) {
						if (!(r[dim] += deg)) delete r[dim];
					} else {
						r[dim] = deg;
					}
				}
			}
		}
	}
	return r;
}

function dpow(d, e) {
	const r = {};
	if (d) {
		for (const dim of Object.keys(d)) {
			const deg = d[dim] * e;
			if (deg) r[dim] = deg;
		}
	}
	return r;
}

function deq(d1, d2) {
	return dempty(ddiv(d1, d2));
}

function dcomp(d1, d2) {
	return dempty(dmul(d1, d2));
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

function dstr(d) {
	if (d) {
		const keys = Object.keys(d).sort();
		const numer = keys.filter(k => d[k] > 0);
		const denom = keys.filter(k => d[k] < 0);
		if (numer.length) {
			const ns = numer.map(k => (d[k] === 1) ? k : (k + sup(d[k]))).join('\u00B7');
			if (denom.length) {
				const ds = denom.map(k => (d[k] === -1) ? k : (k + sup(-d[k]))).join('\u00B7');
				return ns + '/' + ds;
			}
			return ns;
		}
		if (denom.length) {
			const ds = denom.map(k => (d[k] === 1) ? k : (k + sup(d[k]))).join('\u00B7');
			return ds;
		}
	}
	return '';
}

module.exports = {
	empty: dempty,
	mul: dmul,
	div: ddiv,
	pow: dpow,
	eq: deq,
	comp: dcomp,
	str: dstr
};
