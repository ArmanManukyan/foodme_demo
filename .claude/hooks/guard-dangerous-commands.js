// PreToolUse (Bash|PowerShell): blocks pushes to main/master, force pushes,
// git reset --hard and recursive force deletes.
//
// Commands are tokenized, so text that merely mentions these commands, such as a
// commit message or an echo, is allowed. This is a guardrail against mistakes, not
// a security boundary: a script file or an unusual alias can still get past it.
"use strict";

const path = require("node:path");
const { readHookInput, projectDir, currentBranch, block } = require("./lib");

const PROTECTED = new Set(["main", "master"]);
const WRAPPERS = new Set(["sudo", "command", "env", "time", "nohup", "exec", "xargs", "call"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "pwsh", "powershell", "cmd"]);
const GIT_VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);
const PUSH_VALUE_OPTIONS = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);

// Removes text that is data rather than commands: heredoc bodies and PowerShell
// here-strings, which often hold commit messages.
function stripHeredocs(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, "")
    .replace(/@'\r?\n[\s\S]*?\r?\n'@/g, "''")
    .replace(/@"\r?\n[\s\S]*?\r?\n"@/g, '""');
}

// Splits on shell separators outside quotes. Each segment is a list of tokens.
function parseSegments(command) {
  const segments = [];
  let tokens = [];
  let token = null;
  let quote = null;
  const endToken = () => {
    if (token !== null) tokens.push(token);
    token = null;
  };
  const endSegment = () => {
    endToken();
    if (tokens.length) segments.push(tokens);
    tokens = [];
  };

  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && '"\\'.includes(command[i + 1] ?? "")) token += command[++i];
      else token += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      token ??= "";
    } else if (c === "\\" && (command[i + 1] === "\n" || command.startsWith("\r\n", i + 1))) {
      endToken();
      i += command[i + 1] === "\r" ? 2 : 1;
    } else if (/\s/.test(c) && c !== "\n") {
      endToken();
    } else if (";|&\n()`".includes(c)) {
      endSegment();
    } else {
      token = (token ?? "") + c;
    }
  }
  endSegment();
  return segments;
}

function commandName(token) {
  const base = token.split(/[\\/]/).pop().toLowerCase();
  return base.endsWith(".exe") ? base.slice(0, -4) : base;
}

function checkGitPush(args, dir) {
  const positionals = [];
  let force = false;
  let pushesEverything = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force" || a.startsWith("--force-with-lease") || a === "--force-if-includes") force = true;
    else if (a === "--mirror") force = pushesEverything = true;
    else if (a === "--all" || a === "--branches") pushesEverything = true;
    else if (PUSH_VALUE_OPTIONS.has(a)) i++;
    else if (/^-[a-zA-Z]+$/.test(a)) {
      if (a.includes("f")) force = true;
    } else if (!a.startsWith("-")) positionals.push(a);
  }
  const refspecs = positionals.slice(1);
  if (force || refspecs.some((r) => r.startsWith("+"))) {
    return "force push. It can overwrite other people's commits";
  }
  if (pushesEverything) return "this pushes every branch, including main";

  const branch = currentBranch(dir);
  const destinations = refspecs.length
    ? refspecs.map((r) => {
        const dest = r.includes(":") ? r.slice(r.indexOf(":") + 1) : r;
        return dest === "HEAD" ? branch : dest.replace(/^refs\/heads\//, "");
      })
    : [branch]; // A bare "git push" pushes the current branch.
  const hit = destinations.find((d) => PROTECTED.has(d.toLowerCase()));
  return hit ? `this pushes directly to ${hit}. Push a feature branch and open a PR` : null;
}

function checkGit(args, defaultDir) {
  let dir = defaultDir;
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    if (args[i] === "-C") dir = path.resolve(defaultDir, args[i + 1] ?? "");
    i += GIT_VALUE_OPTIONS.has(args[i]) ? 2 : 1;
  }
  const rest = args.slice(i + 1);
  if (args[i] === "push") return checkGitPush(rest, dir);
  if (args[i] === "reset" && rest.includes("--hard")) {
    return "git reset --hard discards uncommitted work. Try git stash, or ask the user to run it";
  }
  return null;
}

function checkDelete(name, args) {
  let recursive = false;
  let force = false;
  for (const a of args) {
    const lower = a.toLowerCase();
    if (/^-r(e(c(u(r(s(e)?)?)?)?)?)?(:\$true)?$/.test(lower) && a !== "-r") recursive = true;
    else if (/^-fo(r(c(e)?)?)?(:\$true)?$/.test(lower)) force = true;
    else if (lower === "--recursive" || lower === "/s") recursive = true;
    else if (lower === "--force" || lower === "/q" || lower === "/f") force = true;
    else if (/^-[a-z]+$/i.test(a)) {
      if (/r/i.test(a)) recursive = true;
      if (/f/i.test(a)) force = true;
    }
  }
  return recursive && force ? `${name} with recursive and force flags deletes files permanently` : null;
}

function checkSegment(tokens, dir) {
  let t = tokens;
  while (t.length && (/^\w+=/.test(t[0]) || WRAPPERS.has(commandName(t[0])) || /^-/.test(t[0]) && t !== tokens)) {
    t = t.slice(1);
  }
  if (!t.length) return null;
  const name = commandName(t[0]);
  const args = t.slice(1);

  if (name === "git") return checkGit(args, dir);
  if (["rm", "remove-item", "ri", "rd", "rmdir", "del", "erase"].includes(name)) return checkDelete(name, args);
  if (name === "eval" || name === "invoke-expression" || name === "iex") return checkCommand(args.join(" "), dir);
  if (SHELLS.has(name)) {
    const flag = args.findIndex((a) => /^(-\w*c|-command|\/c)$/i.test(a));
    return flag === -1 ? null : checkCommand(args.slice(flag + 1).join(" "), dir);
  }
  if (name === "find") {
    const exec = args.findIndex((a) => a === "-exec" || a === "-execdir");
    return exec === -1 ? null : checkSegment(args.slice(exec + 1), dir);
  }
  return null;
}

function checkCommand(command, dir) {
  const stripped = stripHeredocs(command);
  for (const tokens of parseSegments(stripped)) {
    const reason = checkSegment(tokens, dir);
    if (reason) return reason;
  }
  // Command substitution inside double quotes: echo "$(rm -rf x)".
  for (const m of stripped.matchAll(/\$\(([^()]*)\)/g)) {
    const reason = checkCommand(m[1], dir);
    if (reason) return reason;
  }
  return null;
}

function main() {
  const input = readHookInput();
  const command = input.tool_input?.command;
  if (!command) process.exit(0);
  const reason = checkCommand(command, input.cwd || projectDir(input));
  if (reason) {
    block(`Blocked dangerous command: ${reason}.\nIf this is really intended, the user can run it themselves with "! <command>".`);
  }
}

if (require.main === module) main();

module.exports = { checkCommand };
