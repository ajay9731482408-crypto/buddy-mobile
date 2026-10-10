# Developer tools for building Buddy: ECC (optional, on your computer)

ECC ("Everything Claude Code", github.com/affaan-m/ECC) is a set of rules, skills, agents and hooks that help an AI coding assistant (such as Claude Code, Cursor or Codex) work on a project. It is MIT-licensed. It is a developer tool. It is not part of the Buddy app, so it does not change anything the phone runs.

## Install only from official sources
- Repository: https://github.com/affaan-m/ECC
- npm package: `ecc-universal`
- Claude plugin: `ecc@ecc`
Do not use names such as `everything-claude-code` or `opencode-ecc`. The project's own notice warns against unofficial aliases.

## Steps (on your computer, not on the phone)
1. Open a terminal inside the `buddy-mobile` folder.
2. Check what the installer will do before running it: `npx ecc-universal --help`. Read the list of hooks and commands it adds.
3. Install a small profile first: `npx ecc-install --profile minimal`.
4. Or use the Claude Code plugin: `/plugin marketplace add https://github.com/affaan-m/ECC` then `/plugin install ecc@ecc`.

## Safety notes
- ECC includes hooks, which are scripts that run automatically during development. Read them before enabling them.
- Do not commit ECC's generated files together with your secrets. Keep `.env`, sync secrets and API keys out of the repository (the `.gitignore` already lists `.env`).
- Nothing from ECC is needed to run Buddy. The app and its tests run with `npm test` alone.
