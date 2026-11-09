"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/error-message";
import { cvApi, ApiError } from "@/lib/api/client";
import { getAccount } from "@/lib/api/generated/api/account";
import { useAccount } from "@/components/account/account-provider";
import type { CVResource } from "@/lib/api/types";
import { editable } from "@/lib/resume/model";
import {
  LOGOUT_EVENT,
  readRecoveries,
  recoveredCv,
  recoveryKey,
  writeRecovery,
  type EditorScratch,
  type Recovery,
} from "@/lib/resume/recovery";
const same = (a: CVResource, b: CVResource) =>
  JSON.stringify(editable(a)) === JSON.stringify(editable(b));
const hasScratch = (s: EditorScratch) =>
  !!(s.entry || s.style || Object.keys(s.markdown ?? {}).length);
/** One current input, one acknowledged snapshot, and one serial save barrier. */
export function useCvDocument(id: string, onConflict: () => void) {
  const { account } = useAccount();
  const [draft, setDraft] = useState<CVResource | null>(null);
  const [saved, setSaved] = useState<CVResource | null>(null);
  const current = useRef<CVResource | null>(null);
  const acknowledged = useRef<CVResource | null>(null);
  const owner = useRef<string | null>(null);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [sessionMismatch, setSessionMismatch] = useState(false);
  const tab = useRef("");
  const abandoned = useRef(false);
  const [loadingDocument, setLoadingDocument] = useState(true);
  const mounted = useRef(true);
  const loadGeneration = useRef(0);
  const composition = useRef(false);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [loadAuthRequired, setLoadAuthRequired] = useState(false);
  const [candidates, setCandidates] = useState<
    { key: string; value: Recovery }[]
  >([]);
  const candidatesRef = useRef(candidates);
  const [scratch, storeScratch] = useState<EditorScratch>({});
  const scratchRef = useRef<EditorScratch>({});
  const failed = useRef(false);
  const saving = useRef<Promise<boolean> | null>(null);
  const conflict = useRef(onConflict);
  useEffect(() => {
    conflict.current = onConflict;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = useCallback(() => {
    const value = current.current;
    const base = acknowledged.current;
    if (!owner.current || !value || !base || candidatesRef.current.length)
      return;
    if (!tab.current) tab.current = crypto.randomUUID();
    try {
      const key = recoveryKey(owner.current, id, tab.current);
      if (same(value, base) && !hasScratch(scratchRef.current))
        localStorage.removeItem(key);
      else
        writeRecovery(localStorage, key, {
          version: 1,
          owner: owner.current,
          cv: id,
          baseEtag: base.etag,
          time: new Date().toISOString(),
          document: editable(value),
          scratch: scratchRef.current,
        });
      setStorageError("");
    } catch (cause) {
      setStorageError(
        cause instanceof Error && cause.message.startsWith("本机")
          ? cause.message
          : "本机恢复存储不可用，当前输入仍保留。请保存或导出备份后再离开。",
      );
    }
  }, [id]);
  const patch = useCallback(
    (next: Partial<CVResource>) => {
      if (!current.current) return;
      abandoned.current = false;
      current.current = { ...current.current, ...next };
      setDraft(current.current);
      persist();
    },
    [persist],
  );
  const setScratch = useCallback(
    (update: EditorScratch | ((value: EditorScratch) => EditorScratch)) => {
      const next =
        typeof update === "function" ? update(scratchRef.current) : update;
      abandoned.current = false;
      scratchRef.current = next;
      storeScratch(next);
      persist();
    },
    [persist],
  );

  const load = useCallback(async () => {
    const request = ++loadGeneration.current;
    setLoadingDocument(true);
    setLoadError("");
    setLoadAuthRequired(false);
    try {
      const identity = await getAccount();
      const data = await cvApi.getCv(id);
      if (!mounted.current || request !== loadGeneration.current) return;
      abandoned.current = false;
      owner.current = identity.id;
      setLoadedOwner(identity.id);
      setSessionMismatch(false);
      acknowledged.current = data;
      current.current = data;
      scratchRef.current = {};
      storeScratch({});
      setSaved(data);
      setDraft(data);
      failed.current = false;
      try {
        const result = readRecoveries(localStorage, identity.id, id);
        candidatesRef.current = result.results;
        setCandidates(result.results);
        setStorageError(
          result.invalid
            ? "有损坏或版本不兼容的本机草稿，未自动载入；原记录仍保留。"
            : "",
        );
      } catch {
        setStorageError(
          "本机恢复存储不可用，当前输入仍保留。请保存或导出备份后再离开。",
        );
      }
    } catch (cause) {
      if (!mounted.current || request !== loadGeneration.current) return;
      setLoadAuthRequired(cause instanceof ApiError && cause.code === 401);
      const message = errorMessage(
        cause,
        "无法读取此份简历，请登录原账户后重试。",
      );
      setLoadError(message);
      if (current.current) setError(message);
    } finally {
      if (mounted.current && request === loadGeneration.current)
        setLoadingDocument(false);
    }
  }, [id]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    const clear = (identity: unknown) => {
      if (identity !== owner.current) return;
      current.current = null;
      acknowledged.current = null;
      failed.current = true;
      loadGeneration.current++;
      setDraft(null);
      setSaved(null);
      setLoadAuthRequired(true);
      setLoadError(
        "当前账户已退出，本机恢复内容已清理。请重新登录后打开简历。",
      );
    };
    const local = (event: Event) => clear((event as CustomEvent).detail);
    const other = (event: StorageEvent) => {
      if (event.key !== LOGOUT_EVENT || !event.newValue) return;
      try {
        clear(JSON.parse(event.newValue).owner);
      } catch {
        /* Ignore malformed signals. */
      }
    };
    window.addEventListener(LOGOUT_EVENT, local);
    window.addEventListener("storage", other);
    return () => {
      window.removeEventListener(LOGOUT_EVENT, local);
      window.removeEventListener("storage", other);
    };
  }, []);
  const wrongAccount =
    sessionMismatch || !!(account && loadedOwner && account.id !== loadedOwner);
  const ensureOwner = useCallback(async () => {
    try {
      const identity = await getAccount();
      if (identity.id !== owner.current) {
        failed.current = true;
        setSessionMismatch(true);
        setError(
          "账户已切换，请使用原账户重新打开这份简历。本地内容未写入其他账户。",
        );
        setAuthRequired(true);
        return false;
      }
      setAuthRequired(false);
      setSessionMismatch(false);
      return true;
    } catch (cause) {
      failed.current = true;
      setAuthRequired(cause instanceof ApiError && cause.code === 401);
      setError(
        errorMessage(
          cause,
          "无法确认当前账户，输入已保留，请重试。",
          "会话已过期，输入已保留，请用原账户重新登录后保存。",
        ),
      );
      return false;
    }
  }, []);
  const save = useCallback((): Promise<boolean> => {
    if (saving.current) return saving.current;
    const task = async () => {
      if (!current.current || !acknowledged.current || abandoned.current)
        return false;
      if (
        composition.current ||
        hasScratch(scratchRef.current) ||
        candidatesRef.current.length
      ) {
        setError("请先结束输入、应用正在编辑的内容或处理恢复候选，再保存。");
        return false;
      }
      setBusy(true);
      setError("");
      try {
        if (!(await ensureOwner())) return false;
        // Re-read refs after every response: callers await all input, not an old request.
        while (mounted.current && current.current && acknowledged.current) {
          if (composition.current || hasScratch(scratchRef.current)) {
            setError("还有正在编辑的内容，请完成后再保存。");
            return false;
          }
          if (same(current.current, acknowledged.current)) {
            failed.current = false;
            return true;
          }
          const submitted = structuredClone(current.current);
          if (!submitted.displayName.trim()) {
            failed.current = true;
            setError("请输入简历名称。");
            return false;
          }
          if (
            submitted.profile.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitted.profile.email)
          ) {
            failed.current = true;
            setError("请修正邮箱格式后再保存。");
            return false;
          }
          const updated = await cvApi.updateCv(
            id,
            {
              ...editable(submitted),
              etag: acknowledged.current.etag,
              updateMask: "displayName,profile,sections,styleSettings",
            },
            acknowledged.current.etag,
          );
          if (!mounted.current || !current.current) return false;
          acknowledged.current = updated;
          setSaved(updated);
          if (same(current.current, submitted)) {
            current.current = updated;
            setDraft(updated);
          }
          persist();
        }
        return false;
      } catch (cause) {
        failed.current = true;
        setAuthRequired(cause instanceof ApiError && cause.code === 401);
        setError(
          cause instanceof ApiError && cause.isConcurrencyConflict
            ? "服务器已有更新。本地内容已保留，请选择下一步。"
            : errorMessage(cause, "保存失败，输入已保留，请重试。"),
        );
        if (cause instanceof ApiError && cause.isConcurrencyConflict)
          conflict.current();
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    };
    saving.current = task().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [id, ensureOwner, persist]);
  const dirty =
    !!draft && !!saved && (!same(draft, saved) || hasScratch(scratch));
  useEffect(() => {
    if (
      !dirty ||
      busy ||
      composing ||
      failed.current ||
      candidates.length ||
      hasScratch(scratch) ||
      wrongAccount
    )
      return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [draft, dirty, busy, composing, candidates, scratch, wrongAccount, save]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty || busy) e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, busy]);
  function discard() {
    if (saving.current) {
      setError("正在保存，请等待保存完成后再放弃修改。");
      return false;
    }
    try {
      if (owner.current && tab.current)
        localStorage.removeItem(recoveryKey(owner.current, id, tab.current));
    } catch {
      setStorageError("本机草稿无法清理，请检查浏览器存储设置。");
      return false;
    }
    abandoned.current = true;
    return true;
  }
  function resolveRecovery(key: string, restore: boolean) {
    const candidate = candidatesRef.current.find((c) => c.key === key);
    if (!candidate || !acknowledged.current || !current.current) return;
    if (restore && candidate.value.baseEtag !== acknowledged.current.etag)
      return;
    try {
      localStorage.removeItem(key);
    } catch {
      setStorageError("本机草稿无法清理，请检查浏览器存储设置。");
      return;
    }
    const rest = candidatesRef.current.filter((c) => c.key !== key);
    candidatesRef.current = rest;
    setCandidates(rest);
    if (restore) {
      current.current = recoveredCv(acknowledged.current, candidate.value);
      setDraft(current.current);
      scratchRef.current = candidate.value.scratch;
      storeScratch(scratchRef.current);
    }
    persist();
  }
  return {
    draft: wrongAccount || loadingDocument ? null : draft,
    saved,
    busy,
    error,
    setError,
    storageError,
    loadError: wrongAccount ? "账户已切换，请用原账户登录后重开。" : loadError,
    authRequired,
    loadAuthRequired: wrongAccount || loadAuthRequired,
    dirty,
    patch,
    load,
    save,
    ensureOwner,
    ownerId: loadedOwner,
    discard,
    scratch,
    setScratch,
    candidates,
    resolveRecovery,
    setComposition: (value: boolean) => {
      composition.current = value;
      setComposing(value);
      if (!value) persist();
    },
  };
}
