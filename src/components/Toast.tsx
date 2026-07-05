import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Snackbar } from '@mui/material';

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const push = useCallback((m: string) => setMsg(m), []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <Snackbar open={!!msg} autoHideDuration={3600} onClose={() => setMsg(null)} message={msg || ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </ToastCtx.Provider>
  );
}
