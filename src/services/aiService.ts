import { GoogleGenAI, Type } from "@google/genai";
import { Category, SuggestedToken } from "../types";

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

export const analyzePromptForTokens = async (
  prompt: string,
  categories: Category[],
  modelName: string = "gemini-3.1-pro-preview"
): Promise<SuggestedToken[]> => {
  if (!prompt.trim()) return [];
  try {
    const ai = getAiClient();
    if (!ai) {
      return [];
    }

    // Build a map of category paths for better AI understanding
    const getCategoryPath = (catId: string): string => {
      const cat = categories.find(c => c.id === catId);
      if (!cat) return '';
      if (cat.parentId) {
        return `${getCategoryPath(cat.parentId)} > ${cat.name}`;
      }
      return cat.name;
    };

    const categoriesWithPath = categories.map(c => ({
      id: c.id,
      name: c.name,
      fullPath: getCategoryPath(c.id)
    }));

    const categoriesJson = JSON.stringify(categoriesWithPath);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are an expert AI prompt engineer and database curator.
      The user has provided a prompt: "${prompt}".
      
      Your task is to extract meaningful words, phrases, or concepts from this prompt that would make good reusable "tokens" in a prompt-building database.
      For each extracted token, you need to:
      1. Provide a clear, concise name (usually the extracted word/phrase itself).
      2. Provide a short description in Russian (descriptionShort).
      3. Suggest 1 to 3 categories for this token from the provided list of existing categories. A token often belongs to multiple categories (e.g., a specific camera lens might belong to "Photography", "Equipment", and "Lenses"). 
         - Use the provided "fullPath" to understand the category hierarchy.
         - If no existing category fits well, suggest new category names (and leave their corresponding IDs empty).
      4. Provide a confidence score (0.0 to 1.0) on how good of a token this is and how confident you are in the categorization.
      5. Provide 1-3 aliases (synonyms or related terms).
      6. Provide 1-3 word forms (e.g., plurals, adjectives).
      7. Provide 1-2 example usages in a prompt.
      
      Existing Categories with their full paths:
      ${categoriesJson}
      
      Return a JSON array of objects. Each object must have:
      - name: string
      - descriptionShort: string (in Russian)
      - categoryIds: array of strings (IDs of the best matching existing categories, or empty strings if suggesting new ones)
      - categoryNames: array of strings (Names of the matched categories, or the names of the new suggested categories. MUST include full paths if possible, e.g. "Photography > Lenses")
      - confidence: number (0.0 to 1.0)
      - aliases: array of strings
      - wordForms: array of strings
      - examples: array of strings`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              descriptionShort: { type: Type.STRING },
              categoryIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              categoryNames: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidence: { type: Type.NUMBER },
              aliases: { type: Type.ARRAY, items: { type: Type.STRING } },
              wordForms: { type: Type.ARRAY, items: { type: Type.STRING } },
              examples: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["name", "descriptionShort", "categoryIds", "categoryNames", "confidence", "aliases", "wordForms", "examples"]
          }
        },
        temperature: 0.2,
      }
    });

    const text = response.text || '[]';
    const parsed = JSON.parse(text) as any[];
    
    return parsed.map((item, index) => ({
      id: `suggested_${Date.now()}_${index}`,
      name: item.name,
      descriptionShort: item.descriptionShort,
      categoryIds: item.categoryIds || [],
      categoryNames: item.categoryNames || [],
      confidence: item.confidence,
      aliases: item.aliases || [],
      wordForms: item.wordForms || [],
      examples: item.examples || []
    }));
  } catch (error) {
    console.error("Error analyzing prompt for tokens:", error);
    return [];
  }
};

export const highlightPromptNodes = async (
  nodes: { id: string; text: string }[],
  query: string,
  modelName: string = "gemini-3-flash-preview"
): Promise<Record<string, 'strong' | 'medium' | 'weak' | 'none'>> => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return {};
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are an AI assistant analyzing an image generation prompt. 
The user wants to find parts of the prompt related to: "${query}".

Here are the parts (nodes) of the prompt:
${JSON.stringify(nodes, null, 2)}

For each node, determine how strongly it relates to the user's query:
- "strong": Explicitly and directly related.
- "medium": Implicitly or indirectly related.
- "weak": Uncertain or weakly related.
- "none": Not related at all.

Return a JSON array of objects, where each object has "id" (the node ID) and "strength" ("strong", "medium", "weak", or "none").`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              strength: { type: Type.STRING, description: "One of: strong, medium, weak, none" }
            },
            required: ["id", "strength"]
          }
        },
        temperature: 0.1,
      }
    });

    const text = response.text || '[]';
    const parsed = JSON.parse(text) as { id: string, strength: 'strong' | 'medium' | 'weak' | 'none' }[];
    
    const result: Record<string, 'strong' | 'medium' | 'weak' | 'none'> = {};
    for (const item of parsed) {
      result[item.id] = item.strength;
    }
    return result;
  } catch (error) {
    console.error("Error highlighting prompt nodes:", error);
    return {};
  }
};

