
import { ComfyMetadata, SceneDocumentation } from '../types';

const DEMO_WORKFLOW = {
    "nodes": [
      {"id": 4, "type": "CheckpointLoaderSimple", "pos": [40, 230], "widgets_values": ["realisticVision_v51.safetensors"]},
      {"id": 5, "type": "VAELoader", "pos": [40, 480], "widgets_values": ["vae-ft-mse-840000-ema-pruned.safetensors"]},
      {"id": 6, "type": "CLIPTextEncode", "pos": [430, 40], "title": "Positive Prompt", "widgets_values": ["A young red-headed woman sitting on a bed playing an acoustic guitar, wearing large headphones, realistic photography, soft cinematic lighting, detailed face, 8k, room clutter, bed sheets, window background, high resolution, raw photo."]},
      {"id": 7, "type": "CLIPTextEncode", "pos": [430, 230], "title": "Negative Prompt", "widgets_values": ["deformed hands, fused fingers, low quality, bad anatomy, text, watermark, blurry faces, mutated limbs, extra digits"]},
      {"id": 3, "type": "KSampler", "pos": [780, 230], "widgets_values": [880796292329044, "fixed", 25, 6.5, "dpmpp_2m", "karras", 1]},
      {"id": 8, "type": "VAEDecode", "pos": [1150, 230]},
      {"id": 9, "type": "SaveImage", "pos": [1400, 230]}
    ],
    "links": [
      [1, 4, 0, 3, 0, "MODEL"],
      [2, 4, 1, 6, 0, "CLIP"],
      [3, 4, 1, 7, 0, "CLIP"],
      [4, 6, 0, 3, 1, "CONDITIONING"],
      [5, 7, 0, 3, 2, "CONDITIONING"],
      [6, 5, 0, 8, 1, "VAE"],
      [7, 3, 0, 8, 0, "LATENT"],
      [8, 8, 0, 9, 0, "IMAGE"]
    ]
};

/**
 * Extracts text chunks specifically for ComfyUI metadata (workflow, prompt)
 * from a PNG file's ArrayBuffer.
 */
export const extractComfyMetadata = async (file: File): Promise<ComfyMetadata> => {
  // Special case for the interactive demo to simulate embedded metadata
  if (file.name === 'demo.png') {
    return {
      workflow: DEMO_WORKFLOW,
      prompt: null, // Workflow is sufficient for demo
      report: null
    };
  }

  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);
  const textDecoder = new TextDecoder('utf-8');
  
  let offset = 8; // Skip PNG signature (8 bytes)
  const metadata: ComfyMetadata = { workflow: null, prompt: null, report: null };

  while (offset < buffer.byteLength) {
    // Read Chunk Length (4 bytes)
    const length = dataView.getUint32(offset);
    offset += 4;

    // Read Chunk Type (4 bytes)
    const typeBytes = new Uint8Array(buffer, offset, 4);
    const type = String.fromCharCode(...typeBytes);
    offset += 4;

    // We only care about tEXt chunks for ComfyUI and ComfyDocs
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
        } else if (keyword === 'ComfyDocs_Report') {
          try {
            metadata.report = JSON.parse(text) as SceneDocumentation;
          } catch (e) {
            console.error('Failed to parse embedded report JSON', e);
          }
        }
      }
    }

    // Skip Data and CRC (4 bytes)
    offset += length + 4;
  }

  return metadata;
};
