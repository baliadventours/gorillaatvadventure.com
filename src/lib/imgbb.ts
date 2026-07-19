/**
 * Service to handle image uploads to Imgbb with built-in client-side WebP conversion and optimization.
 */

import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1] || base64String;
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
}

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
  // Pre-optimize the image to WebP with smart scaling prior to upload
  let fileToUpload = file;
  try {
    fileToUpload = await optimizeAndConvertToWebP(file);
  } catch (optError) {
    console.warn('[Image Converter] Optimization skipped, uploading original file:', optError);
  }

  const sanitizedName = fileToUpload.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const filePath = `uploads/${Date.now()}_${sanitizedName}`;

  // 1. Try direct client-side Firebase Storage upload FIRST
  try {
    console.log('[Firebase Storage Upload] Uploading directly from client...', fileToUpload.name);
    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, fileToUpload, {
      contentType: fileToUpload.type
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);
    console.log('[Firebase Storage Upload] Success! Public URL:', downloadUrl);
    return downloadUrl;
  } catch (storageError: any) {
    console.warn('[Firebase Storage Upload] Direct client-side Storage failed, trying client-side Firestore fallback:', storageError.message || storageError);

    // 2. Try direct client-side Firestore "uploads" fallback (for smaller files)
    if (fileToUpload.size < 1000000) { // < 1MB limit for Firestore docs
      try {
        console.log('[Firebase Firestore Upload] Saving directly from client to "uploads" collection...');
        const base64Data = await fileToBase64(fileToUpload);
        const docRef = await addDoc(collection(db, 'uploads'), {
          name: fileToUpload.name,
          mimetype: fileToUpload.type,
          base64: base64Data,
          createdAt: new Date().toISOString()
        });
        const downloadUrl = `/api/uploads/${docRef.id}`;
        console.log('[Firebase Firestore Upload] Success! Doc URL:', downloadUrl);
        return downloadUrl;
      } catch (firestoreError: any) {
        console.warn('[Firebase Firestore Upload] Direct client-side Firestore failed:', firestoreError.message || firestoreError);
      }
    } else {
      console.log('[Firebase Firestore Upload] File too large for Firestore document (>1MB), skipping.');
    }
  }

  // 3. Try server backend proxy upload
  try {
    console.log('[Upload Proxy] Attempting server-side upload proxy...', fileToUpload.name);
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
      console.log('[Upload Proxy] Server upload successful! URL:', data.url);
      return data.url;
    } else {
      throw new Error(data.error || 'Server upload did not return a valid URL');
    }
  } catch (proxyError: any) {
    console.warn('[Upload Proxy] Server upload proxy failed. Trying ImgBB as last resort fallback:', proxyError.message || proxyError);

    // 4. Try direct client-side ImgBB upload as ultimate fallback safety net
    if (!IMGBB_API_KEY) {
      throw new Error(`Upload failed. All Firebase upload attempts failed, and VITE_IMGBB_API_KEY is not configured.`);
    }

    const formData = new FormData();
    formData.append('image', fileToUpload);

    try {
      console.log('[ImgBB Direct Upload] Uploading directly to ImgBB...');
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        console.log('[ImgBB Direct Upload] Success! ImgBB URL:', data.data.url);
        return data.data.url;
      } else {
        throw new Error(data.error?.message || 'Failed to upload image to Imgbb');
      }
    } catch (error: any) {
      console.error('[ImgBB Direct Upload] Ultimate fallback failed:', error);
      throw new Error(`All upload options failed. Firebase error: ${proxyError.message}. ImgBB error: ${error.message}`);
    }
  }
}

