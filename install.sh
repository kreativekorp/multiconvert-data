#!/usr/bin/env bash
echo cd '"'"$PWD"'"' | sudo tee /usr/local/bin/mcvt > /dev/null
echo node mcvt.js '"$@"' | sudo tee -a /usr/local/bin/mcvt > /dev/null
sudo chmod +x /usr/local/bin/mcvt
