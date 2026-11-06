// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): blocks edits to files in this
// repo while the current branch is main. Files outside the repo are not affected.
// Edits made by shell commands (sed, redirects) don't go through these tools.
"use strict";

const path = require("node:path");
const { readHookInput, projectDir, isInside, currentBranch, block } = require("./lib");

const input = readHookInput();
const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
const dir = projectDir(input);

if (file && isInside(dir, path.resolve(dir, file)) && currentBranch(dir) === "main") {
  block(
    "Blocked: the current git branch is main, so file edits aren't allowed here.\n" +
      "Create a feature branch first: git switch -c <feature-branch>\n" +
      "Any uncommitted changes come with you to the new branch.",
  );
}
