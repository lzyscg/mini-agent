---
name: Project Initialization
description: Best practices for creating new projects from scratch
triggers: init, create, scaffold, new project, bootstrap, setup, starter
---

# Project Initialization Guidelines

When the user asks to create a new project, follow these steps:

## Before Starting
1. Ask about or infer: language/framework, project name, key requirements
2. Check if the target directory already exists

## Standard Structure
Always create these files:
- **README.md** — Project name, description, setup instructions
- **Dependency file** — `package.json`, `requirements.txt`, `go.mod`, etc.
- **.gitignore** — Appropriate for the language/framework
- **Source directory** — `src/`, `app/`, or language convention

## By Language

### Node.js / TypeScript
```bash
mkdir <project> && cd <project>
npm init -y
# Add TypeScript if requested
npm install -D typescript @types/node tsx
npx tsc --init
```

### Python
```bash
mkdir <project> && cd <project>
python -m venv venv
pip freeze > requirements.txt
```

## After Scaffolding
1. Verify the project runs (`npm start`, `python main.py`, etc.)
2. Create an initial git commit if git is desired
3. Show the user the final project structure
