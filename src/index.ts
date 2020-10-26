import commander from 'commander';
import util from 'util';
import glob from 'glob';
import { promises as fs } from 'fs';

interface TranslationItem {
    /** Unique hash that identifies the key */
    key: string;
    value: string;
    context: string;
}

interface TranslationObject {
    /** eg. "EN" */
    language: string;
    translations: TranslationItem[];
}
const stdout = (msg: string) => process.stdout.write(`${msg}\n`);
const stderr = (msg: string) => process.stderr.write(`${msg}\n`);

const asyncGlob = util.promisify(glob);

const parseArgs = (args: string[]) =>
    commander
        .description('Merge multiple translation files into one')
        .usage('<file-pattern>')
        .option('--ignore-errors', 'Ignore errors when loading and parsing files')
        .option('--no-sort', 'Do not sort translation strings by their keys')
        .option('--no-merge-context', 'Do not try to grab contexts from duplicate keys')
        .parse(args);

/**
 * Expands all glob patterns and returns a flat list of file paths with duplicates removed.
 */
const expandGlobPatterns = async (patterns: string[]): Promise<string[]> => {
    const allPatterns = await Promise.all(patterns.map((p) => asyncGlob(p)));
    const flattened = ([] as string[]).concat.apply([], allPatterns);
    const fileSet: Set<string> = new Set();

    for (const path of flattened) {
        fileSet.add(path);
    }

    return Array.from(fileSet);
};

const loadAndParse = async (path: string, ignoreErrors: boolean): Promise<TranslationObject> => {
    return fs
        .readFile(path)
        .then((buffer) => JSON.parse(buffer.toString()))
        .catch((err) => {
            const str = `Couldn't load JSON from ${path}: ${err.message}`;

            if (!ignoreErrors) throw new Error(str);
            else stderr(`Warning: ${str}`);
        });
};

const sortTranslations = (translations: TranslationItem[]): TranslationItem[] =>
    translations.sort((a, b) => a.key.localeCompare(b.key));

const main = async () => {
    const program = parseArgs(process.argv);

    const { ignoreErrors, sort, mergeContext } = program;

    const paths: string[] = await expandGlobPatterns(program.args);

    const allItems: Record<string, TranslationItem> = {};
    for (const path of paths) {
        const parsed = await loadAndParse(path, ignoreErrors);
        const items = parsed?.translations || [];
        for (const item of items) {
            const { key } = item;
            if (allItems[key]) {
                if (allItems[key].value === item.value) {
                    if (mergeContext && !allItems[key].context && item.context) {
                        allItems[key].context = item.context;
                        stderr(`Pulled context from duplicate entry into ${key}: ${item.context}`);
                    } else {
                        stderr(`Skipping duplicate entry for ${key}`);
                    }
                } else {
                    const str =
                        `Found duplicate keys with different values:\n` +
                        `Key: ${key}\n` +
                        `Value 1: ${allItems[key].value}\n` +
                        `Value 2: ${item.value} (in file ${path})`;
                    if (!ignoreErrors) throw new Error(str);
                    else stderr(`Warning: ${str}`);
                }
            } else {
                allItems[key] = item;
            }
        }
    }

    // Omit sorting if flag is provided
    const translations = sort ? sortTranslations(Object.values(allItems)) : Object.values(allItems);

    const finalObject: TranslationObject = {
        language: 'EN',
        translations,
    };

    stdout(JSON.stringify(finalObject, null, 2));
};

main().catch((err) => {
    stderr(`Unhandled exception: ${err}`);
    process.exit(1);
});
