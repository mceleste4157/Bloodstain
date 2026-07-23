/**
 * Evidence photo panel.
 *
 * Uploads images to Firebase Storage, shows thumbnails, and lets the
 * investigator caption each photo and link it to one or more documented stains.
 * Photo metadata lives on the case (autosaved with everything else); the binary
 * lives in Storage. Deleting removes both.
 */

import { useRef, useState } from 'react';
import type { Bloodstain, CasePhoto } from '@/types';
import { deletePhotoObject, uploadPhoto } from '@/lib/firebase/photos';
import { Button } from '@/components/ui';

interface PhotosPanelProps {
  photos: CasePhoto[];
  stains: Bloodstain[];
  ownerUid: string;
  caseId: string;
  onChange: (photos: CasePhoto[]) => void;
}

export function PhotosPanel({ photos, stains, ownerUid, caseId, onChange }: PhotosPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: CasePhoto[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadPhoto(file, ownerUid, caseId));
      }
      onChange([...photos, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function updatePhoto(id: string, patch: Partial<CasePhoto>) {
    onChange(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function removePhoto(photo: CasePhoto) {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    await deletePhotoObject(photo.storagePath);
    onChange(photos.filter((p) => p.id !== photo.id));
  }

  function toggleLink(photo: CasePhoto, stainId: string) {
    const linked = new Set(photo.linkedStainIds ?? []);
    if (linked.has(stainId)) linked.delete(stainId);
    else linked.add(stainId);
    updatePhoto(photo.id, { linkedStainIds: Array.from(linked) });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : '+ Upload photos'}
        </Button>
        <span className="text-xs text-slate-500">{photos.length} photo(s)</span>
      </div>

      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}

      {photos.length === 0 ? (
        <p className="text-sm text-slate-400">
          No photos yet. Upload crime-scene photographs and link them to stains.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="rounded-lg border border-surface-border p-2">
              {photo.url ? (
                <a href={photo.url} target="_blank" rel="noreferrer">
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Evidence photo'}
                    className="h-36 w-full rounded object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <div className="flex h-36 items-center justify-center rounded bg-surface text-xs text-slate-500">
                  no preview
                </div>
              )}
              <input
                value={photo.caption ?? ''}
                onChange={(e) => updatePhoto(photo.id, { caption: e.target.value })}
                placeholder="Caption"
                className="mt-2 w-full rounded bg-surface px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
              {stains.length > 0 ? (
                <div className="mt-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                    Linked stains
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {stains.map((s) => {
                      const linked = photo.linkedStainIds?.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleLink(photo, s.id)}
                          className={`rounded px-1.5 py-0.5 text-[11px] ${
                            linked
                              ? 'bg-brand-600 text-white'
                              : 'bg-surface-border text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {s.stainId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <button
                onClick={() => void removePhoto(photo)}
                className="mt-2 text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
