let logger = console;
let totalErrorCount = 0;
let totalWarningCount = 0;
let localErrorCount = 0;
let localWarningCount = 0;

function error(context, message) {
	if (logger) logger.log('ERROR: ' + context + ': ' + message);
	totalErrorCount++;
	localErrorCount++;
}

function warning(context, message) {
	if (logger) logger.log('WARNING: ' + context + ': ' + message);
	totalWarningCount++;
	localWarningCount++;
}

function validateStart() {
	localErrorCount = 0;
	localWarningCount = 0;
}

function validateKeys(context, object, required, optional) {
	if (!(object && typeof object === 'object')) {
		error(context, 'value must be a non-null object');
		return;
	}
	const keys = Object.keys(object);
	for (const key of required) {
		if (keys.indexOf(key) < 0) {
			error(context, 'value must contain required key "' + key + '"');
		}
	}
	for (const key of keys) {
		if (required.indexOf(key) < 0 && optional.indexOf(key) < 0) {
			warning(context, 'value contains unknown key "' + key + '"');
		}
	}
}

function validateString(context, key, value) {
	if (!(value && typeof value === 'string')) {
		error(context, 'value for "' + key + '" must be a non-empty string');
	}
}

function validateLS(context, key, object, requiredSubstring) {
	if (!(object && typeof object === 'object')) {
		error(context, 'value for "' + key + '" must be a non-null object');
		return;
	}
	const keys = Object.keys(object);
	if (keys.indexOf('en') < 0) {
		error(context, 'value for "' + key + '" must contain required key "en"');
	}
	for (const lang of keys) {
		const value = object[lang];
		if (!value) {
			error(context, 'value for "' + key + '", language "' + lang + '", must be a non-empty string or non-null object');
		} else if (typeof value === 'string') {
			if (requiredSubstring && value.indexOf(requiredSubstring) < 0) {
				error(context, 'value for "' + key + '", language "' + lang + '", must contain required substring "' + requiredSubstring + '"');
			}
		} else if (typeof value === 'object') {
			const subkeys = Object.keys(value);
			if (subkeys.indexOf('*') < 0) {
				error(context, 'value for "' + key + '", language "' + lang + '", must contain required key "*"');
			}
			for (const number of subkeys) {
				if (number !== '*' && Math.ceil(number) !== Math.floor(number)) {
					error(context, 'value for "' + key + '", language "' + lang + '", contains key "' + number + '" that is not an integer or "*"');
				}
				const subvalue = value[number];
				if (!(subvalue && typeof subvalue === 'string')) {
					error(context, 'value for "' + key + '", language "' + lang + '", number "' + number + '", must be a non-empty string');
				} else if (requiredSubstring && subvalue.indexOf(requiredSubstring) < 0) {
					error(context, 'value for "' + key + '", language "' + lang + '", number "' + number + '", must contain required substring "' + requiredSubstring + '"');
				}
			}
		} else {
			error(context, 'value for "' + key + '", language "' + lang + '", must be a non-empty string or non-null object');
		}
	}
}

function validateLSOrder(context, key, object) {
	if (!(object && typeof object === 'object')) {
		error(context, 'value for "' + key + '" must be a non-null object');
		return;
	}
	const keys = Object.keys(object);
	if (keys.indexOf('en') < 0) {
		error(context, 'value for "' + key + '" must contain required key "en"');
	}
	for (const lang of keys) {
		const value = object[lang];
		if (!(value === 'ltr' || value === 'rtl')) {
			error(context, 'value for "' + key + '", language "' + lang + '", must be "ltr" or "rtl"');
		}
	}
}

function validateDimension(context, key, object, dimensionsMap) {
	if (!(object && typeof object === 'object')) {
		error(context, 'value for "' + key + '" must be a non-null object');
		return;
	}
	const keys = Object.keys(object);
	for (const dim of keys) {
		if (!dimensionsMap[dim]) {
			error(context, 'value for "' + key + '" contains undefined dimension "' + dim + '"');
		}
		if (Math.ceil(object[dim] * 2) !== Math.floor(object[dim] * 2)) {
			error(context, 'value for "' + key + '", dimension "' + dim + '", must be a multiple of 0.5 but is ' + object[dim]);
		}
	}
}

function validateOK() {
	return !localErrorCount;
}

function putIfOK(context, map, key, value) {
	if (validateOK()) {
		if (map[key]) {
			error(context, 'duplicate key "' + key + '"');
		} else {
			map[key] = value;
		}
	}
}

function solverSolutionKeyValid(key) {
	const reg = key.split ? key.split(',') : key;
	if (!reg.length) return false;
	for (let i = 0; i < reg.length; i++) {
		if (reg[i] < 0) return false;
		if (Math.ceil(reg[i]) !== Math.floor(reg[i])) return false;
		if (i > 0 && reg[i] <= reg[i-1]) return false;
	}
	return true;
}

module.exports = {
	logger: (a => ((a === undefined) ? logger : (logger = a))),
	totalErrorCount: (() => totalErrorCount),
	totalWarningCount: (() => totalWarningCount),
	localErrorCount: (() => localErrorCount),
	localWarningCount: (() => localWarningCount),
	error, warning, start: validateStart,
	keys: validateKeys, string: validateString,
	ls: validateLS, lsOrder: validateLSOrder,
	dimension: validateDimension,
	ok: validateOK, putIfOK,
	solverSolutionKeyValid
};
