---
name: Code Review
description: Systematic approach to reviewing and improving code quality
triggers: review, refactor, improve, optimize, clean, lint, code quality
---

# Code Review Guidelines

When the user asks to review or improve code, follow this systematic approach:

## Review Checklist
1. **Read first** — Always read the entire file before suggesting changes
2. **Understand context** — Check imports, related files, and tests
3. **Prioritize issues** — Critical bugs > Logic errors > Style > Nitpicks

## What to Look For
- **Bugs**: Null/undefined access, off-by-one errors, race conditions, unhandled errors
- **Security**: SQL injection, XSS, hardcoded secrets, unsafe deserialization
- **Performance**: Unnecessary loops, missing caching, N+1 queries, memory leaks
- **Readability**: Unclear naming, overly complex logic, missing types, dead code
- **Architecture**: Single responsibility violations, tight coupling, circular dependencies

## How to Present Findings
- Group findings by severity (critical / warning / suggestion)
- Show the problematic code and the improved version side by side
- Explain WHY something is an issue, not just WHAT to change
- If changes are extensive, make them incrementally and verify after each step

## After Changes
- Read the modified file to verify changes are correct
- Run tests if they exist (`npm test`, `pytest`, etc.)
- Run linters if configured (`npm run lint`, `eslint`, etc.)
