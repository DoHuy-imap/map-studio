import React, { useState } from 'react';
import { 
  StockAiRequest, StockAiStyle, StockAiBackground, AspectRatio, ProductionModel, QualityLevel 
} from '../types';
import { generateStockAiImages, modifyStockAiImage, upscaleImageTo4K, getFinalAspectRatio } from '../services/geminiService';
import { saveDesignToHistory } from '../services/historyDb';
import { useAuth } from '../contexts/UserContext';

const initialRequest: StockAiRequest = {
  styleImage: null,
  colors: ['#000000', '#FFFFFF', '#FFD300'],
  keepOriginalColors: false,
  isBlackAndWhite: false,
  shapeImage: null,
  subjectDescription: '',
  additionalStyles: [],
  ratio: '1:1',
  orientation: 'horizontal',
  outputs: 1,
  background: StockAiBackground.WHITE,
  model: ProductionModel.NANO_BANANA_2
};

interface StockAiProps {
  onSaveSuccess?: () => void;
}

const RATIOS = ["1:1", "3:4", "9:16", "1:4", "1:8"];

const StockAi: React.FC<StockAiProps> = ({ onSaveSuccess }) => {
  const { user, addSessionCost } = useAuth();
  const [request, setRequest] = useState<StockAiRequest>({ ...initialRequest });
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modifyInstruction, setModifyInstruction] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleReset = () => {
    setRequest({ ...initialRequest });
    setResults([]);
    setSelectedImage(null);
    setError(null);
    setModifyInstruction('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'styleImage' | 'shapeImage') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRequest(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorChange = (index: number, color: string) => {
    const newColors = [...request.colors];
    newColors[index] = color;
    setRequest(prev => ({ ...prev, colors: newColors }));
  };

  const toggleStyle = (style: StockAiStyle) => {
    setRequest(prev => {
      const isSelected = prev.additionalStyles.includes(style);
      if (isSelected) {
        return { ...prev, additionalStyles: prev.additionalStyles.filter(s => s !== style) };
      } else {
        if (prev.additionalStyles.length >= 2) {
          return prev; // Max 2
        }
        return { ...prev, additionalStyles: [...prev.additionalStyles, style] };
      }
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setResults([]);
    setSelectedImage(null);
    try {
      const urls = await generateStockAiImages(request);
      setResults(urls);
      addSessionCost(urls.length * 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate images.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModify = async () => {
    if (!selectedImage || !modifyInstruction) return;
    setIsModifying(true);
    try {
      const url = await modifyStockAiImage(selectedImage, modifyInstruction, request.ratio, request.orientation, request.model);
      setResults(prev => [url, ...prev]);
      setSelectedImage(url);
      setModifyInstruction('');
      addSessionCost(1000);
    } catch (err: any) {
      alert(err.message || 'Failed to modify image.');
    } finally {
      setIsModifying(false);
    }
  };

  const handleUpscale = async () => {
    if (!selectedImage) return;
    setIsUpscaling(true);
    try {
      const url = await upscaleImageTo4K(selectedImage, request.ratio, request.orientation);
      setResults(prev => [url, ...prev]);
      setSelectedImage(url);
      addSessionCost(5000);
    } catch (err: any) {
      alert(err.message || 'Failed to upscale image.');
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleDownload = () => {
    if (!selectedImage) return;
    const a = document.createElement('a');
    a.href = selectedImage;
    a.download = `stock-ai-${Date.now()}.png`;
    a.click();
  };

  const handleSaveToLibrary = async () => {
    if (!selectedImage || !user) return;
    setIsSaving(true);
    try {
      await saveDesignToHistory({
        thumbnail: selectedImage,
        requestData: {
          ...request,
          mainHeadline: request.subjectDescription || 'Stock AI Image',
          productType: 'Stock AI',
          quality: QualityLevel.HIGH
        } as any,
        designPlan: {
          subject: request.subjectDescription,
          styleContext: request.additionalStyles.join(', '),
          composition: '',
          colorLighting: request.isBlackAndWhite ? 'Black and White' : (request.keepOriginalColors ? 'Original Colors' : request.colors.join(', ')),
          decorElements: '',
          typography: ''
        },
        recommendedAspectRatio: getFinalAspectRatio(request.ratio, request.orientation),
        author: user.displayName,
        finalPrompt: request.subjectDescription,
      });
      alert("Đã lưu vào thư viện thành công!");
      onSaveSuccess?.();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu vào thư viện.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
      {/* Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setZoomedImage(null)}>
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            onClick={() => setZoomedImage(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img 
            src={zoomedImage} 
            alt="Zoomed" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {/* Left Panel: Inputs */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6 overflow-y-auto pr-2">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-1">STOCK AI</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Tạo nguyên liệu thiết kế</p>
          </div>
          <button onClick={handleReset} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm" title="Dự án mới">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        {/* Visual References */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Input Visual References</label>
          <div className="grid grid-cols-3 gap-2">
            {/* Style Image */}
            <div className="flex flex-col gap-1">
              <div className="aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center relative overflow-hidden group">
                {request.styleImage ? (
                  <>
                    <img src={request.styleImage} alt="Style" className="w-full h-full object-cover" />
                    <button onClick={() => setRequest(prev => ({ ...prev, styleImage: null }))} className="absolute top-1 right-1 bg-white/80 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[10px] font-bold uppercase">Style</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'styleImage')} />
                  </label>
                )}
              </div>
            </div>

            {/* Color Palette */}
            <div className="flex flex-col gap-1">
              <div className="aspect-square bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center p-2 gap-2 relative">
                <span className="text-[10px] font-bold uppercase text-slate-500">Color Palette</span>
                
                <label className="flex items-center gap-1.5 cursor-pointer group">
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${request.keepOriginalColors ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 group-hover:border-emerald-400'}`}>
                    {request.keepOriginalColors && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={request.keepOriginalColors}
                    onChange={(e) => setRequest(prev => ({ ...prev, keepOriginalColors: e.target.checked, isBlackAndWhite: e.target.checked ? false : prev.isBlackAndWhite }))}
                  />
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Giữ màu gốc</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer group">
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${request.isBlackAndWhite ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-300 group-hover:border-slate-800'}`}>
                    {request.isBlackAndWhite && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={request.isBlackAndWhite}
                    onChange={(e) => setRequest(prev => ({ ...prev, isBlackAndWhite: e.target.checked, keepOriginalColors: e.target.checked ? false : prev.keepOriginalColors }))}
                  />
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Đen trắng</span>
                </label>

                <div className={`flex flex-col gap-1.5 w-full transition-opacity ${request.keepOriginalColors || request.isBlackAndWhite ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  {request.colors.map((color, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5">
                      <input 
                        type="color" 
                        value={color}
                        onChange={(e) => handleColorChange(idx, e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 p-0 shrink-0"
                      />
                      <input 
                        type="text"
                        value={color.toUpperCase()}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^#[0-9A-F]{0,6}$/i.test(val)) {
                            handleColorChange(idx, val);
                          }
                        }}
                        className="w-full text-[9px] font-mono text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                        maxLength={7}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Shape Image */}
            <div className="flex flex-col gap-1">
              <div className="aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center relative overflow-hidden group">
                {request.shapeImage ? (
                  <>
                    <img src={request.shapeImage} alt="Shape" className="w-full h-full object-cover" />
                    <button onClick={() => setRequest(prev => ({ ...prev, shapeImage: null }))} className="absolute top-1 right-1 bg-white/80 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                    <span className="text-[10px] font-bold uppercase">Shape</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'shapeImage')} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Subject Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Subject Description</label>
          <textarea 
            value={request.subjectDescription}
            onChange={(e) => setRequest(prev => ({ ...prev, subjectDescription: e.target.value }))}
            placeholder="Nhập thêm nội dung yêu cầu bổ sung..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none h-24"
          />
        </div>

        {/* Additional Styles */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest">Additional Styles</label>
            <span className="text-[10px] text-slate-500 font-medium">Tối đa 2</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.values(StockAiStyle).map(style => {
              const isSelected = request.additionalStyles.includes(style);
              const isDisabled = !isSelected && request.additionalStyles.length >= 2;
              return (
                <button
                  key={style}
                  onClick={() => toggleStyle(style)}
                  disabled={isDisabled}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isSelected 
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                      : isDisabled 
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50'
                  }`}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ratio & Orientation */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Ratio</label>
            <select 
              value={request.ratio}
              onChange={(e) => {
                const val = e.target.value as AspectRatio;
                setRequest(prev => ({ ...prev, ratio: val }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {RATIOS.map(r => (
                <option key={r} value={r}>
                  {r === '1:1' ? '1:1 (Vuông)' : `${r} (hoặc ${r.split(':').reverse().join(':')})`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Orientation</label>
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button 
                onClick={() => setRequest(prev => ({ ...prev, orientation: 'horizontal' }))}
                className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all ${request.orientation === 'horizontal' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Ngang
              </button>
              <button 
                onClick={() => setRequest(prev => ({ ...prev, orientation: 'vertical' }))}
                className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all ${request.orientation === 'vertical' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Dọc
              </button>
            </div>
          </div>
        </div>

        {/* Outputs & Background */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Outputs</label>
            <select 
              value={request.outputs}
              onChange={(e) => setRequest(prev => ({ ...prev, outputs: parseInt(e.target.value) as any }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Background</label>
            <select 
              value={request.background}
              onChange={(e) => setRequest(prev => ({ ...prev, background: e.target.value as StockAiBackground }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Object.values(StockAiBackground).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Model</label>
          <div className="flex flex-col gap-2">
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${request.model === ProductionModel.NANO_BANANA ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
              <input 
                type="radio" 
                name="model" 
                checked={request.model === ProductionModel.NANO_BANANA}
                onChange={() => setRequest(prev => ({ ...prev, model: ProductionModel.NANO_BANANA }))}
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <div className="text-sm font-bold text-slate-900">Nano Banana 1</div>
                <div className="text-[10px] text-slate-500">gemini-2.5-flash-image</div>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${request.model === ProductionModel.NANO_BANANA_2 ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
              <input 
                type="radio" 
                name="model" 
                checked={request.model === ProductionModel.NANO_BANANA_2}
                onChange={() => setRequest(prev => ({ ...prev, model: ProductionModel.NANO_BANANA_2 }))}
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <div className="text-sm font-bold text-slate-900">Nano Banana 2</div>
                <div className="text-[10px] text-slate-500">gemini-3.1-flash-image-preview</div>
              </div>
            </label>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Đang tạo...
            </>
          ) : 'Generate Designs'}
        </button>
        
        {error && <div className="text-red-500 text-sm mt-2 p-3 bg-red-50 rounded-xl border border-red-100">{error}</div>}
      </div>

      {/* Right Panel: Results */}
      <div className="w-full lg:w-2/3 bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col overflow-hidden relative">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4 shrink-0">Outputs</h3>
        
        <div className="flex-grow overflow-y-auto">
          {results.length === 0 && !isGenerating ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="font-medium">Chưa có kết quả. Hãy điền thông tin và bấm Generate.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((url, idx) => (
                <div key={idx} className={`relative group rounded-xl overflow-hidden border-2 transition-all ${selectedImage === url ? 'border-emerald-500 shadow-md' : 'border-slate-200 hover:border-emerald-300'}`}>
                  <img src={url} alt={`Result ${idx}`} className="w-full h-auto object-contain bg-white" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={() => setSelectedImage(url)}
                      className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                    >
                      Lựa chọn
                    </button>
                    <button 
                      onClick={() => setZoomedImage(url)}
                      className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/40 transition-colors"
                      title="Phóng to"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                    </button>
                  </div>
                  {selectedImage === url && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {isGenerating && (
            <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-emerald-500/20 rounded-full animate-pulse"></div>
                    <div className="absolute top-0 left-0 w-24 h-24 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-900 font-black uppercase tracking-[0.3em] mt-8 animate-pulse text-sm">Đang tạo thiết kế...</p>
                <p className="text-[10px] text-slate-400 uppercase mt-2 font-bold tracking-widest">Hệ thống AI đang làm việc</p>
            </div>
        )}

        {/* Action Panel for Selected Image */}
        {selectedImage && (
          <div className="mt-6 pt-6 border-t border-slate-200 shrink-0 animate-fade-in-up">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-3">Thao tác với ảnh đã chọn</h4>
            <div className="flex flex-wrap gap-3 mb-4">
              <button 
                onClick={handleDownload}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Tải về
              </button>
              <button 
                onClick={handleSaveToLibrary}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isSaving ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                )}
                Lưu thư viện
              </button>
              <button 
                onClick={handleUpscale}
                disabled={isUpscaling}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isUpscaling ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                )}
                Upscale (4K)
              </button>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Modify</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={modifyInstruction}
                  onChange={(e) => setModifyInstruction(e.target.value)}
                  placeholder="Describe exactly what you want to change while keeping the original composition..."
                  className="flex-grow bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button 
                  onClick={handleModify}
                  disabled={!modifyInstruction || isModifying}
                  className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap text-sm"
                >
                  {isModifying ? 'Đang sửa...' : 'Generate changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAi;
