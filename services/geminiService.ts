
import { GoogleGenAI, Type } from "@google/genai";
import { 
  ArtDirectionRequest, ArtDirectionResponse, ColorOption, DesignPlan, 
  LayoutSuggestion, SeparatedAssets, QualityLevel, CostBreakdown, SubjectAsset,
  AspectRatio, ProductionModel, StockAiRequest, StockAiStyle, StockAiBackground
} from "../types";

// Sử dụng model Pro cho việc lập kế hoạch và sản xuất chất lượng cao
const MODEL_PLANNING = "gemini-3.1-pro-preview";
const MODEL_PRODUCTION_DEFAULT = ProductionModel.NANO_BANANA_2;

// Optimized Quality Boosters (Shorter but potent)
const QUALITY_BOOSTERS = "commercial advertising design, award winning, high fidelity, sharp text, premium lighting, 8k, clean edges";
// Optimized Negative Prompt
const NEGATIVE_PROMPT = "blurry, low quality, distortion, text errors, watermark, lowres, grainy, bad anatomy, noisy";

export const LAYOUT_TAG = "\n\n### DESIGN LAYOUT COORDINATES ###\n";

const extractBase64AndMime = (dataUrl: string | null): { mimeType: string, data: string } | null => {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2]
  };
};

// Hàm tiện ích: Resize ảnh base64 để giảm payload tránh lỗi 400 Payload Too Large
const resizeImageBase64 = (base64Str: string, maxWidth = 1536): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let { width, height } = img;
      // Chỉ resize nếu ảnh lớn hơn maxWidth
      if (width > maxWidth || height > maxWidth) {
        const ratio = Math.min(maxWidth / width, maxWidth / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      } else {
        resolve(base64Str); // Giữ nguyên nếu nhỏ
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Sử dụng PNG để giữ độ trong suốt (alpha channel)
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str); // Fallback nếu lỗi load ảnh
  });
};

const getGeminiClient = () => {
  // Ưu tiên key từ biến môi trường, sau đó đến localStorage (cho bản Vercel/Web)
  const apiKey = process.env.API_KEY || localStorage.getItem('MAP_API_KEY');
  
  if (!apiKey || apiKey.length < 10) {
    throw new Error("API Key chưa được cấu hình. Vui lòng nhập API Key tại màn hình đăng nhập.");
  }
  return new GoogleGenAI({ apiKey });
};

export const estimateRequestCost = (request: ArtDirectionRequest): CostBreakdown => {
    const baseCost = 500; // 500 VND cho phân tích
    let costPerImage = 1000;
    if (request.quality === QualityLevel.HIGH) costPerImage = 5000;
    else if (request.quality === QualityLevel.MEDIUM) costPerImage = 2500;
    
    const productionCost = request.batchSize * costPerImage;
    return {
        analysisInputTokens: 0, analysisOutputTokens: 0, analysisCostVND: baseCost,
        generationImageCount: request.batchSize, generationCostVND: productionCost,
        totalCostVND: baseCost + productionCost
    };
};

export const getClosestAspectRatio = (width: string, height: string): AspectRatio => {
  const w = parseFloat(width);
  const h = parseFloat(height);
  if (isNaN(w) || h === 0) return "1:1";
  const currentRatio = w / h;
  const supportedRatios: { label: AspectRatio, val: number }[] = [
    { label: "1:1", val: 1.0 }, { label: "3:4", val: 0.75 }, { label: "4:3", val: 1.3333 },
    { label: "9:16", val: 0.5625 }, { label: "16:9", val: 1.7777 },
    { label: "1:4", val: 0.25 }, { label: "1:8", val: 0.125 },
    { label: "4:1", val: 4.0 }, { label: "8:1", val: 8.0 }
  ];
  return supportedRatios.reduce((prev, curr) => Math.abs(curr.val - currentRatio) < Math.abs(prev.val - currentRatio) ? curr : prev).label;
};

export const getFinalAspectRatio = (ratio: AspectRatio, orientation: 'horizontal' | 'vertical'): AspectRatio => {
  if (ratio === '1:1') return '1:1';
  
  const parts = ratio.split(':');
  const w = parseInt(parts[0]);
  const h = parseInt(parts[1]);
  
  if (orientation === 'horizontal') {
    return w > h ? ratio : `${h}:${w}` as AspectRatio;
  } else {
    return w < h ? ratio : `${h}:${w}` as AspectRatio;
  }
};

