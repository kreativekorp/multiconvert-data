/* Compilation of SRMP into bytecode suitable for execution in Microsoft BASIC. */

const mbf = require('./mbfloat.js');
const srmp = require('./srmp.js');

const NOP   = 0;  // no operation
const SWAP  = 1;  // swap FAC and ARG
const ADD   = 2;  // add to
const SUBF  = 3;  // subtract from
const MUL   = 4;  // multiply by
const DIVI  = 5;  // divide into
const POW   = 6;  // power
const EXPL  = 7;  // exponential
const EXP   = 8;  // natural exponential
const LOG   = 9;  // natural logarithm
const SQRT  = 10; // square root
const CBRT  = 11; // cube root
const SIN   = 12; // sine
const COS   = 13; // cosine
const TAN   = 14; // tangent
const ATAN  = 15; // inverse tangent
const LOG10 = 16; // base 10 logarithm
const LOG2  = 17; // base 2 logarithm
const ASIN  = 18; // inverse sine
const ACOS  = 19; // inverse cosine
const ACOT  = 20; // inverse cotangent
const ASEC  = 21; // inverse secant
const ACSC  = 22; // inverse cosecant
const COT   = 23; // cotangent
const SEC   = 24; // secant
const CSC   = 25; // cosecant
const ABS   = 26; // absolute value
const INT   = 27; // greatest integer
const SGN   = 28; // sign
const NEG   = 29; // negative
const SFHPI = 30; // subtract from pi/2
const RECIP = 31; // reciprocal
const STFAC = 0x40; // store FAC
const LDARG = 0x80; // load ARG

const OPCODES = [
	'NOP', 'SWAP', 'ADD', 'SUBF', 'MUL', 'DIVI', 'POW', 'EXPL',
	'EXP', 'LOG', 'SQRT', 'CBRT', 'SIN', 'COS', 'TAN', 'ATAN',
	'LOG10', 'LOG2', 'ASIN', 'ACOS', 'ACOT', 'ASEC', 'ACSC', 'COT',
	'SEC', 'CSC', 'ABS', 'INT', 'SGN', 'NEG', 'SFHPI', 'RECIP'
];

const CONSTANTS = [
	1/3, 1, Math.PI/2, Math.PI, Math.PI*2,
	1/Math.log(10), 1/Math.log(2), Math.E,
	Math.PI/180, 180/Math.PI, 1/Math.PI, 1/Math.E,
	1/Math.sqrt(3), 1/Math.sqrt(2),
	Math.sqrt(2), Math.sqrt(3),
	2, 3, 10, 1e2, 1e3, 1e6, 1e9, 1e12,
	1e-12, 1e-9, 1e-6, 1e-3, 1e-2, 1e-1,
	299792458, 0
];

