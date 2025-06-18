#!/usr/bin/env node
import { mkdirSync as makeDirectorySync, writeFileSync } from "fs"
import packageJson from "../package.json" with { type: "json" }

const { name, version, license, exports } = packageJson

makeDirectorySync("dist", { recursive: true })

writeFileSync(
	"dist/jsr.json",
	JSON.stringify({ name, version, license, exports }, undefined, "\t")
)

process.exit()
