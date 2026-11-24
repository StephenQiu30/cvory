import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  CVORY_CONTRACT_VERSION,
  RESUME_SECTION_IDS,
  createEmptyBasics,
  localDraftIndexEntrySchema,
  type BasicsData,
  type EducationItem,
  type ExperienceItem,
  type LocalDraftIndexEntry,
  type OptionalBasicsField,
  type ResumeSectionId,
  type ResumeSnapshot,
  type ResumeStyleOverrides,
  type SupportedTemplateId,
} from "@/lib/contract/contract";

export const GUEST_NAMESPACE = "guest";

function getIndexStorageKey(namespace: string): string {
  return `cvory:v${CVORY_CONTRACT_VERSION}:index:${namespace}`;
}

export function getIndexedDbName(namespace: string, docId: string): string {
  return `cvory:v${CVORY_CONTRACT_VERSION}:doc:${namespace}:${docId}`;
}

export function generateStableId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Lists all valid local drafts under the given namespace (strictly rejecting unsupported contracts).
 */
export function listLocalDrafts(namespace: string = GUEST_NAMESPACE): LocalDraftIndexEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(getIndexStorageKey(namespace));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const valid: LocalDraftIndexEntry[] = [];
    for (const item of parsed) {
      const checked = localDraftIndexEntrySchema.safeParse(item);
      if (checked.success) {
        valid.push(checked.data);
      }
    }
    return valid.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

const EMPTY_DRAFTS: readonly LocalDraftIndexEntry[] = [];
const DRAFTS_CHANGED_EVENT = "cvory:drafts-changed";

const cachedRawByNamespace = new Map<string, string | null>();
const cachedListByNamespace = new Map<string, readonly LocalDraftIndexEntry[]>();

export function subscribeLocalDrafts(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onChange = () => callback();
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFTS_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFTS_CHANGED_EVENT, onChange);
  };
}

export function getLocalDraftsSnapshot(
  namespace: string = GUEST_NAMESPACE
): readonly LocalDraftIndexEntry[] {
  if (typeof window === "undefined") {
    return EMPTY_DRAFTS;
  }
  const raw = window.localStorage.getItem(getIndexStorageKey(namespace));
  if (cachedRawByNamespace.get(namespace) === raw && cachedListByNamespace.has(namespace)) {
    return cachedListByNamespace.get(namespace) ?? EMPTY_DRAFTS;
  }
  const list = listLocalDrafts(namespace);
  cachedRawByNamespace.set(namespace, raw);
  cachedListByNamespace.set(namespace, list);
  return list;
}

export function getLocalDraftsServerSnapshot(): readonly LocalDraftIndexEntry[] {
  return EMPTY_DRAFTS;
}

