import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {projectRoot,readAppRelease,appBasePath} from './app-dependency.ts';

const release=await readAppRelease();
const installed=JSON.parse(await readFile(path.join(projectRoot,'node_modules/@kubohiroya/turbowarp-kamishibai-app/package.json'),'utf8'));
assert.equal(installed.version,release.version);
const filename=appBasePath(release.version);let base:Buffer;
try{base=await readFile(filename);}catch{
  const response=await fetch(release.artifact.url,{signal:AbortSignal.timeout(60000)});assert.ok(response.ok,'Official base download failed');base=Buffer.from(await response.arrayBuffer());
}
assert.equal(base.length,release.artifact.size);assert.equal(createHash('sha256').update(base).digest('hex'),release.artifact.sha256);
await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,base);
console.log(`Prepared published App ${release.version}; official base SHA-256 verified.`);
