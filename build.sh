#!/usr/bin/env bash
echo 'Compiling...'
node build.js
echo 'Minifying...'
echo '/* Anything worth doing is worth overdoing. -- Mick Jagger */' > mcdbmain.min.js
uglifyjs < mcdbmain.js >> mcdbmain.min.js
ls -la mcdbmain.*
