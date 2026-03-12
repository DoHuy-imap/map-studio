
// Fix: Added React to the import statement to resolve "Cannot find namespace 'React'" error.
import React, { useState, useEffect } from 'react';
import { ArtDirectionRequest, ArtDirectionResponse, ImageGenerationResult, SeparatedAssets, DesignPlan, LayoutSuggestion, ProductionModel } from '../types';
import LayoutEditor from './LayoutEditor';
import SmartRemover from './SmartRemover';
import { convertLayoutToPrompt, upscaleImageTo4K, LAYOUT_TAG, suggestNewLayout } from '../services/geminiService';

const triggerDownload = (base64Data: string, fileName: string) => {
  try {
    const parts = base64Data.split(';base64,');
    if (parts.length !== 2) return false;
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
    const blob = new Blob([uInt8Array], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
    return true;
  } catch (e) { return false; }
};

interface ResultDisplayProps {
  request: ArtDirectionRequest;
  artDirection: ArtDirectionResponse | null;
  imageResult: ImageGenerationResult;
  refinementResult: ImageGenerationResult;
  isAnalyzing: boolean;
  analysisError: string | null;
  isUpdatingPlan: boolean;
  onGenerateImages: (finalPrompt: string, append?: boolean, layoutMask?: string | null) => void;
  onUpdatePlan: (updatedPlan: DesignPlan) => void;
  onRegenerateImage: (prompt: string) => void;
  onSeparateLayout: (selectedImage: string, mode: 'full' | 'background') => void;
  onRefineImage: (sourceImage: string, instruction: string) => void;
  onSmartRemove: (sourceImage: string, maskBase64: string, textDescription: string) => void;
  onResetRefinement: () => void;
  separatedAssets: SeparatedAssets;
  onSaveDesign: (selectedImageUrl: string, finalPromptUsed: string) => void;
  isSaving: boolean;
  onInputChange: (field: keyof ArtDirectionRequest, value: any) => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
  request,
  artDirection, 
  imageResult, 
  refinementResult,
  isAnalyzing,
  analysisError,
  isUpdatingPlan,
  onGenerateImages,
  onUpdatePlan,
  onSeparateLayout,
  onSmartRemove,
  onResetRefinement,
  separatedAssets: externalAssets,
  onSaveDesign,
  isSaving,
  onInputChange
}) => {
  const [editablePrompt, setEditablePrompt] = useState('');
  const [localPlan, setLocalPlan] = useState<DesignPlan | null>(null);
  const [localLayout, setLocalLayout] = useState<LayoutSuggestion | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSmartRemover, setShowSmartRemover] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [layoutMask, setLayoutMask] = useState<string | null>(null);
  const [isRefreshingLayout, setIsRefreshingLayout] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const criteriaList: { key: keyof DesignPlan; label: string }[] = [
      { key: 'subject', label: 'Chủ thể & Nội dung' },
      { key: 'styleContext', label: 'Phong cách & Bối cảnh' },
      { key: 'composition', label: 'Bố cục & Góc nhìn' },
      { key: 'colorLighting', label: 'Màu sắc & Ánh sáng' },
      { key: 'decorElements', label: 'Chi tiết trang trí' },
      { key: 'typography', label: 'Typography & Font' },
  ];

  useEffect(() => {
    if (artDirection) {
      const promptOnly = artDirection.final_prompt.split(LAYOUT_TAG)[0];
      setEditablePrompt(promptOnly);
      setLocalPlan(artDirection.designPlan);
      setLocalLayout(artDirection.layout_suggestion);
      setLayoutMask(null); 
    }
  }, [artDirection]);

  useEffect(() => {
    setSelectedImage(null);
    setShowSmartRemover(false);
    onResetRefinement();
  }, [imageResult.images, onResetRefinement]);

  useEffect(() => {
    let interval: any;
    const isAnyLoading = imageResult.loading || externalAssets.loading || refinementResult.loading;
    if (isAnyLoading) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 95) return prev + Math.random() * 4;
          return prev;
        });
      }, 700);
    } else {
      setLoadingProgress(0);
      if (interval) clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [imageResult.loading, externalAssets.loading, refinementResult.loading]);

  const handleLayoutConfirm = (mask: string) => {
      if (!localLayout) return;
      setLayoutMask(mask);
  };
  
  const handleGenerateClick = (append: boolean) => {
      if (imageResult.loading || externalAssets.loading || refinementResult.loading) return;
      
      let fullPromptForApi = editablePrompt;
      if (localLayout) {
          fullPromptForApi += convertLayoutToPrompt(localLayout);
      }
      
      onGenerateImages(fullPromptForApi, append, layoutMask);
  };

  const handleRefreshLayout = async () => {
    if (!artDirection || isRefreshingLayout) return;
    setIsRefreshingLayout(true);
    try {
      const newLayout = await suggestNewLayout(artDirection, request);
      setLocalLayout(newLayout);
    } catch (e) {
      alert("Lỗi khi đề xuất bố cục mới.");
    } finally {
      setIsRefreshingLayout(false);
    }
  };

  const handleDownload4K = async (url: string) => {
      setIsUpscaling(true);
      try {
          const ratio = artDirection?.recommendedAspectRatio || "1:1";
          const upscaleUrl = await upscaleImageTo4K(url, ratio as any);
          triggerDownload(upscaleUrl, `map-design-4k-${Date.now()}.png`);
      } catch (e) { alert("Lỗi nâng cấp 4K."); }
      finally { setIsUpscaling(false); }
  };

  const handleStartSeparation = () => {
      if (!selectedImage) return;
      onSeparateLayout(selectedImage, 'full');
  };

  if (analysisError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-red-50 rounded-[3rem] border border-red-200 p-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-500 mb-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h3 className="text-2xl font-black text-slate-900 uppercase mb-4 tracking-tighter">Lỗi Phân Tích Kỹ Thuật</h3>
        <p className="text-red-600 font-bold max-w-md mx-auto">{analysisError}</p>
        <button onClick={() => window.location.reload()} className="mt-10 px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-800 shadow-xl transition-all">Tải lại Studio</button>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-white rounded-[3.5rem] border border-slate-200 shadow-xl">
             <div className="relative"><div className="w-24 h-24 border-4 border-orange-500/10 rounded-full"></div><div className="absolute inset-0 w-24 h-24 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>
             <h3 className="text-xl font-black text-slate-900 uppercase mt-12 tracking-[0.2em] animate-pulse">Director đang xử lý...</h3>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8 overflow-y-auto pr-3 relative scrollbar-hide pb-20">
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center p-6 backdrop-blur-3xl" onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage} alt="Full" className="max-h-[88vh] max-w-full rounded-3xl shadow-2xl border border-white/10" />
            <p className="text-[10px] text-slate-500 font-black uppercase mt-6 tracking-[0.5em]">Nhấn để đóng</p>
        </div>
      )}
      
      {showSmartRemover && selectedImage && (
          <SmartRemover 
            imageUrl={selectedImage} 
            onClose={() => setShowSmartRemover(false)} 
            isProcessing={refinementResult.loading} 
            onProcess={(mask, text) => onSmartRemove(selectedImage, mask, text)} 
            resultUrl={null} 
            aspectRatio={artDirection?.recommendedAspectRatio || "1:1"}
          />
      )}

      {artDirection && localPlan && (
        <div className="bg-white rounded-[3.5rem] border border-slate-200 overflow-hidden shadow-xl flex-shrink-0 animate-fade-in-down">
           <div className="p-10 pb-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-slate-900 font-black text-2xl uppercase tracking-tighter">Moodboard Summary</h3>
                    <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest mt-1.5 opacity-80">
                      Kích thước: {request.width} x {request.height} cm ● {artDirection.recommendedAspectRatio}
                    </p>
                 </div>
                 <div className="flex items-center gap-4">
                    <span className="text-[10px] text-slate-700 font-black uppercase bg-slate-100 px-5 py-2.5 rounded-2xl border border-slate-200">{request.productType}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="p-6 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm group flex gap-4">
                       <div className="flex-1">
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-2">Tiêu đề & Nội dung chính</span>
                          <h4 className="text-slate-900 font-black text-xl uppercase tracking-tight mb-2">{request.mainHeadline}</h4>
                          <p className="text-xs text-slate-500 font-bold italic line-clamp-2">"{request.secondaryText}"</p>
                       </div>
                       {request.logoImages.length > 0 && (
                         <div className="flex gap-2">
                           {request.logoImages.map((logo, i) => (
                             <div key={i} className="w-20 h-20 bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-lg p-1.5">
                               <img src={logo} className="w-full h-full object-contain" alt={`Logo ${i}`} />
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                    <div className="flex flex-wrap gap-4">
                       <div className="flex gap-2.5">
                           {request.assetImages.map((asset, i) => (<div key={i} className="w-20 h-20 bg-slate-100 rounded-3xl overflow-hidden border-2 border-slate-200 shadow-sm group relative transition-transform hover:scale-105"><img src={asset.image} className="w-full h-full object-cover" alt="Product" />{asset.removeBackground && <div className="absolute top-1 left-1 bg-blue-600 text-[6px] font-black text-white px-1 rounded shadow">AI</div>}</div>))}
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block ml-2">Moodboard References ({request.referenceImages.length})</span>
                    <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                       {request.referenceImages.map((ref, i) => (<div key={i} className="flex-shrink-0 group relative w-28 h-28 rounded-[2rem] overflow-hidden border-2 border-slate-200 shadow-sm cursor-help"><img src={ref.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Ref" /><div className="absolute inset-0 bg-black/70 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">{ref.attributes.map(attr => (<span key={attr} className="text-[8px] text-orange-400 font-black uppercase tracking-tighter truncate">✦ {attr}</span>))}</div></div>))}
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="p-10 space-y-10">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {criteriaList.map((item) => (
                    <div key={item.key} className="bg-slate-950/60 p-7 rounded-[2.5rem] border border-white/5 hover:border-[#FFD300]/20 transition-all shadow-inner group"><h4 className="text-[10px] text-slate-600 font-black uppercase mb-4 tracking-[0.2em] flex items-center gap-2 group-hover:text-slate-400 transition-colors"><div className="w-2 h-2 bg-[#FFD300] rounded-full shadow-[0_0_10px_rgba(255,211,0,0.5)]"></div>{item.label}</h4><textarea value={localPlan[item.key] || ''} onChange={(e) => setLocalPlan(prev => prev ? {...prev, [item.key]: e.target.value} : null)} className="w-full bg-transparent text-slate-300 text-[11px] font-bold outline-none resize-none min-h-[85px] leading-relaxed scrollbar-hide" /></div>
                ))}
             </div>

             {localLayout && (
                <LayoutEditor 
                    key={artDirection?.final_prompt}
                    layout={localLayout} 
                    dynamicLayout={artDirection?.dynamic_layout}
                    onLayoutChange={(updated) => setLocalLayout(updated)} 
                    onConfirm={handleLayoutConfirm}
                    onRefreshLayout={handleRefreshLayout}
                    isRefreshing={isRefreshingLayout}
                />
             )}

             <div className="space-y-5">
                <div className="flex justify-between items-center px-6"><h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>AI Final Design Prompt</h4></div>
                <div className="bg-slate-950 rounded-[3rem] p-10 border border-white/5 shadow-inner relative overflow-hidden group"><textarea className="w-full bg-transparent text-slate-400 text-[12px] font-mono leading-loose outline-none resize-none min-h-[180px] relative z-10 scrollbar-hide" value={editablePrompt} onChange={(e) => setEditablePrompt(e.target.value)} /></div>
                
                {/* Model Selection UI */}
                <div className="flex flex-col gap-3 px-6">
                   <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Production Engine Selection:</span>
                   <div className="flex bg-slate-900/50 rounded-2xl p-1 border border-white/5 w-fit">
                      <button 
                        onClick={() => onInputChange('productionModel', ProductionModel.NANO_BANANA)} 
                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${request.productionModel === ProductionModel.NANO_BANANA ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Nano Banana
                      </button>
                      <button 
                        onClick={() => onInputChange('productionModel', ProductionModel.NANO_BANANA_2)} 
                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${request.productionModel === ProductionModel.NANO_BANANA_2 ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Nano Banana 2
                      </button>
                   </div>
                   <p className="text-[8px] text-slate-500 italic font-medium">
                     {request.productionModel === ProductionModel.NANO_BANANA_2 
                       ? "Nano Banana 2: High fidelity, supports extreme aspect ratios (1:8, 8:1)." 
                       : "Nano Banana: Standard production model, balanced speed and quality."}
                   </p>
                </div>
             </div>

             <div className="flex gap-6">
                 <button onClick={() => localPlan && onUpdatePlan(localPlan)} disabled={isUpdatingPlan} className="flex-1 py-7 bg-slate-800/80 hover:bg-slate-700 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-white/5 shadow-xl">Cập nhật Kế hoạch</button>
                 <button 
                    onClick={() => handleGenerateClick(false)} 
                    disabled={imageResult.loading || externalAssets.loading || refinementResult.loading} 
                    className={`flex-[2] py-7 font-black rounded-3xl shadow-2xl transition-all uppercase tracking-widest text-[11px] border-t-2 border-white/20 flex items-center justify-center gap-3
                        ${(imageResult.loading || externalAssets.loading || refinementResult.loading) ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-[#FFD300] hover:bg-[#FFC000] text-black'}`}
                 >
                    {(imageResult.loading || externalAssets.loading || refinementResult.loading) ? (
                        <>
                          <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                          Đang xử lý...
                        </>
                    ) : 'Sản Xuất Hình Ảnh'}
                 </button>
             </div>
           </div>
        </div>
      )}

      {(imageResult.images.length > 0 || imageResult.loading || externalAssets.loading || refinementResult.loading) && (
          <div className="flex-grow flex flex-col gap-10 pb-32 mt-6">
            <div className="flex items-center justify-between px-6">
                <h3 className="text-slate-900 font-black text-2xl uppercase tracking-tighter">Studio Output</h3>
                {artDirection && (
                    <button 
                        onClick={() => handleGenerateClick(true)} 
                        disabled={imageResult.loading || externalAssets.loading || refinementResult.loading} 
                        className={`text-[10px] border-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all
                            ${(imageResult.loading || externalAssets.loading || refinementResult.loading) ? 'border-slate-700 text-slate-600' : 'text-[#FFD300] border-[#FFD300]/20 hover:text-white hover:border-[#FFD300]'}`}
                    >
                        {(imageResult.loading || externalAssets.loading || refinementResult.loading) ? 'Đang thực hiện...' : 'Thêm biến thể'}
                    </button>
                )}
            </div>
            
            {(imageResult.loading || externalAssets.loading || refinementResult.loading) && (
                <div className="w-full min-h-[450px] bg-white rounded-[4rem] border border-slate-200 flex flex-col items-center justify-center gap-10 relative overflow-hidden shadow-xl">
                     <div className="absolute inset-0 bg-gradient-to-br from-[#FFD300]/5 to-blue-500/10 opacity-40"></div>
                     <div className="relative z-10 flex flex-col items-center w-full max-w-md px-10">
                        <div className="relative mb-8">
                            <div className="w-28 h-28 border-4 border-[#FFD300]/10 rounded-full"></div>
                            <div className="absolute top-0 left-0 w-28 h-28 border-4 border-[#FFD300] border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }}></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg viewBox="0 0 24 24" className="w-12 h-12 text-[#FFD300] animate-pulse" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                        
                        <div className="text-center mb-6">
                           <h4 className="text-slate-900 font-black uppercase tracking-[0.5em] text-lg mb-2">
                             {externalAssets.loading ? 'Graphic Separation' : refinementResult.loading ? 'AI Healing Engine' : 'Production Engine'}
                           </h4>
                           <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                             {externalAssets.loading ? 'Đang tách phân rã lớp đồ họa...' : refinementResult.loading ? 'Đang xóa và tái tạo bối cảnh...' : `Tác phẩm Full-Frame • ${artDirection?.recommendedAspectRatio || "1:1"}`}
                           </p>
                        </div>

                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 mb-4">
                           <div 
                             className="h-full bg-gradient-to-r from-[#FFD300] to-[#FFA000] transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,211,0,0.5)]" 
                             style={{ width: `${loadingProgress}%` }}
                           ></div>
                        </div>
                        
                        <div className="flex justify-between w-full text-[9px] font-black uppercase tracking-widest text-slate-600 italic">
                            <span>{externalAssets.loading ? 'Extracting elements' : refinementResult.loading ? 'Healing pixels' : 'Initializing Print Engine'}</span>
                            <span>{Math.round(loadingProgress)}%</span>
                        </div>

                        <div className="mt-10 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-200 animate-pulse">
                           <p className="text-[9px] text-[#FFD300] font-black uppercase tracking-widest text-center">
                             {externalAssets.loading ? 'Director đang phân tích và trích xuất từng lớp thiết kế...' : refinementResult.loading ? 'Hệ thống AI đang tính toán pixels để lấp đầy vùng trống...' : 'AI đang xuất file đồ họa cao cấp cho in ấn...'}
                           </p>
                        </div>
                     </div>
                </div>
            )}

            {imageResult.images.length > 0 && !imageResult.loading && !externalAssets.loading && !refinementResult.loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 px-4 animate-fade-in-up">
                    {imageResult.images.map((img, idx) => (
                      <div 
                        key={idx} 
                        className={`group relative rounded-[3.5rem] overflow-hidden border-2 transition-all duration-700 cursor-pointer bg-white shadow-xl ${selectedImage === img.url ? 'border-orange-500 ring-[12px] ring-orange-500/5 scale-[0.98]' : 'border-slate-100 hover:border-slate-300'}`} 
                        onClick={() => setSelectedImage(selectedImage === img.url ? null : img.url)}
                      >
                        {img.isNew && (
                          <div className="absolute top-6 right-6 z-20 bg-[#FFD300] text-black text-[9px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-[#FFD300]/30 animate-pulse">NEW</div>
                        )}
                        {img.model && (
                          <div className="absolute top-6 left-6 z-20 bg-slate-900/80 backdrop-blur-md text-white text-[8px] font-black px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                            {img.model === ProductionModel.NANO_BANANA ? 'NANO' : 'NANO 2'}
                          </div>
                        )}
                        <div className="w-full aspect-square relative overflow-hidden">
                          <img src={img.url} alt="Result" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[3px]">
                            <button onClick={(e) => { e.stopPropagation(); setLightboxImage(img.url); }} className="p-6 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-3xl border border-white/20 shadow-2xl transition-all active:scale-75">🔍</button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
            )}
          </div>
      )}

      {selectedImage && (
        <div className="bg-white/95 border-t border-slate-200 p-10 fixed bottom-0 left-0 right-0 z-[60] backdrop-blur-3xl animate-fade-in-up shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
           <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
             <div className="flex items-center gap-8"><div className="w-20 h-20 rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl transform -rotate-3"><img src={selectedImage} className="w-full h-full object-cover" alt="Sel" /></div><div><h3 className="text-slate-900 font-black text-2xl uppercase tracking-tighter">Trung Tâm Hậu Kỳ</h3><div className="text-[10px] text-orange-600 font-black uppercase tracking-widest mt-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>Chế độ kiểm duyệt & xuất bản</div></div></div>
             <div className="flex flex-wrap justify-center gap-5">
                 <button onClick={() => onSaveDesign(selectedImage, editablePrompt)} disabled={isSaving} className="px-10 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-slate-200 shadow-sm transition-all disabled:opacity-50">Lưu Thư Viện</button>
                 <button onClick={handleStartSeparation} disabled={externalAssets.loading} className="px-10 py-5 bg-white border border-blue-200 text-blue-600 text-[10px] font-black rounded-2xl hover:bg-blue-50 transition-all uppercase tracking-widest shadow-sm">{externalAssets.loading ? 'Đang phân tích...' : 'Tách Lớp Đồ Họa'}</button>
                 <button onClick={() => setShowSmartRemover(true)} className="px-10 py-5 bg-white border border-violet-200 text-violet-600 text-[10px] font-black rounded-2xl hover:bg-violet-50 transition-all uppercase tracking-widest shadow-sm">AI Inpaint Pro</button>
                 <button onClick={() => handleDownload4K(selectedImage)} disabled={isUpscaling} className="px-12 py-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 border-t-2 border-white/20">{isUpscaling ? 'Đang Nâng Cấp...' : 'Tải File In (4K)'}</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
