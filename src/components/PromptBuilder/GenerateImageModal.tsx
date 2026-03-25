import React, { useState } from 'react';
import { X, Download, Loader2, Sparkles, Image as ImageIcon, Code } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface GenerateImageModalProps {
  prompt: string;
  onClose: () => void;
}

export const GenerateImageModal: React.FC<GenerateImageModalProps> = ({ prompt, onClose }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [svgCode, setSvgCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateImage = async () => {
    setIsGenerating(true);
    setError(null);
    setImageUrl(null);
    setSvgCode(null);
    setHasGenerated(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      if (format === 'png') {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: prompt }]
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K"
            }
          }
        });
        
        let base64 = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
        
        if (base64) {
          setImageUrl(base64);
        } else {
          setError('Не удалось сгенерировать изображение. Попробуйте изменить промпт.');
        }
      } else {
        // SVG generation
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: `You are an expert SVG designer. Create a beautiful, scalable, and clean SVG vector graphic based on this prompt: "${prompt}".
          
          Requirements:
          1. Output ONLY valid SVG code.
          2. Do NOT wrap it in markdown code blocks (no \`\`\`svg).
          3. Ensure it has a proper viewBox (e.g., viewBox="0 0 512 512").
          4. Use semantic SVG elements and clean styling.
          5. The design should be high quality and visually appealing.`,
          config: {
            temperature: 0.7,
          }
        });

        let text = response.text || '';
        // Clean up markdown if the model ignored the instruction
        text = text.replace(/```svg\n?/gi, '').replace(/```\n?/g, '').trim();
        
        if (text.startsWith('<svg') && text.endsWith('</svg>')) {
          setSvgCode(text);
        } else {
          setError('Не удалось сгенерировать валидный SVG код.');
        }
      }
    } catch (e) {
      console.error(e);
      setError('Произошла ошибка при генерации. Возможно, промпт нарушает правила безопасности.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (format === 'png' && imageUrl) {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (format === 'svg' && svgCode) {
      const blob = new Blob([svgCode], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-vector-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
            <Sparkles size={20} className="text-purple-500" />
            Генерация изображения
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Controls */}
          <div className="flex flex-col gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Формат</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormat('png')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    format === 'png' 
                      ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <ImageIcon size={16} />
                  PNG (Растр)
                </button>
                <button
                  onClick={() => setFormat('svg')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    format === 'svg' 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <Code size={16} />
                  SVG (Вектор)
                </button>
              </div>
            </div>
            
            <button
              onClick={generateImage}
              disabled={isGenerating}
              className="w-full py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {isGenerating ? 'Генерация...' : 'Сгенерировать'}
            </button>
          </div>

          {/* Result Area */}
          <div className="flex flex-col items-center justify-center min-h-[300px] bg-zinc-50 rounded-xl border border-zinc-200 p-6">
            {!hasGenerated && !isGenerating ? (
              <div className="text-center text-zinc-500">
                <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                <p>Выберите формат и нажмите "Сгенерировать"</p>
              </div>
            ) : isGenerating ? (
              <div className="flex flex-col items-center gap-4 text-zinc-500">
                <Loader2 size={40} className="animate-spin text-purple-500" />
                <p className="text-sm font-medium animate-pulse">Создаем шедевр...</p>
                <p className="text-xs text-zinc-400 max-w-md text-center line-clamp-2 mt-2">
                  {prompt}
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-4 text-red-500 max-w-md text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <X size={32} className="text-red-500" />
                </div>
                <p className="font-medium">{error}</p>
              </div>
            ) : (format === 'png' && imageUrl) || (format === 'svg' && svgCode) ? (
              <div className="w-full flex flex-col items-center gap-6">
                <div className="relative group w-full max-w-md aspect-square rounded-lg overflow-hidden shadow-md bg-white flex items-center justify-center">
                  {format === 'png' && imageUrl && (
                    <img 
                      src={imageUrl} 
                      alt="Generated" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {format === 'svg' && svgCode && (
                    <div 
                      className="w-full h-full flex items-center justify-center p-4"
                      dangerouslySetInnerHTML={{ __html: svgCode }}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 rounded-lg font-medium hover:bg-zinc-100 transition-colors shadow-lg transform translate-y-4 group-hover:translate-y-0 duration-200"
                    >
                      <Download size={18} />
                      Скачать {format.toUpperCase()}
                    </button>
                  </div>
                </div>
                <div className="w-full max-w-md bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Промпт</p>
                  <p className="text-sm text-zinc-800 line-clamp-3" title={prompt}>{prompt}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
