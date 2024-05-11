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

module.exports = {
	empty: dempty,
	mul: dmul,
	div: ddiv,
	pow: dpow,
	eq: deq,
	comp: dcomp
};
