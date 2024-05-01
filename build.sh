#!/usr/bin/env bash
echo 'Compiling...'
if node build.js; then
echo 'Minifying...'
echo '/* Anything worth doing is worth overdoing. -- Mick Jagger */' > mcdbmain.min.js
uglifyjs < mcdbmain.js >> mcdbmain.min.js
ls -la mcdbmain.*
else
echo 'Exiting due to errors'
fi
