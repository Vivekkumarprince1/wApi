#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2] || ".env.northflank.local";
const allowList = process.argv.slice(3);
const raw = fs.readFileSync(file, "utf8");
const env = {};

for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index === -1) continue;
  const key = trimmed.slice(0, index);
  const value = trimmed.slice(index + 1);
  if (allowList.length && !allowList.includes(key)) continue;
  env[key] = value;
}

process.stdout.write(JSON.stringify(env, null, 2));
