import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playgroundRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const exampleRoot = join(playgroundRoot, 'apps', 'mobile');
const webRoot = join(playgroundRoot, 'apps', 'web');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const resolvesFromRegistry = (ts, specifier, containingFile, config) => {
  const result = ts.resolveModuleName(specifier, containingFile, config.options, ts.sys);
  const file = result.resolvedModule?.resolvedFileName?.replaceAll('\\', '/');

  assert.ok(file, `${specifier} did not resolve`);
  assert.match(file, /\/node_modules\/@talkentry\//);
  assert.equal(file.includes('/chat_private/'), false);

  return file;
};

describe('published SDK dependencies', () => {
  it('installs the npm releases instead of a local checkout', () => {
    const root = readJson(join(playgroundRoot, 'package.json'));
    const mobile = readJson(join(exampleRoot, 'package.json'));
    const web = readJson(join(webRoot, 'package.json'));

    assert.equal(root.overrides, undefined);
    assert.equal(mobile.dependencies['@talkentry/react-native'], '0.0.1');
    assert.equal(web.dependencies['@talkentry/web'], '0.0.1');
    assert.equal(JSON.stringify(root).includes('file:'), false);
    assert.equal(JSON.stringify(mobile).includes('file:'), false);
    assert.equal(JSON.stringify(web).includes('file:'), false);
    assert.equal(JSON.stringify(root).includes('chat_private'), false);
  });

  it('resolves public entries from node_modules', () => {
    const typescriptRoot = join(playgroundRoot, 'node_modules', 'typescript');

    assert.equal(existsSync(join(typescriptRoot, 'package.json')), true);

    const ts = require(typescriptRoot);
    const mobileFile = ts.readConfigFile(join(exampleRoot, 'tsconfig.json'), ts.sys.readFile);
    const mobileConfig = ts.parseJsonConfigFileContent(mobileFile.config, ts.sys, exampleRoot);

    assert.equal(mobileFile.error, undefined);
    assert.deepEqual(mobileConfig.errors, []);
    assert.equal(mobileConfig.options.paths?.['@talkentry/react-native'], undefined);
    assert.equal(mobileConfig.options.paths?.['@talkentry/core'], undefined);

    resolvesFromRegistry(
      ts,
      '@talkentry/react-native',
      join(exampleRoot, 'App.tsx'),
      mobileConfig,
    );
    resolvesFromRegistry(ts, '@talkentry/core', join(exampleRoot, 'App.tsx'), mobileConfig);

    const webFile = ts.readConfigFile(join(webRoot, 'tsconfig.json'), ts.sys.readFile);
    const webConfig = ts.parseJsonConfigFileContent(webFile.config, ts.sys, webRoot);

    assert.equal(webFile.error, undefined);
    assert.deepEqual(webConfig.errors, []);

    const resolvedWeb = resolvesFromRegistry(
      ts,
      '@talkentry/web',
      join(webRoot, 'src', 'App.tsx'),
      webConfig,
    );

    assert.match(resolvedWeb, /\/node_modules\/@talkentry\/web\//);
  });
});

describe('web example boundary', () => {
  it('does not import React Native from the DOM demo', () => {
    const files = readdirSync(join(webRoot, 'src')).filter(
      (name) => name.endsWith('.ts') || name.endsWith('.tsx'),
    );

    for (const name of files) {
      const code = readFileSync(join(webRoot, 'src', name), 'utf8');

      assert.doesNotMatch(code, /from\s*['"]react-native(?:-web)?['"]/);
      assert.doesNotMatch(code, /from\s*['"]@talkentry\/react-native/);
      assert.doesNotMatch(code, /from\s*['"]@shopify\/flash-list['"]/);
    }
  });
});
