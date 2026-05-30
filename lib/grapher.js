const octants = [
	' ','𜺨','𜺫','🮂','𜴀','▘','𜴁','𜴂','𜴃','𜴄','▝','𜴅','𜴆','𜴇','𜴈','▀',
	'𜴉','𜴊','𜴋','𜴌','🯦','𜴍','𜴎','𜴏','𜴐','𜴑','𜴒','𜴓','𜴔','𜴕','𜴖','𜴗',
	'𜴘','𜴙','𜴚','𜴛','𜴜','𜴝','𜴞','𜴟','🯧','𜴠','𜴡','𜴢','𜴣','𜴤','𜴥','𜴦',
	'𜴧','𜴨','𜴩','𜴪','𜴫','𜴬','𜴭','𜴮','𜴯','𜴰','𜴱','𜴲','𜴳','𜴴','𜴵','🮅',
	'𜺣','𜴶','𜴷','𜴸','𜴹','𜴺','𜴻','𜴼','𜴽','𜴾','𜴿','𜵀','𜵁','𜵂','𜵃','𜵄',
	'▖','𜵅','𜵆','𜵇','𜵈','▌','𜵉','𜵊','𜵋','𜵌','▞','𜵍','𜵎','𜵏','𜵐','▛',
	'𜵑','𜵒','𜵓','𜵔','𜵕','𜵖','𜵗','𜵘','𜵙','𜵚','𜵛','𜵜','𜵝','𜵞','𜵟','𜵠',
	'𜵡','𜵢','𜵣','𜵤','𜵥','𜵦','𜵧','𜵨','𜵩','𜵪','𜵫','𜵬','𜵭','𜵮','𜵯','𜵰',
	'𜺠','𜵱','𜵲','𜵳','𜵴','𜵵','𜵶','𜵷','𜵸','𜵹','𜵺','𜵻','𜵼','𜵽','𜵾','𜵿',
	'𜶀','𜶁','𜶂','𜶃','𜶄','𜶅','𜶆','𜶇','𜶈','𜶉','𜶊','𜶋','𜶌','𜶍','𜶎','𜶏',
	'▗','𜶐','𜶑','𜶒','𜶓','▚','𜶔','𜶕','𜶖','𜶗','▐','𜶘','𜶙','𜶚','𜶛','▜',
	'𜶜','𜶝','𜶞','𜶟','𜶠','𜶡','𜶢','𜶣','𜶤','𜶥','𜶦','𜶧','𜶨','𜶩','𜶪','𜶫',
	'▂','𜶬','𜶭','𜶮','𜶯','𜶰','𜶱','𜶲','𜶳','𜶴','𜶵','𜶶','𜶷','𜶸','𜶹','𜶺',
	'𜶻','𜶼','𜶽','𜶾','𜶿','𜷀','𜷁','𜷂','𜷃','𜷄','𜷅','𜷆','𜷇','𜷈','𜷉','𜷊',
	'𜷋','𜷌','𜷍','𜷎','𜷏','𜷐','𜷑','𜷒','𜷓','𜷔','𜷕','𜷖','𜷗','𜷘','𜷙','𜷚',
	'▄','𜷛','𜷜','𜷝','𜷞','▙','𜷟','𜷠','𜷡','𜷢','▟','𜷣','▆','𜷤','𜷥','█'
];

function create(cols, rows) {
	const graph = [];
	for (let j = 0; j < rows; j++) {
		graph[j] = [];
		for (let i = 0; i < cols; i++) {
			graph[j][i] = ' ';
		}
	}
	return graph;
}

function plot(graph, cols, rows, x, y, o=octants) {
	if (x >= 0 && x < cols * 2 && y >= 0 && y < rows * 4) {
		const c = graph[y >> 2][x >> 1];
		let i = o.indexOf(c); if (i < 0) i = 0;
		i |= 1 << (((y & 3) << 1) | (x & 1));
		graph[y >> 2][x >> 1] = o[i];
	}
}

function runs(a) {
	const runs = [];
	let i = 0;
	while (i < a.length) {
		if (a[i] == null) {
			i++;
		} else {
			let j = i + 1;
			while (j < a.length && a[j] != null && (
				(a[i] <= a[i+1] && a[j-1] <= a[j]) ||
				(a[i] >= a[i+1] && a[j-1] >= a[j]))) j++;
			if ((j - i) < 3) {
				runs.push(a.slice(i, i+1));
				i++;
			} else {
				runs.push(a.slice(i, j));
				i = j - 1;
			}
		}
	}
	return runs;
}

function graph(fn, cols=80, rows=20, l=-10, r=10, t=5, b=-5, res=8) {
	const graph = create(cols, rows);
	const row0 = Math.round((-t * rows * 4) / (b - t));
	const col0 = Math.round((-l * cols * 2) / (r - l));
	const dim = octants.map(o => '\u001B[36m' + o + '\u001B[0m');
	for (let x = 0; x < cols * 2; x++) plot(graph, cols, rows, x, row0, dim);
	for (let y = 0; y < rows * 4; y++) plot(graph, cols, rows, col0, y, dim);

	const ya = [];
	for (let px = 0; px < cols * 2; px++) {
		for (let dx = 0; dx <= res; dx++) {
			const x = (l + (r - l) * (px + dx / res) / (cols * 2));
			try { ya[dx] = fn(x); } catch (e) { ya[dx] = null; }
		}
		for (const run of runs(ya)) {
			const py0 = Math.round((run[0] - t) * (rows * 4) / (b - t));
			const py1 = Math.round((run[run.length-1] - t) * (rows * 4) / (b - t));
			const py2 = Math.max(-1, Math.min(py0, py1));
			const py3 = Math.min(rows * 4, Math.max(py0, py1));
			for (let py = py2; py <= py3; py++) plot(graph, cols, rows, px, py);
		}
	}
	return graph.map(row => row.join('')).join('\n');
}

module.exports = { graph };