export const generateArtDirection = async (request: ArtDirectionRequest): Promise<ArtDirectionResponse> => {
  const ai = getGeminiClient();
  const targetRatio = getClosestAspectRatio(request.width, request.height);
  let colorInstr = request.colorOption === ColorOption.BRAND_LOGO 
    ? "Use Brand Logo colors as primary." 
    : request.colorOption === ColorOption.CUSTOM ? `HEX: ${request.customColors.join(', ')}.` : "AI Custom professional colors.";

  // CMYK Instruction (Optimized)
  if (request.useCMYK) {
      colorInstr += " [CMYK MODE: Use print-safe gamut. No RGB neon/fluorescents. Rich, matte finish.]";
  }

  // OPTIMIZED TOKEN PROMPT
  const promptParts: any[] = [{ text: `
    ROLE: EXPERT ART DIRECTOR. TASK: CREATE DETAILED DESIGN PLAN.

    CONTENT (EXACT MATCH):
    1. Headline: "${request.mainHeadline}"
    2. Subtext: "${request.secondaryText}"
    NO extra text.

    SPECS:
    - Type: ${request.productType} (${request.width}cm x ${request.height}cm, Ratio: ${targetRatio})
    - Strategy: "${request.layoutRequirements}"
    - Style: ${request.visualStyle}
    - Colors: ${colorInstr}
    
    ANALYSIS (Map Refs):
    1. subject (Content): From 'Subject' refs. Product presentation?
    2. styleContext (Mood): From 'Style' refs. Env/Era?
    3. composition (Layout): From 'Composition' refs. Arrangement?
    4. colorLighting (Palette): From 'Color' refs. Light/Tone?
    5. decorElements (Details): From 'Decoration' refs. Shapes/Textures?
    6. typography (Font): From 'Typo' refs & attached image. Style/Weight?

    DYNAMIC LAYOUT RULES (AI SUGGESTED PLACEMENT):
    Generate suggested "Box Layout" positions based on the W/H ratio and print type.
    - Use PERCENTAGES (0 to 100) for all values (width, height, top, left).
    - "top" and "left" represent the distance from the top-left corner of the canvas.
    - Ensure (left + width) <= 100 and (top + height) <= 100.
    - CRITICAL: The 'final_prompt' field must NOT contain any percentages, coordinates, or 'x,y' symbols. It should be a pure descriptive prompt.

    ASSET HANDLING:
    - 'AI background removal': Isolate subject, place in new context.
  ` }];

  // Resize images before sending to Analysis to prevent 400 errors here as well
  for (let idx = 0; idx < request.logoImages.length; idx++) {
    const logo = request.logoImages[idx];
    const resizedLogo = await resizeImageBase64(logo);
    const data = extractBase64AndMime(resizedLogo);
    if (data) {
        promptParts.push({ text: `Brand Logo ${idx + 1} (Keep colors/shape):` });
        promptParts.push({ inlineData: data });
    }
  }

  if (request.typoReferenceImage) {
    const resizedTypo = await resizeImageBase64(request.typoReferenceImage);
    const data = extractBase64AndMime(resizedTypo);
    if (data) {
        promptParts.push({ text: "CRITICAL Typo Ref (Follow style):" });
        promptParts.push({ inlineData: data });
    }
  }

  // Process reference images sequentially to resize
  for (let idx = 0; idx < request.referenceImages.length; idx++) {
    const ref = request.referenceImages[idx];
    const resizedRef = await resizeImageBase64(ref.image);
    const data = extractBase64AndMime(resizedRef);
    if (data) {
        promptParts.push({ text: `Ref ${idx+1} (Attrs: ${ref.attributes.join(', ')}):` });
        promptParts.push({ inlineData: data });
    }
  }

  const response = await ai.models.generateContent({
    model: MODEL_PLANNING,
    contents: { parts: promptParts },
    config: {
      systemInstruction: "You are a professional Senior Art Director. Output JSON strictly following the 6-criteria Design Plan. Never change the provided input text.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          designPlan: { type: Type.OBJECT, properties: { subject: {type: Type.STRING}, styleContext: {type: Type.STRING}, composition: {type: Type.STRING}, colorLighting: {type: Type.STRING}, decorElements: {type: Type.STRING}, typography: {type: Type.STRING} }, required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] },
          layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["id", "name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
          dynamic_layout: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                id: {type: Type.STRING}, 
                width: {type: Type.NUMBER}, 
                height: {type: Type.NUMBER}, 
                top: {type: Type.NUMBER}, 
                left: {type: Type.NUMBER} 
              }, 
              required: ["id", "width", "height", "top", "left"] 
            } 
          },
          analysis: { type: Type.STRING },
          final_prompt: { type: Type.STRING },
          recommendedAspectRatio: { type: Type.STRING, enum: ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"] },
        },
        required: ["designPlan", "layout_suggestion", "analysis", "final_prompt", "recommendedAspectRatio"],
      }
    }
  });

  const result = JSON.parse(response.text) as ArtDirectionResponse;
  result.recommendedAspectRatio = targetRatio;
  result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
  return result;
};

