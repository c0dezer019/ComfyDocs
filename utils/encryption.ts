
/**
 * Encryption Lite Utility
 * Provides basic obfuscation/encryption for storing API keys locally using a user password.
 * 
 * Note: This uses a synchronous XOR cipher with a validation prefix. 
 * It is designed for client-side obfuscation (BYOK) and is not a cryptographic standard 
 * for high-security backend storage.
 */

const SALT_PREFIX = '::COMFY_LITE_V2::';

export const encrypt = (text: string, password: string): string => {
  if (!text || !password) return '';
  const payload = SALT_PREFIX + text;
  try {
    let result = '';
    for (let i = 0; i < payload.length; i++) {
      result += String.fromCharCode(payload.charCodeAt(i) ^ password.charCodeAt(i % password.length));
    }
    return btoa(result);
  } catch (e) {
    console.error("Encryption failed", e);
    return '';
  }
};

export const decrypt = (encoded: string, password: string): string => {
  if (!encoded || !password) return '';
  try {
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
    }
    if (result.startsWith(SALT_PREFIX)) {
        return result.substring(SALT_PREFIX.length);
    }
    return '';
  } catch (e) {
    return '';
  }
};
