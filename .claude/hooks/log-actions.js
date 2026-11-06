// PreToolUse (*): appends one line per tool call to .claude/logs/actions.log as
// time<TAB>tool<TAB>file or command. It runs before the tool, so calls that another
// hook then blocks are logged too. It records attempts, not results.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readHookInput, projectDir } = require("./lib");

const MAX_DETAIL = 500;

function describe(toolInput = {}) {
  const value =
    toolInput.file_path ??
    toolInput.notebook_path ??
    toolInput.command ??
    toolInput.pattern ??
    toolInput.url ??
    toolInput.query ??
    toolInput.skill ??
    toolInput.description ??
    JSON.stringify(Object.keys(toolInput));
  // One entry per line, whatever the command contains.
  return String(value).replace(/\s*[\r\n]+\s*/g, " ⏎ ").replace(/\t/g, " ").slice(0, MAX_DETAIL);
}

try {
  const input = readHookInput();
  const logDir = path.join(projectDir(input), ".claude", "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const line = `${new Date().toISOString()}\t${input.tool_name ?? "unknown"}\t${describe(input.tool_input)}\n`;
  fs.appendFileSync(path.join(logDir, "actions.log"), line);
} catch (error) {
  // Logging must never get in the way of the tool call.
  process.stderr.write(`Could not write the action log: ${error.message}\n`);
}
