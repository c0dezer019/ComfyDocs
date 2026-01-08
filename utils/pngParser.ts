import { ComfyMetadata } from '../types';

/**
 * Extracts text chunks specifically for ComfyUI metadata (workflow, prompt)
 * from a PNG file's ArrayBuffer.
 */
export const extractComfyMetadata = async (file: File): Promise<ComfyMetadata> => {
  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);
  const textDecoder = new TextDecoder('utf-8');
  
  let offset = 8; // Skip PNG signature (8 bytes)
  const metadata: ComfyMetadata = { workflow: null, prompt: null };

  while (offset < buffer.byteLength) {
    // Read Chunk Length (4 bytes)
    const length = dataView.getUint32(offset);
    offset += 4;

    // Read Chunk Type (4 bytes)
    const typeBytes = new Uint8Array(buffer, offset, 4);
    const type = String.fromCharCode(...typeBytes);
    offset += 4;

    // We only care about tEXt chunks for ComfyUI
    if (type === 'tEXt') {
      const chunkData = new Uint8Array(buffer, offset, length);
      // tEXt format: Keyword + null separator + Text
      const nullSeparatorIndex = chunkData.indexOf(0);
      
      if (nullSeparatorIndex !== -1) {
        const keyword = textDecoder.decode(chunkData.slice(0, nullSeparatorIndex));
        const text = textDecoder.decode(chunkData.slice(nullSeparatorIndex + 1));

        if (keyword === 'workflow') {
          try {
            metadata.workflow = JSON.parse(text);
          } catch (e) {
            console.error('Failed to parse workflow JSON', e);
          }
        } else if (keyword === 'prompt') {
          try {
            metadata.prompt = JSON.parse(text);
          } catch (e) {
            console.error('Failed to parse prompt JSON', e);
          }
        }
      }
    }

    // Skip Data and CRC (4 bytes)
    offset += length + 4;
  }

  return metadata;
};
