/**
 * PNG Chunk Writer Utility
 * Used to embed the analysis report back into the image as a standard PNG tEXt chunk.
 */

// Precomputed CRC table
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ 0xffffffff;
};

const stringToUint8 = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

const createChunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeArr = stringToUint8(type);
  const lenArr = new Uint8Array(4);
  const dv = new DataView(lenArr.buffer);
  dv.setUint32(0, data.length); // Big Endian is default for PNG

  // CRC is calculated on Type + Data
  const crcInput = new Uint8Array(typeArr.length + data.length);
  crcInput.set(typeArr, 0);
  crcInput.set(data, typeArr.length);

  const crcVal = crc32(crcInput);
  const crcArr = new Uint8Array(4);
  const crcDv = new DataView(crcArr.buffer);
  crcDv.setUint32(0, crcVal);

  // Assemble: Length (4) + Type (4) + Data (N) + CRC (4)
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  chunk.set(lenArr, 0);
  chunk.set(typeArr, 4);
  chunk.set(data, 8);
  chunk.set(crcArr, 8 + data.length);

  return chunk;
};

/**
 * Embeds the analysis report into the original PNG file.
 * We scan for the IEND chunk and insert our new chunk right before it.
 */
export const embedReportInPng = async (originalFile: File, reportJson: string): Promise<Blob> => {
  const buffer = await originalFile.arrayBuffer();
  const view = new DataView(buffer);

  // Basic PNG Signature check
  if (view.getUint32(0) !== 0x89504e47) {
    throw new Error('Not a valid PNG file');
  }

  // Create the new chunk
  // tEXt format: keyword + null + text
  const keyword = 'ComfyDocs_Report';
  const keywordBytes = stringToUint8(keyword);
  const textBytes = stringToUint8(reportJson);

  const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  chunkData.set(keywordBytes, 0);
  chunkData[keywordBytes.length] = 0; // Null separator
  chunkData.set(textBytes, keywordBytes.length + 1);

  const newChunk = createChunk('tEXt', chunkData);

  // Find insertion point (before IEND)
  let offset = 8;
  const uint8Buffer = new Uint8Array(buffer);
  let insertionIndex = -1;

  while (offset < buffer.byteLength) {
    const length = view.getUint32(offset);
    const typeOffset = offset + 4;
    const type = String.fromCharCode(
      uint8Buffer[typeOffset],
      uint8Buffer[typeOffset + 1],
      uint8Buffer[typeOffset + 2],
      uint8Buffer[typeOffset + 3]
    );

    if (type === 'IEND') {
      insertionIndex = offset;
      break;
    }

    offset += length + 12; // Length(4) + Type(4) + Data(length) + CRC(4)
  }

  if (insertionIndex === -1) {
    // If IEND not found (weird), just append
    insertionIndex = buffer.byteLength;
  }

  // Combine
  const finalBuffer = new Uint8Array(buffer.byteLength + newChunk.length);
  finalBuffer.set(uint8Buffer.slice(0, insertionIndex), 0);
  finalBuffer.set(newChunk, insertionIndex);
  finalBuffer.set(uint8Buffer.slice(insertionIndex), insertionIndex + newChunk.length);

  return new Blob([finalBuffer], { type: 'image/png' });
};
