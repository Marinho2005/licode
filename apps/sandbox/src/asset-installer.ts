import type { Language } from '@licode/protocol';
import { ASSET_MANIFEST } from './assets-manifest.js';

const CACHE_NAME = 'licode-assets-v1';

export interface InstallResult {
  totalBytes: number;
  cached: boolean;
}

export type ProgressCallback = (loaded: number, total: number) => void;

export async function installAssets(
  language: Language,
  onProgress?: ProgressCallback
): Promise<InstallResult> {
  if (language === 'js') {
    return { totalBytes: 0, cached: true };
  }

  const manifest = ASSET_MANIFEST[language];
  if (!manifest || manifest.files.length === 0) {
    return { totalBytes: 0, cached: true };
  }

  if (typeof caches === 'undefined') {
    throw new Error('CacheStorage API is not supported in this environment');
  }

  const cache = await caches.open(CACHE_NAME);

  // 1. Verificar se todos os arquivos já estão em cache
  let allCached = true;
  let cachedTotalBytes = 0;

  for (const file of manifest.files) {
    const url = `${manifest.baseUrl}${file}`;
    const hit = await cache.match(url);
    if (!hit) {
      allCached = false;
      break;
    }
    const cl = hit.headers.get('content-length');
    if (cl) {
      cachedTotalBytes += parseInt(cl, 10);
    } else {
      const blob = await hit.clone().blob();
      cachedTotalBytes += blob.size;
    }
  }

  if (allCached) {
    onProgress?.(cachedTotalBytes, cachedTotalBytes);
    return { totalBytes: cachedTotalBytes, cached: true };
  }

  // 2. Determinar total via HEAD / Content-Length
  let totalBytes = 0;
  for (const file of manifest.files) {
    const url = `${manifest.baseUrl}${file}`;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      const cl = head.headers.get('content-length');
      if (cl) {
        totalBytes += parseInt(cl, 10);
      }
    } catch {
      // Ignora erro no HEAD
    }
  }

  // 3. Baixar arquivos com streaming e gravar no Cache Storage
  let loadedBytes = 0;

  for (const file of manifest.files) {
    const url = `${manifest.baseUrl}${file}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch asset ${url}: ${res.status} ${res.statusText}`);
    }

    if (totalBytes === 0) {
      const cl = res.headers.get('content-length');
      if (cl) {
        totalBytes += parseInt(cl, 10);
      }
    }

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loadedBytes += value.byteLength;
          onProgress?.(loadedBytes, Math.max(totalBytes, loadedBytes));
        }
      }
    } else {
      const blob = await res.blob();
      const arrayBuf = await blob.arrayBuffer();
      chunks.push(new Uint8Array(arrayBuf));
      loadedBytes += blob.size;
      onProgress?.(loadedBytes, Math.max(totalBytes, loadedBytes));
    }

    const combinedBlob = new Blob(chunks as BlobPart[], {
      type: res.headers.get('content-type') || 'application/octet-stream'
    });
    const cachedResponse = new Response(combinedBlob, {
      headers: res.headers,
      status: res.status,
      statusText: res.statusText
    });
    await cache.put(url, cachedResponse);
  }

  return { totalBytes: loadedBytes, cached: false };
}