export const suggestNewLayout = async (direction: ArtDirectionResponse, request: ArtDirectionRequest): Promise<LayoutSuggestion> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: MODEL_PLANNING,
    contents: { parts: [{ text: `Analyze Plan: ${JSON.stringify(direction.designPlan)} & directive: "${request.layoutRequirements}". Create NEW layout JSON. Ratio: ${direction.recommendedAspectRatio}. Output layout_suggestion only.` }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["id", "name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
        }
      }
    }
  });
  return JSON.parse(response.text).layout_suggestion;
};

export const generateDesignImage = async (prompt: string, aspectRatio: string, batchSize: number, imageSize: string, _assets: SubjectAsset[] = [], _logos: string[] = [], mask?: string | null, model: ProductionModel = MODEL_PRODUCTION_DEFAULT): Promise<string[]> => {
  const ai = getGeminiClient();
  
  // OPTIMIZED PRODUCTION PROMPT
  let fullTextPrompt = `${prompt} commercial design, high-end style.`;
  fullTextPrompt += " CRITICAL: Do NOT render any technical coordinates, percentages (%), or 'x,y' symbols as text in the image.";
  if (mask) fullTextPrompt += " Follow layout mask positions exactly.";
  if (_logos.length > 0) fullTextPrompt += ` Include ${_logos.length} brand logos.`;
  
  const imageParts: any[] = [];

  // Resize and prepare assets sequentially to ensure data integrity
  for (let idx = 0; idx < _assets.length; idx++) {
    const asset = _assets[idx];
    const resizedAsset = await resizeImageBase64(asset.image);
    const data = extractBase64AndMime(resizedAsset);
    if (data) {
      imageParts.push({ inlineData: data });
      if (asset.removeBackground) {
        fullTextPrompt += ` Asset ${idx + 1}: Digital cutout. Isolate subject, composite seamlessly. Ignore orig bg.`;
      } else {
        fullTextPrompt += ` Asset ${idx + 1}: Reference product look.`;
      }
    }
  }

  for (let idx = 0; idx < _logos.length; idx++) {
    const logo = _logos[idx];
    const resizedLogo = await resizeImageBase64(logo);
    const data = extractBase64AndMime(resizedLogo);
    if (data) {
      imageParts.push({ inlineData: data });
      fullTextPrompt += ` Logo ${idx + 1}: Brand identity.`;
    }
  }

  if (mask) {
    // Mask usually doesn't need high res, resize to save tokens
    const resizedMask = await resizeImageBase64(mask, 1024);
    const data = extractBase64AndMime(resizedMask);
    if (data) imageParts.push({ inlineData: data });
  }

  // Standard Multimodal structure: [TextPart, ImagePart1, ImagePart2, ...]
  const contents = {
    parts: [
      { text: `${fullTextPrompt}. Negative: ${NEGATIVE_PROMPT}` },
      ...imageParts
    ]
  };

  const urls: string[] = [];
  
  // EXECUTE SEQUENTIALLY to avoid 400/429 errors from concurrency on heavy image tasks
  for (let i = 0; i < batchSize; i++) {
    try {
      // Omit imageSize for gemini-2.5-flash-image as it's not officially supported and might cause 500 errors
      const imageConfig: any = { 
        aspectRatio: aspectRatio as any
      };
      
      if (model !== ProductionModel.NANO_BANANA) {
        imageConfig.imageSize = imageSize as any;
      }

      const result = await ai.models.generateContent({
        model: model,
        contents,
        config: { 
            imageConfig
        } 
      });
      const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData?.data) {
        urls.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    } catch (e) {
      console.error(`Production attempt ${i+1} failed:`, e);
      // We continue to try the next one even if one fails
    }
  }

  if (urls.length === 0) throw new Error("Tất cả nỗ lực sản xuất đều thất bại (400). Hãy kiểm tra lại API Key hoặc giảm độ phức tạp của brief.");
  return urls;
};

