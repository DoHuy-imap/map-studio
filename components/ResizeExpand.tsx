import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio } from '../types';

interface ResizeExpandProps {
  imageUrl: string;
  onClose: () => void;
  onProcess: (compositeImageBase64: string, textDescription: string, targetRatio: AspectRatio) => void;
  isProcessing: boolean;
  currentRatio: AspectRatio;
}

const ResizeExpand: React.FC<ResizeExpandProps> = ({
  imageUrl,
  onClose,
  onProcess,
  isProcessing,
  currentRatio
}) => {
  const [activeTab, setActiveTab] = useState<'scale' | 'ratio'>('scale');
  const [scale, setScale] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [targetRatio, setTargetRatio] = useState<AspectRatio>(currentRatio);
  const [description, setDescription] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const ratios: AspectRatio[] = ['16:9', '4:3', '1:1', '3:4', '9:16'];

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    drawCanvas();
  }, [scale, position, targetRatio, activeTab]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine canvas size based on target ratio
    let canvasWidth = img.width;
    let canvasHeight = img.height;

    if (activeTab === 'ratio') {
      const parts = targetRatio.split(':');
      const ratioW = parseInt(parts[0]);
      const ratioH = parseInt(parts[1]);
      const targetR = ratioW / ratioH;
      const imgR = img.width / img.height;

      if (targetR > imgR) {
        // Wider target
        canvasHeight = img.height;
        canvasWidth = img.height * targetR;
      } else {
        // Taller target
        canvasWidth = img.width;
        canvasHeight = img.width / targetR;
      }
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    let drawWidth = img.width;
    let drawHeight = img.height;
    let drawX = (canvasWidth - drawWidth) / 2;
    let drawY = (canvasHeight - drawHeight) / 2;

    if (activeTab === 'scale') {
      const scaleFactor = scale / 100;
      drawWidth = img.width * scaleFactor;
      drawHeight = img.height * scaleFactor;
      
      // Apply position offset
      drawX = (canvasWidth - drawWidth) / 2 + position.x;
      drawY = (canvasHeight - drawHeight) / 2 + position.y;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTab !== 'scale') return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || activeTab !== 'scale') return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleAlign = (alignment: 'center' | 'left' | 'right' | 'top' | 'bottom') => {
    if (!canvasRef.current || !imageRef.current) return;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const scaleFactor = scale / 100;
    const drawWidth = img.width * scaleFactor;
    const drawHeight = img.height * scaleFactor;

    let newX = 0;
    let newY = 0;

    switch (alignment) {
      case 'center':
        newX = 0;
        newY = 0;
        break;
      case 'left':
        newX = -(canvas.width - drawWidth) / 2;
        break;
      case 'right':
        newX = (canvas.width - drawWidth) / 2;
        break;
      case 'top':
        newY = -(canvas.height - drawHeight) / 2;
        break;
      case 'bottom':
        newY = (canvas.height - drawHeight) / 2;
        break;
    }
    setPosition({ x: newX, y: newY });
  };

  const handleProcess = () => {
    if (!canvasRef.current) return;
    const compositeImageBase64 = canvasRef.current.toDataURL('image/png');
    onProcess(compositeImageBase64, description, activeTab === 'ratio' ? targetRatio : currentRatio);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Tùy chỉnh kích thước</h2>
            <p className="text-sm text-slate-500 font-medium">Resize & Expand (Outpainting)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 bg-slate-100 p-6 flex items-center justify-center overflow-hidden relative" ref={containerRef}>
            <div 
              className="relative shadow-lg ring-1 ring-slate-200/50"
              style={{
                backgroundColor: '#ffffff',
                backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                maxWidth: '100%',
                maxHeight: '100%',
                cursor: activeTab === 'scale' ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            >
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-[60vh] object-contain block"
              />
            </div>
          </div>

          {/* Controls Area */}
          <div className="w-full lg:w-96 bg-white border-l border-slate-100 flex flex-col overflow-y-auto">
            <div className="flex border-b border-slate-100">
              <button 
                onClick={() => { setActiveTab('scale'); setPosition({x:0, y:0}); }}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'scale' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Mở rộng trong khung
              </button>
              <button 
                onClick={() => { setActiveTab('ratio'); setScale(100); setPosition({x:0, y:0}); }}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === 'ratio' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Đổi Tỷ Lệ Mới
              </button>
            </div>

            <div className="p-6 flex-1 flex flex-col gap-6">
              {activeTab === 'scale' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div>
                    <label className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">
                      <span>Thu nhỏ ảnh gốc (Scale)</span>
                      <span className="text-emerald-600">{scale}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="50" max="100" 
                      value={scale} 
                      onChange={(e) => setScale(parseInt(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Căn lề nhanh</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => handleAlign('top')} className="col-start-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                      <button onClick={() => handleAlign('left')} className="col-start-1 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                      <button onClick={() => handleAlign('center')} className="col-start-2 p-2 bg-slate-200 hover:bg-slate-300 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                      <button onClick={() => handleAlign('right')} className="col-start-3 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                      <button onClick={() => handleAlign('bottom')} className="col-start-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ratio' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Chọn tỷ lệ mới</label>
                    <div className="grid grid-cols-2 gap-3">
                      {ratios.map(r => (
                        <button 
                          key={r}
                          onClick={() => setTargetRatio(r)}
                          className={`py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all ${targetRatio === r ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Căn lề nhanh</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => handleAlign('top')} className="col-start-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                      <button onClick={() => handleAlign('left')} className="col-start-1 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                      <button onClick={() => handleAlign('center')} className="col-start-2 p-2 bg-slate-200 hover:bg-slate-300 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg></button>
                      <button onClick={() => handleAlign('right')} className="col-start-3 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                      <button onClick={() => handleAlign('bottom')} className="col-start-2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Mô tả bối cảnh mở rộng (Tùy chọn)</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="VD: Thêm bầu trời xanh, bãi cỏ rộng..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none h-24"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={handleProcess}
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Đang xử lý...</>
                ) : 'Mở Rộng Ảnh'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResizeExpand;
