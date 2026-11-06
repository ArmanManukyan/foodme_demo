// Shared helpers for the hook scripts in this folder. Node built-ins only.
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function readHookInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

function isInside(dir, file) {
  const relative = path.relative(dir, file);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

// Current branch name, or "" for a detached HEAD or when git is unavailable.
function currentBranch(dir) {
  try {
    return execFileSync("git", ["-C", dir, "symbolic-ref", "--short", "-q", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return "";
  }
}

// Exit code 2 is how a PreToolUse hook blocks a tool call. Claude sees stderr.
function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

module.exports = { readHookInput, projectDir, isInside, currentBranch, block };