export const separateDesignComponents = async (_p: string, ar: string, sz: string, img: string): Promise<SeparatedAssets> => {
  const ai = getGeminiClient();
  const sourceData = extractBase64AndMime(img);
  if (!sourceData) throw new Error("Invalid image data.");

  const results: SeparatedAssets = { background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null };
  const tasks = [
    { 
      mode: 'bg', 
      p: "Extract background. Remove typo/logos. Keep decor/subjects/env. Pure static background." 
    },
    { 
      mode: 'txt', 
      p: "Extract text/logos only. Pure white background. No extra elements." 
    }
  ];

  const promises = tasks.map(async (t) => {
    const res = await ai.models.generateContent({
      model: MODEL_PRODUCTION_DEFAULT,
      contents: { parts: [{ text: t.p }, { inlineData: sourceData }]},
      config: { imageConfig: { aspectRatio: ar as any, imageSize: sz as any } },
    });
    return { mode: t.mode, data: res.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data };
  });

  const resArray = await Promise.all(promises);
  resArray.forEach(r => {
    if (r.mode === 'bg' && r.data) results.background = `data:image/png;base64,${r.data}`;
    if (r.mode === 'txt' && r.data) results.textLayer = `data:image/png;base64,${r.data}`;
  });
  return results;
};

export const removeObjectWithMask = async (source: string, mask: string, instr?: string): Promise<string | null> => {
    const ai = getGeminiClient();
    const sourceData = extractBase64AndMime(source);
    const maskData = extractBase64AndMime(mask);
    if (!sourceData || !maskData) return null;
    
    let prompt = `Eraser tool: ${instr || 'Remove and rebuild background.'}`;
    if (instr) {
        if (instr.startsWith('[ADD]')) {
            prompt = `Inpaint tool: Add the following to the masked area: ${instr.replace('[ADD]', '').trim()}. Ensure it blends perfectly with the environment, lighting, and perspective.`;
        } else if (instr.startsWith('[REPLACE]')) {
            prompt = `Inpaint tool: Replace the masked area with: ${instr.replace('[REPLACE]', '').trim()}. Remove the original object completely and seamlessly integrate the new object into the scene.`;
        } else if (instr.startsWith('[REMOVE]')) {
            prompt = `Eraser tool: Remove the object in the masked area: ${instr.replace('[REMOVE]', '').trim()}. Rebuild the background seamlessly as if the object was never there.`;
        }
    }
    
    const response = await ai.models.generateContent({
        model: MODEL_PRODUCTION_DEFAULT,
        contents: { parts: [{ text: prompt }, { inlineData: sourceData }, { inlineData: maskData }]}
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return data ? `data:image/png;base64,${data}` : null;
};

export const regeneratePromptFromPlan = async (plan: DesignPlan, req: ArtDirectionRequest, ar: string, lay: any): Promise<ArtDirectionResponse> => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
        model: MODEL_PLANNING,
        contents: { parts: [{ text: `Regenerate a production prompt and layout based on updated plan: ${JSON.stringify(plan)}. 
        Include dynamic_layout suggested boxes (percentages 0-100). 
        IMPORTANT: Do NOT include any percentages or coordinates in the 'final_prompt' field.` }] },
        config: {
            systemInstruction: "Expert Art Director. Output JSON. Ensure 'final_prompt' is a clean descriptive text without any layout numbers or percentages.",
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    designPlan: { type: Type.OBJECT, properties: { subject: {type: Type.STRING}, styleContext: {type: Type.STRING}, composition: {type: Type.STRING}, colorLighting: {type: Type.STRING}, decorElements: {type: Type.STRING}, typography: {type: Type.STRING} }, required: ["subject", "styleContext", "composition", "colorLighting", "decorElements", "typography"] },
                    layout_suggestion: { type: Type.OBJECT, properties: { canvas_ratio: {type: Type.STRING}, elements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, name: {type: Type.STRING}, type: {type: Type.STRING, enum: ["subject", "text", "decor", "logo"]}, color: {type: Type.STRING}, rect: { type: Type.OBJECT, properties: { x: {type: Type.NUMBER}, y: {type: Type.NUMBER}, width: {type: Type.NUMBER}, height: {type: Type.NUMBER} }, required: ["x", "y", "width", "height"] } }, required: ["id", "name", "type", "color", "rect"] } } }, required: ["canvas_ratio", "elements"] },
                    dynamic_layout: { 
                      type: Type.ARRAY, 
                      items: { 
                        type: Type.OBJECT, 
                        properties: { 
                          id: {type: Type.STRING}, 
                          width: {type: Type.NUMBER}, 
                          height: {type: Type.NUMBER}, 
                          top: {type: Type.NUMBER}, 
                          left: {type: Type.NUMBER} 
                        }, 
                        required: ["id", "width", "height", "top", "left"] 
                      } 
                    },
                    analysis: { type: Type.STRING },
                    final_prompt: { type: Type.STRING },
                    recommendedAspectRatio: { type: Type.STRING, enum: ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"] },
                },
                required: ["designPlan", "layout_suggestion", "analysis", "final_prompt", "recommendedAspectRatio"],
            },
        },
    });
    const result = JSON.parse(response.text) as ArtDirectionResponse;
    result.recommendedAspectRatio = ar as any;
    result.final_prompt = `${result.final_prompt}, ${QUALITY_BOOSTERS}`;
    return result;
};