function mbsrmpOperation(kernel, instructions, opcode, operand) {
	switch (opcode) {
		case 'A': case 'a':
			if (operand != 0) {
				instructions.push(LDARG + kernel.indexOfConstant(operand));
				instructions.push(ADD);
			}
			break;
		case 'S': case 's':
			if (operand != 0) {
				instructions.push(LDARG + kernel.indexOfConstant(-operand));
				instructions.push(ADD);
			}
			break;
		case 'Z': case 'z':
			if (operand == 0) {
				instructions.push(NEG);
			} else {
				instructions.push(LDARG + kernel.indexOfConstant(operand));
				instructions.push(SUBF);
			}
			break;
		case 'M': case 'm':
			if (operand == -1) {
				instructions.push(NEG);
			} else if (operand != 1) {
				instructions.push(LDARG + kernel.indexOfConstant(operand));
				instructions.push(MUL);
			}
			break;
		case 'D': case 'd':
			if (operand == -1) {
				instructions.push(NEG);
			} else if (operand != 1) {
				instructions.push(LDARG + kernel.indexOfConstant(1 / operand));
				instructions.push(MUL);
			}
			break;
		case 'G': case 'g':
			if (operand == -1) {
				instructions.push(NEG);
				instructions.push(RECIP);
			} else if (operand == 1) {
				instructions.push(RECIP);
			} else {
				instructions.push(LDARG + kernel.indexOfConstant(operand));
				instructions.push(DIVI);
			}
			break;
		case 'C': case 'c':
			if (operand == -Math.PI) {
				instructions.push(NEG);
			} else if (operand != Math.PI) {
				instructions.push(LDARG + kernel.indexOfConstant(Math.PI / operand));
				instructions.push(MUL);
			}
			break;
		case 'Q': case 'q':
			if (operand == -Math.PI) {
				instructions.push(NEG);
			} else if (operand != Math.PI) {
				instructions.push(LDARG + kernel.indexOfConstant(operand / Math.PI));
				instructions.push(MUL);
			}
			break;
		case 'P': case 'p':
			if (operand == -1) {
				instructions.push(RECIP);
			} else if (operand == 0.5) {
				instructions.push(SQRT);
			} else if (operand == 1/3) {
				instructions.push(CBRT);
			} else if (operand != 1) {
				instructions.push(LDARG + kernel.indexOfConstant(operand));
				instructions.push(POW);
			}
			break;
		case 'R': case 'r':
			if (operand == -1) {
				instructions.push(RECIP);
			} else if (operand == 2) {
				instructions.push(SQRT);
			} else if (operand == 3) {
				instructions.push(CBRT);
			} else if (operand != 1) {
				instructions.push(LDARG + kernel.indexOfConstant(1 / operand));
				instructions.push(POW);
			}
			break;
		case 'X': case 'x':
			if (operand == Math.E) {
				instructions.push(EXP);
			} else {
				instructions.push(LDARG + kernel.indexOfConstant(operand));
				instructions.push(EXPL);
			}
			break;
		case 'L': case 'l':
			if (operand == Math.E) {
				instructions.push(LOG);
			} else if (operand == 2) {
				instructions.push(LOG2);
			} else if (operand == 10) {
				instructions.push(LOG10);
			} else {
				instructions.push(LOG);
				instructions.push(LDARG + kernel.indexOfConstant(1 / Math.log(operand)));
				instructions.push(MUL);
			}
			break;
		case 'E': case 'e':
			instructions.push(EXP);
			if (operand != 0) {
				instructions.push(LDARG + kernel.indexOfConstant(-operand));
				instructions.push(ADD);
			}
			break;
		case 'N': case 'n':
			if (operand != 0) {
				instructions.push(LDARG + kernel.indexOfConstant(operand));
				instructions.push(ADD);
			}
			instructions.push(LOG);
			break;
		case 'V': case 'v':
			operand = -operand;
			// fallthrough;
		case 'F': case 'f':
			if (operand == +1) instructions.push(SIN);
			if (operand == +2) instructions.push(COS);
			if (operand == +3) instructions.push(TAN);
			if (operand == +4) instructions.push(COT);
			if (operand == +5) instructions.push(SEC);
			if (operand == +6) instructions.push(CSC);
			if (operand == -1) instructions.push(ASIN);
			if (operand == -2) instructions.push(ACOS);
			if (operand == -3) instructions.push(ATAN);
			if (operand == -4) instructions.push(ACOT);
			if (operand == -5) instructions.push(ASEC);
			if (operand == -6) instructions.push(ACSC);
			break;
	}
}

function mbsrmpOptimize(ops, add=(a,b)=>(a-(-b)), sub=(a,b)=>(a-b), neg=(a)=>(-a), mul=(a,b)=>(a*b), div=(a,b)=>(a/b), inv=(a)=>(1/a), pi=Math.PI) {
	const opops = [];
	let lastop = null;
	for (const [opcode, operand] of ops) {
		switch (opcode) {
			case 'A': case 'a':
				if (lastop && (lastop[0] === 'A')) lastop[1] = add(lastop[1], operand);
				else opops.push(lastop = ['A', operand]);
				break;
			case 'S': case 's':
				if (lastop && (lastop[0] === 'A')) lastop[1] = sub(lastop[1], operand);
				else opops.push(lastop = ['A', neg(operand)]);
				break;
			case 'M': case 'm':
				if (lastop && (lastop[0] === 'M')) lastop[1] = mul(lastop[1], operand);
				else opops.push(lastop = ['M', operand]);
				break;
			case 'D': case 'd':
				if (lastop && (lastop[0] === 'M')) lastop[1] = div(lastop[1], operand);
				else opops.push(lastop = ['M', inv(operand)]);
				break;
			case 'C': case 'c':
				if (lastop && (lastop[0] === 'M')) lastop[1] = mul(lastop[1], div(pi, operand));
				else opops.push(lastop = ['M', div(pi, operand)]);
				break;
			case 'Q': case 'q':
				if (lastop && (lastop[0] === 'M')) lastop[1] = mul(lastop[1], div(operand, pi));
				else opops.push(lastop = ['M', div(operand, pi)]);
				break;
			default:
				opops.push([opcode.toUpperCase(), operand]);
				break;
		}
	}
	return opops;
}

