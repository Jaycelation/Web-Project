/** Run npm from the monorepo root with root .env and absolute crypto key paths. */
import {existsSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {loadEnvFile} from 'node:process';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=resolve(root,'.env');
if(existsSync(file))loadEnvFile(file);
else console.warn('Root .env not found; using the existing process environment.');
for(const key of ['CRYPTO_PRIVATE_KEY_PATH','CRYPTO_PUBLIC_KEY_PATH','CRYPTO_SIGNING_PRIVATE_KEY_PATH','CRYPTO_SIGNING_PUBLIC_KEY_PATH']) {
  const value=process.env[key];
  if(value&&!isAbsolute(value))process.env[key]=resolve(root,value);
}
const npm=process.env.npm_execpath;
const args=process.argv.slice(2);
if(!npm||!existsSync(npm)||args.length===0) {
  console.error('Usage: npm run local -- run <script> (or npm run local -- --version)');
  process.exit(1);
}
const child=spawn(process.execPath,[npm,...args],{cwd:root,stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',(error)=>{console.error(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
