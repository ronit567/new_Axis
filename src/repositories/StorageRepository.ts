import { supabase } from '../lib/supabase'

const LISTING_IMAGES_BUCKET = 'listing-images'

// Must stay in sync with the bucket's allowed_mime_types (0014_storage_buckets.sql).
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const ALLOWED_CONTENT_TYPES = new Set(Object.values(EXTENSION_CONTENT_TYPES))

// A local photo picked via expo-image-picker. mimeType comes straight from
// the picker's asset — the source of truth, since it reflects the actual
// file bytes. Extension-sniffing the uri is only a fallback: Android content
// picker uris (content://...) routinely have no file extension at all, so
// relying on the uri alone would silently mislabel real PNGs/WebPs as jpeg.
export type LocalPhoto = {
  uri: string
  mimeType: string | null
}

function contentTypeFor(photo: LocalPhoto): string {
  if (photo.mimeType && ALLOWED_CONTENT_TYPES.has(photo.mimeType)) return photo.mimeType
  const ext = photo.uri.split('.').pop()?.split('?')[0].toLowerCase() ?? ''
  return EXTENSION_CONTENT_TYPES[ext] ?? 'image/jpeg'
}

function extensionFor(contentType: string): string {
  return contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
}

export type UploadedListingImages = {
  // Public URLs, in selection order, to persist as listings.image_urls.
  urls: string[]
  // Storage object paths (same order) — kept so a caller can roll back this
  // upload batch (e.g. the listing row insert that follows fails).
  paths: string[]
}

export const StorageRepository = {
  // Path convention (0014_storage_buckets.sql): {seller_id}/{listing_id}/{filename}.
  // listingId is caller-generated (before the listings row exists) so the
  // upload can happen first and the insert only ever references URLs that are
  // already live — a failed insert never leaves a broken listing pointing at
  // missing images.
  async uploadListingImages(
    sellerId: string,
    listingId: string,
    photos: LocalPhoto[],
  ): Promise<UploadedListingImages> {
    const paths: string[] = []
    const urls: string[] = []

    try {
      for (let i = 0; i < photos.length; i += 1) {
        const photo = photos[i]
        const contentType = contentTypeFor(photo)
        const path = `${sellerId}/${listingId}/${i}.${extensionFor(contentType)}`

        const response = await fetch(photo.uri)
        const arraybuffer = await response.arrayBuffer()

        const { error } = await supabase.storage
          .from(LISTING_IMAGES_BUCKET)
          .upload(path, arraybuffer, { contentType })
        if (error) throw error

        paths.push(path)
        const { data } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path)
        urls.push(data.publicUrl)
      }

      return { urls, paths }
    } catch (error) {
      // Partial failure: clean up whatever this attempt did upload rather than
      // leaving orphaned objects, then surface an actionable message instead
      // of a raw storage error.
      await StorageRepository.deleteListingImages(paths)
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Couldn't upload photo ${paths.length + 1} of ${photos.length}: ${reason}`)
    }
  },

  async deleteListingImages(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    // Best-effort: if cleanup itself fails (e.g. network dropped), don't mask
    // the original error with a cleanup error. An orphaned storage object is
    // a lesser problem than losing the real failure reason.
    await supabase.storage
      .from(LISTING_IMAGES_BUCKET)
      .remove(paths)
      .catch(() => undefined)
  },
}
