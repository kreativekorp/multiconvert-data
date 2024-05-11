const fs = require('node:fs');
const path = require('node:path');

function listFiles(paths, parent) {
	if (fs.statSync(parent).isDirectory()) {
		for (const child of fs.readdirSync(parent)) {
			if (!child.startsWith('.')) {
				listFiles(paths, path.join(parent, child));
			}
		}
	} else {
		paths.push(parent);
	}
}

function findFiles(parent, prefix) {
	foundFiles = [];
	const ok = new RegExp('^' + prefix.replace(/\P{L}/gu, '[-._]') + '([-._]|$)', 'iu');
	for (const child of fs.readdirSync(parent)) {
		if (ok.test(child)) {
			listFiles(foundFiles, path.join(parent, child));
		}
	}
	return foundFiles;
}

module.exports = { listFiles, findFiles };
