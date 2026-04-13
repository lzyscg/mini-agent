---
name: Git Workflow
description: Guidelines for git operations including commits, branches, and merges
triggers: git, commit, branch, merge, rebase, push, pull, stash, cherry-pick
---

# Git Workflow Guidelines

When the user asks about git operations, follow these practices:

## Commits
- Write clear, concise commit messages in the imperative mood ("Add feature" not "Added feature")
- Use conventional commits format when appropriate: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Keep commits atomic — one logical change per commit
- Always run `git status` and `git diff` before committing to verify changes

## Branches
- Use descriptive branch names: `feat/user-auth`, `fix/login-bug`, `refactor/api-layer`
- Always check current branch with `git branch` before making changes
- Create feature branches from the latest main/master

## Safety
- Never force push to main/master unless explicitly asked
- Never run `git reset --hard` without confirming with the user
- Always check `git status` before destructive operations
- Prefer `git stash` over discarding changes

## Workflow
1. `git status` — understand current state
2. `git add <specific-files>` — stage specific changes (avoid `git add .` unless appropriate)
3. `git diff --staged` — review what will be committed
4. `git commit -m "type: description"` — commit with clear message
