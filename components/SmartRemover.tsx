
import React, { useRef, useState, useEffect } from 'react';
import { upscaleImageTo4K } from '../services/geminiService';

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

interface SmartRemoverProps {
  imageUrl: string;
  onClose: () => void;
  onProcess: (maskBase64: string, textDescription: string) => void;
  isProcessing: boolean;
  resultUrl?: string | null;
  aspectRatio?: string; 
}

interface DrawPath {
  x: number;
  y: number;
  size: number;
}

type InpaintMode = 'add' | 'remove' | 'replace';

const SmartRemover: React.FC<SmartRemoverProps> = ({ imageUrl, onClose, onProcess, isProcessing, resultUrl, aspectRatio = "1:1" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [removalDescription, setRemovalDescription] = useState('');
  const [mode, setMode] = useState<InpaintMode>('remove');
  const [paths, setPaths] = useState<DrawPath[][]>([]); 
  const [currentPath, setCurrentPath] = useState<DrawPath[]>([]);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [showOriginal, setShowOriginal] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      ctx.drawImage(img, 0, 0);
    };
  }, [imageUrl]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas || resultUrl) return; 
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
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
  };

  const drawPaths = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = mode === 'add' ? 'rgba(34, 197, 94, 0.7)' : mode === 'replace' ? 'rgba(59, 130, 246, 0.7)' : 'rgba(239, 68, 68, 0.7)'; 
    const allPaths = [...paths, currentPath];
    allPaths.forEach(path => {
      if (path.length < 1) return;
      ctx.beginPath();
      ctx.lineWidth = path[0].size;
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    });
  };

  useEffect(() => { if (!resultUrl) redraw(); }, [paths, currentPath, resultUrl, mode]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing || resultUrl) return;
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setCurrentPath([{ x: coords.x, y: coords.y, size: brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1) }]); 
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing || !isDrawing || resultUrl) return;
    const coords = getCoordinates(e);
    const scaledSize = brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1);
    setCurrentPath(prev => [...prev, { x: coords.x, y: coords.y, size: scaledSize }]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.length > 0) { setPaths(prev => [...prev, currentPath]); setCurrentPath([]); }
  };

  const handleProcess = () => {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imageSize.w;
    maskCanvas.height = imageSize.h;
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;
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
    
    const finalInstruction = `[${mode.toUpperCase()}] ${removalDescription}`;
    onProcess(maskCanvas.toDataURL('image/png'), finalInstruction);
  };

  const handleDownload4K = async () => {
      if (!resultUrl) return;
      setIsUpscaling(true);
      try {
          const res = await upscaleImageTo4K(resultUrl, aspectRatio);
          triggerDownload(res, `map-inpaint-4k-${Date.now()}.png`);
      } catch (e) { alert("Lỗi nâng cấp 4K."); }
      finally { setIsUpscaling(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-5xl bg-white p-6 rounded-[3rem] border border-slate-200 shadow-2xl mb-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-3 rounded-2xl shadow-lg shadow-violet-500/20">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                  <path d="M2 2l7.586 7.586"></path>
                  <circle cx="11" cy="11" r="2"></circle>
               </svg>
             </div>
             <div>
                <h3 className="text-slate-900 text-xl font-black uppercase tracking-tighter">AI Inpaint Pro</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Cọ Chỉnh Sửa - Thêm, Xóa, Thay thế</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
             {!resultUrl && !isProcessing && (
                 <div className="flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-200">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Brush</span>
                    <input type="range" min="10" max="200" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-32 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                    <button onClick={() => setPaths(prev => prev.slice(0, -1))} disabled={paths.length === 0} className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-20 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                 </div>
             )}
             {resultUrl && (
                 <button 
                    onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200 active:scale-95 select-none"
                 >
                    Giữ để So sánh
                 </button>
             )}
             <button onClick={onClose} disabled={isProcessing} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-400 transition-all disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>

        {!resultUrl && !isProcessing && (
            <div className="mt-6 flex flex-col gap-4">
               <div className="flex gap-2">
                  <button onClick={() => setMode('add')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${mode === 'add' ? 'bg-green-50 border-green-200 text-green-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>Thêm chi tiết</button>
                  <button onClick={() => setMode('remove')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${mode === 'remove' ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>Xóa đối tượng</button>
                  <button onClick={() => setMode('replace')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${mode === 'replace' ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>Thay thế</button>
               </div>
               <div className="flex gap-4">
                   <div className="relative flex-1">
                      <div className={`absolute left-5 top-1/2 -translate-y-1/2 ${mode === 'add' ? 'text-green-500' : mode === 'replace' ? 'text-blue-500' : 'text-red-500'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <input 
                          type="text" 
                          placeholder={mode === 'add' ? "Nhập chi tiết muốn thêm (Vd: Thêm một con mèo, thêm đám mây...)" : mode === 'replace' ? "Nhập chi tiết muốn thay thế (Vd: Thay thế bằng bầu trời đêm...)" : "Nhập tên vật thể muốn xóa (Vd: logo, cái cây, người...)"} 
                          className={`w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-xs text-slate-900 focus:ring-2 outline-none transition-all placeholder-slate-300 font-bold ${mode === 'add' ? 'focus:ring-green-500/30' : mode === 'replace' ? 'focus:ring-blue-500/30' : 'focus:ring-red-500/30'}`} 
                          value={removalDescription} 
                          onChange={(e) => setRemovalDescription(e.target.value)} 
                      />
                   </div>
                   <button onClick={handleProcess} disabled={(paths.length === 0 && !removalDescription) || isProcessing} className={`px-10 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-20 border-t border-white/20 ${mode === 'add' ? 'bg-green-600 hover:bg-green-500 shadow-green-600/20' : mode === 'replace' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20' : 'bg-red-600 hover:bg-red-500 shadow-red-600/20'}`}>
                       Thực hiện
                   </button>
               </div>
            </div>
        )}
      </div>

      <div className="relative flex-grow flex items-center justify-center max-w-full overflow-hidden rounded-[3.5rem] bg-slate-50 border border-slate-200 shadow-2xl">
         {resultUrl && !showOriginal ? (
             <img src={resultUrl} className="max-w-full max-h-full object-contain animate-fade-in" alt="Result" />
         ) : (
             <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className={`block max-w-full max-h-full object-contain touch-none ${!resultUrl ? 'cursor-crosshair' : ''}`} />
         )}
         
         {isProcessing && (
             <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
                 <div className="relative">
                    <div className="w-24 h-24 border-4 border-violet-500/20 rounded-full animate-pulse"></div>
                    <div className="absolute top-0 left-0 w-24 h-24 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                 </div>
                 <p className="text-slate-900 font-black uppercase tracking-[0.3em] mt-8 animate-pulse text-sm">Đang tái cấu trúc bối cảnh...</p>
                 <p className="text-[10px] text-slate-400 uppercase mt-2 font-bold tracking-widest">Hệ thống AI Inpaint Pro đang làm việc</p>
             </div>
         )}
      </div>

      {resultUrl && (
          <div className="mt-8 flex gap-6 w-full max-w-2xl relative z-10">
             <button onClick={() => { setPaths([]); setRemovalDescription(''); onClose(); }} className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-slate-200">Đóng & Lưu kết quả</button>
             <button onClick={handleDownload4K} disabled={isUpscaling} className="flex-[2] py-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-orange-500/10 transition-all active:scale-95 disabled:opacity-50 border-t border-white/20">
                {isUpscaling ? 'Đang Nâng Cấp...' : 'Tải File Kết Quả 4K'}
             </button>
          </div>
      )}
    </div>
  );
};

export default SmartRemover;