class MBSRMPKernel {
	constructor(constants=CONSTANTS) {
		this.forwardInstructions = [];
		this.reverseInstructions = [];
		this.values = [];
		this.constants = constants.map(mbf.encode);
		this.constantsSrc = constants;
	}
	indexOfRegister(r) {
		const key = String(r);
		const index = this.values.indexOf(key);
		if (index >= 0) return index;
		const newIndex = this.values.length;
		this.values.push(key);
		return newIndex;
	}
	indexOfConstant(v) {
		const key = mbf.encode(v);
		const constIndex = this.constants.indexOf(key);
		if (constIndex >= 0) return constIndex + 0x40;
		const valueIndex = this.values.indexOf(key);
		if (valueIndex >= 0) return valueIndex;
		const newIndex = this.values.length;
		this.values.push(key);
		return newIndex;
	}
	parseInstructions(s, complement=false) {
		if (complement) {
			this.reverseInstructions.push(RECIP);
		}
		for (const [opcode, operand] of mbsrmpOptimize(srmp.parseForward(s))) {
			mbsrmpOperation(this, this.forwardInstructions, opcode, operand);
		}
		for (const [opcode, operand] of mbsrmpOptimize(srmp.parseReverse(s))) {
			mbsrmpOperation(this, this.reverseInstructions, opcode, operand);
		}
		if (complement) {
			this.forwardInstructions.push(RECIP);
		}
	}
	parseRational(p, q, complement=false) {
		if (complement) {
			this.reverseInstructions.push(RECIP);
		}
		if (p / q == -1) {
			this.forwardInstructions.push(NEG);
			this.reverseInstructions.push(NEG);
		} else if (p / q != 1) {
			this.forwardInstructions.push(LDARG + this.indexOfConstant(p / q));
			this.forwardInstructions.push(MUL);
			this.reverseInstructions.push(LDARG + this.indexOfConstant(q / p));
			this.reverseInstructions.push(MUL);
		}
		if (complement) {
			this.forwardInstructions.push(RECIP);
		}
	}
	parseBase(complement=false) {
		if (complement) {
			this.reverseInstructions.push(RECIP);
			this.forwardInstructions.push(RECIP);
		}
	}
	compile() {
		let fptr = 4;
		let rptr = fptr + this.forwardInstructions.length + 1;
		let kptr = rptr + this.reverseInstructions.length + 1;
		const size = kptr + this.values.length * 5;
		const buffer = new ArrayBuffer(size);
		const view = new DataView(buffer);
		view.setUint8(0, size);
		view.setUint8(1, fptr);
		view.setUint8(2, rptr);
		view.setUint8(3, kptr);
		for (const fi of this.forwardInstructions) {
			view.setUint8(fptr, fi);
			fptr++;
		}
		for (const ri of this.reverseInstructions) {
			view.setUint8(rptr, ri);
			rptr++;
		}
		for (const k of this.values) {
			if (typeof k === 'bigint') mbf.setBits(view, kptr, k);
			kptr += 5;
		}
		return view;
	}
	decompile(view) {
		const size = view.getUint8(0, false);
		let fptr = view.getUint8(1, false);
		let rptr = view.getUint8(2, false);
		let kptr = view.getUint8(3, false);
		while (fptr < size) {
			const fi = view.getUint8(fptr, false);
			if (!fi) break;
			this.forwardInstructions.push(fi);
			fptr++;
		}
		while (rptr < size) {
			const ri = view.getUint8(rptr, false);
			if (!ri) break;
			this.reverseInstructions.push(ri);
			rptr++;
		}
		while (kptr + 5 <= size) {
			const k = mbf.getBits(view, kptr);
			this.values.push(k);
			kptr += 5;
		}
	}
	dumpInstruction(inst, logger=console) {
		const h = (inst | 0x100).toString(16).substring(1).toUpperCase();
		if (inst >= LDARG) {
			const index = inst - LDARG;
			if (index >= 0x40) {
				logger.log(h, 'LDARG', index, '(' + this.constantsSrc[index - 0x40] + ')');
			} else if (this.values[index] && typeof this.values[index] === 'bigint') {
				logger.log(h, 'LDARG', index, '(' + mbf.decode(this.values[index]) + ')');
			} else {
				logger.log(h, 'LDARG', index);
			}
		} else if (inst >= STFAC) {
			logger.log(h, 'STFAC', inst - STFAC);
		} else {
			logger.log(h, OPCODES[inst & 0x1F]);
		}
	}
	dump(logger=console) {
		if (this.forwardInstructions.length) {
			logger.log('Forward:');
			for (const fi of this.forwardInstructions) {
				this.dumpInstruction(fi, logger);
			}
		}
		if (this.reverseInstructions.length) {
			logger.log('Reverse:');
			for (const ri of this.reverseInstructions) {
				this.dumpInstruction(ri, logger);
			}
		}
		if (this.values.length) {
			logger.log('Values:');
			for (let i = 0; i < this.values.length; i++) {
				const k = this.values[i];
				if (k && typeof k === 'bigint') {
					const h = (k | (1n << 40n)).toString(16).substring(1).toUpperCase();
					logger.log(i, h, mbf.decode(k));
				} else {
					logger.log(i, k || '0');
				}
			}
		}
	}
}

