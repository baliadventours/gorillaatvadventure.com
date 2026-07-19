/**
 * Service to handle image uploads to Imgbb with built-in client-side WebP conversion and optimization.
 */

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

/**
 * Converts a standard image File (JPG, PNG, WebP, etc.) to a highly-compressed,
 * optimized WebP File in the browser using HTML5 Canvas.
 * Keeps structural fidelity while dramatically shrinking filesize.
 */
async function optimizeAndConvertToWebP(
  file: File, 
  maxWidth = 1920, 
  maxHeight = 1440, 
  quality = 0.82
): Promise<File> {
  // Return early if not running in the browser or if the file is not an image
  if (typeof window === 'undefined' || !window.HTMLCanvasElement || !file.type.startsWith('image/')) {
    return file;
  }

  // Skip SVG assets as they are vector based
  if (file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Apply aspect-ratio preserving dimensions scaling if dimensions exceed thresholds
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // canvas contextual failure fallback
          return;
        }

        // Draw image keeping high visual sharpness
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // blob export fallback
              return;
            }

            // Replace current extension with .webp
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const optimizedName = `${baseName}_optimized.webp`;

            const optimizedFile = new File([blob], optimizedName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            // Log performance metrics for debugging / tracking in console
            const initialKB = (file.size / 1024).toFixed(1);
            const finalKB = (optimizedFile.size / 1024).toFixed(1);
            const savedPercentage = Math.round((1 - optimizedFile.size / file.size) * 100);
            
            console.log(
              `[Image Converter] Preserving high contrast. Successfully converted "${file.name}" (${initialKB} KB) ` +
              `to optimized WebP format "${optimizedName}" (${finalKB} KB). ` +
              `Image size reduced by ${savedPercentage}% (${width}x${height}px)`
            );

            // Dispatch global event for listeners to display a toast / interactive feedback
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('image-optimized', {
                detail: {
                  originalName: file.name,
                  optimizedName: optimizedName,
                  originalSizeKb: parseFloat(initialKB),
                  optimizedSizeKb: parseFloat(finalKB),
                  percentSaved: savedPercentage,
                  width: width,
                  height: height
                }
              }));
            }

            // Return the optimized WebP if it is indeed smaller (fallback to original if original was somehow smaller)
            resolve(optimizedFile.size < file.size ? optimizedFile : file);
          },
          'image/webp',
          quality
        );
      };
      
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File): Promise<string> {
  // Pre-optimize the image to WebP with smart scaling prior to payload packaging
  let fileToUpload = file;
  try {
    fileToUpload = await optimizeAndConvertToWebP(file);
  } catch (optError) {
    console.warn('[Image Converter] Optimization skipped, uploading original file:', optError);
  }

  // Attempt upload to our own backend proxy first (100% reliable, no CORS issues, no client-side API keys needed!)
  try {
    console.log('[Upload Proxy] Uploading to server proxy:', fileToUpload.name);
    const formData = new FormData();
    formData.append('image', fileToUpload);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || `Server returned status ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.url) {
      console.log('[Upload Proxy] Upload successful via server! URL:', data.url);
      return data.url;
    } else {
      throw new Error(data.error || 'Server upload did not return a valid URL');
    }
  } catch (proxyError: any) {
    console.warn('[Upload Proxy] Server upload failed. Falling back to direct client-side ImgBB:', proxyError);

    if (!IMGBB_API_KEY) {
      throw new Error(`Upload failed. Server upload error: ${proxyError.message}. Also, VITE_IMGBB_API_KEY is not defined in environment variables for client fallback.`);
    }

    const formData = new FormData();
    formData.append('image', fileToUpload);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        return data.data.url;
      } else {
        throw new Error(data.error?.message || 'Failed to upload image to Imgbb');
      }
    } catch (error) {
      console.error('Imgbb upload error:', error);
      throw error;
    }
  }
}

