
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getAllDesigns, deleteDesign } from '../services/historyDb';
import { DesignDNA } from '../types';
import SmartRemover from './SmartRemover';
import { removeObjectWithMask, upscaleImageTo4K } from '../services/geminiService';
import { useAuth } from '../contexts/UserContext';

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

interface GalleryViewProps {
  onSeparateLayout?: (url: string, finalPrompt: string, aspectRatio: string, quality: any) => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({ onSeparateLayout }) => {
  const { user } = useAuth();
  const [designs, setDesigns] = useState<DesignDNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState<DesignDNA | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editResult, setEditResult] = useState<string | null>(null);
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [filterMine, setFilterMine] = useState(false);

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const data = await getAllDesigns();
      setDesigns(data);
    } catch (e) { console.error("Fetch error", e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDesigns(); }, []);

  const filteredDesigns = useMemo(() => {
    if (!filterMine || !user) return designs;
    return designs.filter(d => d.author === user.displayName);
  }, [designs, filterMine, user]);

  const handleDeleteItem = async (id: number) => {
    if(window.confirm('Xóa vĩnh viễn thiết kế này?')) {
        try {
          await deleteDesign(id);
          setDesigns(prev => prev.filter(d => d.id !== id));
          if (selectedDesign?.id === id) setSelectedDesign(null);
          alert("Đã xóa thiết kế.");
        } catch (err) { alert("Không thể xóa."); }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if(window.confirm(`Xóa ${selectedIds.length} thiết kế đã chọn?`)) {
        try {
          for (const id of selectedIds) {
            await deleteDesign(id);
          }
          setDesigns(prev => prev.filter(d => !selectedIds.includes(d.id!)));
          setSelectedIds([]);
          setIsSelectMode(false);
          alert(`Đã xóa ${selectedIds.length} thiết kế.`);
        } catch (err) { 
          alert("Lỗi khi xóa hàng loạt."); 
          fetchDesigns(); // Refresh to match DB
        }
    }
  };

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleCardClick = (design: DesignDNA) => {
    if (isSelectMode) {
      handleToggleSelect(design.id!);
    } else {
      setSelectedDesign(design);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('vi-VN');
  
  const handleDownload4K = async (url: string, ratio: string) => {
      setIsUpscaling(true);
      try {
          const res = await upscaleImageTo4K(url, ratio as any);
          triggerDownload(res, `map-4k-${Date.now()}.png`);
      } catch (e) { alert("Lỗi 4K."); }
      finally { setIsUpscaling(false); }
  };

  return (
    <div className="h-full overflow-y-auto pr-2 flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
        <div><h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Tệp Gallery Chung</h2></div>
        <div className="flex items-center gap-4">
            <button onClick={() => setFilterMine(!filterMine)} className={`text-[10px] px-5 py-2.5 rounded-xl font-black uppercase tracking-widest border transition-all ${filterMine ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{filterMine ? 'Của tôi' : 'Tất cả'}</button>
            <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }} className={`text-[10px] px-5 py-2.5 rounded-xl font-black uppercase tracking-widest transition-all ${isSelectMode ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{isSelectMode ? 'Hủy' : 'Chọn'}</button>
            {isSelectMode && selectedIds.length > 0 && (
                <button 
                    onClick={handleBulkDelete} 
                    className="text-[10px] px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow-lg transition-all"
                >
                    Xóa ({selectedIds.length})
                </button>
            )}
        </div>
      </div>

      {loading ? (<div className="flex items-center justify-center flex-grow"><div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 pb-10">
          {filteredDesigns.map((design) => (
            <div 
              key={design.id} 
              onClick={() => handleCardClick(design)} 
              className={`group relative bg-white rounded-[2.5rem] overflow-hidden border cursor-pointer transition-all duration-500 ${isSelectMode && selectedIds.includes(design.id!) ? 'border-purple-500 ring-4 ring-purple-500/20 scale-95' : 'border-slate-200 hover:border-slate-400'}`}
            >
              <div className="w-full aspect-square bg-slate-50 relative overflow-hidden">
                 <img src={design.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="Thumb" />
                 {isSelectMode && (
                   <div 
                    onClick={(e) => { e.stopPropagation(); handleToggleSelect(design.id!); }} 
                    className={`absolute top-4 right-4 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.includes(design.id!) ? 'bg-purple-500 border-purple-500' : 'bg-white/40 border-slate-400'}`}
                   >
                     {selectedIds.includes(design.id!) && <div className="w-2 h-2 bg-white rounded-full" />}
                   </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 flex flex-col justify-end p-5 opacity-0 group-hover:opacity-100 transition-opacity"><p className="text-[10px] text-white font-black uppercase tracking-widest line-clamp-1">{design.requestData.mainHeadline}</p></div>
              </div>
              <div className="p-5 flex justify-between items-center bg-white">
                 <div><span className="text-[8px] text-orange-600 font-black uppercase tracking-widest">{design.author}</span><p className="text-[8px] text-slate-400 font-bold uppercase">{formatDate(design.createdAt)}</p></div>
                 {!isSelectMode && (
                   <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(design.id!); }} 
                    className="p-2 text-red-500/50 hover:text-red-500 transition-colors"
                   >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDesign && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={() => { setSelectedDesign(null); setEditResult(null); }}>
           <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3rem] border border-slate-200 flex flex-col md:flex-row overflow-hidden shadow-2xl animate-scale-up" onClick={e => e.stopPropagation()}>
               <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-8 relative border-r border-slate-200">
                 <img src={editResult || selectedDesign.thumbnail} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Preview" />
               </div>
               <div className="w-full md:w-1/2 flex flex-col p-12 bg-white">
                   <div className="flex justify-between items-start mb-10">
                       <div><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{selectedDesign.requestData.mainHeadline}</h3><p className="text-[10px] text-slate-400 font-black uppercase mt-2 tracking-widest">{selectedDesign.author} ● {formatDate(selectedDesign.createdAt)}</p></div>
                       <button onClick={() => { setSelectedDesign(null); setEditResult(null); }} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                   </div>
                   <div className="flex-grow space-y-8 overflow-y-auto pr-4 scrollbar-hide">
                       <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 space-y-4">
                           <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Design Plan Analysis</h4>
                           <p className="text-[11px] text-slate-600 leading-relaxed font-bold"><span className="text-slate-400 uppercase mr-2">Subject:</span> {selectedDesign.designPlan.subject}</p>
                           <p className="text-[11px] text-slate-600 leading-relaxed font-bold"><span className="text-slate-400 uppercase mr-2">Style:</span> {selectedDesign.designPlan.styleContext}</p>
                           <p className="text-[11px] text-slate-600 leading-relaxed font-bold"><span className="text-slate-400 uppercase mr-2">Composition:</span> {selectedDesign.designPlan.composition}</p>
                           <p className="text-[11px] text-slate-600 leading-relaxed font-bold"><span className="text-slate-400 uppercase mr-2">Color & Lighting:</span> {selectedDesign.designPlan.colorLighting}</p>
                           <p className="text-[11px] text-slate-600 leading-relaxed font-bold"><span className="text-slate-400 uppercase mr-2">Decor Elements:</span> {selectedDesign.designPlan.decorElements}</p>
                           <p className="text-[11px] text-slate-600 leading-relaxed font-bold"><span className="text-slate-400 uppercase mr-2">Typography:</span> {selectedDesign.designPlan.typography}</p>
                           {selectedDesign.finalPrompt && (
                               <div className="mt-4 pt-4 border-t border-slate-200">
                                   <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">Final Prompt</h4>
                                   <p className="text-[11px] text-slate-600 leading-relaxed italic">{selectedDesign.finalPrompt}</p>
                               </div>
                           )}
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setIsEditing(true)} className="py-5 bg-white border border-violet-200 text-violet-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-50 transition-all">🪄 AI Inpaint Pro</button>
                            <button onClick={() => {
                                if (onSeparateLayout) {
                                    onSeparateLayout(editResult || selectedDesign.thumbnail, selectedDesign.finalPrompt || '', selectedDesign.recommendedAspectRatio || '1:1', selectedDesign.requestData.quality);
                                }
                            }} className="py-5 bg-white border border-blue-200 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all">Tách Lớp Đồ Họa</button>
                       </div>
                       <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(selectedDesign.id!); }} 
                        className="w-full py-4 bg-red-50 border border-red-200 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-100 transition-all"
                       >
                        Xóa Thiết Kế
                       </button>
                   </div>
                   <div className="mt-10 pt-10 border-t border-slate-100"><button onClick={() => handleDownload4K(editResult || selectedDesign.thumbnail, selectedDesign.recommendedAspectRatio || "1:1")} disabled={isUpscaling} className="w-full py-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-black rounded-3xl shadow-xl shadow-orange-500/10 uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border-t-2 border-white/20">{isUpscaling ? 'Nâng cấp 4K...' : 'Xuất File In (4K)'}</button></div>
               </div>
           </div>
        </div>
      )}

      {isEditing && selectedDesign && (
          <SmartRemover 
            imageUrl={editResult || selectedDesign.thumbnail} 
            onClose={() => setIsEditing(false)} 
            isProcessing={isProcessingEdit} 
            onProcess={async (mask, text) => {
              setIsProcessingEdit(true);
              try {
                const res = await removeObjectWithMask(editResult || selectedDesign.thumbnail, mask, text);
                if (res) { setEditResult(res); }
              } catch(e) { 
                console.error("Smart Remover Error:", e);
                alert("Lỗi xử lý xóa thông minh."); 
              }
              finally { setIsProcessingEdit(false); }
            }} 
            resultUrl={editResult}
            aspectRatio={selectedDesign.recommendedAspectRatio}
          />
      )}
    </div>
  );
};

export default GalleryView;
