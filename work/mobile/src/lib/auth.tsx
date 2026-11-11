import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { api, ApiError, onExpired, restoreToken, sessionRequest, setToken } from "./api";
import {activateResourceCache,clearResources,prefetchResource} from "./resource-cache";
import {monthBounds,today} from "./dates";
import type { Session } from "./types";

import {hasPermission} from './permissions';

type Auth = {
  session: Session | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const epoch=useRef(0);
  const refresh = useCallback(async () => {
    const version=epoch.current;
    try {
      const saved = await restoreToken();
      const next=saved?await api<Session>("/api/mobile/me"):null;
      if(version!==epoch.current)return;
      if(next?.permissions?.isApprovedStaff)await activateResourceCache(next).catch(()=>clearResources());
      else clearResources();
      if(version!==epoch.current)return;
      setError("");
      // The session is re-verified every minute and on foreground. Keep the
      // existing object when nothing changed so the whole navigation tree and
      // every useAuth() consumer do not re-render on each check.
      setSession(old=>old&&next&&JSON.stringify(old)===JSON.stringify(next)?old:next);
      if(next?.permissions?.isApprovedStaff){if(hasPermission(next.permissions,'shoots.view'))void prefetchResource('/api/shoots');if(hasPermission(next.permissions,'chat.view')){if(next.permissions.features?.teamChat!==false)void prefetchResource('/api/chat/messages');void prefetchResource('/api/chat/conversations')}if(hasPermission(next.permissions,'calendar.view')){const {from,to}=monthBounds(today().slice(0,7));void prefetchResource(`/api/calendar?from=${from}&to=${to}`)}}
    } catch (e) {
      if(version!==epoch.current)return;
      if(e instanceof ApiError&&(e.status===401||e.status===403)){clearResources();setSession(null);setError('');return}
      setError((e as Error).message);
      throw e;
    } finally {
      if(version===epoch.current)setLoading(false);
    }
  }, []);
  useEffect(() => {
    const off = onExpired(() => {
      epoch.current++;
      setLoading(false);
      void import("./location").then(m=>m.disableAttendance(false)).catch(()=>{});
      clearResources();
      setSession(null);
      setError("");
    });
    // Bootstrap is asynchronous SecureStore + network I/O; state is set only
    // after those operations settle (the compiler rule cannot follow them).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => {});
    return off;
  }, [refresh]);
  useEffect(() => {
    const check = () => {
      if (AppState.currentState === "active") void refresh().catch(() => {});
    };
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    const timer = setInterval(check, 60_000);
    return () => {
      listener.remove();
      clearInterval(timer);
    };
  }, [refresh]);
  const login = useCallback(async (email: string, password: string) => {
    const version=++epoch.current;
    clearResources();
    setSession(null);
    const result = await api<{ token: string }>("/api/mobile/auth/login", {
      method: "POST",
      body: { email, password },
      public: true,
    });
    if(version!==epoch.current)return;
    await setToken(result.token);
    if(version!==epoch.current)return;
    await refresh();
  }, [refresh]);
  const logout = useCallback(async () => {
    // Invalidate visible/private data immediately, even if the network is offline.
    epoch.current++;
    clearResources();
    setSession(null);
    setError("");
    const request=sessionRequest();
    const cleanup = Promise.allSettled([
      import("./push-notifications").then(m=>m.unregisterPush(request)),
      import("./location").then(m=>m.disableAttendance(true,request)),
      request("/api/auth/logout", { method: "POST", body: {} }),
    ]);
    await setToken(null);
    await cleanup;
  }, []);
  const value = useMemo(() => ({ session, loading, error, refresh, login, logout }), [session, loading, error, refresh, login, logout]);

  return (
    <Context.Provider value={value}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
