import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { sortImportsWithRuff } from '../ruff';

describe('sortImportsWithRuff', () => {
    it('passes a temporary file to the configured command and reads the result', async () => {
        const result = await sortImportsWithRuff(
            'import pandas\nimport os',
            {
                command: 'ruff',
                arguments: ['check', '--fix', '${file}'],
            },
            async (command, args) => {
                assert.equal(command, 'ruff');
                assert.equal(args[0], 'check');
                const temporaryFile = args[2];
                assert.equal(await readFile(temporaryFile, 'utf8'), 'import pandas\nimport os\n');
                await writeFile(temporaryFile, 'import os\n\nimport pandas\n', 'utf8');
            },
        );

        assert.equal(result.applied, true);
        assert.equal(result.text, 'import os\n\nimport pandas');
    });

    it('keeps imports when the command fails', async () => {
        const result = await sortImportsWithRuff(
            'import pandas',
            { command: 'ruff', arguments: ['check', '${file}'] },
            async () => {
                throw new Error('command not found');
            },
        );

        assert.equal(result.applied, false);
        assert.equal(result.text, 'import pandas');
        assert.match(result.message ?? '', /command not found/);
    });

    it('rejects arguments without the file placeholder', async () => {
        let called = false;
        const result = await sortImportsWithRuff(
            'import pandas',
            { command: 'ruff', arguments: ['check', '--fix'] },
            async () => {
                called = true;
            },
        );

        assert.equal(called, false);
        assert.equal(result.applied, false);
        assert.match(result.message ?? '', /\$\{file\}/);
    });
});
