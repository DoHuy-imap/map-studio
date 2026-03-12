import React from 'react';

interface DashboardProps {
  onSelectFeature: (feature: 'studio' | 'gallery' | 'ai-template' | 'stock-ai') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectFeature }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in-up">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4">M.A.P Studio - Creativity is endless</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Chọn một tính năng để bắt đầu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* Feature 1: Tạo mẫu thiết kế (Current Studio) */}
        <div 
          onClick={() => onSelectFeature('studio')}
          className="bg-white p-8 rounded-[3rem] border border-orange-200 shadow-xl shadow-orange-500/10 cursor-pointer group hover:border-orange-400 transition-all hover:-translate-y-1 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 group-hover:text-orange-600 transition-colors">Studio</h3>
          <p className="text-sm text-slate-500 font-medium">Sử dụng AI để tạo hình ảnh, tách nền, và xử lý hậu kỳ thông minh.</p>
        </div>

        {/* Feature 2: STOCK AI */}
        <div 
          onClick={() => onSelectFeature('stock-ai')}
          className="bg-white p-8 rounded-[3rem] border border-emerald-200 shadow-xl shadow-emerald-500/10 cursor-pointer group hover:border-emerald-400 transition-all hover:-translate-y-1 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 group-hover:text-emerald-600 transition-colors">STOCK AI</h3>
          <p className="text-sm text-slate-500 font-medium">Tạo nguyên liệu thiết kế tự động (vector, 3D, line art...).</p>
        </div>

        {/* Feature 3: Thiết kế với mẫu AI (Current AI Template) */}
        <div 
          onClick={() => onSelectFeature('ai-template')}
          className="bg-white p-8 rounded-[3rem] border border-violet-200 shadow-xl shadow-violet-500/10 cursor-pointer group hover:border-violet-400 transition-all hover:-translate-y-1 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 group-hover:text-violet-600 transition-colors">Ai Template</h3>
          <p className="text-sm text-slate-500 font-medium">Tái tạo, nâng cấp và chỉnh sửa các mẫu thiết kế có sẵn bằng AI.</p>
        </div>

        {/* Feature 4: Tệp Gallery */}
        <div 
          onClick={() => onSelectFeature('gallery')}
          className="bg-white p-8 rounded-[3rem] border border-blue-200 shadow-xl shadow-blue-500/10 cursor-pointer group hover:border-blue-400 transition-all hover:-translate-y-1 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 group-hover:text-blue-600 transition-colors">Tệp Gallery Chung</h3>
          <p className="text-sm text-slate-500 font-medium">Quản lý và sử dụng lại các thiết kế đã lưu cho toàn bộ hệ sinh thái.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
