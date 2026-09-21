import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { supabase } from '../lib/supabase'
import { decodeBase64 } from '../lib/base64'

const LISTING_IMAGES_BUCKET = 'listing-images'
const AVATARS_BUCKET = 'avatars'
// 2x the largest on-screen avatar at 3x density, so it stays sharp if a
// profile header ever grows.
const AVATAR_LONG_EDGE = 512
const AVATAR_COMPRESS = 0.75

// On-device resize targets (0023). Cameras produce 3–6MB ~4000px photos; the
// detail gallery renders at screen width and the grid card at ~180pt, so
// uploading originals wastes both storage and every buyer's bandwidth.
// 1600px covers the gallery at 3x density (~200–400KB); 480px covers the
// grid card at 3x (~20–40KB).
const DETAIL_LONG_EDGE = 1600
const DETAIL_COMPRESS = 0.7
const THUMB_LONG_EDGE = 480
const THUMB_COMPRESS = 0.6

// A local photo picked via expo-image-picker. Every upload path re-encodes to
// JPEG (prepareListingPhoto), so mimeType no longer decides the uploaded
// content type; it is carried for callers that still branch on it.
// width/height (when the picker reports them) let prepareListingPhoto pick
// the long edge without decoding the image first.
export type LocalPhoto = {
  uri: string
  mimeType: string | null
  width?: number
  height?: number
}

// Resize a picked photo to `longEdge` (never upscaling) and re-encode as
// JPEG at `compress`. Returns a local file uri for the resized copy plus its
// output dimensions — computed here rather than read back from saveAsync, so
// a follow-up pass over the result (the thumb) never needs a probe decode.
// Lives here — not in the form hook — so upload code paths can't forget it
// and tests can mock it alongside the storage client.
type PreparedPhoto = { uri: string; bytes: Uint8Array; width: number; height: number }

