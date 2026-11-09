"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/error-message";
import { cvApi, ApiError } from "@/lib/api/client";
import type { CVResource } from "@/lib/api/types";
import { editable } from "@/lib/resume/model";
/** Owns draft, saved snapshot and conditional writes. UI never maintains another save source. */
export function useCvDocument(id: string, onConflict: () => void) {
  const [draft, setDraft] = useState<CVResource | null>(null);
  const [saved, setSaved] = useState<CVResource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [loadAuthRequired, setLoadAuthRequired] = useState(false);
  const inFlight = useRef(false);
  const dirty =
    !!draft &&
    !!saved &&
    JSON.stringify(editable(draft)) !== JSON.stringify(editable(saved));
  const load = useCallback(async () => {
    setLoadError("");
    setLoadAuthRequired(false);
    try {
      const data = await cvApi.getCv(id);
      setSaved(data);
      setDraft(data);
      setLoadError("");
    } catch (e) {
      setLoadAuthRequired(e instanceof ApiError && e.code === 401);
      setLoadError(
        errorMessage(
          e,
          e instanceof ApiError && e.isNotFound
            ? "这份简历不存在或已被删除。"
            : "无法读取此份简历，请重试。",
        ),
      );
    }
  }, [id]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty || busy) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, busy]);
  const patch = (next: Partial<CVResource>) =>
    setDraft((current) => (current ? { ...current, ...next } : current));
  async function save() {
    if (!draft || !saved || inFlight.current) return false;
    setAuthRequired(false);
    if (
      draft.profile.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.profile.email)
    ) {
      setError("请修正邮箱格式后再保存。");
      return false;
    }
    if (!draft.displayName.trim()) {
      setError("请输入简历名称。");
      return false;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    const submitted = structuredClone(draft);
    try {
      const updated = await cvApi.updateCv(
        id,
        {
          ...editable(submitted),
          etag: saved.etag,
          updateMask: "displayName,profile,sections,styleSettings",
        },
        saved.etag,
      );
      setSaved(updated);
      setDraft((current) =>
        current &&
        JSON.stringify(editable(current)) ===
          JSON.stringify(editable(submitted))
          ? updated
          : current,
      );
      return true;
    } catch (e) {
      setAuthRequired(e instanceof ApiError && e.code === 401);
      setError(
        e instanceof ApiError && e.isConcurrencyConflict
          ? "服务器已有更新。本地内容已保留，请选择下一步。"
          : errorMessage(e, "保存失败，输入已保留，请重试。"),
      );
      if (e instanceof ApiError && e.isConcurrencyConflict) onConflict();
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return {
    draft,
    saved,
    busy,
    error,
    setError,
    loadError,
    authRequired,
    loadAuthRequired,
    dirty,
    patch,
    load,
    save,
  };
}
