"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { getAccount } from "@/lib/api/generated/api/account";
import { AuthDialog } from "./auth-dialog";
import { LOGOUT_EVENT } from "@/lib/resume/recovery";
import { ApiError } from "@/lib/api/request";
const Context = createContext<{
  account: API.AccountResource | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  setAccount: (value: API.AccountResource | null) => void;
  openAuth: (onSuccess?: () => void) => void;
}>({
  account: null,
  loading: true,
  error: "",
  refresh: async () => {},
  setAccount: () => {},
  openAuth: () => {},
});
export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, storeAccount] = useState<API.AccountResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const [authOpen, setAuthOpen] = useState(false);
  const authCallbacks = useRef<{
    onSuccess?: () => void;
  }>({});
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openAuth = useCallback((onSuccess?: () => void) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    authCallbacks.current = { onSuccess };
    setAuthOpen(true);
  }, []);
  const setAccount = useCallback((value: API.AccountResource | null) => {
    revision.current++;
    storeAccount(value);
    setLoading(false);
    setError("");
  }, []);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true);
    setError("");
    try {
      const result = await getAccount();
      if (request !== revision.current) return;
      storeAccount(result);
      setError("");
    } catch (e) {
      if (request !== revision.current) return;
      storeAccount(null);
      setError(
        e instanceof ApiError && e.code === 401 ? "" : "账户连接失败，请重试。",
      );
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  useEffect(() => {
    const recheck = () => {
      void refresh();
    };
    window.addEventListener("focus", recheck);
    const storage = (event: StorageEvent) => {
      if (event.key === LOGOUT_EVENT) recheck();
    };
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("focus", recheck);
      window.removeEventListener("storage", storage);
    };
  }, [refresh]);
  return (
    <Context.Provider
      value={{ account, loading, error, refresh, setAccount, openAuth }}
    >
      {children}
      {authOpen ? (
        <AuthDialog
          returnFocusRef={returnFocusRef}
          onClose={() => {
            setAuthOpen(false);
          }}
          onSuccess={(value) => {
            setAccount(value);
            setAuthOpen(false);
            authCallbacks.current.onSuccess?.();
          }}
        />
      ) : null}
    </Context.Provider>
  );
}
export function useAccount() {
  return useContext(Context);
}
