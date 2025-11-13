const MAGIC = 0x43363446696C6500n; // 'C64File\x00'

const ASCII_MAP = {
	'£': '\\', '¥': 'Y', '¦': '|',
	'©': '(C)', '®': '(R)', '±': '+/-',
	'µ': 'u', '·': '*', '×': '*', '÷': '/',
	'¼': '1/4', '½': '1/2', '¾': '3/4',
	'Æ': 'AE', 'æ': 'ae', 'Ð': 'DH', 'ð': 'dh',
	'Ø': 'O', 'ø': 'o', 'Þ': 'TH', 'þ': 'th',
	'ẞ': 'SS', 'ß': 'ss', 'Ĳ': 'IJ', 'ĳ': 'ij',
	'Ŋ': 'NG', 'ŋ': 'ng', 'Œ': 'OE', 'œ': 'oe',
	'‘': "'", '’': "'", '‚': ',', '‛': "'",
	'“': '"', '”': '"', '„': ',,', '‟': '"',
	'′': "'", '″': "''", '‴': "'''", '⁗': "''''",
	'‹': '<', '›': '>', '«': '<<', '»': '>>',
	'≤': '<=', '≥': '>=', '≠': '<>', '−': '-',
	'€': 'C=', '℗': '(P)', '℠': '(SM)', '™': '(TM)',
	'⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
	'⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
	'⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
	'₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
	'₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
	'₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')',
	'←': '_', '↑': '^', 'π': '~'
};

function asciify(s) {
	return (s
		.replaceAll(
			new RegExp(Object.keys(ASCII_MAP).join('|'), 'g'),
			m => ASCII_MAP[m]
		)
		.normalize('NFKD')
		.replaceAll(/\p{M}/ug, '')
		.replaceAll(
			/[^\t\n\r -~]/ug,
			m => ('[u' + m.codePointAt(0).toString(16).toUpperCase() + ']')
		)
	);
}

function byteASC2PET(b) {
	const b1 = b & 0xE0;
	if (b1 === 0x60 || b1 === 0xC0) b ^= 0xA0;
	const b2 = b & 0xE0;
	if (b2 === 0x40 || b2 === 0xC0) {
		const b3 = b & 0x1F;
		if (b3 >= 0x01 && b3 <= 0x1A) b ^= 0x80;
	}
	return b;
}

function bytePET2ASC(b) {
	const b1 = b & 0xE0;
	if (b1 === 0x60 || b1 === 0xC0) b ^= 0xA0;
	const b2 = b & 0xE0;
	if (b2 === 0x40 || b2 === 0x60) {
		const b3 = b & 0x1F;
		if (b3 >= 0x01 && b3 <= 0x1A) b ^= 0x20;
	}
	return b;
}

function encodePETSCII(s) {
	return Uint8Array.from(
		[...s]
		.map(c => c.codePointAt(0))
		.map(c => ((c < 0xA0) ? c : 0x3F))
		.map(byteASC2PET)
	);
}

function decodePETSCII(b) {
	return (
		Array.from(b)
		.map(c => (c & 0xFF))
		.map(bytePET2ASC)
		.map(c => ((c < 0xA0) ? c : 0x3F))
		.map(c => String.fromCodePoint(c))
		.join('')
	);
}

function c64fileHeader(name) {
	const buffer = new ArrayBuffer(0x1A);
	const view = new DataView(buffer);
	view.setBigUint64(0, MAGIC, false);
	const nb = encodePETSCII(name);
	for (let i = 0; i < 16 && i < nb.length; i++) view.setUint8(i + 8, nb[i]);
	return view;
}

function isC64File(view) {
	return (view.byteLength >= 0x1A && view.getBigUint64(0, false) === MAGIC);
}

function getC64FileName(view) {
	let endptr = 8;
	while (endptr < 24 && view.getUint8(endptr)) endptr++;
	const slice = view.buffer.slice(view.byteOffset + 8, view.byteOffset + endptr);
	return decodePETSCII(new Uint8Array(slice));
}

function getC64FileContent(view) {
	const slice = view.buffer.slice(view.byteOffset + 0x1A, view.byteOffset + view.byteLength);
	return new DataView(slice);
}

module.exports = {
	asciify,
	encode: encodePETSCII,
	decode: decodePETSCII,
	header: c64fileHeader,
	isC64File,
	getName: getC64FileName,
	getContent: getC64FileContent
};
