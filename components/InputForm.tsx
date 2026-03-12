
import React, { useRef, useEffect } from 'react';
import { 
  ArtDirectionRequest, ProductType, VisualStyle, ColorOption, 
  ReferenceImageConfig, ReferenceAttribute, SubjectAsset 
} from '../types';

interface InputFormProps {
  values: ArtDirectionRequest;
  onChange: (field: keyof ArtDirectionRequest, value: any) => void;
  onSubmit: () => void;
  onReset: () => void;
  isGenerating: boolean;
  estimatedCost?: number;
}

const InputForm: React.FC<InputFormProps> = ({ values, onChange, onSubmit, onReset, isGenerating, estimatedCost = 0 }) => {
  const assetInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const typoRefInputRef = useRef<HTMLInputElement>(null);

  const attributes: ReferenceAttribute[] = ['Subject', 'Composition', 'Decoration', 'Style', 'Color', 'Typo'];

  useEffect(() => {
    const hasStyleRef = values.referenceImages.some(ref => ref.attributes.includes('Style'));
    if (hasStyleRef && values.visualStyle !== VisualStyle.FOLLOW_REF) {
      onChange('visualStyle', VisualStyle.FOLLOW_REF);
    } else if (!hasStyleRef && values.visualStyle === VisualStyle.FOLLOW_REF) {
      onChange('visualStyle', VisualStyle.MODERN_TECH);
    }
  }, [values.referenceImages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'assetImages' | 'logoImages' | 'referenceImages' | 'typoReferenceImage') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (field === 'assetImages') {
      const currentAssets = [...values.assetImages];
      (Array.from(files) as File[]).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            currentAssets.push({ image: reader.result as string, removeBackground: false });
            onChange('assetImages', [...currentAssets]);
          }
        };
        reader.readAsDataURL(file);
      });
    } else if (field === 'logoImages') {
      const currentLogos = [...values.logoImages];
      (Array.from(files) as File[]).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            currentLogos.push(reader.result as string);
            onChange('logoImages', [...currentLogos]);
          }
        };
        reader.readAsDataURL(file);
      });
    } else if (field === 'typoReferenceImage') {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) onChange('typoReferenceImage', reader.result as string);
      };
      reader.readAsDataURL(files[0]);
    } else if (field === 'referenceImages') {
      if (values.referenceImages.length >= 3) return;
      (Array.from(files) as File[]).slice(0, 3 - values.referenceImages.length).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            const newRef: ReferenceImageConfig = {
              id: Math.random().toString(36).substr(2, 9),
              image: reader.result as string,
              attributes: []
            };
            onChange('referenceImages', [...values.referenceImages, newRef]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const toggleAttribute = (refId: string, attr: ReferenceAttribute) => {
    const updatedRefs = values.referenceImages.map(ref => {
      if (ref.id === refId) {
        const hasAttr = ref.attributes.includes(attr);
        return {
          ...ref,
          attributes: hasAttr ? ref.attributes.filter(a => a !== attr) : [...ref.attributes, attr]
        };
      }
      return ref;
    });
    onChange('referenceImages', updatedRefs);
  };

  const toggleAssetAi = (idx: number) => {
    const updatedAssets = [...values.assetImages];
    updatedAssets[idx] = { ...updatedAssets[idx], removeBackground: !updatedAssets[idx].removeBackground };
    onChange('assetImages', updatedAssets);
  };

  return (
    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-xl h-full flex flex-col overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#FFD300] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Creative Studio</h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Production Brief</p>
          </div>
        </div>
        <button 
          onClick={() => { if(window.confirm('Hủy bỏ tiến trình hiện tại và tạo Brief mới?')) onReset(); }} 
          className="p-2.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-200"
          title="New Production Brief"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="space-y-8 flex-grow">
        <section className="space-y-4">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> Project Setup
          </label>
          <div className="grid grid-cols-2 gap-3">
            <select
              className="col-span-2 w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs text-slate-900 font-bold outline-none cursor-pointer"
              value={values.productType}
              onChange={(e) => onChange('productType', e.target.value)}
            >
              {Object.values(ProductType).map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">W</div>
              <input type="number" placeholder="Width" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-10 py-3.5 text-xs text-slate-900 font-mono outline-none" value={values.width} onChange={(e) => onChange('width', e.target.value)} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 font-black uppercase">CM</span>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">H</div>
              <input type="number" placeholder="Height" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-10 py-3.5 text-xs text-slate-900 font-mono outline-none" value={values.height} onChange={(e) => onChange('height', e.target.value)} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 font-black uppercase">CM</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Core Messaging
          </label>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input type="text" className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs text-slate-900 font-black placeholder-slate-300 outline-none transition-all uppercase" placeholder="MAIN HEADLINE" value={values.mainHeadline} onChange={(e) => onChange('mainHeadline', e.target.value)} />
              <div className="w-14 h-14 shrink-0">
                {values.typoReferenceImage ? (
                  <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-[#FFD300] group">
                    <img src={values.typoReferenceImage} className="w-full h-full object-cover" />
                    <button onClick={() => onChange('typoReferenceImage', null)} className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[7px] font-black uppercase text-white">X</button>
                  </div>
                ) : (
                  <button onClick={() => typoRefInputRef.current?.click()} className="w-full h-full rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-orange-500 transition-all bg-slate-50" title="Tham chiếu Typo">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2}/></svg>
                  </button>
                )}
                <input type="file" ref={typoRefInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'typoReferenceImage')} />
              </div>
            </div>
            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs text-slate-700 placeholder-slate-300 h-20 resize-none outline-none font-bold" placeholder="Supporting text (CTA, dates, details...)" value={values.secondaryText} onChange={(e) => onChange('secondaryText', e.target.value)} />
          </div>
        </section>

        <section className="space-y-4">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Strategy & Layout
          </label>
          <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs text-slate-700 placeholder-slate-300 h-24 resize-none outline-none font-bold" placeholder="Phân tích bố cục chính xác tại đây (Ví dụ: đặt sp bên trái, headline nghiêng 15 độ bên phải...)" value={values.layoutRequirements} onChange={(e) => onChange('layoutRequirements', e.target.value)} />
        </section>

        <section className="space-y-4">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> Visual Subjects (Sản phẩm)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-[8px] text-slate-400 font-black uppercase ml-1">Logo Thương Hiệu</span>
              <div className="flex flex-wrap gap-2">
                {values.logoImages.map((logo, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-orange-500/50 group bg-white p-1">
                    <img src={logo} alt={`logo-${i}`} className="w-full h-full object-contain" />
                    <button onClick={() => onChange('logoImages', values.logoImages.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-black uppercase text-white">Xóa</button>
                  </div>
                ))}
                <button onClick={() => logoInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-orange-500 transition-all bg-slate-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2.5}/></svg>
                </button>
                <input type="file" multiple ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'logoImages')} />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[8px] text-slate-400 font-black uppercase ml-1">Ảnh Sản Phẩm (AI Subjects)</span>
              <div className="flex flex-wrap gap-2">
                {values.assetImages.map((asset, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={asset.image} className="w-full h-full object-cover" />
                    <div className="absolute top-0 left-0 right-0 p-0.5 flex justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleAssetAi(i)} className={`p-1 rounded-md text-[6px] font-black uppercase tracking-tighter ${asset.removeBackground ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>AI</button>
                      <button onClick={() => onChange('assetImages', values.assetImages.filter((_, idx) => idx !== i))} className="p-1 bg-red-600 rounded-md text-white text-[6px]">X</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => assetInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-all bg-slate-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2.5}/></svg>
                </button>
                <input type="file" multiple ref={assetInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'assetImages')} />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div> Reference Ideas (Tham chiếu)
          </label>
          <div className="space-y-4">
             {values.referenceImages.map((ref) => (
               <div key={ref.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex gap-4">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                    <img src={ref.image} className="w-full h-full object-cover" />
                    <button onClick={() => onChange('referenceImages', values.referenceImages.filter(r => r.id !== ref.id))} className="absolute top-1 right-1 bg-black/70 p-1.5 rounded-md text-white hover:bg-red-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                  </div>
                  <div className="flex-grow">
                     <span className="text-[7px] text-slate-400 font-black uppercase tracking-widest mb-1.5 block">Inherit Criteria:</span>
                     <div className="flex flex-wrap gap-1">
                        {attributes.map(attr => (
                          <button key={attr} onClick={() => toggleAttribute(ref.id, attr)} className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider border transition-all ${ref.attributes.includes(attr) ? 'bg-pink-600 border-pink-500 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'}`}>{attr}</button>
                        ))}
                     </div>
                  </div>
               </div>
             ))}
             {values.referenceImages.length < 3 && (
               <button onClick={() => refInputRef.current?.click()} className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:border-pink-500/50 hover:text-pink-500 transition-all bg-slate-50">Add Reference Idea ({values.referenceImages.length}/3)</button>
             )}
             <input type="file" multiple ref={refInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'referenceImages')} />
          </div>
        </section>

        <section className="space-y-4">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Studio Aesthetics
          </label>
          <div className="space-y-4">
            <div className="space-y-2">
               <span className="text-[8px] text-slate-400 font-black uppercase ml-1">Bảng Màu</span>
               <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-xs text-slate-900 font-bold outline-none" value={values.colorOption} onChange={(e) => onChange('colorOption', e.target.value)}>
                 {Object.values(ColorOption).map(opt => <option key={opt} value={opt}>{opt}</option>)}
               </select>
               
               {/* CMYK Toggle */}
               <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onChange('useCMYK', !values.useCMYK)}>
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Chế độ màu in ấn (CMYK Safe)</span>
                  <div className={`w-10 h-5 rounded-full p-1 transition-all ${values.useCMYK ? 'bg-cyan-600' : 'bg-slate-200'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-md transition-all transform ${values.useCMYK ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
               </div>
            </div>
            <div className="space-y-2">
               <span className="text-[8px] text-slate-400 font-black uppercase ml-1">Phong Cách Visual</span>
               <select 
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-xs text-slate-900 font-bold outline-none disabled:opacity-50" 
                 value={values.visualStyle} 
                 onChange={(e) => onChange('visualStyle', e.target.value)}
                 disabled={values.referenceImages.some(r => r.attributes.includes('Style'))}
                >
                 {Object.values(VisualStyle).map(style => <option key={style} value={style}>{style}</option>)}
               </select>
            </div>
          </div>
        </section>

        <section className="space-y-4 pb-4">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Batch Setup
          </label>
          <div className="flex bg-slate-50 rounded-2xl p-1 border border-slate-200">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => onChange('batchSize', n)} className={`flex-1 text-[9px] font-black py-2 rounded-xl transition-all ${values.batchSize === n ? 'bg-orange-500 text-white shadow-xl' : 'text-slate-400'}`}>{n} Images</button>
              ))}
          </div>
        </section>
      </div>

      <div className="pt-6 border-t border-slate-100 shrink-0 mt-4">
        <div className="flex items-center justify-between mb-4 px-2">
           <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Chi phí ước tính:</span>
           <span className="text-sm text-emerald-600 font-black tracking-tighter">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(estimatedCost)}
           </span>
        </div>
        <button onClick={onSubmit} disabled={isGenerating || !values.mainHeadline} className={`w-full py-5 rounded-2xl text-black font-black uppercase tracking-widest text-xs transition-all shadow-xl ${isGenerating || !values.mainHeadline ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#FFD300] hover:bg-[#FFC000] active:scale-95 shadow-yellow-500/10'}`}>
          {isGenerating ? <div className="w-5 h-5 border-2 border-slate-400 border-t-black rounded-full animate-spin mx-auto"></div> : 'Launch Production'}
        </button>
      </div>
    </div>
  );
};

export default InputForm;