export const suggestReplacements = async (word: string, context: string, modelName: string = "gemini-3-flash-preview"): Promise<string[]> => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return [];
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are a helpful assistant. Provide 3-5 synonyms or alternative phrases for the word "${word}" in the context of an image generation prompt: "${context}". Return ONLY a comma-separated list of the suggestions, nothing else.`,
      config: {
        temperature: 0.7,
      }
    });

    const text = response.text || '';
    return text.split(',').map(s => s.trim()).filter(Boolean);
  } catch (error) {
    console.error("Error suggesting replacements:", error);
    return [];
  }
};

export const translatePrompt = async (prompt: string, modelName: string = "gemini-3-flash-preview"): Promise<string> => {
  if (!prompt.trim()) return '';
  try {
    const ai = getAiClient();
    if (!ai) {
      return prompt;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Translate the following image generation prompt into Russian. Keep the technical terms (like '8k', 'octane render', 'unreal engine') in English if they don't have a good Russian equivalent, but translate the descriptive parts. Return ONLY the translated text.\n\nPrompt: ${prompt}`,
      config: {
        temperature: 0.3,
      }
    });
    return response.text || '';
  } catch (error) {
    console.error("Error translating prompt:", error);
    return 'Ошибка перевода';
  }
};

export const reviewPrompt = async (nodes: { id: string, text: string }[], query: string, modelName: string = "gemini-3.1-pro-preview"): Promise<any[]> => {
  if (nodes.length === 0 || !query.trim()) return [];
  try {
    const ai = getAiClient();
    if (!ai) {
      return [];
    }

    const promptText = nodes.map(n => n.text).join(' ');
    const nodesJson = JSON.stringify(nodes.map(n => ({ id: n.id, text: n.text })));

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are an expert AI prompt engineer. The user has an image generation prompt and wants to improve it based on this request: "${query}".
      
      Analyze the prompt and suggest specific changes (additions, removals, replacements, or moves) to fulfill the user's request.
      
      Current Prompt Nodes:
      ${nodesJson}
      
      Return a JSON array of suggestion objects. Each object must have:
      - id: a unique string ID
      - type: "add", "remove", "replace", or "move"
      - targetNodeIds: an array of node IDs that are being removed, replaced, or moved (empty for "add")
      - targetText: the text being affected (for reference)
      - newText: the new text to add, or the replacement text (leave empty for "remove")
      - reason: a short explanation in Russian of why this change improves the prompt according to the user's request.
      
      IMPORTANT: 
      1. When replacing or removing, make sure to list ALL relevant node IDs in targetNodeIds.
      2. For "add", provide the new text.
      3. For "replace", provide the new text that should replace the target nodes. The new text can be multiple words; the system will parse it.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, description: "One of: add, remove, replace, move" },
              targetNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetText: { type: Type.STRING },
              newText: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["id", "type", "reason"]
          }
        },
        temperature: 0.7,
      }
    });

    const text = response.text || '[]';
    return JSON.parse(text);
  } catch (error) {
    console.error("Error reviewing prompt:", error);
    return [];
  }
};

export const optimizePrompt = async (prompt: string, modelName: string = "gemini-3-flash-preview"): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return prompt;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a professional prompt engineer. Your task is to take a raw list of tokens and phrases and turn them into a high-quality, well-structured prompt for image generation (like Midjourney, Stable Diffusion, etc.).
              
              Rules:
              1. Fix spelling, grammar, and punctuation errors.
              2. Use professional prompt-engineering techniques (e.g., using descriptive adjectives, lighting terms, camera angles).
              3. Maintain the original meaning and all key elements provided.
              4. If the input is already well-structured, just polish it.
              5. Output ONLY the optimized prompt text, nothing else.
              
              Input: ${prompt}`
            }
          ]
        }
      ],
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      }
    });

    return response.text || prompt;
  } catch (error) {
    console.error("Error optimizing prompt:", error);
    return prompt;
  }
};
