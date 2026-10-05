import type { Env } from '../types/env'
import { AppError } from '../utils/response'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024

function parseDataUrl(value: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(value)
  if (!match) return null
  const mime = match[1]
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { mime, bytes }
}

function extensionForMime(mime: string): string {
  if (mime.includes('avif')) return 'avif'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('png')) return 'png'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('heic') || mime.includes('heif')) return 'heic'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('quicktime')) return 'mov'
  return 'bin'
}

function mimeFromFileName(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'jfif':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'avif':
      return 'image/avif'
    case 'gif':
      return 'image/gif'
    case 'heic':
    case 'heif':
      return 'image/heic'
    case 'mp4':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    case 'mov':
      return 'video/quicktime'
    default:
      return null
  }
}

function resolveUploadMime(file: File, kind: 'IMAGE' | 'VIDEO'): string {
  const raw = file.type?.split(';')[0]?.trim().toLowerCase()
  if (raw && raw !== 'application/octet-stream') return raw
  return mimeFromFileName(file.name) ?? (kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg')
}

function assertMediaBucket(env: Env): R2Bucket {
  const bucket = env.PRODUCT_MEDIA_BUCKET
  if (!bucket) {
    throw new AppError(
      'Product media storage is not configured on the Worker (R2 binding missing)',
      'STORAGE_UNAVAILABLE',
      503,
    )
  }
  return bucket
}

export function resolveMediaUrl(env: Env, keyOrUrl: string): string {
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://') || keyOrUrl.startsWith('data:')) {
    return keyOrUrl
  }
  if (keyOrUrl.startsWith('/')) return keyOrUrl
  const base = env.R2_PUBLIC_URL?.replace(/\/$/, '')
  return base ? `${base}/${keyOrUrl}` : keyOrUrl
}

function r2KeyFromPublicUrl(env: Env, url: string): string | null {
  const base = env.R2_PUBLIC_URL?.replace(/\/$/, '')
  if (base && url.startsWith(`${base}/`)) {
    return url.slice(base.length + 1)
  }
  try {
    const parsed = new URL(url)
    if (parsed.hostname.endsWith('.r2.dev')) {
      const key = parsed.pathname.replace(/^\//, '')
      return key || null
    }
  } catch {
    // not a URL
  }
  return null
}

export async function uploadProductMediaFile(
  env: Env,
  file: File,
  kind: 'IMAGE' | 'VIDEO',
): Promise<{ url: string; r2_key: string; file_name: string }> {
  const bucket = assertMediaBucket(env)

  if (file.size <= 0) {
    throw new AppError('Uploaded file is empty', 'INVALID_MEDIA', 400)
  }

  const maxBytes = kind === 'VIDEO' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    throw new AppError('Media file is too large', 'MEDIA_TOO_LARGE', 400)
  }

  const mime = resolveUploadMime(file, kind)
  if (kind === 'IMAGE' && !mime.startsWith('image/')) {
    throw new AppError('File must be an image', 'INVALID_MEDIA', 400)
  }
  if (kind === 'VIDEO' && !mime.startsWith('video/')) {
    throw new AppError('File must be a video', 'INVALID_MEDIA', 400)
  }

  const ext = extensionForMime(mime)
  const stamp = crypto.randomUUID()
  const fileName = kind === 'VIDEO' ? `video.${ext}` : `image-${stamp.slice(0, 8)}.${ext}`
  const r2Key = `products/uploads/${stamp}/${fileName}`

  const body = await file.arrayBuffer()
  await bucket.put(r2Key, body, {
    httpMetadata: { contentType: mime },
  })

  return {
    url: resolveMediaUrl(env, r2Key),
    r2_key: r2Key,
    file_name: fileName,
  }
}

export async function persistMediaInput(
  env: Env,
  productId: string,
  input: string,
  kind: 'IMAGE' | 'VIDEO',
  sortOrder: number,
): Promise<{ r2Key: string; fileName: string; url: string }> {
  if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('/')) {
    const keyFromPublic = input.startsWith('http') ? r2KeyFromPublicUrl(env, input) : null
    if (keyFromPublic) {
      return {
        r2Key: keyFromPublic,
        fileName: keyFromPublic.split('/').pop() ?? 'file',
        url: resolveMediaUrl(env, keyFromPublic),
      }
    }
    return {
      r2Key: input,
      fileName: input.split('/').pop() ?? 'external',
      url: input,
    }
  }

  const parsed = parseDataUrl(input)
  if (!parsed) {
    throw new AppError('Invalid media payload', 'INVALID_MEDIA', 400)
  }

  const maxBytes = kind === 'VIDEO' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (parsed.bytes.byteLength > maxBytes) {
    throw new AppError('Media file is too large', 'MEDIA_TOO_LARGE', 400)
  }

  const ext = extensionForMime(parsed.mime)
  const fileName = kind === 'VIDEO' ? `demo.${ext}` : `gallery-${String(sortOrder).padStart(2, '0')}.${ext}`
  const r2Key = `products/${productId}/${fileName}`

  await assertMediaBucket(env).put(r2Key, parsed.bytes, {
    httpMetadata: { contentType: parsed.mime },
  })

  return { r2Key, fileName, url: resolveMediaUrl(env, r2Key) }
}

export async function deleteR2Object(env: Env, key: string) {
  if (!key.startsWith('products/')) return
  const bucket = env.PRODUCT_MEDIA_BUCKET
  if (!bucket) return
  await bucket.delete(key)
}
