
import { GoogleGenAI, Type } from "@google/genai";
import { SceneDocumentation, PromptAnalysis, QualityIssue, Annotation } from "../types";

// Helper to get effective API key from local storage
const getApiKey = (): string => {
  return localStorage.getItem('gemini_api_key') || '';
};

export const generateSceneDocumentation = async (
  imageBase64: string,
  workflowJson: string,
  promptJson: string
): Promise<SceneDocumentation> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_NOT_FOUND");

  const ai = new GoogleGenAI({ apiKey });
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      sceneOverview: {
        type: Type.ARRAY,
        description: "List of visual attributes. Categories should be 'Subject', 'Lighting', 'Composition', 'Style', etc.",
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            details: { type: Type.STRING }
          },
          required: ["category", "details"]
        }
      },
      qualityAnalysis: {
        type: Type.OBJECT,
        description: "Analysis of image artifacts.",
        properties: {
            overallScore: { type: Type.NUMBER, description: "Strictly calculated as: 10 - Sum(issues.score)." },
            issues: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        description: { type: Type.STRING },
                        severity: { type: Type.STRING, enum: ['Critical', 'Major', 'Minor', 'Note'] },
                        score: { type: Type.NUMBER },
                        suggestedFixes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Optional [ymin, xmin, ymax, xmax] if issue is localized" },
                        style: { type: Type.STRING, enum: ['box', 'paint'] }
                    },
                    required: ["type", "description", "severity", "score", "suggestedFixes"]
                }
            }
        },
        required: ["overallScore", "issues"]
      },
      promptAnalysis: {
        type: Type.OBJECT,
        description: "Analysis of how well the image matches the intended prompt.",
        properties: {
            adherenceScore: { type: Type.NUMBER },
            critique: { type: Type.STRING },
            improvements: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }
            }
        },
        required: ["adherenceScore", "critique", "improvements"]
      },
      workflowAnalysis: {
        type: Type.ARRAY,
        description: "Step-by-step analysis of the workflow graph.",
        items: { type: Type.STRING }
      },
      parameters: {
        type: Type.OBJECT,
        properties: {
          seed: { type: Type.STRING },
          steps: { type: Type.NUMBER },
          cfg: { type: Type.NUMBER },
          sampler: { type: Type.STRING },
          scheduler: { type: Type.STRING },
          denoise: { type: Type.NUMBER },
          model: { type: Type.STRING },
          vae: { type: Type.STRING }
        },
        required: ["seed", "steps", "cfg", "sampler", "scheduler"]
      },
      prompts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["label", "text"]
        }
      },
      negativePrompt: { type: Type.STRING }
    },
    required: ["sceneOverview", "qualityAnalysis", "promptAnalysis", "workflowAnalysis", "parameters", "prompts", "negativePrompt"]
  };

  const prompt = `
    Role: Expert Computer Vision and Stable Diffusion Quality Assurance Specialist.
    Task: DEEP PIXEL-LEVEL FORENSIC ANALYSIS of the provided image.
    
    Workflow Data: ${workflowJson.substring(0, 15000)}
    Metadata: ${promptJson.substring(0, 5000)}

    Rules:
    - Identify specific quality issues (anatomy, texture, lighting).
    - Provide unique 'suggestedFixes' for every quality issue.
    - Score adherence 1-10.
    - If an issue is localized to a specific area (like a hand, face, or artifact), provide the 2D bounding box (ymin, xmin, ymax, xmax).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }, { text: prompt }],
      },
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text) as SceneDocumentation;
      // Initialize confidence to 100 for single pass
      if (parsed.qualityAnalysis?.issues) {
        parsed.qualityAnalysis.issues.forEach(issue => {
          issue.confidence = 100;
          issue.passCount = 1;
        });
      }
      return parsed;
    }
    throw new Error("Empty response from AI");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found") || error.message?.includes("API_KEY_NOT_FOUND")) {
      throw new Error("API_KEY_NOT_FOUND");
    }
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate documentation.");
  }
};

export const runConsensusQualityAnalysis = async (
  imageBase64: string,
  passCount: number
): Promise<QualityIssue[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_NOT_FOUND");
  const ai = new GoogleGenAI({ apiKey });

  // 1. Run N parallel passes using Flash (faster)
  const passPromises = Array(passCount).fill(0).map(() => 
    ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }, { text: "List all visual quality issues, artifacts, or anatomical errors in this image." }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             issues: { 
               type: Type.ARRAY, 
               items: { type: Type.OBJECT, properties: { description: { type: Type.STRING } } } 
             }
          }
        }
      }
    })
  );

  const results = await Promise.all(passPromises);
  const allRawIssues = results
    .map(r => JSON.parse(r.text || "{}").issues || [])
    .flat()
    .map((i: any) => i.description)
    .join("\n");

  // 2. Run Judge Pass using Pro (smarter) to consolidate
  const judgePrompt = `
    You are a Consensus Algorithm. 
    I ran ${passCount} separate analysis passes on an image. Here are the combined raw findings:
    
    ${allRawIssues}
    
    Task:
    1. Group identical or semantically similar issues.
    2. Calculate 'confidence' (percentage 0-100) based on how many times the issue appeared across the ${passCount} passes. (e.g. if found in 2 of 3 passes, confidence is 66).
    3. Return a clean, consolidated list.
    4. Provide specific technical 'suggestedFixes' for each issue.
    5. Assign severity and a score penalty (0.1 - 2.0).
    6. **CRITICAL**: For each issue, identify its location in the image. Provide a 2D bounding box [ymin, xmin, ymax, xmax] (normalized 0-1). If the issue is global (e.g. "blurry"), leave box_2d empty.
    7. Select 'box' style for distinct objects, 'paint' for surface textures.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }, { text: judgePrompt }],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          issues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ['Critical', 'Major', 'Minor', 'Note'] },
                score: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER, description: "Percentage 0-100" },
                suggestedFixes: { type: Type.ARRAY, items: { type: Type.STRING } },
                box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "[ymin, xmin, ymax, xmax]" },
                style: { type: Type.STRING, enum: ['box', 'paint'] }
              },
              required: ["type", "description", "severity", "score", "confidence", "suggestedFixes"]
            }
          }
        }
      },
      thinkingConfig: { thinkingBudget: 1024 }
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  return (parsed.issues || []).map((i: QualityIssue) => ({
    ...i,
    passCount: passCount,
    id: crypto.randomUUID()
  }));
};

