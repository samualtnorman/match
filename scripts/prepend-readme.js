#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";

if (!(process.argv[2] && process.argv[3]))
	process.exit(1)

const readme = readFileSync(process.argv[2], { encoding: `utf8` })
const original = readFileSync(process.argv[3], { encoding: `utf8` })

writeFileSync(
	process.argv[3],
	`/**\n * ${readme.trim().replaceAll(`*/`, `*\u200D/`).replaceAll(`\n`, `\n * `)}\n * @module\n */\n${original}`,
)
