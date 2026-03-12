import React, { useState } from 'react';
import { generateDesignImage, processAiTemplate, upscaleImageTo4K } from '../services/geminiService';
import { ProductionModel } from '../types';

const StockWithAI: React.FC = () => {
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [shapeImage, setShapeImage] = useState<string | null>(null);
  const [colors, setColors] = useState(['', '', '']);
  const [subject, setSubject] = useState('');
  
  const stylesList = [
    'AI Auto-Style',
    'Vector art',
    '3D Render',
    'Line art',
    'Line',
    'Photorealistic AI',
    'Abstract AI'
  ];
  const [activeStyles, setActiveStyles] = useState<string[]>(['AI Auto-Style']);
  
  const [ratio, setRatio] = useState('1:1');
  const [outputs, setOutputs] = useState(1);
  const [background, setBackground] = useState('White');
  const [model, setModel] = useState<ProductionModel>(ProductionModel.NANO_BANANA_2);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [isModifying, setIsModifying] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleStyle = (style: string) => {
    if (activeStyles.includes(style)) {
      if (activeStyles.length > 1) {
        setActiveStyles(activeStyles.filter(s => s !== style));
      }
    } else {
      if (activeStyles.length < 2) {
        setActiveStyles([...activeStyles, style]);
      } else {
        // Replace the last one if already 2
        setActiveStyles([activeStyles[0], style]);
      }
    }
  };

  const toggleOrientation = () => {
    const parts = ratio.split(':');
    if (parts.length === 2) {
      setRatio(`${parts[1]}:${parts[0]}`);
    }
  };

  const handleGenerate = async () => {
    if (!subject && !styleImage && !shapeImage) {
      setError('Vui lòng nhập Subject Description hoặc tải lên ảnh tham chiếu.');
      return;
    }
    if (activeStyles.length > 1 && outputs < 2) {
      setError('Khi chọn 2 style, số lượng output phải lớn hơn 1.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    setResults([]);
    setSelectedImage(null);

    try {
      let prompt = `Generate a design asset: ${subject}. `;
      prompt += `Visual style: ${activeStyles.join(' and ')}. `;
      
      const validColors = colors.filter(c => c.trim() !== '');
      if (validColors.length > 0) prompt += `Color palette: ${validColors.join(', ')}. `;
      
      prompt += `Background: ${background}.`;

      const assets = [];
      if (styleImage) assets.push({ image: styleImage, removeBackground: false });
      if (shapeImage) assets.push({ image: shapeImage, removeBackground: false });

      const generatedImages = await generateDesignImage(
        prompt,
        ratio,
        outputs,
        '1K', // Default quality 1K
        assets,
        [],
        null,
        model
      );

      setResults(generatedImages);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo ảnh');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpscale = async () => {
    if (!selectedImage) return;
    setIsModifying(true);
    try {
      const upscaled = await upscaleImageTo4K(selectedImage, ratio);
      // Replace the selected image in the results with the upscaled one
      setResults(prev => prev.map(img => img === selectedImage ? upscaled : img));
      setSelectedImage(upscaled);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi upscale');
    } finally {
      setIsModifying(false);
    }
  };

  const handleModify = async () => {
    if (!selectedImage || !modifyPrompt) return;
    setIsModifying(true);
    try {
      const modified = await processAiTemplate(selectedImage, null, modifyPrompt, ratio);
      if (modified) {
        setResults(prev => prev.map(img => img === selectedImage ? modified : img));
        setSelectedImage(modified);
        setModifyPrompt('');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi modify');
    } finally {
      setIsModifying(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar */}
      <div className="w-80 bg-[#151619] text-slate-300 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 border-r border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012-2v2M7 7h10" /></svg>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Stock with AI</h2>
            <p className="text-xs text-slate-400">Tạo nguyên liệu thiết kế</p>
          </div>
        </div>

        {/* Input Visual References */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
            Input Visual References
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <label className="border border-dashed border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors relative h-24">
              {styleImage ? (
                <img src={styleImage} alt="Style" className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-50" />
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                  <span className="text-[10px] text-slate-400">Style</span>
                </>
              )}
              <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, setStyleImage)} />
            </label>
            
            <div className="border border-slate-700 rounded-xl p-2 flex flex-col gap-1 h-24 bg-slate-800/50 relative">
              <span className="text-[9px] text-slate-400 absolute -top-2 left-2 bg-[#151619] px-1">Color Palette</span>
              {colors.map((color, i) => (
                <div key={i} className="flex items-center gap-1 bg-slate-900 rounded px-1 py-0.5">
                  <div className="w-3 h-3 rounded-sm border border-slate-700 shrink-0" style={{ backgroundColor: color || 'transparent' }}></div>
                  <input 
                    type="text" 
                    placeholder="#HEX" 
                    value={color}
                    onChange={e => {
                      const newColors = [...colors];
                      newColors[i] = e.target.value;
                      setColors(newColors);
                    }}
                    className="bg-transparent text-[10px] w-full outline-none text-slate-300 placeholder-slate-600 uppercase"
                  />
                </div>
              ))}
            </div>

            <label className="border border-dashed border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors relative h-24">
              {shapeImage ? (
                <img src={shapeImage} alt="Shape" className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-50" />
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                  <span className="text-[10px] text-slate-400">Shape</span>
                </>
              )}
              <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, setShapeImage)} />
            </label>
          </div>
        </div>

        {/* Subject Description */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Subject Description
          </h3>
          <textarea 
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Mô tả nội dung yêu cầu bổ sung..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-24"
          />
        </div>

        {/* Additional Styles */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 mb-2">Additional Styles (Max 2)</h3>
          <div className="flex flex-wrap gap-2">
            {stylesList.map(style => (
              <button 
                key={style}
                onClick={() => toggleStyle(style)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  activeStyles.includes(style)
                    ? 'bg-emerald-600 border-emerald-500 text-white' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {style === 'AI Auto-Style' && <span className="mr-1">✨</span>}
                {activeStyles.includes(style) && style !== 'AI Auto-Style' && <span className="mr-1">✓</span>}
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Ratio Canva</label>
            <div className="flex gap-2">
              <select 
                value={ratio}
                onChange={e => setRatio(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 outline-none focus:border-emerald-500"
              >
                <option value="1:1">1:1</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
                <option value="1:4">1:4</option>
                <option value="4:1">4:1</option>
              </select>
              <button 
                onClick={toggleOrientation}
                className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:bg-slate-700 text-slate-300"
                title="Đảo chiều ngang/dọc"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Outputs</label>
            <select 
              value={outputs}
              onChange={e => setOutputs(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 outline-none focus:border-emerald-500"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Background</label>
            <select 
              value={background}
              onChange={e => setBackground(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 outline-none focus:border-emerald-500"
            >
              <option value="White">White</option>
              <option value="Creative">Creative</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Model</label>
            <select 
              value={model}
              onChange={e => setModel(e.target.value as ProductionModel)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 outline-none focus:border-emerald-500"
            >
              <option value={ProductionModel.NANO_BANANA}>Nano Banana 1</option>
              <option value={ProductionModel.NANO_BANANA_2}>Nano Banana 2</option>
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-auto"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
              Generating...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Generate Designs
            </>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto relative">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Stock with AI</h1>
            <p className="text-slate-500 font-medium">Tạo hình ảnh các dữ liệu thiết kế theo yêu cầu để sử dụng.</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-8 border border-red-100 font-medium">
              {error}
            </div>
          )}

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-emerald-500/20 rounded-full animate-pulse"></div>
                <div className="absolute top-0 left-0 w-20 h-20 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-slate-900 font-black uppercase tracking-widest mt-6 animate-pulse">Đang tạo hình ảnh...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((img, i) => (
                <div key={i} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm group relative">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 mb-4 relative cursor-pointer" onClick={() => setSelectedImage(img)}>
                    <img src={img} alt={`Result ${i+1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-white text-slate-900 px-4 py-2 rounded-xl font-bold text-sm shadow-lg">
                        Phóng to / Tùy chọn
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Chưa có kết quả</h3>
              <p className="text-slate-500 max-w-md">Nhập thông tin ở thanh công cụ bên trái và nhấn Generate Designs để tạo nguyên liệu thiết kế.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Selected Image */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 relative">
              <img src={selectedImage} alt="Selected" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-md" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-slate-800 shadow-sm transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="w-full md:w-80 bg-white p-6 flex flex-col gap-6 border-l border-slate-100 overflow-y-auto">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tùy chọn</h3>
              
              <div className="flex flex-col gap-3">
                <a 
                  href={selectedImage} 
                  download={`stock-ai-${Date.now()}.png`} 
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải về
                </a>
                
                <button 
                  onClick={handleUpscale}
                  disabled={isModifying}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isModifying ? (
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-indigo-700 rounded-full animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  )}
                  Upscale (4K)
                </button>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Modify</h4>
                <p className="text-xs text-slate-500 mb-3">Describe exactly what you want to change while keeping the original composition</p>
                <textarea 
                  value={modifyPrompt}
                  onChange={e => setModifyPrompt(e.target.value)}
                  placeholder="Ví dụ: Đổi màu nền thành đỏ, thêm chi tiết hoa văn..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-24 mb-3"
                />
                <button 
                  onClick={handleModify}
                  disabled={isModifying || !modifyPrompt}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isModifying ? (
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  )}
                  Generate changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockWithAI;
