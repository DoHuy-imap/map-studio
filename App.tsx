
import React, { useState, useEffect, useCallback } from 'react';
import InputForm from './components/InputForm';
import ResultDisplay from './components/ResultDisplay';
import GalleryView from './components/GalleryView';
import Dashboard from './components/Dashboard';
import AiTemplateDesign from './components/AiTemplateDesign';
import StockAi from './components/StockAi';
import LoginScreen from './components/LoginScreen';
import { 
  ArtDirectionRequest, ArtDirectionResponse, ColorOption, ImageGenerationResult, 
  ProductType, VisualStyle, QualityLevel, SeparatedAssets, DesignPlan, 
  StudioImage, ProductionModel
} from './types';
import { 
  generateArtDirection, generateDesignImage, separateDesignComponents, 
  regeneratePromptFromPlan, removeObjectWithMask, estimateRequestCost 
} from './services/geminiService';
import { saveDesignToHistory } from './services/historyDb';
import { useAuth } from './contexts/UserContext';

// Define initialRequest outside to ensure reference stability
const initialRequest: ArtDirectionRequest = {
  productType: ProductType.POSTER,
  mainHeadline: '',
  typoReferenceImage: null,
  secondaryText: '',
  layoutRequirements: '',
  visualStyle: VisualStyle.MODERN_TECH,
  colorOption: ColorOption.AI_CUSTOM,
  customColors: ['#FFD300', '#000000', '#FFFFFF'],
  useCMYK: false,
  width: '60',
  height: '90',
  assetImages: [],
  logoImages: [],
  referenceImages: [], 
  batchSize: 1,
  quality: QualityLevel.LOW,
  productionModel: ProductionModel.NANO_BANANA_2
};

const MapMiniLogo = () => (
  <div className="w-10 h-10 bg-black border-2 border-[#FFD300] rounded-xl flex items-center justify-center shadow-lg shadow-[#FFD300]/10 overflow-hidden">
     <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1.5">
        <path d="M50 15C42 15 35 22 35 30C35 35 38 40 42 42V55H58V42C62 40 65 35 65 30C65 22 58 15 50 15Z" stroke="white" strokeWidth="4"/>
        <path d="M42 55L35 75L50 85L65 75L58 55H42Z" fill="#FFD300" stroke="white" strokeWidth="4"/>
        <path d="M42 55L35 75" stroke="#E91E63" strokeWidth="6"/>
        <path d="M50 55V85" stroke="#FFD300" strokeWidth="6"/>
        <path d="M58 55L65 75" stroke="#00BCD4" strokeWidth="6"/>
     </svg>
  </div>
);

