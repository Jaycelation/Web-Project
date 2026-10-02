# Verification - 2026-10-02

Executed using Node v22.16.0 and npm 10.9.2 in a Linux container.

- Domain + contracts: real TypeScript builds passed.
- unit-tests.txt: 50/50 pure unit tests passed.
- isolated-service-tests.txt: 30/30 service branch tests passed using explicit Nest/Prisma doubles. Not a database or HTTP integration test.
- Syntax transpilation: 154 TS/TSX source files, 0 diagnostics. NOT full type checking.
- Workspace consistency: all six manifests match local dependency/version entries in package-lock.json.
- Launcher: npm run local -- --version returned 10.9.2.
- blocked-npm-install.txt: installation failed. npm debug log additionally reported EAI_AGAIN for registry.npmjs.org.
- blocked-full-build.txt: full build attempted and blocked at missing jose. API/Web builds were not reached.
- No live DB, browser, Docker, npm audit, or complete original crypto/security suite was run.

The container used globally installed TypeScript via NODE_PATH for isolated service/syntax checks because npm installation was blocked. After npm ci, the scripts use the declared root typescript devDependency normally.