export const generateIssueFix = async (
  imageBase64: string,
  issue: QualityIssue
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "API Key missing.";
  
  const ai = new GoogleGenAI({ apiKey });
  const responseSchema = {
    type: Type.OBJECT,
    properties: { fix: { type: Type.STRING } },
    required: ["fix"]
  };

  const prompt = `
    Context: Stable Diffusion/ComfyUI Image Analysis.
    Issue Type: ${issue.type}
    Description: ${issue.description}
    User Context/Notes: ${issue.userNotes || "None provided."}

    Task: Provide a single, concise technical fix or actionable suggestion for this issue.
    CRITICAL: If the User Context/Notes explain that this element is intentional (e.g., "The character is an alien", "Stylized distortion"), 
    your fix should validate that intention or offer a way to refine it without "fixing" it as an error. 
    If the note clarifies it is NOT an issue, return "No fix needed (User Verified)".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }, { text: prompt }],
      },
      config: { responseMimeType: 'application/json', responseSchema: responseSchema },
    });

    if (response.text) return JSON.parse(response.text).fix;
    throw new Error("Empty response");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_NOT_FOUND");
    }
    return "Could not generate fix.";
  }
};

export const generateIssuesFromNotes = async (
    imageBase64: string,
    notes: string,
    referenceImages: string[] = []
  ): Promise<QualityIssue[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API_KEY_NOT_FOUND");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Construct parts array
    const parts: any[] = [
        { inlineData: { mimeType: 'image/png', data: imageBase64 } }
    ];

    // Add reference images
    referenceImages.forEach(img => {
        parts.push({ inlineData: { mimeType: 'image/png', data: img } });
    });

    const prompt = `
      The user has provided the following notes/observations about this image:
      "${notes}"

      INPUT INFORMATION:
      - The FIRST image provided is the GENERATED IMAGE that needs analysis.
      - Any SUBSEQUENT images are USER-PROVIDED REFERENCES to explain their intent or show what they wanted. Use them to understand the "Idea" or "Style" aimed for.
  
      Task: 
      1. Analyze the generated image in the context of these notes and references.
      2. Convert actionable points from these notes into formal technical quality issues or suggestions.
      3. If the note describes a defect, categorize it and suggest a fix.
      4. If the note describes an idea supported by reference images, format it as a 'Note' severity item with implementation suggestions on how to achieve that look better.
    `;

    parts.push({ text: prompt });
  
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        issues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              description: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['Critical', 'Major', 'Minor', 'Note'] },
              score: { type: Type.NUMBER },
              suggestedFixes: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["type", "description", "severity", "score", "suggestedFixes"]
          }
        }
      }
    };
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: parts,
        },
        config: { responseMimeType: 'application/json', responseSchema: responseSchema },
      });
  
      if (response.text) {
          const parsed = JSON.parse(response.text);
          return (parsed.issues || []).map((i: QualityIssue) => ({
              ...i,
              confidence: 100,
              passCount: 1,
              id: crypto.randomUUID(),
              userNotes: "Generated from Scene Notes"
          }));
      }
      throw new Error("Empty response");
    } catch (error: any) {
       if (error.message?.includes("Requested entity was not found")) {
        throw new Error("API_KEY_NOT_FOUND");
      }
      throw new Error("Failed to generate issues from notes.");
    }
  };

export const refreshPromptAnalysis = async (
  imageBase64: string,
  currentDoc: SceneDocumentation
): Promise<PromptAnalysis> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_NOT_FOUND");
  
  const ai = new GoogleGenAI({ apiKey });
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
        adherenceScore: { type: Type.NUMBER },
        critique: { type: Type.STRING },
        improvements: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["adherenceScore", "critique", "improvements"]
  };

  const prompt = `Update the Prompt Engineering analysis based on these issues: ${JSON.stringify(currentDoc.qualityAnalysis)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }, { text: prompt }],
      },
      config: { responseMimeType: 'application/json', responseSchema: responseSchema },
    });

    if (response.text) return JSON.parse(response.text) as PromptAnalysis;
    throw new Error("Empty response");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_NOT_FOUND");
    }
    throw new Error("Failed to refresh analysis.");
  }
};

