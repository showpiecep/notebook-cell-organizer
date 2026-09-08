import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const releaseTag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;

if (!releaseTag) {
    console.error('Release tag is missing. Set RELEASE_TAG or GITHUB_REF_NAME.');
    process.exit(1);
}

const expectedTag = `v${packageJson.version}`;
if (releaseTag !== expectedTag) {
    console.error(`Release tag ${releaseTag} does not match package version ${expectedTag}.`);
    process.exit(1);
}

console.log(`Release version verified: ${releaseTag}`);
