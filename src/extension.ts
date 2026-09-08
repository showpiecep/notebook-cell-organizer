import * as vscode from 'vscode';
import { extractCellContent } from './organizer';
import { sortImportsWithRuff } from './ruff';

let outputChannel: vscode.OutputChannel;

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
        const extracted = extractCellContent(originalText);
        extracted.shellCommands.forEach(command => shellLines.add(command));
        extracted.imports.forEach(importStatement => importLines.add(importStatement));

        const newText = extracted.remainingText;
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

    let organizedImports = [...importLines].join('\n');
    const config = vscode.workspace.getConfiguration(
        'notebook-cell-organizer',
        notebook.uri,
    );
    const useRuff = config.get<boolean>('useRuffForImportSorting', false);

    if (useRuff && language === 'python' && organizedImports) {
        const result = await sortImportsWithRuff(organizedImports, {
            command: config.get<string>('ruff.command', 'ruff'),
            arguments: config.get<string[]>('ruff.arguments', [
                'check',
                '--select',
                'I',
                '--fix',
                '${file}',
            ]),
        });
        organizedImports = result.text;

        if (result.message) {
            outputChannel.appendLine(result.message);
        }
    }

    // If the affected cells are already at the top, compare them with the final
    // content too. This still lets Ruff re-sort an already organized import cell.
    const newCellCount = (shellLines.size > 0 ? 1 : 0) + (importLines.size > 0 ? 1 : 0);
    const onlyTopModified = [...cellNewTexts.keys()].every(k => k < newCellCount);
    const allBecomeEmpty = [...cellNewTexts.values()].every(v => v === '');
    const expectedTopCellTexts = [
        ...(shellLines.size > 0 ? [[...shellLines].join('\n')] : []),
        ...(importLines.size > 0 ? [organizedImports] : []),
    ];
    const topCellsMatch = expectedTopCellTexts.every((text, index) =>
        notebook.cellAt(index).document.getText().trim() === text.trim()
    );
    if (onlyTopModified && allBecomeEmpty && topCellsMatch) {
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
            organizedImports,
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
    outputChannel = vscode.window.createOutputChannel('Notebook Cell Organizer');
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

    context.subscriptions.push(organizeCommand, saveListener, outputChannel);
}

export function deactivate() {}