export const processAiTemplate = async (
    source: string, 
    mask: string | null, 
    instr: string, 
    targetAspectRatio?: string
): Promise<string | null> => {
    const ai = getGeminiClient();
    const sourceData = extractBase64AndMime(source);
    if (!sourceData) return null;
    
    const parts: any[] = [];
    
    let prompt = instr || 'Enhance and recreate this design.';
    
    if (mask) {
        const maskData = extractBase64AndMime(mask);
        if (maskData) {
            parts.push({ inlineData: maskData });
            prompt = `Inpaint/Eraser tool: ${instr}. If removing, rebuild the background seamlessly. If adding, blend it perfectly with the environment.`;
        }
    }
    
    if (targetAspectRatio) {
        prompt += `\nIMPORTANT: The output MUST be in ${targetAspectRatio} aspect ratio. If the original image has a different aspect ratio, you MUST outpaint and extend the background seamlessly to fit the new aspect ratio without cropping the original content.`;
    }

    parts.unshift({ inlineData: sourceData });
    parts.unshift({ text: prompt });

    const config: any = {};
    if (targetAspectRatio) {
        config.imageConfig = { aspectRatio: targetAspectRatio };
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: Object.keys(config).length > 0 ? config : undefined
    });
    
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return data ? `data:image/png;base64,${data}` : null;
};

