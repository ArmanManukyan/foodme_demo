// PreToolUse (Write|Edit|MultiEdit): blocks edits that ADD a bad pattern to a test file.
//
// Only additions are blocked. Patterns already in the file, such as the planted
// waitForTimeout marked FM-FLAKE-01, don't stop unrelated edits to that file.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readHookInput, block } = require("./lib");

const TEST_FILE = [
  /\.(spec|test)\.[cm]?[jt]sx?$/i,
  /[\\/]e2e[\\/].*\.[cm]?[jt]sx?$/i,
  /[\\/]src[\\/]test[\\/].*\.java$/i,
];

// Blanks comments, and optionally string contents, while keeping offsets and
// line numbers unchanged.
function mask(source, { strings }) {
  const out = source.split("");
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      let end = source.indexOf("\n", i);
      if (end === -1) end = source.length;
      blank(i, end);
      i = end;
    } else if (c === "/" && next === "*") {
      let end = source.indexOf("*/", i + 2);
      end = end === -1 ? source.length : end + 2;
      blank(i, end);
      i = end;
    } else if (c === '"' || c === "'" || c === "`") {
      let end = i + 1;
      while (end < source.length && source[end] !== c) {
        if (source[end] === "\\") end++;
        if (c !== "`" && source[end] === "\n") break;
        end++;
      }
      if (strings) blank(i + 1, end);
      i = end + 1;
    } else {
      i++;
    }
  }
  return out.join("");
}

function matching(code, open, openChar, closeChar) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === openChar) depth++;
    else if (code[i] === closeChar && --depth === 0) return i;
  }
  return -1;
}

function lineOf(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

// Top-level comma positions inside the parentheses that open at `open`.
function argumentRanges(code, open, close) {
  const ranges = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < close; i++) {
    if ("([{".includes(code[i])) depth++;
    else if (")]}".includes(code[i])) depth--;
    else if (code[i] === "," && depth === 0) {
      ranges.push([start, i]);
      start = i + 1;
    }
  }
  if (code.slice(start, close).trim()) ranges.push([start, close]);
  return ranges;
}

function hasCommentAbove(source, offset) {
  const lines = source.slice(0, offset).split("\n");
  const previous = lines[lines.length - 2] ?? "";
  return /^\s*(\/\/|\*|\/\*)\s*\S/.test(previous);
}

function analyzeJs(source) {
  const found = [];
  const code = mask(source, { strings: true });
  const noComments = mask(source, { strings: false });
  const add = (rule, offset, text) => found.push({ rule, line: lineOf(source, offset), text });
  const scan = (rule, regex, text) => {
    for (const m of code.matchAll(regex)) add(rule, m.index, text);
  };

  scan("only", /(?<![\w.])(?:test|it|describe)(?:\.\w+)*?\.only\b/g, ".only leaves the rest of the suite unrun");
  scan("only", /(?<![\w.])(?:fit|fdescribe)\s*\(/g, "focused test leaves the rest of the suite unrun");
  scan("wait", /\bwaitForTimeout\s*\(/g, "fixed wait: use an auto-waiting assertion or expect.poll");
  scan("sleep", /\bsleep\s*\(/g, "sleep: use an auto-waiting assertion or expect.poll");
  scan("sleep", /new\s+Promise[\s\S]{0,60}?setTimeout/g, "setTimeout sleep: use an auto-waiting assertion or expect.poll");

  for (const m of code.matchAll(/(?<![\w.])(?:test|it|describe)(?:\.describe)?\.skip\b(\s*\()?/g)) {
    let hasReason = hasCommentAbove(source, m.index);
    if (!hasReason && m[1]) {
      const open = m.index + m[0].length - 1;
      const close = matching(code, open, "(", ")");
      const args = close === -1 ? [] : argumentRanges(code, open, close);
      if (args[1]) hasReason = /^\s*['"`]\s*\S/.test(noComments.slice(args[1][0], args[1][1]));
    }
    if (!hasReason) {
      add("skip", m.index, 'skip with no reason: use test.skip(condition, "reason") or put a comment on the line above');
    }
  }

  for (const m of code.matchAll(/(?<![\w.])(?:test|it)(?:\.(?:only|fail|slow|fixme))?\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matching(code, open, "(", ")");
    if (close === -1) continue;
    const args = argumentRanges(code, open, close);
    const isDeclaration = args.length >= 2 && /=>|\bfunction\b/.test(code.slice(args[args.length - 1][0], close));
    if (isDeclaration && !/\bexpect\b/.test(code.slice(open, close))) {
      add("no-expect", m.index, "test has no expect()");
    }
  }
  return found;
}

function analyzeJava(source) {
  const found = [];
  const code = mask(source, { strings: true });
  const noComments = mask(source, { strings: false });
  const add = (rule, offset, text) => found.push({ rule, line: lineOf(source, offset), text });

  for (const m of code.matchAll(/\bsleep\s*\(/g)) add("sleep", m.index, "sleep: wait for state instead");
  for (const m of noComments.matchAll(/@(?:Disabled|Ignore)\b(\s*\(\s*"\s*[^"\s])?/g)) {
    if (!m[1]) add("skip", m.index, '@Disabled with no reason: use @Disabled("reason")');
  }
  for (const m of code.matchAll(/@(?:Test|ParameterizedTest)\b/g)) {
    const open = code.indexOf("{", m.index);
    if (open === -1) continue;
    const close = matching(code, open, "{", "}");
    const body = code.slice(open, close === -1 ? code.length : close);
    if (!/\b(?:assert\w*|andExpect|verify\w*|fail|expect\w*)\s*\(/.test(body)) {
      add("no-expect", m.index, "test has no assertion");
    }
  }
  return found;
}

function analyze(source, file) {
  return /\.java$/i.test(file) ? analyzeJava(source) : analyzeJs(source);
}

function countByRule(violations) {
  const counts = {};
  for (const v of violations) counts[v.rule] = (counts[v.rule] ?? 0) + 1;
  return counts;
}

function replaceOnce(text, from, to, all) {
  if (!from) return `${text}\n${to}`;
  // If the text can't be located (line endings, say), still check the new text.
  if (!text.includes(from)) return `${text}\n${to}`;
  return all ? text.split(from).join(to) : text.replace(from, () => to);
}

function contentAfterEdit(toolName, toolInput, before) {
  if (toolName === "Write") return toolInput.content ?? "";
  if (toolName === "MultiEdit") {
    return (toolInput.edits ?? []).reduce(
      (text, e) => replaceOnce(text, e.old_string, e.new_string ?? "", e.replace_all),
      before,
    );
  }
  return replaceOnce(before, toolInput.old_string, toolInput.new_string ?? "", toolInput.replace_all);
}

function main() {
  const input = readHookInput();
  const file = input.tool_input?.file_path;
  if (!file || !TEST_FILE.some((pattern) => pattern.test(file))) process.exit(0);

  let before = "";
  try {
    before = fs.readFileSync(file, "utf8");
  } catch {
    // New file: nothing to compare against.
  }

  const after = analyze(contentAfterEdit(input.tool_name, input.tool_input, before), file);
  const baseline = countByRule(analyze(before, file));
  const added = countByRule(after);
  const problems = after.filter((v) => added[v.rule] > (baseline[v.rule] ?? 0));
  if (problems.length === 0) process.exit(0);

  const lines = problems.map((v) => `  line ${v.line}: ${v.text}`).join("\n");
  block(
    `Blocked: this edit adds a bad test pattern to ${path.basename(file)}.\n${lines}\n` +
      "See .claude/rules/testing.md.",
  );
}

if (require.main === module) main();

module.exports = { analyze };
