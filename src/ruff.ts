import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FILE_PLACEHOLDER = '${file}';

export interface RuffOptions {
    command: string;
    arguments: string[];
}

export interface RuffSortResult {
    text: string;
    applied: boolean;
    message?: string;
}

export type RuffCommandRunner = (
    command: string,
    args: readonly string[],
) => Promise<void>;

const defaultRunner: RuffCommandRunner = async (command, args) => {
    await execFileAsync(command, args, {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
    });
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function sortImportsWithRuff(
    imports: string,
    options: RuffOptions,
    runner: RuffCommandRunner = defaultRunner,
): Promise<RuffSortResult> {
    if (!options.command.trim()) {
        return {
            text: imports,
            applied: false,
            message: 'Ruff command is empty.',
        };
    }

    if (!options.arguments.some(argument => argument.includes(FILE_PLACEHOLDER))) {
        return {
            text: imports,
            applied: false,
            message: `Ruff arguments must contain ${FILE_PLACEHOLDER}.`,
        };
    }

    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'notebook-cell-organizer-'));
    const temporaryFile = join(temporaryDirectory, 'imports.py');

    try {
        await writeFile(temporaryFile, `${imports.trim()}\n`, 'utf8');
        const args = options.arguments.map(argument =>
            argument.replaceAll(FILE_PLACEHOLDER, temporaryFile)
        );

        await runner(options.command, args);
        const sortedImports = (await readFile(temporaryFile, 'utf8')).trim();

        if (!sortedImports) {
            return {
                text: imports,
                applied: false,
                message: 'Ruff produced an empty imports file; the original imports were kept.',
            };
        }

        return {
            text: sortedImports,
            applied: true,
        };
    } catch (error) {
        return {
            text: imports,
            applied: false,
            message: `Ruff was skipped: ${errorMessage(error)}`,
        };
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}
