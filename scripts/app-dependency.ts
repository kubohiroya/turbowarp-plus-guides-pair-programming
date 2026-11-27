import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

interface AppRelease {
  formatVersion: number;
  repository: string;
  version: string;
  tag: string;
  commit: string;
  publishedAt: string;
  sourceIdentity: string;
  artifact: {filename: string; size: number; sha256: string; url: string};
}

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
/** Where the base SB3 of every App release is kept, relative to the repository. */
export const appBaseDirectory = 'app-base';

export function appBaseRelativePath(version: string): string {
  assert.match(version, /^\d+\.\d+\.\d+(?:-rc\.\d+)?$/u);
  return `${appBaseDirectory}/kamishibai-${version}.sb3`;
}

/** Read the sole app dependency snapshot without contacting the network. */
export async function readAppRelease(root = projectRoot): Promise<AppRelease> {
  const release = JSON.parse(
    await readFile(path.join(root, 'app-release.json'), 'utf8'),
  ) as AppRelease;
  assert.equal(release.formatVersion, 1);
  assert.equal(release.repository, 'kubohiroya/turbowarp-kamishibai-app');
  assert.match(release.version, /^4\.0\.\d+(?:-rc\.\d+)?$/u);
  assert.equal(release.tag, `v${release.version}`);
  assert.match(release.commit, /^[a-f0-9]{40}$/u);
  assert.match(release.sourceIdentity, /^sha256:[a-f0-9]{64}$/u);
  assert(
    Number.isSafeInteger(release.artifact.size) && release.artifact.size > 0,
  );
  assert.match(release.artifact.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(release.artifact.filename, `kamishibai-${release.version}.sb3`);
  assert.equal(
    release.artifact.url,
    `https://github.com/${release.repository}/releases/download/${release.tag}/${release.artifact.filename}`,
  );
  return release;
}

/** This projection is recorded in output locks, never in story settings. */
export function appRuntimeIdentity(release: AppRelease) {
  return {
    repository: `https://github.com/${release.repository}`,
    version: release.version,
    commit: release.commit,
    basePath: appBaseRelativePath(release.version),
    baseSourceIdentity: release.sourceIdentity,
    baseSize: release.artifact.size,
    baseSha256: release.artifact.sha256,
  };
}

export function appBasePath(version: string, root = projectRoot) {
  return path.join(root, ...appBaseRelativePath(version).split('/'));
}
