/* Syntax/transpilation only. This does not replace tsc or a framework build. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let checked = 0;
let errors = 0;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.next', '.local'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { visit(file); continue; }
    if (!/\.tsx?$/.test(file) || /\.d\.ts$/.test(file)) continue;
    checked++;
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
        experimentalDecorators: true, emitDecoratorMetadata: true },
    });
    for (const diagnostic of result.diagnostics ?? []) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
      errors++; console.error(path.relative(root,file), ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  }
}
for (const dir of ['apps', 'packages']) visit(path.join(root,dir));
console.log(JSON.stringify({check:'syntax/transpilation only; NOT full typecheck',checked,errors}));
process.exitCode = errors ? 1 : 0;
