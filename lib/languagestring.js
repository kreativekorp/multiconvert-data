function getLS(ls, lang, num) {
	if (typeof ls !== 'object') return ls;
	ls = (lang !== undefined && ls[lang] !== undefined) ? ls[lang] : ls['en'];
	if (typeof ls !== 'object') return ls;
	ls = (num !== undefined && ls[num] !== undefined) ? ls[num] : ls['*'];
	return ls;
}

function formatLSInner(fmt, ...lss) {
	if (typeof fmt !== 'object') fmt = {'*': fmt};
	const allKeys = Object.keys(fmt);
	for (let i = 0; i < lss.length; i++) {
		if (typeof lss[i] !== 'object') lss[i] = {'*': lss[i]};
		allKeys.push(...Object.keys(lss[i]));
	}
	const rls = {};
	for (const k of allKeys) {
		rls[k] = (fmt[k] || fmt['*']).replaceAll(
			/@([0-9]+|\{([0-9]+)(,([0-9]+))?\})?/g,
			(g0, g1, g2, g3, g4) => {
				const ls = lss[g2 || g1 || 0];
				return ls[g4 || k] || ls['*'];
			}
		);
	}
	return rls;
}

function formatLS(fmt, ...lss) {
	if (typeof fmt !== 'object') fmt = {'en': fmt};
	for (let i = 0; i < lss.length; i++) {
		if (typeof lss[i] !== 'object') lss[i] = {'en': lss[i]};
	}
	const rls = {};
	for (const k of Object.keys(fmt)) {
		const lssk = lss.map(ls => ls[k]);
		if (lssk.filter(x => x).length === lssk.length) {
			rls[k] = formatLSInner(fmt[k], ...lssk);
		}
	}
	return rls;
}

function joinLS(fmt, rtl, lss) {
	if (lss.length === 0) return null;
	if (lss.length === 1) return lss[0];
	if (typeof fmt !== 'object') fmt = {'en': fmt};
	for (let i = 0; i < lss.length; i++) {
		if (typeof lss[i] !== 'object') lss[i] = {'en': lss[i]};
	}
	const rls = {};
	for (const k of Object.keys(fmt)) {
		const lssk = lss.map(ls => ls[k]);
		if (lssk.filter(x => x).length === lssk.length) {
			const rtlk = (typeof rtl === 'object' ? rtl[k] : rtl);
			if (rtlk === true || rtlk === 'rtl') {
				let n = lssk.length - 1;
				let ls = lssk[n];
				while (n > 0) ls = formatLSInner(fmt[k], lssk[--n], ls);
				rls[k] = ls;
			} else {
				let ls = lssk[0], i = 1;
				const n = lssk.length;
				while (i < n) ls = formatLSInner(fmt[k], ls, lssk[i++]);
				rls[k] = ls;
			}
		}
	}
	return rls;
}

module.exports = {
	get: getLS,
	format: formatLS,
	join: joinLS
};
