const index = {};

function ununi(s) {
	let t = '';
	for (let i = 0; i < s.length; i++) {
		switch (s[i]) {
			case '\u00A9': t += '(C)'; break;
			case '\u00AE': t += '(R)'; break;
			case '\u00B7': case '\u00D7': t += '*'; break;
			case '\u00F7':                t += '/'; break;
			case '\u2018': case '\u2019': t += "'"; break;
			case '\u201C': case '\u201D': t += '"'; break;
			default: t += s[i];
		}
	}
	return t;
}

function unsup(s) {
	let t = '';
	for (let i = 0; i < s.length; i++) {
		switch (s[i]) {
			case '\u2070': t += '0'; break; case '\u00B9': t += '1'; break;
			case '\u00B2': t += '2'; break; case '\u00B3': t += '3'; break;
			case '\u2074': t += '4'; break; case '\u2075': t += '5'; break;
			case '\u2076': t += '6'; break; case '\u2077': t += '7'; break;
			case '\u2078': t += '8'; break; case '\u2079': t += '9'; break;
			case '\u207A': t += '+'; break; case '\u207B': t += '-'; break;
			case '\u2E33': t += '.'; break; case '\u2E34': t += ','; break;
			case '\u1D31': t += 'E'; break; case '\u1D49': t += 'e'; break;
			default: t += s[i];
		}
	}
	return t;
}

function unsub(s) {
	let t = '';
	for (let i = 0; i < s.length; i++) {
		switch (s[i]) {
			case '\u2080': t += '0'; break; case '\u2081': t += '1'; break;
			case '\u2082': t += '2'; break; case '\u2083': t += '3'; break;
			case '\u2084': t += '4'; break; case '\u2085': t += '5'; break;
			case '\u2086': t += '6'; break; case '\u2087': t += '7'; break;
			case '\u2088': t += '8'; break; case '\u2089': t += '9'; break;
			case '\u208A': t += '+'; break; case '\u208B': t += '-'; break;
			default: t += s[i];
		}
	}
	return t;
}

function normalize(s) {
	s = String(s).replaceAll(/\s/g, '');
	s = s.replaceAll(
		/[\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079\u207A\u207B\u2E33\u2E34\u1D31\u1D49]+/g,
		g => ('^' + unsup(g))
	);
	s = s.replaceAll(
		/[\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089\u208A\u208B]+/g,
		g => ('_' + unsub(g))
	);
	s = ununi(s);
	return s;
}

function build(context, lang, ...objs) {
	for (const obj of objs) {
		if (typeof obj === 'object') {
			for (const key of Object.keys(obj)) {
				const entry = {};
				if (context) {
					if (typeof context === 'object') {
						for (const ck of Object.keys(context)) {
							entry[ck] = context[ck];
						}
					} else {
						entry['context'] = context;
					}
				}
				entry['key'] = key;
				entry['value'] = obj[key];
				if (typeof obj[key] === 'object') {
					let symbol = obj[key]['symbol'];
					if (!(symbol === undefined || symbol === null)) {
						let s = symbol.join ? symbol.join(',') : symbol;
						if (!(s = normalize(s))) continue;
						if (!index[s]) index[s] = [entry];
						else if (index[s].indexOf(entry) < 0) index[s].push(entry);
					}
					let name = obj[key]['name'];
					if (!(name === undefined || name === null)) {
						if (typeof name === 'object') name = name[lang] || name['en'];
						if (typeof name !== 'object') name = [name];
						for (const k of Object.keys(name)) {
							let n = name[k];
							if (n === undefined || n === null) continue;
							if (!(n = normalize(n).toLowerCase())) continue;
							if (!index[n]) index[n] = [entry];
							else if (index[n].indexOf(entry) < 0) index[n].push(entry);
						}
					}
				}
				const k = normalize(key);
				if (!k) continue;
				if (!index[k]) index[k] = [entry];
				else if (index[k].indexOf(entry) < 0) index[k].push(entry);
			}
		}
	}
}

function disambiguate(lang, ...objs) {
	const results = {};
	for (const obj of objs) {
		if (typeof obj === 'object' && typeof obj[lang] === 'object') {
			for (const key of Object.keys(obj[lang])) {
				const k = normalize(key);
				if (k && index[k] && index[k].length > 1) {
					const matcher = obj[lang][key];
					const matches = index[k].filter(o => {
						for (const mk of Object.keys(matcher)) {
							if (mk === 'message') continue;
							if (o[mk] !== matcher[mk]) return false;
						}
						return true;
					});
					if (matches.length == 1) {
						const entry = {};
						for (const mk of Object.keys(matches[0])) {
							entry[mk] = matches[0][mk];
						}
						entry['disambiguated'] = matcher['message'] || true;
						const i = index[k].indexOf(matches[0]);
						if (i) index[k][i] = index[k][0];
						index[k][0] = entry;
						results[key] = true;
					} else {
						results[key] = false;
					}
				}
			}
		}
	}
	return results;
}

function lookup(term) {
	term = normalize(term);
	if (index[term]) return index[term];
	return index[term.toLowerCase()];
}

function cslookup(term) {
	return index[normalize(term)];
}

module.exports = { index, build, disambiguate, lookup, cslookup };
