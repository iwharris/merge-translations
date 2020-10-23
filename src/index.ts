import commander from 'commander';
import util from 'util';
import glob from 'glob';
import { promises as fs } from 'fs';

interface TranslatableItem {
    /** Unique hash that identifies the key */
    key: string;
    value: string;
    context: string;
}

interface TranslationObject {
    /** eg. "EN" */
    language: string;
    translations: TranslatableItem[];
}
const stdout = (msg: string) => process.stdout.write(`${msg}\n`);
const stderr = (msg: string) => process.stderr.write(`${msg}\n`);

const asyncGlob = util.promisify(glob);

const parseArgs = (args: string[]) => {
    return commander
        .description('Merge multiple translation files into one')
        .usage('<file-pattern>')
        .parse(args);
};

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

const loadAndParse = async (path: string): Promise<TranslationObject> => {
    return fs
        .readFile(path)
        .then((buffer) => JSON.parse(buffer.toString()))
        .catch((err) => {
            stderr(`Couldn't load JSON from ${path}: ${err.message}`);
        });
};

const main = async () => {
    const program = parseArgs(process.argv);

    const paths: string[] = await expandGlobPatterns(program.args);

    const allItems: Record<string, TranslatableItem> = {};
    for (const path of paths) {
        const parsed = await loadAndParse(path);
        const items = parsed?.translations || [];
        for (const item of items) {
            const { key } = item;
            if (allItems[key]) {
                if (allItems[key].value === item.value) {
                    stderr(`Skipping duplicate entry for ${key}`);
                } else {
                    stderr(`Warning: Found duplicate keys with different values:\n  `);
                }
            } else {
                allItems[key] = item;
            }
        }
    }

    const finalObject: TranslationObject = {
        language: 'EN',
        translations: Object.values(allItems),
    };

    stdout(JSON.stringify(finalObject, null, 2));
};

main().catch((err) => {
    stderr(`Unhandled exception: ${err}`);
    process.exit(1);
});
