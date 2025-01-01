const fs = require('node:fs');
const path = require('node:path');

function fnp(pattern) {
	return pattern.replace(/\P{L}/gu, '[-._]');
}

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

function findFiles(parent, prefix, subdirs=['extra','general','misc','multiconvert','other']) {
	foundFiles = [];
	const dp = new RegExp('^(data|(' + subdirs.map(fnp).join('|') + ')([-._]data)?)$', 'iu');
	const ok = new RegExp('^(' + fnp(prefix) + ')([-._]|$)', 'iu');
	for (const child of fs.readdirSync(parent)) {
		const cpath = path.join(parent, child);
		if (dp.test(child) && fs.statSync(cpath).isDirectory()) {
			for (const gchild of fs.readdirSync(cpath)) {
				if (ok.test(gchild)) {
					const gcpath = path.join(cpath, gchild);
					listFiles(foundFiles, gcpath);
				}
			}
		} else if (ok.test(child)) {
			listFiles(foundFiles, cpath);
		}
	}
	return foundFiles;
}

module.exports = { listFiles, findFiles };
