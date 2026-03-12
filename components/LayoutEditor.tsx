
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LayoutSuggestion, LayoutElement, DynamicLayoutElement } from '../types';

interface LayoutEditorProps {
  layout: LayoutSuggestion;
  dynamicLayout?: DynamicLayoutElement[];
  onLayoutChange: (updatedLayout: LayoutSuggestion) => void;
  onConfirm: (maskBase64: string) => void;
  onRefreshLayout: () => void;
  isRefreshing: boolean;
}

const LayoutEditor: React.FC<LayoutEditorProps> = ({ 
    layout, 
    dynamicLayout,
    onLayoutChange, 
    onConfirm,
    onRefreshLayout,
    isRefreshing
}) => {
  const [elements, setElements] = useState<LayoutElement[]>(layout.elements);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [history, setHistory] = useState<LayoutElement[][]>([JSON.parse(JSON.stringify(layout.elements))]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [activeAction, setActiveAction] = useState<{ id: string, type: 'move' | 'resize' } | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setElements(layout.elements);
    setHistory([JSON.parse(JSON.stringify(layout.elements))]);
    setHistoryIndex(0);
  }, [layout]);

  const dynamicAspectRatio = useMemo(() => {
    const parts = layout.canvas_ratio.split(':');
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (!isNaN(w) && !isNaN(h) && h !== 0) {
        return w / h;
      }
    }
    return 1; 
  }, [layout.canvas_ratio]);

  const addToHistory = useCallback((newElements: LayoutElement[]) => {
      setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(JSON.parse(JSON.stringify(newElements)));
          return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          const prevElements = JSON.parse(JSON.stringify(history[newIndex]));
          setHistoryIndex(newIndex);
          setElements(prevElements);
          onLayoutChange({ ...layout, elements: prevElements });
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          const nextElements = JSON.parse(JSON.stringify(history[newIndex]));
          setHistoryIndex(newIndex);
          setElements(nextElements);
          onLayoutChange({ ...layout, elements: nextElements });
      }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, type: 'move' | 'resize') => {
    e.stopPropagation();
    setActiveAction({ id, type });
    setSelectedId(id);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeAction || !containerRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
        const containerRect = containerRef.current!.getBoundingClientRect();
        const deltaX = ((e.clientX - lastPos.current.x) / containerRect.width) * 100;
        const deltaY = ((e.clientY - lastPos.current.y) / containerRect.height) * 100;
        lastPos.current = { x: e.clientX, y: e.clientY };

        setElements(prev => prev.map(el => {
            if (el.id !== activeAction.id) return el;
            
            if (activeAction.type === 'move') {
                const newX = Math.max(0, Math.min(100 - el.rect.width, el.rect.x + deltaX));
                const newY = Math.max(0, Math.min(100 - el.rect.height, el.rect.y + deltaY));
                return { ...el, rect: { ...el.rect, x: newX, y: newY } };
            } else {
                const newWidth = Math.max(5, Math.min(100 - el.rect.x, el.rect.width + deltaX));
                let newHeight = Math.max(5, Math.min(100 - el.rect.y, el.rect.height + deltaY));
                
                if (el.imageRatio) {
                    newHeight = (newWidth * dynamicAspectRatio) / el.imageRatio;
                }
                return { ...el, rect: { ...el.rect, width: newWidth, height: newHeight } };
            }
        }));
    });
  }, [activeAction, dynamicAspectRatio]);

  const handleMouseUp = useCallback(() => {
    if (activeAction) {
      setActiveAction(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      addToHistory(elements);
      onLayoutChange({ ...layout, elements });
    }
  }, [activeAction, elements, layout, onLayoutChange, addToHistory]);

  useEffect(() => {
    if (activeAction) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeAction, handleMouseMove, handleMouseUp]);

  const generateCleanMask = (): string => {
      const canvas = document.createElement('canvas');
      const width = 1024; 
      const height = Math.round(width / dynamicAspectRatio);
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height);
      elements.forEach(el => {
          ctx.fillStyle = el.color; 
          ctx.fillRect((el.rect.x / 100) * width, (el.rect.y / 100) * height, (el.rect.width / 100) * width, (el.rect.height / 100) * height);
      });
      return canvas.toDataURL('image/png');
  };

  const getElementTheme = (type: string, name: string) => {
    if (type === 'subject') return { bg: 'rgba(16, 185, 129, 0.6)', border: 'border-emerald-500', text: 'text-emerald-400' };
    if (type === 'logo') return { bg: 'rgba(234, 179, 8, 0.6)', border: 'border-yellow-500', text: 'text-yellow-400' };
    if (type === 'decor') return { bg: 'rgba(168, 85, 247, 0.6)', border: 'border-purple-500', text: 'text-purple-400' };
    if (type === 'text') {
        if (name.toLowerCase().includes('main')) return { bg: 'rgba(59, 130, 246, 0.7)', border: 'border-blue-500', text: 'text-blue-400' };
        return { bg: 'rgba(71, 85, 105, 0.6)', border: 'border-slate-400', text: 'text-slate-400' };
    }
    return { bg: 'rgba(100, 116, 139, 0.5)', border: 'border-slate-500', text: 'text-slate-500' };
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden flex flex-col mt-4 shadow-xl">
       <div className="bg-slate-50/80 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
           <div className="flex items-center gap-6">
               <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                   <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                   Bố Cục Động (AI Suggested)
               </h4>
               <div className="flex gap-3">
                   <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 disabled:opacity-20 transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                   <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 disabled:opacity-20 transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
                   <button onClick={onRefreshLayout} disabled={isRefreshing} className={`p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-all active:scale-90 ${isRefreshing ? 'animate-spin opacity-50' : ''}`} title="Làm mới đề xuất"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
               </div>
           </div>
           <div className="text-[11px] text-orange-600 bg-slate-50 px-4 py-2 rounded-2xl font-black border border-slate-200">
               Canvas: {layout.canvas_ratio}
           </div>
       </div>

       <div className="flex flex-col md:flex-row h-[550px]">
           {/* Container cho Canvas Layout */}
           <div className="flex-1 p-8 flex items-center justify-center bg-slate-50 relative overflow-hidden">
                <div 
                    ref={containerRef} 
                    className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" 
                    style={{ 
                        aspectRatio: `${dynamicAspectRatio}`,
                        maxHeight: '100%',
                        maxWidth: '100%',
                        width: dynamicAspectRatio >= 1 ? '100%' : 'auto',
                        height: dynamicAspectRatio < 1 ? '100%' : 'auto'
                    }}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]"></div>
                    
                    {/* Dynamic Layout Guides (Suggested Boxes) */}
                    {dynamicLayout && dynamicLayout.map((box, idx) => (
                        <div 
                            key={`guide-${box.id}-${idx}`}
                            className="absolute border border-orange-500/30 bg-orange-500/5 pointer-events-none z-[10] flex items-start justify-start p-1"
                            style={{
                                left: `${box.left}%`,
                                top: `${box.top}%`,
                                width: `${box.width}%`,
                                height: `${box.height}%`,
                                borderStyle: 'dashed'
                            }}
                        >
                            <span className="text-[7px] font-black text-orange-500/40 uppercase tracking-widest">Suggested {box.id}</span>
                        </div>
                    ))}

                    {elements.map((el, index) => {
                        const theme = getElementTheme(el.type, el.name);
                        return (
                        <div 
                            key={el.id || `canvas-el-${index}`} 
                            onMouseDown={(e) => handleMouseDown(e, el.id, 'move')} 
                            className={`absolute flex flex-col items-center justify-center text-center cursor-move select-none group border-[3px] transition-all duration-300 shadow-xl ${el.id === selectedId ? 'z-[100] border-white ring-4 ring-white/10' : `z-[50] ${theme.border} hover:z-[60]`}`} 
                            style={{ 
                                left: `${el.rect.x}%`, 
                                top: `${el.rect.y}%`, 
                                width: `${el.rect.width}%`, 
                                height: `${el.rect.height}%`, 
                                backgroundColor: theme.bg,
                                borderStyle: 'dashed',
                                pointerEvents: 'auto'
                            }}
                        >
                            <div className="p-2 pointer-events-none flex flex-col items-center">
                                <span className="text-[9px] font-black text-white uppercase tracking-tighter drop-shadow-md line-clamp-2 leading-tight">{el.name}</span>
                                <div className="px-2 py-0.5 bg-black/60 rounded-full mt-2 border border-white/10">
                                    <span className="text-[7px] text-white/90 font-black uppercase tracking-widest">{el.type}</span>
                                </div>
                            </div>
                            {el.id === selectedId && (
                                <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-end justify-end p-1">
                                    <div className="w-3 h-3 bg-white rounded-full shadow-lg border-2 border-slate-900" />
                                </div>
                            )}
                        </div>
                        );
                    })}
                </div>
           </div>

            <div className="w-full md:w-64 bg-slate-50 border-l border-slate-200 flex flex-col">
               <div className="p-4 border-b border-slate-100 bg-slate-100/50">
                   <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Danh sách Layers</h5>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
                   {[...elements].reverse().map((el, index) => {
                       const theme = getElementTheme(el.type, el.name);
                       return (
                           <div 
                               key={el.id || `list-el-${index}`} 
                               onClick={() => setSelectedId(el.id)}
                               className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${el.id === selectedId ? 'bg-white border-orange-500/40 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-100'}`}
                           >
                               <div className={`w-3 h-3 rounded-full ${theme.text.replace('text-', 'bg-')} border border-white/10`}></div>
                               <div className="flex-1 min-w-0">
                                   <p className={`text-[10px] font-black truncate ${el.id === selectedId ? 'text-slate-900' : 'text-slate-400'}`}>{el.name}</p>
                               </div>
                           </div>
                       )
                   })}
               </div>
           </div>
       </div>
       
       <div className="bg-slate-50/80 px-8 py-4 flex justify-end border-t border-slate-100">
           <button onClick={() => onConfirm(generateCleanMask())} className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-10 py-3.5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Xác Nhận & Sản Xuất</button>
       </div>
    </div>
  );
};

export default LayoutEditor;
