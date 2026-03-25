import React, { useState } from 'react';
import { X, Upload, Sparkles, Search, Sun, Palette, Camera, Box, Monitor, LayoutGrid } from 'lucide-react';
import { fileToBase64 } from '../utils/fileUtils';
import { GoogleGenAI } from '@google/genai';

const PREDEFINED_ICONS = ['Sun', 'Palette', 'Camera', 'Box', 'Sparkles', 'Monitor', 'LayoutGrid'];

const iconMap: Record<string, React.ReactNode> = {
  Sun: <Sun size={20} />,
  Palette: <Palette size={20} />,
  Camera: <Camera size={20} />,
  Box: <Box size={20} />,
  Sparkles: <Sparkles size={20} />,
  Monitor: <Monitor size={20} />,
  LayoutGrid: <LayoutGrid size={20} />
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (icon: string) => void;
}

export const IconPickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [tab, setTab] = useState<'find' | 'generate' | 'upload'>('find');
  const [format, setFormat] = useState<'svg' | 'png'>('svg');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      onSelect(base64);
      onClose();
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const ai = new GoogleGenAI({ apiKey });

      if (format === 'png') {
        // Create a reference image of existing icons (Box, Sun, Camera) to show the style
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 72 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <g transform="translate(0, 0)">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
          </g>
          <g transform="translate(24, 0)">
            <circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>
          </g>
          <g transform="translate(48, 0)">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle>
          </g>
        </svg>`;
        
        const referenceBase64 = await new Promise<string>((resolve) => {
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, 300, 100);
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png').split(',')[1]);
            }
            URL.revokeObjectURL(url);
          };
          img.src = url;
        });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: referenceBase64,
                  mimeType: 'image/png'
                }
              },
              { 
                text: `Generate a single new icon for "${prompt}". The new icon MUST be in the EXACT same style as the provided reference image: minimalist, line-art, black stroke on white background, no fill, 2px stroke width, simple vector style, centered.` 
              }
            ]
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
          onSelect(base64);
          onClose();
        } else {
          alert('Не удалось сгенерировать PNG иконку');
        }
      } else {
        // SVG Generation
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: `You are an expert SVG designer. Create a minimalist, line-art icon for "${prompt}".
          It must be a valid SVG string.
          Requirements:
          - viewBox="0 0 24 24"
          - fill="none"
          - stroke="currentColor"
          - stroke-width="2"
          - stroke-linecap="round"
          - stroke-linejoin="round"
          - Only output the raw <svg>...</svg> code, no markdown formatting, no explanations.`,
          config: {
            temperature: 0.7,
          }
        });
        
        let svgCode = response.text?.trim() || '';
        // Remove markdown formatting if any
        svgCode = svgCode.replace(/^```(xml|svg|html)?\n?/i, '').replace(/\n?```$/i, '').trim();
        
        if (svgCode && svgCode.startsWith('<svg')) {
          // Convert to data URI
          const base64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgCode)))}`;
          onSelect(base64);
          onClose();
        } else {
          alert('Не удалось сгенерировать SVG иконку');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка генерации');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Выберите иконку</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
        </div>
        
        <div className="flex border-b border-zinc-100">
          <button onClick={() => setTab('find')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${tab === 'find' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>Найти</button>
          <button onClick={() => setTab('generate')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${tab === 'generate' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>Создать ИИ</button>
          <button onClick={() => setTab('upload')} className={`flex-1 py-3 text-sm font-medium border-b-2 ${tab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}>Загрузить</button>
        </div>

        <div className="p-4 min-h-[240px]">
          {tab === 'find' && (
            <div>
              <p className="text-xs text-zinc-500 mb-4">Стандартные иконки (Lucide React)</p>
              <div className="grid grid-cols-4 gap-2">
                {PREDEFINED_ICONS.map(icon => (
                  <button 
                    key={icon} 
                    onClick={() => { onSelect(icon); onClose(); }} 
                    className="flex flex-col items-center justify-center p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-blue-300 transition-colors text-zinc-600"
                  >
                    {iconMap[icon]}
                    <span className="text-[10px] mt-2 text-zinc-500">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'generate' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-zinc-500">Опишите, какую иконку вы хотите сгенерировать</p>
              
              <div className="flex gap-2 bg-zinc-100 p-1 rounded-lg">
                <button 
                  onClick={() => setFormat('svg')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${format === 'svg' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Вектор (SVG)
                </button>
                <button 
                  onClick={() => setFormat('png')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${format === 'png' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                >
                  Растр (PNG)
                </button>
              </div>

              <input 
                type="text" 
                value={prompt} 
                onChange={e => setPrompt(e.target.value)} 
                placeholder="Например: киберпанк город, неоновый кот..."
                className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm outline-none focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              />
              <button 
                onClick={handleGenerate} 
                disabled={isGenerating || !prompt}
                className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? 'Генерация...' : <><Sparkles size={16} /> Сгенерировать</>}
              </button>
            </div>
          )}

          {tab === 'upload' && (
            <div className="flex flex-col items-center justify-center h-full min-h-[160px] border-2 border-dashed border-zinc-300 rounded-lg p-6 bg-zinc-50">
              <Upload size={32} className="text-zinc-400 mb-3" />
              <p className="text-sm text-zinc-600 mb-4 text-center">Выберите изображение на компьютере<br/><span className="text-xs text-zinc-400">(рекомендуется квадратное)</span></p>
              <label className="px-4 py-2 bg-white border border-zinc-300 rounded-md text-sm font-medium cursor-pointer hover:bg-zinc-50 transition-colors">
                Выбрать файл
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
