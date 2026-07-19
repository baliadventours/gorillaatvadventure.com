/**
 * Cloudflare Image Transformation Utility
 * Documentation: https://developers.cloudflare.com/images/optimization/transformations/overview/
 */

export interface CloudflareTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'json';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: 'auto' | 'side' | string; // e.g. "0.5x0.5"
  blur?: number;
  sharpen?: number;
  rotate?: number;
  dpr?: number;
  background?: string;
  anim?: boolean;
}

/**
 * Transforms an image URL to use Cloudflare Image Transformations.
 * 
 * URL Format: https://<ZONE>/cdn-cgi/image/<OPTIONS>/<SOURCE_URL>
 */
export function getCloudflareImageUrl(src: string, options: CloudflareTransformOptions = {}): string {
  if (!src) return '';
  
  // Skip if already a Cloudflare transformation URL or a blob/data URL
  if (src.includes('/cdn-cgi/image/') || src.startsWith('blob:') || src.startsWith('data:')) {
    return src;
  }

  // Only apply transformations if we are on the production domain.
  // Cloudflare Image Resizing only works when the request passes through the Cloudflare proxy.
  const isDev = typeof window !== 'undefined' && (
    window.location.hostname.includes('run.app') || 
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1')
  );

  if (isDev) {
    return src;
  }

  const parts: string[] = [];

  if (options.width) parts.push(`width=${options.width}`);
  if (options.height) parts.push(`height=${options.height}`);
  if (options.quality) parts.push(`quality=${options.quality}`);
  if (options.format) parts.push(`format=${options.format}`);
  if (options.fit) parts.push(`fit=${options.fit}`);
  if (options.gravity) parts.push(`gravity=${options.gravity}`);
  if (options.blur) parts.push(`blur=${options.blur}`);
  if (options.sharpen) parts.push(`sharpen=${options.sharpen}`);
  if (options.rotate) parts.push(`rotate=${options.rotate}`);
  if (options.dpr) parts.push(`dpr=${options.dpr}`);
  if (options.background) parts.push(`background=${options.background}`);
  if (options.anim !== undefined) parts.push(`anim=${options.anim}`);

  if (parts.length === 0) {
    // If no specific options, we might still want 'format=auto' for optimization
    parts.push('format=auto');
  }

  const optionsString = parts.join(',');
  
  // We use relative path if it's on the same domain, or absolute if needed.
  // Using relative path '/cdn-cgi/image/...' ensures it goes through the same Cloudflare zone.
  return `/cdn-cgi/image/${optionsString}/${src}`;
}
