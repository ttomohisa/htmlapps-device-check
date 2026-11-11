'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.config.json'), 'utf8'));

test('release runs on merged main only, with least-scoped write permission', () => {
  assert.match(workflow, /^on:\s*\n  push:\s*\n    branches:\s*\n      - main/m);
  assert.doesNotMatch(workflow, /pull_request:|workflow_dispatch:/);
  assert.match(workflow, /permissions:\s*\n  contents: write/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('tag uses app version and never overwrites existing releases or tags', () => {
  assert.match(config.version, /^\d+\.\d+\.\d+$/);
  assert.match(workflow, /Get-Content -Raw -Encoding UTF8 app\.config\.json/);
  assert.match(workflow, /\$tag = "v\$version"/);
  assert.match(workflow, /gh release view \$tag/);
  assert.match(workflow, /git\/ref\/tags\/\$tag/);
  assert.match(workflow, /"needed=false"/);
  assert.match(workflow, /throw "\$tag exists without a GitHub Release/);
  assert.match(workflow, /--target \$env:GITHUB_SHA/);
  assert.doesNotMatch(workflow, /git push --force|git tag -f|--force/);
});

test('standalone is verified before publishing and includes both downloadable HTML variants', () => {
  const build = workflow.indexOf('run: ./scripts/check-repository.ps1');
  const publish = workflow.indexOf('gh release create');
  assert.ok(build >= 0 && publish > build, 'check-repository must run before creating a Release');
  assert.match(workflow, /dist\/index\.html/);
  assert.match(workflow, /dist\/index\.self-extract\.html/);
  assert.match(workflow, /release-assets\/device-check\.html/);
  assert.match(workflow, /release-assets\/device-check\.self-extract\.html/);
  assert.match(workflow, /--generate-notes/);
  assert.ok((workflow.match(/if: \$\{\{ steps\.version\.outputs\.needed == 'true' \}\}/g) || []).length >= 4);
});

test('expected missing tags do not leave a failing native exit status', () => {
  const step = workflow.match(/      - name: Check version and existing tag\n([\s\S]*?)(?=      - name: Set up Node\.js)/);
  assert.ok(step, 'the version-check step must exist');
  const commands = step[1];
  assert.match(commands, /gh release view \$tag/);
  assert.match(commands, /gh api "repos\/\$env:GITHUB_REPOSITORY\/git\/ref\/tags\/\$tag"/);
  assert.match(commands, /"needed=true" \| Out-File/);
  assert.match(commands, /Write-Host "\$tag already has a GitHub Release/);
  assert.match(commands, /throw "\$tag exists without a GitHub Release/);
  assert.match(commands, /Write-Host "Will publish \$tag after validating the merged main commit\."[\s\S]*?\n\s+exit 0\s*$/,
    'a missing tag is an expected 404, not an Actions step failure: clear the final native exit code');
});