export const askQuestion = async (
  imageBase64: string,
  currentDoc: SceneDocumentation,
  question: string
): Promise<{ answer: string; annotations?: Annotation[]; updates?: { critique?: string; newImprovements?: string[] } }> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_NOT_FOUND");
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Updated Schema to include annotations
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      answer: { type: Type.STRING },
      annotations: {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              properties: {
                  label: { type: Type.STRING },
                  style: { type: Type.STRING, enum: ['box', 'paint'], description: "Use 'box' for discrete objects (hands, faces) and 'paint' for surface issues (texture, lighting)." },
                  box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Normalized [ymin, xmin, ymax, xmax]" }
              },
              required: ["label", "style", "box_2d"]
          }
      },
      updates: {
        type: Type.OBJECT,
        properties: {
          critique: { type: Type.STRING },
          newImprovements: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    },
    required: ["answer"]
  };

  const prompt = `
    User question: "${question}". 
    Current analysis: ${JSON.stringify(currentDoc.promptAnalysis)}
    
    If the user's question relates to a specific visual element or defect in the image:
    1. Provide 2D bounding box coordinates (ymin, xmin, ymax, xmax) normalized to 0-1.
    2. Choose 'box' style for objects (outlines) or 'paint' style for surface areas (translucent fill).
    3. Ensure the annotation does not obscure the issue itself (the paint should be translucent).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }, { text: prompt }],
      },
      config: { responseMimeType: 'application/json', responseSchema: responseSchema },
    });

    if (response.text) return JSON.parse(response.text);
    throw new Error("Empty response");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_NOT_FOUND");
    }
    throw new Error("Failed to get answer.");
  }
};
