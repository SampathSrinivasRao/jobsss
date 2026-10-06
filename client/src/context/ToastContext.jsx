import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const timers = useRef(new Set());
  const toast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setMessages((current) => [...current.slice(-3), { id, message, type }]);
    const timer = setTimeout(() => { setMessages((current) => current.filter((item) => item.id !== id)); timers.current.delete(timer); }, 5500);
    timers.current.add(timer);
  }, []);
  useEffect(() => { const active = timers.current; return () => active.forEach(clearTimeout); }, []);
  return <ToastContext.Provider value={{ toast }}>{children}<div className="toast-stack" aria-live="polite">{messages.map((item) => <div className={`toast ${item.type}`} key={item.id}>{item.type === 'error' ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}<span>{item.message}</span><button aria-label="Dismiss notification" onClick={() => setMessages((current) => current.filter((m) => m.id !== item.id))}><X size={16} /></button></div>)}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