const App: React.FC = () => {
  const { user, logout, addSessionCost, sessionCost, totalCost } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'studio' | 'gallery' | 'ai-template' | 'stock-ai'>('home');
  const [refreshGalleryKey, setRefreshGalleryKey] = useState(0);

  // Use state spread to ensure fresh copy
  const [request, setRequest] = useState<ArtDirectionRequest>({ ...initialRequest });
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    const cost = estimateRequestCost(request);
    setEstimatedCost(cost.totalCostVND);
  }, [request]);

  const [artDirection, setArtDirection] = useState<ArtDirectionResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false); 
  const [imageResult, setImageResult] = useState<ImageGenerationResult>({ images: [], loading: false, error: null });
  const [refinementResult, setRefinementResult] = useState<ImageGenerationResult>({ images: [], loading: false, error: null });
  const [separatedAssets, setSeparatedAssets] = useState<SeparatedAssets>({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: keyof ArtDirectionRequest, value: any) => {
    setRequest(prev => ({ ...prev, [field]: value }));
  };

  const handleResetBrief = useCallback(() => {
    // Force a fresh reset of all states
    setRequest({ ...initialRequest });
    setArtDirection(null);
    setImageResult({ images: [], loading: false, error: null });
    setRefinementResult({ images: [], loading: false, error: null });
    setSeparatedAssets({ background: null, textLayer: null, subjects: [], decor: [], lighting: null, loading: false, error: null });
    setAnalysisError(null);
    // Switch to studio tab just in case
    setActiveTab('studio');
  }, []);

  const handleAnalyze = async () => {
    if (!request.mainHeadline) {
      setAnalysisError("Vui lòng nhập Tiêu đề chính.");
      return;
    }
    setAnalysisError(null);
    setImageResult({ images: [], loading: false, error: null });
    setArtDirection(null);
    setIsAnalyzing(true);
    try {
      const direction = await generateArtDirection(request);
      setArtDirection(direction);
      addSessionCost(500); // Chi phí phân tích
    } catch (err: any) {
      setAnalysisError(err.message || "Lỗi phân tích brief.");
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const handleUpdatePlan = async (updatedPlan: DesignPlan) => {
    if (!artDirection) return;
    setIsUpdatingPlan(true);
    try {
      const result = await regeneratePromptFromPlan(updatedPlan, request, artDirection.recommendedAspectRatio, artDirection.layout_suggestion);
      setArtDirection(result);
      addSessionCost(500); // Chi phí cập nhật plan
    } catch (err: any) {
      setAnalysisError("Cập nhật thất bại: " + err.message);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleGenerateFinalImages = async (finalPrompt: string, append: boolean = false, layoutMask: string | null = null) => {
    setImageResult(prev => ({ ...prev, loading: true, error: null }));
    try {
      const urls = await generateDesignImage(
        finalPrompt,
        artDirection?.recommendedAspectRatio || "1:1",
        request.batchSize,
        request.quality,
        request.assetImages,
        request.logoImages,
        layoutMask,
        request.productionModel
      );
      const newImages: StudioImage[] = urls.map(url => ({ 
        url, 
        isNew: true,
        model: request.productionModel 
      }));
      setImageResult(prev => ({
          images: (append || prev.images.length > 0) ? [...prev.images.map(img => ({ ...img, isNew: false })), ...newImages] : newImages,
          loading: false,
          error: null
      }));
      
      let costPerImage = 1000;
      if (request.quality === QualityLevel.HIGH) costPerImage = 5000;
      else if (request.quality === QualityLevel.MEDIUM) costPerImage = 2500;
      addSessionCost(urls.length * costPerImage);
    } catch (err: any) {
      setImageResult(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleSeparateLayout = async (selectedImage: string) => {
    if (!artDirection) return;
    setSeparatedAssets(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await separateDesignComponents(
        artDirection.final_prompt,
        artDirection.recommendedAspectRatio,
        request.quality,
        selectedImage
      );
      setSeparatedAssets({ ...result, loading: false, error: null });
      
      const layerImages: StudioImage[] = [];
      if (result.background) layerImages.push({ url: result.background, isNew: true });
      if (result.textLayer) layerImages.push({ url: result.textLayer, isNew: true });
      
      if (layerImages.length > 0) {
          setImageResult(prev => ({
              ...prev,
              images: [...prev.images.map(img => ({ ...img, isNew: false })), ...layerImages]
          }));
      }
      addSessionCost(2000); // Chi phí tách nền
    } catch (err: any) {
      setSeparatedAssets(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleSeparateLayoutFromGallery = async (selectedImage: string, finalPrompt: string, aspectRatio: string, quality: QualityLevel) => {
    setSeparatedAssets(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await separateDesignComponents(
        finalPrompt,
        aspectRatio as any,
        quality || QualityLevel.LOW,
        selectedImage
      );
      setSeparatedAssets({ ...result, loading: false, error: null });
      
      const layerImages: StudioImage[] = [];
      layerImages.push({ url: selectedImage, isNew: true });
      if (result.background) layerImages.push({ url: result.background, isNew: true });
      if (result.textLayer) layerImages.push({ url: result.textLayer, isNew: true });
      
      if (layerImages.length > 0) {
          setImageResult(prev => ({
              ...prev,
              images: [...prev.images.map(img => ({ ...img, isNew: false })), ...layerImages]
          }));
      }
      addSessionCost(2000); // Chi phí tách nền
    } catch (err: any) {
      setSeparatedAssets(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleSmartRemove = async (sourceImage: string, maskBase64: string, textDescription: string) => {
    setRefinementResult(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await removeObjectWithMask(sourceImage, maskBase64, textDescription);
      if (res) {
        const newImg = { url: res, isNew: true };
        setImageResult(prev => ({
           ...prev,
           images: [...prev.images.map(img => ({ ...img, isNew: false })), newImg], 
        }));
        setRefinementResult(prev => ({ ...prev, images: [newImg], loading: false, error: null }));
        addSessionCost(1000); // Chi phí xóa vật thể
      }
    } catch (err: any) {
      setRefinementResult(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleSaveDesign = useCallback(async (imageUrl: string) => {
    if (!user || !artDirection) return;
    setIsSaving(true);
    try {
      await saveDesignToHistory({
        thumbnail: imageUrl,
        requestData: JSON.parse(JSON.stringify(request)),
        designPlan: artDirection.designPlan,
        recommendedAspectRatio: artDirection.recommendedAspectRatio,
        author: user.displayName,
        finalPrompt: artDirection.final_prompt,
      });
      setRefreshGalleryKey(prev => prev + 1);
      alert("Thiết kế đã được lưu vào Thư Viện.");
    } catch (err) {
      console.error("Save error:", err);
      alert("Lỗi khi lưu thiết kế.");
    } finally {
      setIsSaving(false);
    }
  }, [user, artDirection, request]);

  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="relative z-10 container mx-auto px-4 py-6 h-screen flex flex-col">
        <header className="flex items-center justify-between mb-6 shrink-0 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-4">
             <MapMiniLogo />
             <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">M.A.P Studio</h1>
                <span className="text-[9px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm shadow-orange-200">Nano Banana 2.1</span>
              </div>
               <p className="text-[9px] text-orange-600 font-bold uppercase tracking-widest opacity-80">AI Art Direction & Design Engine</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-100">
               <div className="flex items-center gap-2">
                 <span className="text-[9px] font-bold text-emerald-600 uppercase">Phiên:</span>
                 <span className="text-xs font-black text-emerald-700">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(sessionCost)}</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[9px] font-bold text-emerald-600 uppercase">Tổng:</span>
                 <span className="text-[10px] font-black text-emerald-700">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalCost)}</span>
               </div>
             </div>
             <nav className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex gap-1">
                 <button onClick={() => setActiveTab('home')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'home' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Home</button>
                 <button onClick={() => setActiveTab('studio')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'studio' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Studio</button>
                 <button onClick={() => setActiveTab('stock-ai')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'stock-ai' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Stock AI</button>
                 <button onClick={() => setActiveTab('ai-template')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ai-template' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>AI Template</button>
                 <button onClick={() => setActiveTab('gallery')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'gallery' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Gallery</button>
             </nav>
             <button onClick={logout} className="p-2 bg-slate-100 rounded-xl hover:bg-red-50 text-slate-500 hover:text-red-600 transition-all border border-slate-200">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
        </header>

        <main className="flex-grow overflow-hidden min-h-0 pb-2 relative">
           <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'home' ? 'block' : 'hidden'}`}>
              <Dashboard onSelectFeature={setActiveTab as any} />
           </div>
           <div className={`absolute inset-0 ${activeTab === 'ai-template' ? 'block' : 'hidden'}`}>
              <AiTemplateDesign />
           </div>
           <div className={`absolute inset-0 ${activeTab === 'stock-ai' ? 'block' : 'hidden'}`}>
              <StockAi />
           </div>
           <div className={`absolute inset-0 ${activeTab === 'studio' ? 'block' : 'hidden'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  <div className="lg:col-span-4 h-full min-h-[500px]">
                    <InputForm values={request} onChange={handleInputChange} onSubmit={handleAnalyze} onReset={handleResetBrief} isGenerating={isAnalyzing || imageResult.loading} estimatedCost={estimatedCost} />
                  </div>
                  <div className="lg:col-span-8 h-full min-h-[500px]">
                    <ResultDisplay 
                      request={request} 
                      artDirection={artDirection} 
                      imageResult={imageResult} 
                      refinementResult={refinementResult} 
                      isAnalyzing={isAnalyzing} 
                      analysisError={analysisError}
                      isUpdatingPlan={isUpdatingPlan}
                      onGenerateImages={handleGenerateFinalImages} 
                      onUpdatePlan={handleUpdatePlan} 
                      onRegenerateImage={() => {}} 
                      onSeparateLayout={handleSeparateLayout}
                      onRefineImage={() => {}} 
                      onSmartRemove={handleSmartRemove} 
                      onResetRefinement={() => {}} 
                      separatedAssets={separatedAssets} 
                      onSaveDesign={handleSaveDesign} 
                      isSaving={isSaving}
                      onInputChange={handleInputChange}
                    />
                  </div>
              </div>
           </div>
           <div className={`absolute inset-0 overflow-y-auto ${activeTab === 'gallery' ? 'block' : 'hidden'}`}>
              <GalleryView key={refreshGalleryKey} onSeparateLayout={(url, prompt, ratio, quality) => {
                 handleSeparateLayoutFromGallery(url, prompt, ratio, quality);
                 setActiveTab('studio');
              }} />
           </div>
        </main>
      </div>
    </div>
  );
};

export default App;
