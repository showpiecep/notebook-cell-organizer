import * as vscode from 'vscode';

const SHELL_RE = /^\s*(!|%pip\s|%conda\s)/;
const IMPORT_RE = /^\s*(import\s|from\s+\S+\s+import\s)/;

async function organizeNotebook(notebook: vscode.NotebookDocument, silent = false): Promise<void> {
    const shellLines = new Set<string>();
    const importLines = new Set<string>();
    const cellNewTexts = new Map<number, string>();
    const emptyCellIndices: number[] = [];

    // Detect language from the first code cell
    let language = 'python';
    for (let i = 0; i < notebook.cellCount; i++) {
        const cell = notebook.cellAt(i);
        if (cell.kind === vscode.NotebookCellKind.Code) {
            language = cell.document.languageId;
            break;
        }
    }

    // Pass 1: collect shell/import lines and compute remaining text per cell
    for (let i = 0; i < notebook.cellCount; i++) {
        const cell = notebook.cellAt(i);
        if (cell.kind !== vscode.NotebookCellKind.Code) {
            continue;
        }

        const originalText = cell.document.getText();
        const remaining: string[] = [];

        const lines = originalText.split('\n');
        let j = 0;
        while (j < lines.length) {
            const line = lines[j];
            if (SHELL_RE.test(line)) {
                shellLines.add(line);
                j++;
            } else if (IMPORT_RE.test(line)) {
                const opens = (line.match(/\(/g) || []).length;
                const closes = (line.match(/\)/g) || []).length;
                if (opens > closes) {
                    // Multi-line import: collect until parens are balanced
                    const block: string[] = [line];
                    let balance = opens - closes;
                    j++;
                    while (j < lines.length && balance > 0) {
                        const l = lines[j];
                        block.push(l);
                        balance += (l.match(/\(/g) || []).length;
                        balance -= (l.match(/\)/g) || []).length;
                        j++;
                    }
                    importLines.add(block.join('\n'));
                } else {
                    importLines.add(line);
                    j++;
                }
            } else {
                remaining.push(line);
                j++;
            }
        }

        const newText = remaining.join('\n').trim();
        if (newText !== originalText.trim()) {
            cellNewTexts.set(i, newText);
        }
        if (newText === '') {
            emptyCellIndices.push(i);
        }
    }

    if (shellLines.size === 0 && importLines.size === 0) {
        if (!silent) {
            vscode.window.showInformationMessage('Nothing to organize.');
        }
        return;
    }

    // Idempotency check: if only the top N cells were touched and all become empty,
    // the notebook is already organized — nothing would actually change
    const newCellCount = (shellLines.size > 0 ? 1 : 0) + (importLines.size > 0 ? 1 : 0);
    const onlyTopModified = [...cellNewTexts.keys()].every(k => k < newCellCount);
    const allBecomeEmpty = [...cellNewTexts.values()].every(v => v === '');
    if (onlyTopModified && allBecomeEmpty) {
        if (!silent) {
            vscode.window.showInformationMessage('Nothing to organize.');
        }
        return;
    }

    // Step 1: text edits — update cell contents in place
    const textEdit = new vscode.WorkspaceEdit();
    for (const [idx, newText] of cellNewTexts) {
        const cell = notebook.cellAt(idx);
        const lastLine = cell.document.lineAt(cell.document.lineCount - 1);
        const fullRange = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
        textEdit.replace(cell.document.uri, fullRange, newText);
    }
    await vscode.workspace.applyEdit(textEdit);

    // Step 2: notebook edits — delete empty cells and insert new ones at the top
    const nbEdits: vscode.NotebookEdit[] = [];

    // Delete in reverse index order so earlier indices stay valid
    for (const idx of emptyCellIndices.sort((a, b) => b - a)) {
        nbEdits.push(
            vscode.NotebookEdit.deleteCells(new vscode.NotebookRange(idx, idx + 1))
        );
    }

    // shell commands → cell 0, imports → cell 1
    const newCells: vscode.NotebookCellData[] = [];
    if (shellLines.size > 0) {
        newCells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            [...shellLines].join('\n'),
            language
        ));
    }
    if (importLines.size > 0) {
        newCells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            [...importLines].join('\n'),
            language
        ));
    }

    // Group all notebook edits into a single edit.set() call to avoid conflicts
    nbEdits.push(vscode.NotebookEdit.insertCells(0, newCells));
    const nbEdit = new vscode.WorkspaceEdit();
    nbEdit.set(notebook.uri, nbEdits);
    await vscode.workspace.applyEdit(nbEdit);

    if (!silent) {
        vscode.window.showInformationMessage(
            `Done! Shell: ${shellLines.size} line(s), Imports: ${importLines.size} statement(s).`
        );
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Command available from Command Palette and notebook toolbar
    const organizeCommand = vscode.commands.registerCommand(
        'notebook-cell-organizer.organize',
        async () => {
            const editor = vscode.window.activeNotebookEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Open a Jupyter notebook first.');
                return;
            }
            await organizeNotebook(editor.notebook);
        }
    );

    // Auto-organize on save when the toggle is enabled
    const saveListener = vscode.workspace.onDidSaveNotebookDocument(async (notebook) => {
        const config = vscode.workspace.getConfiguration('notebook-cell-organizer');
        if (config.get<boolean>('organizeOnSave')) {
            await organizeNotebook(notebook, true);
        }
    });

    context.subscriptions.push(organizeCommand, saveListener);
}

export function deactivate() {}