async function prepareListingPhoto(
  photo: LocalPhoto,
  longEdge: number,
  compress: number,
): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(photo.uri)

  let { width, height } = photo
  if (!width || !height) {
    // Rare: some Android content:// assets come back without dimensions.
    // Decode once to measure; the context stays usable for the resize below.
    const probe = await context.renderAsync()
    width = probe.width
    height = probe.height
  }

  if (Math.max(width, height) > longEdge) {
    context.resize(width >= height ? { width: longEdge } : { height: longEdge })
  }

  const rendered = await context.renderAsync()
  // `base64: true` hands the encoded JPEG straight back. Reading it off the
  // saved file:// URI instead — which is what this used to do, via fetch() —
  // routes a local file read through Expo's native fetch, where it
  // intermittently hangs and rejects with "fetch failed: UnexpectedException:
  // The request timed out" from ExpoModulesCore. The bytes never need to touch
  // the network stack, so they no longer do.
  const saved = await rendered.saveAsync({ compress, format: SaveFormat.JPEG, base64: true })

  if (!saved.base64) {
    // Defensive: the option is honoured on both platforms, but an empty result
    // here would otherwise surface as a zero-byte upload that only shows up as
    // a broken image much later.
    throw new Error('Image encoding returned no data. Please try another photo.')
  }

  const scale = Math.min(1, longEdge / Math.max(width, height))
  return {
    uri: saved.uri,
    bytes: decodeBase64(saved.base64),
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

export type UploadedListingImages = {
  // Public URLs, in selection order, to persist as listings.image_urls.
  urls: string[]
  // Public URLs of the grid-sized variants (same order) — listings.thumb_urls.
  thumbUrls: string[]
  // Every storage object path this batch created (detail + thumb) — kept so a
  // caller can roll back the whole upload (e.g. the listing row insert that
  // follows fails).
  paths: string[]
}

// Shared loop for both listing upload paths (create + edit additions): per
// photo, resize to the detail and thumb variants and upload both, naming
// objects via `pathFor` so the two paths keep their distinct (index-named vs
// timestamped) conventions. Both variants are JPEG after manipulation, so
// the picker mimeType no longer decides the uploaded content type.
async function uploadListingPhotoSet(
  photos: LocalPhoto[],
  pathFor: (index: number, suffix: '' | '_thumb') => string,
): Promise<UploadedListingImages> {
  const paths: string[] = []
  const urls: string[] = []
  const thumbUrls: string[] = []

  const uploadVariant = async (
    bytes: Uint8Array,
    path: string,
  ): Promise<{ url: string; path: string }> => {
    const { error } = await supabase.storage
      .from(LISTING_IMAGES_BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg' })
    if (error) throw error

    const { data } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl, path }
  }

  try {
    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i]
      const detail = await prepareListingPhoto(photo, DETAIL_LONG_EDGE, DETAIL_COMPRESS)
      // The thumb derives from the already-resized detail output (dimensions
      // known, already JPEG) instead of re-decoding the full-resolution source.
      const thumb = await prepareListingPhoto(
        { uri: detail.uri, mimeType: 'image/jpeg', width: detail.width, height: detail.height },
        THUMB_LONG_EDGE,
        THUMB_COMPRESS,
      )

      // The pair uploads concurrently; allSettled (not all) so a failed
      // variant can't leave its sibling still in-flight while the catch
      // below deletes the batch.
      const results = await Promise.allSettled([
        uploadVariant(detail.bytes, pathFor(i, '')),
        uploadVariant(thumb.bytes, pathFor(i, '_thumb')),
      ])

      for (const result of results) {
        if (result.status === 'fulfilled') paths.push(result.value.path)
      }
      const [detailResult, thumbResult] = results
      if (detailResult.status === 'rejected') throw detailResult.reason
      if (thumbResult.status === 'rejected') throw thumbResult.reason

      urls.push(detailResult.value.url)
      thumbUrls.push(thumbResult.value.url)
    }

    return { urls, thumbUrls, paths }
  } catch (error) {
    // Partial failure: clean up whatever this attempt did upload rather than
    // leaving orphaned objects, then surface an actionable message instead
    // of a raw storage error. thumbUrls counts fully-finished photos, so the
    // failing photo is the next one regardless of which variant died.
    await StorageRepository.deleteListingImages(paths)
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Couldn't upload photo ${thumbUrls.length + 1} of ${photos.length}: ${reason}`)
  }
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
    return uploadListingPhotoSet(photos, (i, suffix) => `${sellerId}/${listingId}/${i}${suffix}.jpg`)
  },

  // Edit-flow uploads (0021): a listing already has live objects named by
  // index (0.jpg, 1.jpg, ...) at this same {seller_id}/{listing_id}/ prefix.
  // Reusing index-based names here would silently overwrite one of those
  // live objects mid-edit — before the listings row (or edit request) that's
  // supposed to point at the new photo has actually been written. Timestamped
  // filenames guarantee an addition never collides with an existing object,
  // whether the edit lands immediately (direct update) or sits in review (an
  // edit request whose proposed_image_urls references it).
  async uploadListingImageAdditions(
    sellerId: string,
    listingId: string,
    photos: LocalPhoto[],
  ): Promise<UploadedListingImages> {
    const batch = Date.now()
    return uploadListingPhotoSet(
      photos,
      (i, suffix) => `${sellerId}/${listingId}/${batch}-${i}${suffix}.jpg`,
    )
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

  // Path convention (0014_storage_buckets.sql): {user_id}/{filename}. The
  // filename is timestamped rather than fixed ("avatar.jpg") on purpose: the
  // stored value changes on every replacement, so expo-image's cache can never
  // serve a stale photo for the old one. Older files under the prefix are
  // removed best-effort after the new upload succeeds.
  //
  // Returns the object PATH, not a URL (0039). The avatars bucket is private, so
  // there is no durable URL to persist — a signed URL expires. profiles.avatar_url
  // therefore stores this path and the client signs it at render time; see
  // src/lib/avatarUrls.ts, which Avatar calls.
  //
  // Resized before upload, like listing photos. The picker hands back whatever
  // the camera produced (up to the bucket's 2MB cap, past which the upload
  // simply failed), for a circle that is never drawn larger than 84pt — about
  // 250px on a 3x screen. Every viewer of every list row paid for the rest.
  async uploadAvatar(userId: string, photo: LocalPhoto): Promise<string> {
    const prepared = await prepareListingPhoto(photo, AVATAR_LONG_EDGE, AVATAR_COMPRESS)
    const contentType = 'image/jpeg'
    const path = `${userId}/${Date.now()}.jpg`

    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, prepared.bytes, { contentType })
    if (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Couldn't upload your photo: ${reason}`)
    }

    // Sweep older avatars so the bucket holds one file per user. Best-effort,
    // same reasoning as deleteListingImages: an orphaned old avatar is a
    // lesser problem than failing the whole change after the upload worked.
    const newName = path.split('/').pop()
    await supabase.storage
      .from(AVATARS_BUCKET)
      .list(userId)
      .then(({ data }) => {
        const stale = (data ?? [])
          .filter(file => file.name !== newName)
          .map(file => `${userId}/${file.name}`)
        return stale.length > 0
          ? supabase.storage.from(AVATARS_BUCKET).remove(stale)
          : undefined
      })
      .catch(() => undefined)

    return path
  },
}
