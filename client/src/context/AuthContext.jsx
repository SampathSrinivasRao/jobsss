import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshUser = useCallback(async () => {
    try { const result = await api.get('/auth/me'); setUser(result.user || result); setError(''); }
    catch (err) { if (err.status === 401) { setUser(null); setError(''); } else setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refreshUser(); }, [refreshUser]);
  async function login(values) { const result = await api.post('/auth/login', values); setUser(result.user || result); setError(''); return result.user || result; }
  async function register(values) { const result = await api.post('/auth/register', values); setUser(result.user || result); setError(''); return result.user || result; }
  async function logout() { await api.post('/auth/logout'); setUser(null); }
  return <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