export function saveLocalDraftIndex(
  namespace: string,
  entries: readonly LocalDraftIndexEntry[]
): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const serialized = JSON.stringify(entries);
    window.localStorage.setItem(getIndexStorageKey(namespace), serialized);
    cachedRawByNamespace.set(namespace, serialized);
    cachedListByNamespace.set(
      namespace,
      [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    );
    window.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function upsertLocalDraftIndexEntry(
  namespace: string,
  entry: LocalDraftIndexEntry
): boolean {
  const existing = listLocalDrafts(namespace).filter((item) => item.id !== entry.id);
  return saveLocalDraftIndex(namespace, [entry, ...existing]);
}

export function removeLocalDraftIndexEntry(namespace: string, docId: string): boolean {
  const remaining = listLocalDrafts(namespace).filter((item) => item.id !== docId);
  return saveLocalDraftIndex(namespace, remaining);
}

/**
 * Creates a brand-new empty local draft with the chosen template (AC-CV-01: sample text never copied).
 */
export function createLocalDraft(
  templateId: SupportedTemplateId,
  namespace: string = GUEST_NAMESPACE,
  title: string = "未命名简历"
): LocalDraftIndexEntry {
  const id = generateStableId("draft");
  const now = new Date().toISOString();
  const entry: LocalDraftIndexEntry = {
    id,
    contractVersion: CVORY_CONTRACT_VERSION,
    title,
    templateId,
    updatedAt: now,
  };
  upsertLocalDraftIndexEntry(namespace, entry);
  return entry;
}

export function renameLocalDraft(
  docId: string,
  title: string,
  namespace: string = GUEST_NAMESPACE
): LocalDraftIndexEntry | null {
  const drafts = listLocalDrafts(namespace);
  const target = drafts.find((item) => item.id === docId);
  if (!target) {
    return null;
  }
  const updated: LocalDraftIndexEntry = {
    ...target,
    title: title.trim() || target.title,
    updatedAt: new Date().toISOString(),
  };
  upsertLocalDraftIndexEntry(namespace, updated);
  return updated;
}

export async function deleteLocalDraft(
  docId: string,
  namespace: string = GUEST_NAMESPACE
): Promise<void> {
  removeLocalDraftIndexEntry(namespace, docId);
  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(getIndexedDbName(namespace, docId));
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

/**
 * Duplicates a local draft by copying its current Yjs binary state into a fresh independent doc ID.
 */
export async function duplicateLocalDraft(
  sourceId: string,
  namespace: string = GUEST_NAMESPACE
): Promise<LocalDraftIndexEntry | null> {
  const sourceEntry = listLocalDrafts(namespace).find((item) => item.id === sourceId);
  if (!sourceEntry) {
    return null;
  }

  const sourceDoc = new Y.Doc();
  const sourcePersistence = new IndexeddbPersistence(
    getIndexedDbName(namespace, sourceId),
    sourceDoc
  );
  await sourcePersistence.whenSynced;
  const fullUpdate = Y.encodeStateAsUpdate(sourceDoc);
  await sourcePersistence.destroy();
  sourceDoc.destroy();

  const newId = generateStableId("draft");
  const now = new Date().toISOString();
  const copyTitle = `${sourceEntry.title}（副本）`;

  const targetDoc = new Y.Doc();
  const targetPersistence = new IndexeddbPersistence(getIndexedDbName(namespace, newId), targetDoc);
  await targetPersistence.whenSynced;
  Y.applyUpdate(targetDoc, fullUpdate);
  const metaMap = targetDoc.getMap<unknown>("meta");
  metaMap.set("title", copyTitle);
  metaMap.set("updatedAt", now);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await targetPersistence.destroy();
  targetDoc.destroy();

  const newEntry: LocalDraftIndexEntry = {
    id: newId,
    contractVersion: CVORY_CONTRACT_VERSION,
    title: copyTitle,
    templateId: sourceEntry.templateId,
    updatedAt: now,
  };
  upsertLocalDraftIndexEntry(namespace, newEntry);
  return newEntry;
}

export interface ResumeYDocHandle {
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence | null;
  readonly getSnapshot: () => ResumeSnapshot;
  readonly updateTitle: (title: string) => void;
  readonly setTemplateId: (templateId: SupportedTemplateId) => void;
  readonly updateBasics: (patch: Partial<BasicsData>) => void;
  readonly toggleOptionalBasicsField: (field: OptionalBasicsField, visible: boolean) => void;
  readonly upsertEducation: (item: EducationItem) => void;
  readonly removeEducation: (id: string) => void;
  readonly reorderEducation: (fromIndex: number, toIndex: number) => void;
  readonly upsertExperience: (section: "work" | "projects", item: ExperienceItem) => void;
  readonly removeExperience: (section: "work" | "projects", id: string) => void;
  readonly reorderExperience: (
    section: "work" | "projects",
    fromIndex: number,
    toIndex: number
  ) => void;
  readonly updateSkillsHtml: (html: string) => void;
  readonly reorderSections: (fromIndex: number, toIndex: number) => void;
  readonly toggleSectionHidden: (section: ResumeSectionId, hidden: boolean) => void;
  readonly updateStyleOverride: <K extends keyof ResumeStyleOverrides>(
    key: K,
    value: ResumeStyleOverrides[K]
  ) => void;
  readonly resetStyleOverrides: () => void;
  readonly destroy: () => Promise<void>;
}

function readOrderIds(orderArray: Y.Array<string>, deletedMap: Y.Map<boolean>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of orderArray.toArray()) {
    if (!seen.has(id) && !deletedMap.get(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Opens or initializes a single-contract Y.Doc backed by y-indexeddb.
 */
export function openResumeYDoc(
  docId: string,
  initialTemplateId: SupportedTemplateId = "classic-single",
  initialTitle: string = "未命名简历",
  namespace: string = GUEST_NAMESPACE
): ResumeYDocHandle {
  const doc = new Y.Doc();
  const metaMap = doc.getMap<unknown>("meta");
  const basicsMap = doc.getMap<unknown>("basics");
  const styleOverridesMap = doc.getMap<unknown>("styleOverrides");
  const sectionOrderArray = doc.getArray<string>("sectionOrder");
  const hiddenSectionsMap = doc.getMap<boolean>("hiddenSections");

  const educationOrder = doc.getArray<string>("educationOrder");
  const educationItems = doc.getMap<EducationItem>("educationItems");
  const educationDeleted = doc.getMap<boolean>("educationDeleted");

  const workOrder = doc.getArray<string>("workOrder");
  const workItems = doc.getMap<ExperienceItem>("workItems");
  const workDeleted = doc.getMap<boolean>("workDeleted");

  const projectsOrder = doc.getArray<string>("projectsOrder");
  const projectsItems = doc.getMap<ExperienceItem>("projectsItems");
  const projectsDeleted = doc.getMap<boolean>("projectsDeleted");

  const skillsMap = doc.getMap<string>("skills");

  const ensureInitialized = () => {
    doc.transact(() => {
      if (!metaMap.has("contractVersion")) {
        metaMap.set("contractVersion", CVORY_CONTRACT_VERSION);
      }
      if (!metaMap.has("title")) {
        metaMap.set("title", initialTitle);
      }
      if (!metaMap.has("templateId")) {
        metaMap.set("templateId", initialTemplateId);
      }
      if (!metaMap.has("updatedAt")) {
        metaMap.set("updatedAt", new Date().toISOString());
      }
      if (sectionOrderArray.length === 0) {
        sectionOrderArray.push([...RESUME_SECTION_IDS]);
      }
    });
  };

  let persistence: IndexeddbPersistence | null = null;
  if (typeof indexedDB !== "undefined") {
    persistence = new IndexeddbPersistence(getIndexedDbName(namespace, docId), doc);
    void persistence.whenSynced.then(() => {
      ensureInitialized();
    });
  } else {
    ensureInitialized();
  }

  const touchUpdatedAt = () => {
    const now = new Date().toISOString();
    metaMap.set("updatedAt", now);
    const title = String(metaMap.get("title") ?? initialTitle);
    const templateId = (metaMap.get("templateId") as SupportedTemplateId) ?? initialTemplateId;
    upsertLocalDraftIndexEntry(namespace, {
      id: docId,
      contractVersion: CVORY_CONTRACT_VERSION,
      title,
      templateId,
      updatedAt: now,
    });
  };

  const getSnapshot = (): ResumeSnapshot => {
    const emptyBasics = createEmptyBasics();
    const basics: BasicsData = {
      fullName: String(basicsMap.get("fullName") ?? emptyBasics.fullName),
      targetRole: String(basicsMap.get("targetRole") ?? emptyBasics.targetRole),
      phone: String(basicsMap.get("phone") ?? emptyBasics.phone),
      email: String(basicsMap.get("email") ?? emptyBasics.email),
      location: String(basicsMap.get("location") ?? emptyBasics.location),
      wechat: String(basicsMap.get("wechat") ?? emptyBasics.wechat),
      github: String(basicsMap.get("github") ?? emptyBasics.github),
      website: String(basicsMap.get("website") ?? emptyBasics.website),
      portfolio: String(basicsMap.get("portfolio") ?? emptyBasics.portfolio),
      visibleOptionalFields: Array.isArray(basicsMap.get("visibleOptionalFields"))
        ? (basicsMap.get("visibleOptionalFields") as OptionalBasicsField[])
        : [],
    };

    const rawSectionOrder = sectionOrderArray.toArray() as ResumeSectionId[];
    const sectionOrder: ResumeSectionId[] =
      rawSectionOrder.length === RESUME_SECTION_IDS.length
        ? rawSectionOrder
        : [...RESUME_SECTION_IDS];

    const hiddenSections: ResumeSectionId[] = [];
    for (const sec of RESUME_SECTION_IDS) {
      if (hiddenSectionsMap.get(sec) === true) {
        hiddenSections.push(sec);
      }
    }

    const styleOverrides: ResumeStyleOverrides = {
      ...(styleOverridesMap.has("fontFamily")
        ? { fontFamily: styleOverridesMap.get("fontFamily") as ResumeStyleOverrides["fontFamily"] }
        : {}),
      ...(styleOverridesMap.has("fontSizePt")
        ? { fontSizePt: styleOverridesMap.get("fontSizePt") as ResumeStyleOverrides["fontSizePt"] }
        : {}),
      ...(styleOverridesMap.has("lineHeight")
        ? { lineHeight: styleOverridesMap.get("lineHeight") as ResumeStyleOverrides["lineHeight"] }
        : {}),
      ...(styleOverridesMap.has("spacing")
        ? { spacing: styleOverridesMap.get("spacing") as ResumeStyleOverrides["spacing"] }
        : {}),
      ...(styleOverridesMap.has("accentColor")
        ? { accentColor: String(styleOverridesMap.get("accentColor")) }
        : {}),
    };

    const education = readOrderIds(educationOrder, educationDeleted)
      .map((id) => educationItems.get(id))
      .filter((item): item is EducationItem => item !== undefined);

    const work = readOrderIds(workOrder, workDeleted)
      .map((id) => workItems.get(id))
      .filter((item): item is ExperienceItem => item !== undefined);

    const projects = readOrderIds(projectsOrder, projectsDeleted)
      .map((id) => projectsItems.get(id))
      .filter((item): item is ExperienceItem => item !== undefined);

    return {
      id: docId,
      contractVersion: CVORY_CONTRACT_VERSION,
      title: String(metaMap.get("title") ?? initialTitle),
      templateId: (metaMap.get("templateId") as SupportedTemplateId) ?? initialTemplateId,
      sectionOrder,
      hiddenSections,
      styleOverrides,
      basics,
      education,
      work,
      projects,
      skillsHtml: String(skillsMap.get("html") ?? ""),
      updatedAt: String(metaMap.get("updatedAt") ?? new Date().toISOString()),
    };
  };

  return {
    doc,
    persistence,
    getSnapshot,
    updateTitle(title: string) {
      doc.transact(() => {
        metaMap.set("title", title);
        touchUpdatedAt();
      });
    },
    setTemplateId(templateId: SupportedTemplateId) {
      doc.transact(() => {
        metaMap.set("templateId", templateId);
        touchUpdatedAt();
      });
    },
    updateBasics(patch: Partial<BasicsData>) {
      doc.transact(() => {
        for (const [key, value] of Object.entries(patch)) {
          if (value !== undefined) {
            basicsMap.set(key, value);
          }
        }
        touchUpdatedAt();
      });
    },
    toggleOptionalBasicsField(field: OptionalBasicsField, visible: boolean) {
      doc.transact(() => {
        const current = Array.isArray(basicsMap.get("visibleOptionalFields"))
          ? [...(basicsMap.get("visibleOptionalFields") as OptionalBasicsField[])]
          : [];
        const next = visible
          ? current.includes(field)
            ? current
            : [...current, field]
          : current.filter((item) => item !== field);
        basicsMap.set("visibleOptionalFields", next);
        touchUpdatedAt();
      });
    },
    upsertEducation(item: EducationItem) {
      doc.transact(() => {
        if (educationDeleted.get(item.id)) {
          return;
        }
        educationItems.set(item.id, item);
        if (!educationOrder.toArray().includes(item.id)) {
          educationOrder.push([item.id]);
        }
        touchUpdatedAt();
      });
    },
    removeEducation(id: string) {
      doc.transact(() => {
        educationDeleted.set(id, true);
        touchUpdatedAt();
      });
    },
    reorderEducation(fromIndex: number, toIndex: number) {
      const ids = readOrderIds(educationOrder, educationDeleted);
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length) {
        return;
      }
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      doc.transact(() => {
        educationOrder.delete(0, educationOrder.length);
        educationOrder.push(ids);
        touchUpdatedAt();
      });
    },
    upsertExperience(section: "work" | "projects", item: ExperienceItem) {
      const order = section === "work" ? workOrder : projectsOrder;
      const items = section === "work" ? workItems : projectsItems;
      const deleted = section === "work" ? workDeleted : projectsDeleted;
      doc.transact(() => {
        if (deleted.get(item.id)) {
          return;
        }
        items.set(item.id, item);
        if (!order.toArray().includes(item.id)) {
          order.push([item.id]);
        }
        touchUpdatedAt();
      });
    },
    removeExperience(section: "work" | "projects", id: string) {
      const deleted = section === "work" ? workDeleted : projectsDeleted;
      doc.transact(() => {
        deleted.set(id, true);
        touchUpdatedAt();
      });
    },
    reorderExperience(section: "work" | "projects", fromIndex: number, toIndex: number) {
      const order = section === "work" ? workOrder : projectsOrder;
      const deleted = section === "work" ? workDeleted : projectsDeleted;
      const ids = readOrderIds(order, deleted);
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length) {
        return;
      }
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      doc.transact(() => {
        order.delete(0, order.length);
        order.push(ids);
        touchUpdatedAt();
      });
    },
    updateSkillsHtml(html: string) {
      doc.transact(() => {
        skillsMap.set("html", html);
        touchUpdatedAt();
      });
    },
    reorderSections(fromIndex: number, toIndex: number) {
      const current = sectionOrderArray.toArray();
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return;
      }
      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);
      doc.transact(() => {
        sectionOrderArray.delete(0, sectionOrderArray.length);
        sectionOrderArray.push(current);
        touchUpdatedAt();
      });
    },
    toggleSectionHidden(section: ResumeSectionId, hidden: boolean) {
      doc.transact(() => {
        hiddenSectionsMap.set(section, hidden);
        touchUpdatedAt();
      });
    },
    updateStyleOverride(key, value) {
      doc.transact(() => {
        if (value === undefined) {
          styleOverridesMap.delete(key);
        } else {
          styleOverridesMap.set(key, value);
        }
        touchUpdatedAt();
      });
    },
    resetStyleOverrides() {
      doc.transact(() => {
        for (const key of Array.from(styleOverridesMap.keys())) {
          styleOverridesMap.delete(key);
        }
        touchUpdatedAt();
      });
    },
    async destroy() {
      if (persistence) {
        await persistence.destroy();
      }
      doc.destroy();
    },
  };
}
