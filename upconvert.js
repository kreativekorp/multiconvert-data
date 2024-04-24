#!/usr/bin/env node

const cp = require('copy-paste');

function upconvert(s) {
	s = s.replaceAll(/m\.u\['([a-z][0-9]+)'\]=/g, '"$1":');
	s = s.replaceAll(/'s':'([^']+)'/g, '"symbol":"$1"');
	s = s.replaceAll(/'n':'([^']+)','p':'([^']+)'/g, '"name":{"en":{"1":"$1","*":"$2"}}');
	s = s.replaceAll(/'n':'([^']+)'/g, '"name":{"en":{"*":"$1"}}');
	s = s.replaceAll(/'m':([0-9]+[.][0-9]+([Ee][+-]?[0-9]+)?)/g, '"multiplier":"$1"');
	s = s.replaceAll(/'w':([0-9]+[.][0-9]+([Ee][+-]?[0-9]+)?)/g, '"divisor":"$1"');
	s = s.replaceAll(/'m'/g, '"multiplier"');
	s = s.replaceAll(/'w'/g, '"divisor"');
	s = s.replaceAll(/'d'/g, '"dimension"');
	s = s.replaceAll(/'L'/g, '"length"');
	s = s.replaceAll(/'M'/g, '"mass"');
	s = s.replaceAll(/'T'/g, '"time"');
	s = s.replaceAll(/'I'/g, '"current"');
	s = s.replaceAll(/'Q'/g, '"temperature"');
	s = s.replaceAll(/'N'/g, '"substance"');
	s = s.replaceAll(/'J'/g, '"intensity"');
	s = s.replaceAll(/'A'/g, '"angle"');
	s = s.replaceAll(/'C'/g, '"currency"');
	s = s.replaceAll(/'D'/g, '"data"');
	s = s.replaceAll(/;/g, ',');
	s = '{\n' + s + '\n}';
	s = s.replaceAll(/,(\s*\})/g, '$1');
	return s;
}

cp.paste(function(e,s) {
	cp.copy(upconvert(s), function() {
		process.exit(0);
	})
});
