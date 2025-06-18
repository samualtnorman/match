#!/usr/bin/env bash
set -ex
rm dist --recursive --force
mkdir dist --parents
cp src/*.ts dist
scripts/prepend-readme.js README.md dist/default.ts
scripts/emit-jsr-json.js
