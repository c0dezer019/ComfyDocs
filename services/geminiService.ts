
import { GoogleGenAI, Type } from "@google/genai";
import { SceneDocumentation, PromptAnalysis, QualityIssue } from "../types";

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
                        severity: { type: Type.STRING, enum: ['Critical', 'Major', 'Minor'] },
                        score: { type: Type.NUMBER },
                        suggestedFix: { type: Type.STRING }
                    },
                    required: ["type", "description", "severity", "score", "suggestedFix"]
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
    - Provide a unique 'suggestedFix' for every quality issue.
    - Score adherence 1-10.
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

    if (response.text) return JSON.parse(response.text) as SceneDocumentation;
    throw new Error("Empty response from AI");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found") || error.message?.includes("API_KEY_NOT_FOUND")) {
      throw new Error("API_KEY_NOT_FOUND");
    }
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate documentation.");
  }
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

  const prompt = `Provide a single, concise technical fix for this Stable Diffusion issue: ${issue.type} - ${issue.description}`;

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
): Promise<{ answer: string; updates?: { critique?: string; newImprovements?: string[] } }> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_NOT_FOUND");
  
  const ai = new GoogleGenAI({ apiKey });
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      answer: { type: Type.STRING },
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

  const prompt = `User question: "${question}". Current analysis: ${JSON.stringify(currentDoc.promptAnalysis)}`;

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
