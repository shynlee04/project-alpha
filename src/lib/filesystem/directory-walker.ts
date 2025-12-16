import { FileSystemError } from './fs-errors';
import type { DirectoryEntry } from './fs-types';
import type { LocalFSAdapter } from './local-fs-adapter';

export interface WalkDirectoryEntry extends DirectoryEntry {
    path: string;
}

export async function walkDirectorySegments(
    root: FileSystemDirectoryHandle | null,
    segments: string[],
    create = false
): Promise<FileSystemDirectoryHandle> {
    if (!root) {
        throw new FileSystemError('No directory access granted.', 'NO_DIRECTORY_ACCESS');
    }

    let current = root;

    for (const segment of segments) {
        current = await current.getDirectoryHandle(segment, { create });
    }

    return current;
}

export async function* walkDirectory(
    adapter: Pick<LocalFSAdapter, 'listDirectory'>,
    path: string,
    options: {
        recursive?: boolean;
        skipDirectory?: (entry: { path: string; name: string }) => boolean;
    } = {}
): AsyncGenerator<WalkDirectoryEntry> {
    const recursive = options.recursive ?? true;

    const entries: DirectoryEntry[] = await adapter.listDirectory(path);
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;
        yield { ...entry, path: entryPath };

        if (entry.type === 'directory') {
            if (recursive && (!options.skipDirectory || !options.skipDirectory({ path: entryPath, name: entry.name }))) {
                yield* walkDirectory(adapter, entryPath, options);
            }
        }
    }
}
