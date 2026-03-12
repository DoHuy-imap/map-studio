
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/UserContext';

interface SettingsModalProps {
  onClose: () => void;
  isStrict?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isStrict = false }) => {
  // Fix: useAuth instead of useUser which is not exported
  const { user, login } = useAuth();
  const [name, setName] = useState(user?.displayName || '');

  useEffect(() => {
    if (user) {
      setName(user.displayName);
    }
  }, [user]);

  const handleSave = () => {
    if (!name.trim()) {
        alert("Vui lòng nhập Tên!");
        return;
    }
    
    login(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={!isStrict ? onClose : undefined}>
      <div className={`bg-white border ${isStrict ? 'border-red-500/50 shadow-red-500/10' : 'border-slate-200'} w-full max-w-md rounded-2xl shadow-2xl overflow-hidden`} onClick={e => e.stopPropagation()}>
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
           <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
             {isStrict ? (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                 </svg>
             ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
             )}
             {isStrict ? "Cấu hình hệ thống M.A.P" : "Cài Đặt Cá Nhân"}
           </h3>
           {!isStrict && (
               <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
               </button>
           )}
        </div>

        <div className="p-6 space-y-5">
           {isStrict && (
               <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-600 mb-4">
                   Để sử dụng, vui lòng thiết lập danh tính của bạn.
               </div>
           )}

           {/* Display Name */}
           <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tên hiển thị (Tác giả)</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
           </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
           {!isStrict && (
               <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-600 text-sm font-medium">Hủy bỏ</button>
           )}
           <button 
             onClick={handleSave}
             disabled={!name}
             className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isStrict ? "Lưu & Bắt đầu" : "Lưu Cài Đặt"}
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
