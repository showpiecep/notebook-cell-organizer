import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractCellContent } from '../organizer';

describe('extractCellContent', () => {
    it('extracts shell commands and top-level imports', () => {
        const result = extractCellContent([
            '!pip install pandas',
            'import numpy as np',
            'value = 42',
        ].join('\n'));

        assert.deepEqual(result.shellCommands, ['!pip install pandas']);
        assert.deepEqual(result.imports, ['import numpy as np']);
        assert.equal(result.remainingText, 'value = 42');
    });

    it('extracts parenthesized multi-line imports as one statement', () => {
        const result = extractCellContent([
            'from sklearn import (',
            '    cross_val_score,',
            '    train_test_split,',
            ')',
            'train()',
        ].join('\n'));

        assert.deepEqual(result.imports, [[
            'from sklearn import (',
            '    cross_val_score,',
            '    train_test_split,',
            ')',
        ].join('\n')]);
        assert.equal(result.remainingText, 'train()');
    });

    it('preserves TYPE_CHECKING and other conditional imports', () => {
        const source = [
            'from typing import TYPE_CHECKING',
            '',
            'if TYPE_CHECKING:',
            '    from optional_package import Model',
            '',
            'try:',
            '    import optional_dependency',
            'except ImportError:',
            '    optional_dependency = None',
        ].join('\n');

        const result = extractCellContent(source);

        assert.deepEqual(result.imports, ['from typing import TYPE_CHECKING']);
        assert.equal(result.remainingText, [
            'if TYPE_CHECKING:',
            '    from optional_package import Model',
            '',
            'try:',
            '    import optional_dependency',
            'except ImportError:',
            '    optional_dependency = None',
        ].join('\n'));
    });

    it('preserves function-local imports', () => {
        const source = [
            'def load_data():',
            '    import pandas as pd',
            '    return pd.DataFrame()',
        ].join('\n');

        const result = extractCellContent(source);

        assert.deepEqual(result.imports, []);
        assert.equal(result.remainingText, source);
    });
});
