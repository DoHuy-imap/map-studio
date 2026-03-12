import React, { useState, useRef, useEffect, useCallback } from 'react';
import { upscaleImageTo4K, processAiTemplate } from '../services/geminiService';
import { useAuth } from '../contexts/UserContext';
import { saveDesignToHistory } from '../services/historyDb';
import { ProductType, QualityLevel, ProductionModel, VisualStyle, ColorOption } from '../types';

interface DrawPath {
  x: number;
  y: number;
  size: number;
  mode: 'add' | 'remove';
}

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

const getClosestAspectRatio = (w: number, h: number): string => {
    const ratio = w / h;
    const supported = [
        { name: "1:1", val: 1 },
        { name: "3:4", val: 3/4 },
        { name: "4:3", val: 4/3 },
        { name: "9:16", val: 9/16 },
        { name: "16:9", val: 16/9 }
    ];
    let closest = supported[0];
    let minDiff = Math.abs(ratio - closest.val);
    for (let i = 1; i < supported.length; i++) {
        const diff = Math.abs(ratio - supported[i].val);
        if (diff < minDiff) {
            minDiff = diff;
            closest = supported[i];
        }
    }
    return closest.name;
};

const AiTemplateDesign: React.FC = () => {
    const { user, addSessionCost } = useAuth();
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [instruction, setInstruction] = useState('');
    const [width, setWidth] = useState<number | ''>('');
    const [height, setHeight] = useState<number | ''>('');
    const [keepOriginalSize, setKeepOriginalSize] = useState(true);
    const [brushMode, setBrushMode] = useState<'remove' | 'add'>('remove');
    const [brushSize, setBrushSize] = useState(40);
    const [isProcessing, setIsProcessing] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    // Canvas state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [paths, setPaths] = useState<DrawPath[][]>([]); 
    const [currentPath, setCurrentPath] = useState<DrawPath[]>([]);
    const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
    
    // Zoom & Pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setUploadedImage(event.target.result as string);
                setResultImage(null);
                setPaths([]);
                setZoom(1);
                setPan({ x: 0, y: 0 });
            }
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        if (!uploadedImage || resultImage) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = uploadedImage;
        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
            
            // Set initial width/height if keepOriginalSize is true
            if (keepOriginalSize && width === '' && height === '') {
                setWidth(img.naturalWidth);
                setHeight(img.naturalHeight);
            }
            
            ctx.drawImage(img, 0, 0);
            drawPaths(ctx);
        };
    }, [uploadedImage, resultImage, keepOriginalSize]);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || resultImage || !uploadedImage) return; 
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = uploadedImage;
        if (img.complete) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawPaths(ctx);
        } else {
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                drawPaths(ctx);
            };
        }
    }, [uploadedImage, resultImage, paths, currentPath]);

    const drawPaths = (ctx: CanvasRenderingContext2D) => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const allPaths = [...paths, currentPath];
        allPaths.forEach(path => {
            if (path.length < 1) return;
            ctx.strokeStyle = path[0].mode === 'add' ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'; 
            ctx.beginPath();
            ctx.lineWidth = path[0].size;
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();
        });
    };

    useEffect(() => { redraw(); }, [paths, currentPath, redraw]);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!canvasRef.current || !containerRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        
        // Calculate coordinates relative to the canvas element, accounting for CSS transform scale
        const x = (clientX - rect.left) / zoom;
        const y = (clientY - rect.top) / zoom;
        
        // Scale to actual canvas resolution
        const scaleX = canvasRef.current.width / (rect.width / zoom);
        const scaleY = canvasRef.current.height / (rect.height / zoom);
        
        return { x: x * scaleX, y: y * scaleY };
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (isProcessing || resultImage) return;
        
        // If holding space or middle click, start panning
        if (('button' in e && e.button === 1) || e.altKey) {
            setIsPanning(true);
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            setLastPanPos({ x: clientX, y: clientY });
            return;
        }

        setIsDrawing(true);
        const coords = getCoordinates(e);
        const scaledSize = brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1);
        setCurrentPath([{ x: coords.x, y: coords.y, size: scaledSize, mode: brushMode }]); 
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (isProcessing || resultImage) return;

        if (isPanning) {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            const dx = clientX - lastPanPos.x;
            const dy = clientY - lastPanPos.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastPanPos({ x: clientX, y: clientY });
            return;
        }

        if (!isDrawing) return;
        const coords = getCoordinates(e);
        const scaledSize = brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1);
        setCurrentPath(prev => [...prev, { x: coords.x, y: coords.y, size: scaledSize, mode: brushMode }]);
    };

    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }
        if (!isDrawing) return;
        setIsDrawing(false);
        if (currentPath.length > 0) { 
            setPaths(prev => [...prev, currentPath]); 
            setCurrentPath([]); 
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomChange = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.min(Math.max(0.1, prev * zoomChange), 5));
        }
    };

    const handleProcess = async () => {
        if (!uploadedImage) return;
        setIsProcessing(true);
        
        try {
            let maskBase64: string | null = null;
            
            if (paths.length > 0) {
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = imageSize.w;
                maskCanvas.height = imageSize.h;
                const mCtx = maskCanvas.getContext('2d');
                if (mCtx) {
                    mCtx.fillStyle = '#000000';
                    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                    mCtx.lineCap = 'round'; mCtx.lineJoin = 'round'; mCtx.strokeStyle = '#FFFFFF';
                    paths.forEach(path => {
                        if (path.length < 1) return;
                        mCtx.beginPath();
                        mCtx.lineWidth = path[0].size; 
                        mCtx.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) mCtx.lineTo(path[i].x, path[i].y);
                        mCtx.stroke();
                    });
                    maskBase64 = maskCanvas.toDataURL('image/png');
                }
            }

            let targetAspectRatio: string | undefined = undefined;
            if (!keepOriginalSize && width && height) {
                targetAspectRatio = getClosestAspectRatio(Number(width), Number(height));
            }

            const result = await processAiTemplate(uploadedImage, maskBase64, instruction, targetAspectRatio);
            if (result) {
                setResultImage(result);
                addSessionCost(1500); // Cost for AI Template processing
            } else {
                alert("Không thể xử lý ảnh. Vui lòng thử lại.");
            }
        } catch (error) {
            console.error("Error processing AI Template:", error);
            alert("Đã xảy ra lỗi trong quá trình xử lý.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpscale = async () => {
        if (!uploadedImage) return;
        setIsProcessing(true);
        try {
            let targetAspectRatio = "1:1";
            if (!keepOriginalSize && width && height) {
                targetAspectRatio = getClosestAspectRatio(Number(width), Number(height));
            } else {
                targetAspectRatio = getClosestAspectRatio(imageSize.w, imageSize.h);
            }
            
            // For simple upscale without edits, we just call upscaleImageTo4K directly on the uploaded image
            const res = await upscaleImageTo4K(uploadedImage, targetAspectRatio);
            setResultImage(res);
            addSessionCost(2000);
        } catch (e) {
            alert("Lỗi nâng cấp ảnh.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload4K = async () => {
        if (!resultImage) return;
        setIsUpscaling(true);
        try {
            let targetAspectRatio = "1:1";
            if (!keepOriginalSize && width && height) {
                targetAspectRatio = getClosestAspectRatio(Number(width), Number(height));
            } else {
                targetAspectRatio = getClosestAspectRatio(imageSize.w, imageSize.h);
            }
            const res = await upscaleImageTo4K(resultImage, targetAspectRatio);
            triggerDownload(res, `ai-template-4k-${Date.now()}.png`);
            addSessionCost(2000);
        } catch (e) { 
            alert("Lỗi nâng cấp 4K."); 
        } finally { 
            setIsUpscaling(false); 
        }
    };

    const handleSaveToGallery = async () => {
        if (!user || !resultImage) return;
        setIsSaving(true);
        try {
            const designPlan = {
                subject: "AI Template Design",
                style: "Custom",
                composition: "Custom",
                colorAndLighting: "Custom",
                decorElements: "Custom",
                typography: "Custom"
            };
            
            await saveDesignToHistory({
                requestData: {
                    productType: ProductType.POSTER,
                    mainHeadline: instruction || "AI Template Processing",
                    typoReferenceImage: null,
                    secondaryText: "",
                    layoutRequirements: "",
                    visualStyle: VisualStyle.MODERN_TECH,
                    colorOption: ColorOption.AI_CUSTOM,
                    customColors: [],
                    useCMYK: false,
                    width: width.toString(),
                    height: height.toString(),
                    logoImages: [],
                    assetImages: [],
                    referenceImages: [],
                    batchSize: 1,
                    quality: QualityLevel.LOW,
                    productionModel: ProductionModel.NANO_BANANA
                },
                designPlan: {
                    subject: "AI Template Design",
                    styleContext: "Custom",
                    composition: "Custom",
                    colorLighting: "Custom",
                    decorElements: "Custom",
                    typography: "Custom"
                },
                thumbnail: resultImage,
                finalPrompt: instruction || "AI Template Processing",
                recommendedAspectRatio: keepOriginalSize ? "1:1" : getClosestAspectRatio(Number(width) || 1, Number(height) || 1),
                author: user.displayName
            });
            alert("Đã lưu vào thư viện thành công!");
        } catch (error) {
            console.error("Error saving to gallery:", error);
            alert("Lỗi khi lưu vào thư viện.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setUploadedImage(null);
        setResultImage(null);
        setInstruction('');
        setPaths([]);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full animate-fade-in">
            {/* Left Panel: Controls */}
            <div className="lg:col-span-4 h-full flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Thiết Kế Mẫu AI</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Tái tạo & Chỉnh sửa</p>
                    </div>
                    {uploadedImage && (
                        <button onClick={handleReset} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm" title="Dự án mới">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    {/* Upload Section */}
                    {!uploadedImage && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tải ảnh mẫu lên</label>
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg className="w-8 h-8 mb-3 text-slate-400 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                    <p className="mb-2 text-xs text-slate-500 font-medium"><span className="font-bold">Click để tải lên</span> hoặc kéo thả</p>
                                    <p className="text-[10px] text-slate-400">PNG, JPG, WEBP</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                        </div>
                    )}

                    {uploadedImage && (
                        <>
                            {/* Instruction Input */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung yêu cầu</label>
                                <textarea 
                                    value={instruction}
                                    onChange={(e) => setInstruction(e.target.value)}
                                    placeholder="Ví dụ: Bỏ toàn bộ text, thêm đám mây..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-700 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all resize-none h-24 font-medium placeholder-slate-400"
                                />
                            </div>

                            {/* Dimensions */}
                            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kích thước đầu ra</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={keepOriginalSize} 
                                            onChange={(e) => setKeepOriginalSize(e.target.checked)}
                                            className="w-3.5 h-3.5 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                                        />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Giữ nguyên mẫu</span>
                                    </label>
                                </div>
                                {!keepOriginalSize && (
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">W</span>
                                                <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || '')} className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500/20 outline-none" placeholder="1080" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">H</span>
                                                <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value) || '')} className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500/20 outline-none" placeholder="1920" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Brush Controls */}
                            {!resultImage && (
                                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Công cụ AI Inpaint Pro</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setBrushMode('remove')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${brushMode === 'remove' ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>Cọ Xóa (Đỏ)</button>
                                        <button onClick={() => setBrushMode('add')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${brushMode === 'add' ? 'bg-green-50 border-green-200 text-green-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>Cọ Thêm (Xanh)</button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Size</span>
                                        <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className={`flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer ${brushMode === 'add' ? 'accent-green-500' : 'accent-red-500'}`} />
                                        <button onClick={() => setPaths(prev => prev.slice(0, -1))} disabled={paths.length === 0} className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-20 transition-colors bg-white rounded-lg border border-slate-200 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium italic text-center">Giữ Alt/Option để kéo di chuyển ảnh. Cuộn chuột để Zoom.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Actions */}
                {uploadedImage && !resultImage && (
                    <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-2 gap-4">
                        <button 
                            onClick={handleUpscale} 
                            disabled={isProcessing} 
                            className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200 disabled:opacity-50"
                        >
                            Upscale
                        </button>
                        <button 
                            onClick={handleProcess} 
                            disabled={isProcessing} 
                            className="py-4 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isProcessing ? 'Đang xử lý...' : 'Thực Hiện'}
                        </button>
                    </div>
                )}
            </div>

            {/* Right Panel: Canvas / Result */}
            <div className="lg:col-span-8 h-full bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                {!uploadedImage ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Chưa có ảnh mẫu</h3>
                        <p className="text-sm font-medium max-w-md">Tải lên một mẫu thiết kế từ phần mềm AI của bạn để bắt đầu quá trình tái tạo và chỉnh sửa.</p>
                    </div>
                ) : resultImage ? (
                    <div className="flex-1 flex flex-col relative">
                        <div 
                            className="flex-1 p-6 flex items-center justify-center bg-slate-50/50 overflow-hidden relative group cursor-pointer"
                            onClick={() => setIsPreviewModalOpen(true)}
                        >
                            <img src={resultImage} alt="Result" className="max-w-full max-h-full object-contain rounded-xl shadow-lg animate-fade-in transition-transform group-hover:scale-[1.02]" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                <div className="bg-white/90 text-slate-800 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg transform scale-90 group-hover:scale-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-white border-t border-slate-100 flex justify-center gap-4">
                            <button onClick={handleSaveToGallery} disabled={isSaving} className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200 disabled:opacity-50">
                                {isSaving ? 'Đang lưu...' : 'Lưu Thư Viện'}
                            </button>
                            <button onClick={handleDownload4K} disabled={isUpscaling} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50">
                                {isUpscaling ? 'Đang Nâng Cấp...' : 'Tải Về 4K'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div 
                        ref={containerRef}
                        className="flex-1 relative overflow-hidden bg-slate-100 cursor-crosshair"
                        onWheel={handleWheel}
                    >
                        <div 
                            className="absolute inset-0 flex items-center justify-center origin-center transition-transform duration-75 ease-out"
                            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                        >
                            <canvas 
                                ref={canvasRef} 
                                onMouseDown={handleMouseDown} 
                                onMouseMove={handleMouseMove} 
                                onMouseUp={handleMouseUp} 
                                onMouseLeave={handleMouseUp} 
                                onTouchStart={handleMouseDown} 
                                onTouchMove={handleMouseMove} 
                                onTouchEnd={handleMouseUp} 
                                className="max-w-none shadow-xl"
                                style={{ 
                                    cursor: isPanning ? 'grab' : (brushMode === 'add' ? 'crosshair' : 'crosshair'),
                                    touchAction: 'none'
                                }}
                            />
                        </div>
                        
                        {/* Zoom Controls Overlay */}
                        <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-white/90 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-slate-200/50">
                            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.2))} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                            <span className="text-[10px] font-black text-slate-700 w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                            <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors" title="Reset View"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                        </div>
                    </div>
                )}
                
                {isProcessing && (
                    <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-orange-500/20 rounded-full animate-pulse"></div>
                            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-slate-900 font-black uppercase tracking-[0.3em] mt-8 animate-pulse text-sm">Đang tái tạo thiết kế...</p>
                        <p className="text-[10px] text-slate-400 uppercase mt-2 font-bold tracking-widest">Hệ thống AI đang làm việc</p>
                    </div>
                )}
            </div>

            {/* Fullscreen Preview Modal */}
            {isPreviewModalOpen && resultImage && (
                <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col animate-fade-in">
                    <div className="flex justify-end p-4">
                        <button onClick={() => setIsPreviewModalOpen(false)} className="p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                        <img src={resultImage} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl" />
                    </div>
                    <div className="p-6 bg-slate-900/50 border-t border-white/10 flex justify-center gap-4">
                        <button onClick={() => { handleSaveToGallery(); setIsPreviewModalOpen(false); }} disabled={isSaving} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/10 disabled:opacity-50">
                            {isSaving ? 'Đang lưu...' : 'Lưu Thư Viện'}
                        </button>
                        <button onClick={() => { handleDownload4K(); setIsPreviewModalOpen(false); }} disabled={isUpscaling} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50">
                            {isUpscaling ? 'Đang Nâng Cấp...' : 'Tải Về 4K'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiTemplateDesign;
