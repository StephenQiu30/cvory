import { z } from "zod";
import type { CVResource, SectionItem, StyleSettings } from "@/lib/api/types";
import { completeResume, editable } from "./model";
import { parseBackup } from "./files";

export type EditorScratch = {
  markdown?: Record<string, string>;
  entry?: { sectionId: string; item: SectionItem };
  style?: StyleSettings;
};
export type Recovery = {
  version: 1;
  owner: string;
  cv: string;
  baseEtag: string;
  time: string;
  document: ReturnType<typeof editable>;
  scratch: EditorScratch;
};
export const RECOVERY_PREFIX = "cvory:recovery:";
export const LOGOUT_EVENT = "cvory:logout";
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CANDIDATES = 10;
const header = z.object({
  version: z.literal(1),
  owner: z.string(),
  cv: z.string(),
  baseEtag: z.string(),
  time: z.iso.datetime(),
  document: z.object({ displayName: z.string().max(MAX_BYTES) }).passthrough(),
  scratch: z
    .object({
      markdown: z.record(z.string(), z.string().max(MAX_BYTES)).optional(),
      entry: z.object({ sectionId: z.string(), item: z.unknown() }).optional(),
      style: z.unknown().optional(),
    })
    .strict(),
});
export function recoveryKey(owner: string, cv: string, tab: string) {
  return `${RECOVERY_PREFIX}${encodeURIComponent(owner)}:${encodeURIComponent(cv)}:${tab}`;
}
export function parseRecovery(
  text: string,
  owner: string,
  cv: string,
): Recovery {
  if (new Blob([text]).size > MAX_BYTES)
    throw Error("本机草稿超过 4 MiB，无法恢复。");
  const value = header.parse(JSON.parse(text));
  if (value.owner !== owner || value.cv !== cv)
    throw Error("草稿账户或简历不匹配。");
  // Reuse the bounded backup structure validator; an unfinished name is allowed locally.
  const validate = (document: unknown) =>
    parseBackup(
      JSON.stringify({
        format: "cvory",
        version: 1,
        document,
      }),
    );
  const data = validate({
    ...value.document,
    displayName: "未命名简历",
  });
  const scratch: EditorScratch = { markdown: value.scratch.markdown };
  if (value.scratch.entry) {
    const item = completeResume(
      validate({
        ...data,
        sections: [
          {
            id: value.scratch.entry.sectionId,
            type: "custom",
            title: "",
            items: [value.scratch.entry.item],
          },
        ],
      }),
    ).sections[0].items[0];
    scratch.entry = { sectionId: value.scratch.entry.sectionId, item };
  }
  if (value.scratch.style)
    scratch.style = completeResume(
      validate({ ...data, styleSettings: value.scratch.style }),
    ).styleSettings;
  return {
    ...value,
    document: {
      displayName: value.document.displayName,
      ...completeResume(data),
    },
    scratch,
  };
}
export function readRecoveries(storage: Storage, owner: string, cv: string) {
  const prefix = recoveryKey(owner, cv, "");
  const results: { key: string; value: Recovery }[] = [];
  let invalid = false;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    if (!key.startsWith(prefix)) continue;
    try {
      results.push({
        key,
        value: parseRecovery(storage.getItem(key)!, owner, cv),
      });
    } catch {
      invalid = true;
    }
  }
  return {
    results: results.sort((a, b) => b.value.time.localeCompare(a.value.time)),
    invalid,
  };
}
export function writeRecovery(
  storage: Storage,
  key: string,
  recovery: Recovery,
  replacing?: string,
) {
  const text = JSON.stringify(recovery);
  if (new Blob([text]).size > MAX_BYTES)
    throw Error("本机恢复空间单份上限为 4 MiB，请先保存或导出备份。");
  let count = 0;
  for (let i = 0; i < storage.length; i++)
    if (storage.key(i)?.startsWith(RECOVERY_PREFIX)) count++;
  if (
    !storage.getItem(key) &&
    count - (replacing && storage.getItem(replacing) ? 1 : 0) >= MAX_CANDIDATES
  )
    throw Error("本机已保留 10 份草稿，请先处理恢复候选或保存备份。");
  storage.setItem(key, text);
}
export function clearOwnerRecoveries(owner: string) {
  const prefix = `${RECOVERY_PREFIX}${encodeURIComponent(owner)}:`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++)
    if (localStorage.key(i)?.startsWith(prefix))
      keys.push(localStorage.key(i)!);
  keys.forEach((key) => localStorage.removeItem(key));
}
export function announceLogout(owner: string) {
  window.dispatchEvent(new CustomEvent(LOGOUT_EVENT, { detail: owner }));
  try {
    localStorage.setItem(
      LOGOUT_EVENT,
      JSON.stringify({ owner, nonce: crypto.randomUUID() }),
    );
  } catch {
    /* Other tabs re-check their session on focus; no draft data is in this signal. */
  }
}
export function recoveredCv(server: CVResource, value: Recovery): CVResource {
  return { ...server, ...value.document };
}
