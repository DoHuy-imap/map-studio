
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/UserContext';

const MapLogo = ({ className }: { className?: string }) => (
  <div className={`relative ${className}`}>
    <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="5" y="5" width="90" height="90" rx="15" fill="black" stroke="#FFD300" strokeWidth="4"/>
      <path d="M50 20C40 20 32 28 32 38C32 44 35 49 40 52V65H60V52C65 49 68 44 68 38C68 28 60 20 50 20Z" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M40 65L32 85L50 95L68 85L60 65H40Z" fill="#FFD300" stroke="white" strokeWidth="2"/>
      <path d="M40 65L32 85" stroke="#E91E63" strokeWidth="4"/>
      <path d="M50 65V95" stroke="#FFD300" strokeWidth="4"/>
      <path d="M60 65L68 85" stroke="#00BCD4" strokeWidth="4"/>
      <text x="50" y="115" fill="#FFD300" fontSize="16" fontWeight="900" textAnchor="middle" fontFamily="Arial">M.A.P</text>
    </svg>
  </div>
);

const LoginScreen: React.FC = () => {
  const { login, checkApiKeyStatus, saveApiKey, isAiStudioEnvironment } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isApiKeyFound, setIsApiKeyFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State cho manual API key input
  const [manualKey, setManualKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      const active = await checkApiKeyStatus();
      setIsApiKeyFound(active);
      setLoading(false);
    };
    checkKey();
  }, [checkApiKeyStatus]);

  const handleSelectKey = async () => {
    if (isAiStudioEnvironment && (window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      setIsApiKeyFound(true);
    }
  };

  const handleStart = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên nhà thiết kế.");
      return;
    }

    if (!isApiKeyFound) {
      // Nếu là môi trường web thường và user đã nhập key
      if (!isAiStudioEnvironment && manualKey.length > 20) {
          saveApiKey(manualKey);
          setIsApiKeyFound(true);
          login(name.trim());
          return;
      }

      setError("Vui lòng cấu hình API Key để tiếp tục.");
      return;
    }

    login(name.trim());
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden font-['Inter']">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] animate-pulse"></div>

      <div className="bg-white border border-slate-200 p-10 sm:p-14 rounded-[3.5rem] w-full max-w-lg shadow-2xl relative z-10 animate-fade-in text-center">
          <div className="flex flex-col items-center mb-10">
            <MapLogo className="w-24 h-28 mb-6" />
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">AI ART DIRECTOR</h1>
              <span className="bg-orange-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter shadow-lg shadow-orange-200">Nano Banana 2</span>
            </div>
            <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.5em] mt-3 opacity-60">Creative Intelligence Studio</p>
          </div>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-xs font-bold animate-shake text-left">
              ⚠ {error}
            </div>
          )}

          <div className="text-left space-y-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Định danh nhà thiết kế</label>
            <input 
              type="text" 
              placeholder="Nhập tên của bạn..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4 text-slate-900 font-bold focus:ring-2 focus:ring-orange-500/40 outline-none transition-all placeholder-slate-300"
            />
          </div>

          <div className="text-left space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Trạng thái API Key</label>
            
            {isApiKeyFound ? (
              <div className="w-full bg-emerald-50 border border-emerald-200 rounded-3xl px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-emerald-600 text-xs font-bold">API Key đã sẵn sàng</span>
                </div>
                {!isAiStudioEnvironment && (
                    <button onClick={() => { localStorage.removeItem('MAP_API_KEY'); window.location.reload(); }} className="text-[9px] text-slate-400 hover:text-slate-600 underline uppercase font-black tracking-widest">Reset</button>
                )}
              </div>
            ) : isAiStudioEnvironment ? (
              // Giao diện chọn Key cho Project IDX / AI Studio
              <button 
                onClick={handleSelectKey}
                className="w-full bg-slate-50 border border-dashed border-slate-200 hover:border-orange-500 rounded-3xl px-6 py-4 text-slate-400 hover:text-orange-600 transition-all flex items-center justify-center gap-3"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m-2 4a2 2 0 012 2m-2-4a2 2 0 01-2-2m-2 4a2 2 0 01-2 2m5-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                <span className="text-xs font-bold">Kết nối API Key (AI Studio)</span>
              </button>
            ) : (
              // Giao diện nhập Key thủ công cho Vercel / Web
              <div className="relative group">
                  <div className="relative">
                      <input 
                        type={showKey ? "text" : "password"} 
                        placeholder="Dán Gemini API Key của bạn tại đây..."
                        value={manualKey}
                        onChange={(e) => setManualKey(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-6 py-4 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-orange-500/40 outline-none transition-all placeholder-slate-300 pr-12"
                      />
                      <button 
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-2"
                      >
                         {showKey ? (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                         ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                         )}
                      </button>
                  </div>
                  <div className="mt-2 flex justify-between items-center px-2">
                      <p className="text-[9px] text-slate-400">Key được lưu an toàn trong trình duyệt của bạn.</p>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[9px] text-orange-600 hover:underline font-bold uppercase">Lấy API Key ↗</a>
                  </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleStart}
            disabled={!name || (!isApiKeyFound && manualKey.length < 20)}
            className={`w-full py-5 font-black rounded-3xl shadow-xl uppercase tracking-[0.2em] transition-all text-sm group flex items-center justify-center gap-3
                ${(!name || (!isApiKeyFound && manualKey.length < 20)) 
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' 
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 active:scale-95'
                }`}
          >
            {(!isAiStudioEnvironment && !isApiKeyFound) ? 'Lưu Key & Kết nối' : 'Kết nối Studio'}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
        
        <div className="mt-12 flex justify-center gap-4 opacity-30">
             <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
             <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
             <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
