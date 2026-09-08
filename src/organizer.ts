const SHELL_RE = /^\s*(!|%pip\s|%conda\s)/;
const TOP_LEVEL_IMPORT_RE = /^(import\s|from\s+\S+\s+import\s)/;

export interface ExtractedCellContent {
    shellCommands: string[];
    imports: string[];
    remainingText: string;
}

function parenthesisBalance(line: string): number {
    const opens = (line.match(/\(/g) || []).length;
    const closes = (line.match(/\)/g) || []).length;
    return opens - closes;
}

/**
 * Extract shell commands and top-level Python imports from a code cell.
 * Indented imports are deliberately preserved because moving conditional,
 * function-local, or TYPE_CHECKING imports can change program behaviour.
 */
export function extractCellContent(originalText: string): ExtractedCellContent {
    const shellCommands: string[] = [];
    const imports: string[] = [];
    const remaining: string[] = [];
    const lines = originalText.split('\n');

    let index = 0;
    while (index < lines.length) {
        const line = lines[index];

        if (SHELL_RE.test(line)) {
            shellCommands.push(line);
            index++;
            continue;
        }

        if (!TOP_LEVEL_IMPORT_RE.test(line)) {
            remaining.push(line);
            index++;
            continue;
        }

        const block = [line];
        let balance = parenthesisBalance(line);
        index++;

        while (index < lines.length && balance > 0) {
            const continuationLine = lines[index];
            block.push(continuationLine);
            balance += parenthesisBalance(continuationLine);
            index++;
        }

        imports.push(block.join('\n'));
    }

    return {
        shellCommands,
        imports,
        remainingText: remaining.join('\n').trim(),
    };
}