function mbsrmpCompileInstructions(s, complement=false, constants=CONSTANTS) {
	const kernel = new MBSRMPKernel(constants);
	kernel.parseInstructions(s, complement);
	return kernel.compile();
}

function mbsrmpCompileRational(p, q, complement=false, constants=CONSTANTS) {
	const kernel = new MBSRMPKernel(constants);
	kernel.parseRational(p, q, complement);
	return kernel.compile();
}

function mbsrmpCompileBase(complement=false, constants=CONSTANTS) {
	const kernel = new MBSRMPKernel(constants);
	kernel.parseBase(complement);
	return kernel.compile();
}

function mbsrmpDump(view, logger=console, constants=CONSTANTS) {
	const kernel = new MBSRMPKernel(constants);
	kernel.decompile(view);
	kernel.dump(logger);
}

/* Compilation of multiple units into an archive. */

function cwrap(a) {
	const length = a.length;
	const b = new Uint8Array(length + 1);
	for (let i = 0; i < length; i++) b[i] = a[i];
	b[length] = 0;
	return b;
}

function pwrap(a) {
	const length = (a.length < 255) ? a.length : 255;
	const b = new Uint8Array(length + 1);
	b[0] = length;
	for (let i = 0; i < length; i++) b[i + 1] = a[i];
	return b;
}

function getCString(view, ptr) {
	const start = view.byteOffset + ptr;
	while (view.getUint8(ptr)) ptr++;
	const end = view.byteOffset + ptr;
	const slice = view.buffer.slice(start, end);
	return new Uint8Array(slice);
}

function getPString(view, ptr) {
	const length = view.getUint8(ptr);
	const start = view.byteOffset + ptr + 1;
	const end = start + length;
	const slice = view.buffer.slice(start, end);
	return new Uint8Array(slice);
}

function defaultNameDecodeFn(view, ptr) {
	const decoder = new TextDecoder();
	return decoder.decode(getCString(view, ptr));
}

function defaultNameEncodeFn(u) {
	const encoder = new TextEncoder();
	return cwrap(encoder.encode(u['name']));
}

function defaultDataEncodeFn(u) {
	return u['data'];
}

function mbsrmpCompileCategory(units, namefn=defaultNameEncodeFn, datafn=defaultDataEncodeFn) {
	const strings = units.map(namefn);
	const programs = units.map(datafn);
	const stringOffsetTable = [];
	const programOffsetTable = [];
	let stringOffset = 0;
	let programOffset = 0;
	for (const s of strings) {
		stringOffsetTable.push(stringOffset);
		stringOffset += s.length;
	}
	for (const p of programs) {
		programOffsetTable.push(programOffset);
		programOffset += p.byteLength;
	}
	let sotptr = 10;
	let potptr = sotptr + stringOffsetTable.length * 2;
	let stptr = potptr + programOffsetTable.length * 2;
	let ptptr = stptr + stringOffset;
	const size = ptptr + programOffset;
	const buffer = new ArrayBuffer(size);
	const view = new DataView(buffer);
	view.setUint8(0, ((size + 255) >> 8), true);
	view.setUint8(1, units.length, true);
	view.setUint16(2, sotptr, true);
	view.setUint16(4, potptr, true);
	view.setUint16(6, stptr, true);
	view.setUint16(8, ptptr, true);
	for (const so of stringOffsetTable) {
		view.setUint16(sotptr, stptr + so, true);
		sotptr += 2;
	}
	for (const po of programOffsetTable) {
		view.setUint16(potptr, ptptr + po, true);
		potptr += 2;
	}
	for (const s of strings) {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(stptr, s[i]);
			stptr++;
		}
	}
	for (const p of programs) {
		for (let i = 0; i < p.byteLength; i++) {
			view.setUint8(ptptr, p.getUint8(i));
			ptptr++;
		}
	}
	return view;
}

