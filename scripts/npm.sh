#!/bin/sh
set -ex
rm dist --recursive --force
./rollup.config.js
scripts/emit-dts.sh
scripts/emit-package-json.js
cp README.md LICENSE dist
