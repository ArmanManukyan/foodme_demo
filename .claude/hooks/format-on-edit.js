// PostToolUse (Write|Edit|MultiEdit): formats the edited file with Prettier, when
// Prettier is installed in a node_modules folder between the file and the repo root.
//
// It does nothing otherwise. It never downloads Prettier through npx, and Prettier
// is not currently a dependency of this repo.
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { readHookInput, projectDir, isInside } = require("./lib");

const SUPPORTED = /\.(c|m)?(js|ts)x?$|\.(json|css|scss|html|md|ya?ml)$/i;
const ENTRY_POINTS = ["bin/prettier.cjs", "bin-prettier.js"];

function findPrettier(startDir, rootDir) {
  let dir = startDir;
  while (true) {
    for (const entry of ENTRY_POINTS) {
      const candidate = path.join(dir, "node_modules", "prettier", entry);
      if (fs.existsSync(candidate)) return candidate;
    }
    if (path.relative(dir, rootDir) === "") return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const input = readHookInput();
const file = input.tool_input?.file_path;
const root = projectDir(input);

if (file && SUPPORTED.test(file) && isInside(root, file) && !/[\\/]node_modules[\\/]/.test(file)) {
  const prettier = findPrettier(path.dirname(file), root);
  if (prettier) {
    const result = spawnSync(process.execPath, [prettier, "--write", "--ignore-unknown", file], {
      encoding: "utf8",
      timeout: 20000,
    });
    if (result.status !== 0) {
      // Non-blocking: the edit stays, and the failure is reported.
      process.stderr.write(`Prettier could not format ${path.basename(file)}: ${result.stderr ?? result.error}\n`);
      process.exit(1);
    }
  }
}
