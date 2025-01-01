all: mcdbmain.min.js mcdbmisc.min.js
	ls -la mcdb*

clean:
	rm -f mcdb*

install: install.sh
	sudo ./install.sh

mcdbmain.js: general-data includes lib solvers tests typeicons units build.js
	node build.js

mcdbmisc.js: general-data includes lib solvers tests typeicons units build.js
	node build.js

mcdbmain.min.js: mcdbmain.js
	echo '/* Anything worth doing is worth overdoing. -- Mick Jagger */' > mcdbmain.min.js
	uglifyjs < mcdbmain.js >> mcdbmain.min.js

mcdbmisc.min.js: mcdbmisc.js
	echo '/* Anything worth doing is worth overdoing. -- Mick Jagger */' > mcdbmisc.min.js
	uglifyjs < mcdbmisc.js >> mcdbmisc.min.js

.PHONY: all clean install
