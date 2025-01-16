const vm = require('node:vm');

const srmpPattern = /([A-Za-z])|([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)(_[+-]?[0-9]+)?)/g;

const srmpReverseOp = {
	'A':'S', 'a':'s', 'S':'A', 's':'a', 'Z':'Z', 'z':'z',
	'M':'D', 'm':'d', 'D':'M', 'd':'m', 'G':'G', 'g':'g',
	'P':'R', 'p':'r', 'R':'P', 'r':'p',
	'X':'L', 'x':'l', 'L':'X', 'l':'x',
	'E':'N', 'e':'n', 'N':'E', 'n':'e',
	'C':'Q', 'c':'q', 'Q':'C', 'q':'c',
	'F':'V', 'f':'v', 'V':'F', 'v':'f'
};

function srmpCodeGenValid(s) {
	s = s.replaceAll(srmpPattern, '');
	return !s.replaceAll(/\s/g, '');
}

function srmpCodeGenParse(s, opcode='M') {
	const operations = [];
	for (const m of s.matchAll(srmpPattern)) {
		if (m[1]) opcode = m[1];
		if (m[2]) operations.push([opcode, m[2].replaceAll('_', 'e')]);
	}
	return operations;
}

function srmpCodeGenOperation(kernel, opcode, operand) {
	switch (opcode) {
		case 'A': case 'a': return '(' + kernel + ')+(' + operand + ')';
		case 'S': case 's': return '(' + kernel + ')-(' + operand + ')';
		case 'Z': case 'z': return '(' + operand + ')-(' + kernel + ')';
		case 'M': case 'm': return '(' + kernel + ')*(' + operand + ')';
		case 'D': case 'd': return '(' + kernel + ')/(' + operand + ')';
		case 'G': case 'g': return '(' + operand + ')/(' + kernel + ')';
		case 'C': case 'c': return '(' + kernel + ')*Math.PI/(' + operand + ')';
		case 'Q': case 'q': return '(' + kernel + ')*(' + operand + ')/Math.PI';
		case 'P': case 'p': return 'Math.pow(' + kernel + ',' + operand + ')';
		case 'X': case 'x': return 'Math.pow(' + operand + ',' + kernel + ')';
		case 'R': case 'r':
			if (operand == 2) return 'Math.sqrt(' + kernel + ')';
			if (operand == 3) return 'Math.cbrt(' + kernel + ')';
			return 'Math.pow(' + kernel + ',1/(' + operand + '))';
		case 'L': case 'l':
			if (operand == 2) return 'Math.log2(' + kernel + ')';
			if (operand == 10) return 'Math.log10(' + kernel + ')';
			return 'Math.log(' + kernel + ')/Math.log(' + operand + ')';
		case 'E': case 'e':
			if (operand == 0) return 'Math.exp(' + kernel + ')';
			if (operand == 1) return 'Math.expm1(' + kernel + ')';
			return 'Math.exp(' + kernel + ')-(' + operand + ')';
		case 'N': case 'n':
			if (operand == 0) return 'Math.log(' + kernel + ')';
			if (operand == 1) return 'Math.log1p(' + kernel + ')';
			return 'Math.log((' + kernel + ')+(' + operand + '))';
		case 'V': case 'v':
			operand = -operand;
			// fallthrough;
		case 'F': case 'f':
			if (operand ==  +1) return 'Math.sin(' + kernel + ')';
			if (operand ==  +2) return 'Math.cos(' + kernel + ')';
			if (operand ==  +3) return 'Math.tan(' + kernel + ')';
			if (operand ==  +4) return '1/Math.tan(' + kernel + ')';
			if (operand ==  +5) return '1/Math.cos(' + kernel + ')';
			if (operand ==  +6) return '1/Math.sin(' + kernel + ')';
			if (operand ==  +7) return 'Math.sinh(' + kernel + ')';
			if (operand ==  +8) return 'Math.cosh(' + kernel + ')';
			if (operand ==  +9) return 'Math.tanh(' + kernel + ')';
			if (operand == +10) return '1/Math.tanh(' + kernel + ')';
			if (operand == +11) return '1/Math.cosh(' + kernel + ')';
			if (operand == +12) return '1/Math.sinh(' + kernel + ')';
			if (operand ==  -1) return 'Math.asin(' + kernel + ')';
			if (operand ==  -2) return 'Math.acos(' + kernel + ')';
			if (operand ==  -3) return 'Math.atan(' + kernel + ')';
			if (operand ==  -4) return 'Math.atan2(1,' + kernel + ')';
			if (operand ==  -5) return 'Math.acos(1/(' + kernel + '))';
			if (operand ==  -6) return 'Math.asin(1/(' + kernel + '))';
			if (operand ==  -7) return 'Math.asinh(' + kernel + ')';
			if (operand ==  -8) return 'Math.acosh(' + kernel + ')';
			if (operand ==  -9) return 'Math.atanh(' + kernel + ')';
			if (operand == -10) return 'Math.atanh(1/(' + kernel + '))';
			if (operand == -11) return 'Math.acosh(1/(' + kernel + '))';
			if (operand == -12) return 'Math.asinh(1/(' + kernel + '))';
			return kernel;
		default: return kernel;
	}
}

function srmpCodeGenForward(s, cgop=srmpCodeGenOperation) {
	let kernel = 'a';
	const operations = srmpCodeGenParse(s, 'M');
	for (let i = 0; i < operations.length; i++) {
		const [opcode, operand] = operations[i];
		kernel = cgop(kernel, opcode, operand);
	}
	return 'function(a){return(' + kernel + ');}';
}

function srmpCodeGenReverse(s, cgop=srmpCodeGenOperation) {
	let kernel = 'a';
	const operations = srmpCodeGenParse(s, 'M');
	for (let i = operations.length - 1; i >= 0; i--) {
		const [opcode, operand] = operations[i];
		kernel = cgop(kernel, (srmpReverseOp[opcode] || opcode), operand);
	}
	return 'function(a){return(' + kernel + ');}';
}

function srmpCompileForward(s, cgop=srmpCodeGenOperation, ctx={}) {
	const forwardCode = srmpCodeGenForward(s, cgop);
	const forwardFn = new vm.Script('(' + forwardCode + ')').runInNewContext(ctx);
	return (typeof forwardFn === 'function') ? forwardFn : null;
}

function srmpCompileReverse(s, cgop=srmpCodeGenOperation, ctx={}) {
	const reverseCode = srmpCodeGenReverse(s, cgop);
	const reverseFn = new vm.Script('(' + reverseCode + ')').runInNewContext(ctx);
	return (typeof reverseFn === 'function') ? reverseFn : null;
}

function srmpRationalize(s, p=1, q=1, mul=(a,b)=>(a*b), pi=Math.PI) {
	const operations = srmpCodeGenParse(s, 'M');
	for (let i = 0; i < operations.length; i++) {
		const [opcode, operand] = operations[i];
		switch (opcode) {
			case 'C': case 'c': p = mul(p, pi); // fallthrough;
			case 'D': case 'd': q = mul(q, operand); break;
			case 'Q': case 'q': q = mul(q, pi); // fallthrough;
			case 'M': case 'm': p = mul(p, operand); break;
			default: return null;
		}
	}
	return [p, q];
}

module.exports = {
	validate: srmpCodeGenValid,
	parse: srmpCodeGenParse,
	codegenForward: srmpCodeGenForward,
	codegenReverse: srmpCodeGenReverse,
	compileForward: srmpCompileForward,
	compileReverse: srmpCompileReverse,
	rationalize: srmpRationalize
};
