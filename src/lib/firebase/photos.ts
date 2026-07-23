/**
 * Evidence photo storage.
 *
 * Uploads images to Firebase Storage under photos/{uid}/{caseId}/{photoId} and
 * returns the metadata stored on the case (`CasePhoto`). The path embeds the
 * owner uid so the storage rules can restrict every file to its owner without
 * consulting Firestore.
 */

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { CasePhoto } from '@/types';
import { storage } from './config';

function photoId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Upload one image; resolves to the CasePhoto metadata to store on the case. */
export async function uploadPhoto(
  file: File,
  ownerUid: string,
  caseId: string,
): Promise<CasePhoto> {
  const id = photoId();
  const storagePath = `photos/${ownerUid}/${caseId}/${id}`;
  const objectRef = ref(storage, storagePath);
  await uploadBytes(objectRef, file, { contentType: file.type });
  const url = await getDownloadURL(objectRef);
  return {
    id,
    storagePath,
    url,
    caption: file.name.replace(/\.[^.]+$/, ''),
    linkedStainIds: [],
    createdAt: Date.now(),
  };
}

/** Fetch an image URL and convert it to a data URL (for PDF embedding). */
export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Delete a photo's underlying storage object (metadata removal is separate). */
export async function deletePhotoObject(storagePath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    // A missing object is fine — the metadata still gets removed by the caller.
    console.warn('Could not delete photo object:', err);
  }
}