function mbsrmpDumpCategory(view, namefn=defaultNameDecodeFn, logger=console, constants=CONSTANTS) {
	const length = view.getUint8(1, true);
	const sotptr = view.getUint16(2, true);
	const potptr = view.getUint16(4, true);
	const index = [];
	logger.log('Table of Contents:');
	for (let i = 0; i < length; i++) {
		const sptr = view.getUint16(sotptr + i + i, true);
		const pptr = view.getUint16(potptr + i + i, true);
		const sptrs = (sptr | 0x10000).toString(16).substring(1).toUpperCase();
		const pptrs = (pptr | 0x10000).toString(16).substring(1).toUpperCase();
		const name = namefn(view, sptr);
		const plen = view.getUint8(pptr);
		const plens = '<' + plen + ' bytes>';
		index.push([name, pptr, plen]);
		logger.log(i, sptrs, pptrs, name, plens);
	}
	for (const [name, pptr, plen] of index) {
		logger.log('Name:');
		logger.log(name);
		const start = view.byteOffset + pptr;
		const end = start + plen;
		const slice = view.buffer.slice(start, end);
		mbsrmpDump(new DataView(slice), logger, constants);
	}
}

function mbsrmpCompileInclude(categories, namefn=defaultNameEncodeFn, datafn=defaultDataEncodeFn) {
	const strings = categories.map(namefn);
	const programs = categories.map(datafn);
	const stringOffsetTable = [];
	const programOffsetTable = [];
	let stringOffset = 0;
	let programOffset = 0;
	for (const s of strings) {
		stringOffsetTable.push(stringOffset);
		stringOffset += s.length;
	}
	for (const p of programs) {
		programOffsetTable.push(programOffset);
		programOffset += ((p.byteLength + 255) >> 8);
	}
	let sotptr = 10;
	let potptr = sotptr + stringOffsetTable.length * 2;
	let stptr = potptr + programOffsetTable.length * 2;
	let ptptr = ((stptr + stringOffset + 255) >> 8);
	const size = ((ptptr + programOffset) << 8);
	const buffer = new ArrayBuffer(size);
	const view = new DataView(buffer);
	view.setUint8(0, ptptr, true);
	view.setUint8(1, categories.length, true);
	view.setUint16(2, sotptr, true);
	view.setUint16(4, potptr, true);
	view.setUint16(6, stptr, true);
	view.setUint16(8, ptptr, true);
	for (const so of stringOffsetTable) {
		view.setUint16(sotptr, stptr + so, true);
		sotptr += 2;
	}
	for (const po of programOffsetTable) {
		view.setUint16(potptr, ptptr + po, true);
		potptr += 2;
	}
	for (const s of strings) {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(stptr, s[i]);
			stptr++;
		}
	}
	for (const p of programs) {
		let ptr = (ptptr << 8);
		for (let i = 0; i < p.byteLength; i++) {
			view.setUint8(ptr, p.getUint8(i));
			ptr++;
		}
		ptptr = ((ptr + 255) >> 8);
	}
	return view;
}

function mbsrmpDumpInclude(view, namefn=defaultNameDecodeFn, logger=console, constants=CONSTANTS) {
	const length = view.getUint8(1, true);
	const sotptr = view.getUint16(2, true);
	const potptr = view.getUint16(4, true);
	const index = [];
	logger.log('Master Table of Contents:');
	for (let i = 0; i < length; i++) {
		const sptr = view.getUint16(sotptr + i + i, true);
		const pptr = view.getUint16(potptr + i + i, true);
		const sptrs = (sptr | 0x10000).toString(16).substring(1).toUpperCase();
		const pptrs = (pptr | 0x10000).toString(16).substring(1).toUpperCase();
		const name = namefn(view, sptr);
		const plen = view.getUint8(pptr << 8);
		const plens = '<' + plen + ' pages>';
		index.push([name, pptr, plen]);
		logger.log(i, sptrs, pptrs, name, plens);
	}
	for (const [name, pptr, plen] of index) {
		logger.log('Name:');
		logger.log(name);
		const start = view.byteOffset + (pptr << 8);
		const end = start + (plen << 8);
		const slice = view.buffer.slice(start, end);
		mbsrmpDumpCategory(new DataView(slice), namefn, logger, constants);
	}
}

module.exports = {
	compileInstructions: mbsrmpCompileInstructions,
	compileRational: mbsrmpCompileRational,
	compileBase: mbsrmpCompileBase,
	optimize: mbsrmpOptimize,
	dump: mbsrmpDump,
	cwrap, pwrap,
	getCString, getPString,
	defaultNameDecodeFn,
	defaultNameEncodeFn,
	defaultDataEncodeFn,
	compileCategory: mbsrmpCompileCategory,
	dumpCategory: mbsrmpDumpCategory,
	compileInclude: mbsrmpCompileInclude,
	dumpInclude: mbsrmpDumpInclude
};