export const upscaleImageTo4K = async (image: string, ratio: AspectRatio | string, orientation?: 'horizontal' | 'vertical'): Promise<string> => {
  const ai = getGeminiClient();
  const sourceData = extractBase64AndMime(image);
  if (!sourceData) throw new Error("Invalid image data.");

  const finalRatio = orientation ? getFinalAspectRatio(ratio as AspectRatio, orientation) : ratio;

  const response = await ai.models.generateContent({
    model: MODEL_PRODUCTION_DEFAULT,
    contents: {
      parts: [
        { text: "Upscale to 4K, maintain fidelity." },
        { inlineData: sourceData }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: finalRatio as any,
        imageSize: "4K"
      }
    }
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part?.inlineData?.data) throw new Error("Upscale failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const generateStockAiImages = async (request: StockAiRequest): Promise<string[]> => {
  const ai = getGeminiClient();
  
  let prompt = request.subjectDescription || "Generate design material";
  
  if (request.additionalStyles && request.additionalStyles.length > 0) {
    const styles = request.additionalStyles.filter(s => s !== StockAiStyle.AI_AUTO).join(", ");
    if (styles) {
      prompt += `. Style: ${styles}`;
    }
  }

  if (request.isBlackAndWhite) {
    prompt += `. Color palette: Black and white, monochrome, grayscale.`;
  } else if (request.colors && request.colors.length > 0) {
    if (request.keepOriginalColors) {
      prompt += `. Color palette: Use the exact colors from the input references.`;
    } else {
      prompt += `. Color palette: ${request.colors.join(", ")}`;
    }
  }

  if (request.background === StockAiBackground.WHITE) {
    prompt += `. Pure white background`;
  } else {
    prompt += `. Creative background`;
  }

  const imageParts: any[] = [];

  if (request.styleImage) {
    const resizedStyle = await resizeImageBase64(request.styleImage);
    const data = extractBase64AndMime(resizedStyle);
    if (data) {
      imageParts.push({ inlineData: data });
      prompt += `. Use this image as style reference.`;
    }
  }

  if (request.shapeImage) {
    const resizedShape = await resizeImageBase64(request.shapeImage);
    const data = extractBase64AndMime(resizedShape);
    if (data) {
      imageParts.push({ inlineData: data });
      if (request.keepOriginalShape) {
        prompt += `. Strictly maintain the exact shape, silhouette, and outline of the provided shape reference image. Do not alter the core shape.`;
      } else {
        prompt += `. Use this image as shape/composition reference.`;
      }
    }
  }

  const contents = {
    parts: [
      { text: `${prompt}. High quality, detailed.` },
      ...imageParts
    ]
  };

  const urls: string[] = [];
  const finalRatio = getFinalAspectRatio(request.ratio, request.orientation);
  
  for (let i = 0; i < request.outputs; i++) {
    try {
      const imageConfig: any = { 
        aspectRatio: finalRatio as any
      };
      
      if (request.model !== ProductionModel.NANO_BANANA) {
        imageConfig.imageSize = "1K";
      }

      const result = await ai.models.generateContent({
        model: request.model,
        contents,
        config: { 
            imageConfig
        } 
      });
      const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData?.data) {
        urls.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    } catch (e) {
      console.error(`Stock AI generation attempt ${i+1} failed:`, e);
    }
  }

  if (urls.length === 0) throw new Error("Failed to generate Stock AI images.");
  return urls;
};

export const modifyStockAiImage = async (sourceImage: string, instruction: string, ratio: AspectRatio, orientation: 'horizontal' | 'vertical', model: ProductionModel): Promise<string> => {
  const ai = getGeminiClient();
  const sourceData = extractBase64AndMime(sourceImage);
  if (!sourceData) throw new Error("Invalid image data.");

  const finalRatio = getFinalAspectRatio(ratio, orientation);

  const imageConfig: any = { 
    aspectRatio: finalRatio as any
  };
  
  if (model !== ProductionModel.NANO_BANANA) {
    imageConfig.imageSize = "1K";
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { text: `Modify this image: ${instruction}. Keep the original composition.` },
        { inlineData: sourceData }
      ]
    },
    config: {
      imageConfig
    }
  });

  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part?.inlineData?.data) throw new Error("Modification failed.");
  return `data:image/png;base64,${part.inlineData.data}`;
};

export const convertLayoutToPrompt = (layout: LayoutSuggestion): string => {
  let prompt = LAYOUT_TAG;
  prompt += "SPATIAL LAYOUT INSTRUCTIONS (DO NOT RENDER THESE NUMBERS AS TEXT):\n";
  layout.elements.forEach(el => {
    prompt += `- Place ${el.name} (${el.type}) at approximately ${Math.round(el.rect.x)}% from left and ${Math.round(el.rect.y)}% from top.\n`;
  });
  return prompt;
};
