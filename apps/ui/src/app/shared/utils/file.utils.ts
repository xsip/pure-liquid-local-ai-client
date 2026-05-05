/**
 * Utility functions for file handling, shared across chat input components.
 */

/**
 * Returns a human-readable file size label from a base64 data URL.
 * e.g. "23.4 KB", "1.2 MB", "512 B"
 */
export function fileSizeLabel(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bytes = Math.round((base64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface AppendedFile {
  type: 'input_image' | 'input_file';
  filename: string;
  id?: string;
  sizeKb?: number;
  assetUrl?: string;
  fileName?: string;
  image_url?: string; // data:<mime>;base64,<data>
}

/**
 * Reads a FileList into an array of AppendedFile objects (base64 data URLs).
 * Returns a Promise resolving to the new files array.
 */
export function readFilesAsDataUrls(files: FileList): Promise<AppendedFile[]> {
  const readers: Promise<AppendedFile>[] = Array.from(files).map(
    (file) =>
      new Promise<AppendedFile>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            type: 'input_image',
            filename: file.name,
            image_url: reader.result as string,
          });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }),
  );
  return Promise.all(readers);
}

/**
 * Merges new files into an existing list, deduplicating by filename
 * (last write wins).
 */
export function mergeFiles(existing: AppendedFile[], incoming: AppendedFile[]): AppendedFile[] {
  const map = new Map(existing.map((f) => [f.filename, f]));
  incoming.forEach((f) => map.set(f.filename, f));
  return Array.from(map.values());
}
