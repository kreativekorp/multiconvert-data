#!/usr/bin/env node

const fs = require('node:fs');
const c64file = require('./lib/c64file.js');
const mbsrmp = require('./lib/mbsrmp.js');

function processFile(filename, dumpfn) {
	console.log(filename);
	try {
		const b = fs.readFileSync(filename);
		const rb = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
		const view = new DataView(rb);
		if (c64file.isC64File(view)) {
			console.log('File Name:');
			console.log(c64file.getName(view));
			dumpfn(c64file.getContent(view));
		} else {
			dumpfn(view);
		}
	} catch (err) {
		console.error(err);
	}
}

const dumpFunctions = {
	'-u': ((view, namefn, logger) => mbsrmp.dump(view, logger)),
	'-t': mbsrmp.dumpCategory,
	'-i': mbsrmp.dumpInclude
};

const nameFunctions = {
	'-a': mbsrmp.defaultNameDecodeFn,
	'-c': ((view, ptr) => c64file.decode(mbsrmp.getCString(view, ptr)))
};

function printHelp() {
	console.log('Usage:');
	console.log('  dump-mbsrmp.js [options] <filename> [<filename> [...]]');
	console.log();
	console.log('Options:');
	console.log('  -u    dump unit definition [default]');
	console.log('  -t    dump unit type / category');
	console.log('  -i    dump include / installation default');
	console.log('  -a    decode names as ASCII [default]');
	console.log('  -c    decode names as PETSCII');
	console.log('  --    treat remaining arguments as file names');
}

function processArgs(args, i, length) {
	if (i >= length) {
		printHelp();
		return;
	}
	let forceFilename = false;
	let dumpfn = dumpFunctions['-u'];
	let namefn = nameFunctions['-a'];
	while (i < length) {
		const arg = args[i++];
		if (forceFilename) {
			processFile(arg, (view => dumpfn(view, namefn, console)));
		} else if (arg === '--') {
			forceFilename = true;
		} else if (dumpFunctions[arg]) {
			dumpfn = dumpFunctions[arg];
		} else if (nameFunctions[arg]) {
			namefn = nameFunctions[arg];
		} else if (arg === '--help') {
			printHelp();
		} else {
			processFile(arg, (view => dumpfn(view, namefn, console)));
		}
	}
}

processArgs(process.argv, 2, process.argv.length);
