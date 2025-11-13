/* Floating-point numbers as encoded by Microsoft BASIC on 8-bit micros. */

function encode(v) {
	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setFloat64(0, v, false);
	const bits = view.getBigUint64(0, false);

	const neg = (bits >> 63n) & 1n;
	const exp = (bits >> 52n) & 0x7FFn;
	const man = bits & ((1n << 52n) - 1n);

	let mbfexp = exp - 894n;
	let mbfman = (man >> 21n) + ((man >> 20n) & 1n);
	if (mbfman >= (1n << 31n)) { mbfexp++; mbfman = 0n; }

	if (mbfexp <= 0n) return 0n;
	if (mbfexp >= 256n) throw new RangeError();
	return (mbfexp << 32n) | (neg << 31n) | mbfman;
}

function decode(bits) {
	const exp = (bits >> 32n) & 0xFFn;
	const neg = (bits >> 31n) & 1n;
	const man = bits & ((1n << 31n) - 1n);

	if (exp == 0n) return 0;
	const dblexp = exp + 894n;
	const dblman = (man << 21n);
	const dblbits = (neg << 63n) | (dblexp << 52n) | dblman;

	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setBigUint64(0, dblbits, false);
	return view.getFloat64(0, false);
}

function getBits(view, offset) {
	const exp = view.getUint8(offset, false);
	const man = view.getUint32(offset+1, false);
	return (BigInt(exp) << 32n) | BigInt(man);
}

function setBits(view, offset, bits) {
	const exp = (bits >> 32n) & 0xFFn;
	const man = bits & ((1n << 32n) - 1n);
	view.setUint8(offset, Number(exp), false);
	view.setUint32(offset+1, Number(man), false);
}

function getFloat(view, offset) {
	return decode(getBits(view, offset));
}

function setFloat(view, offset, v) {
	setBits(view, offset, encode(v));
}

module.exports = {
	encode, decode,
	getBits, setBits,
	getFloat, setFloat
};
