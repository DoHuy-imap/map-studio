
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

interface UserSettings {
  displayName: string;
}

interface AuthContextType {
  user: UserSettings | null;
  login: (name: string) => void;
  logout: () => void;
  deleteAccountData: () => Promise<void>;
  checkApiKeyStatus: () => Promise<boolean>;
  saveApiKey: (key: string) => void;
  isAiStudioEnvironment: boolean;
  sessionCost: number;
  totalCost: number;
  addSessionCost: (amount: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'map_app_user_v3';
const API_KEY_STORAGE = 'MAP_API_KEY';
const TOTAL_COST_STORAGE = 'MAP_TOTAL_COST';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 phút

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSettings | null>(null);
  const [isAiStudioEnvironment, setIsAiStudioEnvironment] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  
  const timeoutIdRef = useRef<any>(null);

  useEffect(() => {
    const savedTotalCost = localStorage.getItem(TOTAL_COST_STORAGE);
    if (savedTotalCost) {
      setTotalCost(Number(savedTotalCost));
    }
  }, []);

  const addSessionCost = useCallback((amount: number) => {
    setSessionCost(prev => prev + amount);
    setTotalCost(prev => {
      const newTotal = prev + amount;
      localStorage.setItem(TOTAL_COST_STORAGE, newTotal.toString());
      return newTotal;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      setIsAiStudioEnvironment(true);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const login = (name: string) => {
    const newUser = { displayName: name };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  };

  const logout = useCallback(() => {
    if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
    }
    setUser(null);
    try {
        localStorage.removeItem(STORAGE_KEY);
        // Tùy chọn: Xóa luôn API Key khi logout để bảo mật tuyệt đối
        // localStorage.removeItem(API_KEY_STORAGE);
    } catch (e) {
        console.error("Error clearing storage:", e);
    }
    setTimeout(() => {
        window.location.reload();
    }, 100);
  }, []);

  const saveApiKey = (key: string) => {
    if (key && key.trim().length > 0) {
        localStorage.setItem(API_KEY_STORAGE, key.trim());
    }
  };

  useEffect(() => {
    if (!user) return;
    const resetTimer = () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = setTimeout(() => {
        alert("Phiên làm việc đã hết hạn do 30 phút không hoạt động. Vui lòng đăng nhập lại.");
        logout();
      }, INACTIVITY_LIMIT);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];
    resetTimer();
    const handleActivity = () => resetTimer();
    events.forEach(event => window.addEventListener(event, handleActivity));
    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [user, logout]);

  const deleteAccountData = async () => {
    if (!user) return;
    try {
      const { deleteDesignsByAuthor } = await import('../services/historyDb');
      await deleteDesignsByAuthor(user.displayName);
      logout();
    } catch (error) {
      console.error("Lỗi khi xóa dữ liệu:", error);
      alert("Không thể xóa dữ liệu lúc này.");
    }
  };

  const checkApiKeyStatus = async () => {
    try {
      // 1. Kiểm tra môi trường AI Studio
      if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
        return await (window as any).aistudio.hasSelectedApiKey();
      }
      
      // 2. Kiểm tra Local Storage (cho Vercel/Web)
      const storedKey = localStorage.getItem(API_KEY_STORAGE);
      if (storedKey && storedKey.length > 10) return true;

      // 3. Kiểm tra biến môi trường
      return !!(process.env.API_KEY && process.env.API_KEY.length > 5);
    } catch (e) {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      deleteAccountData,
      checkApiKeyStatus,
      saveApiKey,
      isAiStudioEnvironment,
      sessionCost,
      totalCost,
      addSessionCost
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
