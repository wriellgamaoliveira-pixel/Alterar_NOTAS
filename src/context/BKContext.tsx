import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { classifyCFOP, parseBKXml } from '@/parsers/bkParser';
import {
  ensureDirectoryPermission,
  listChangedXmlFiles,
  loadDirectoryHandle,
  loadIndexedState,
  readPortableBackup,
  requestDirectory,
  saveIndexedState,
  writePortableBackup,
} from '@/services/bkIndexedDb';
import {
  DEFAULT_CFOP_CONFIG,
  DEFAULT_UNITS,
  type BKCFOPConfig,
  type BKDocument,
  type BKEvent,
  type BKStoredState,
  type BKSyncResult,
} from '@/types/bk';

const LEGACY_STORAGE_KEY = 'portal-fiscal-bk-v1';

interface BKContextValue extends BKStoredState {
  storageReady: boolean;
  storageBusy: boolean;
  storageError?: string;
  saveConfigAndReclassify: (config: BKCFOPConfig, deadlineDays: number, warningDays: number, from?: string, to?: string) => { ok: boolean; message: string; count: number };
  importBatch: (documents: BKDocument[], events: Array<{ accessKey: string; event: BKEvent }>) => { imported: number; updated: number };
  saveDocument: (document: BKDocument) => void;
  deleteDocuments: (ids: string[]) => { ok: boolean; message: string };
  selectStorageFolder: () => Promise<string>;
  syncStorageFolder: (requestPermission?: boolean) => Promise<BKSyncResult>;
  exportPortableBackup: () => Promise<string>;
  importPortableBackup: () => Promise<string>;
  setAutoSyncMinutes: (minutes: number) => void;
}

const BKContext = createContext<BKContextValue | undefined>(undefined);

const emptyState = (): BKStoredState => ({
  version: 1, documents: [], config: DEFAULT_CFOP_CONFIG, units: DEFAULT_UNITS,
  deadlineDays: 180, warningDays: 30, autoSyncMinutes: 5, knownFiles: {},
});

function withRequiredExportCFOPs(config: BKCFOPConfig): BKCFOPConfig {
  const forcedExports = ['7501', '7504'];
  return {
    remessa: config.remessa.filter((cfop) => !forcedExports.includes(cfop)),
    exportacao: [...new Set([...config.exportacao.filter((cfop) => !forcedExports.includes(cfop)), ...forcedExports])],
    'venda-interna': config['venda-interna'].filter((cfop) => !forcedExports.includes(cfop)),
    devolucao: config.devolucao.filter((cfop) => !forcedExports.includes(cfop)),
  };
}

function normalizeState(value?: Partial<BKStoredState>): BKStoredState {
  const config = withRequiredExportCFOPs(value?.config || DEFAULT_CFOP_CONFIG);
  const documents = Array.isArray(value?.documents)
    ? value.documents.map((document) => ({ ...document, category: classifyCFOP(document.cfops, config) }))
    : [];
  return {
    ...emptyState(), ...value,
    documents,
    config,
    units: Array.isArray(value?.units) ? value.units : DEFAULT_UNITS,
    knownFiles: value?.knownFiles || {},
    autoSyncMinutes: Number(value?.autoSyncMinutes) >= 1 ? Number(value?.autoSyncMinutes) : 5,
  };
}

function loadLegacyState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '')); }
  catch { return emptyState(); }
}

function eventStatus(events: BKEvent[], fallback: BKDocument['fiscalStatus']) {
  const ordered = [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (ordered.some((event) => event.type === 'cancelamento' && (!event.sefazCode || ['101', '135', '155'].includes(event.sefazCode)))) return 'cancelada';
  if (ordered.some((event) => event.type === 'autorizacao' && (!event.sefazCode || ['100', '150'].includes(event.sefazCode)))) return 'autorizada';
  return fallback;
}

function validateCFOPConfig(config: BKCFOPConfig) {
  const seen = new Map<string, string>();
  for (const [category, values] of Object.entries(config)) for (const value of values) {
    if (seen.has(value)) return `CFOP ${value} repetido em ${seen.get(value)} e ${category}.`;
    seen.set(value, category);
  }
  return '';
}

function reclassifyDocuments(documents: BKDocument[], config: BKCFOPConfig, from?: string, to?: string) {
  const classified = documents.map((document) => {
    const documentDate = document.issueDate.slice(0, 10);
    if ((from && documentDate < from) || (to && documentDate > to)) return document;
    return { ...document, category: classifyCFOP(document.cfops, config) };
  });
  const blocked = classified.some((document, index) =>
    documents[index].category === 'exportacao' && document.category !== 'exportacao' && document.shipmentId);
  const count = classified.filter((document, index) => document.category !== documents[index].category).length;
  return { classified, blocked, count };
}

function mergeFiscalData(current: BKDocument[], incomingDocuments: BKDocument[], incomingEvents: Array<{ accessKey: string; event: BKEvent }>) {
  const documents = structuredClone(current);
  let imported = 0; let updated = 0;
  for (const incoming of incomingDocuments) {
    const index = documents.findIndex((item) =>
      (incoming.accessKey && item.accessKey === incoming.accessKey) || item.complementaryId === incoming.complementaryId);
    if (index < 0) { documents.push(incoming); imported += 1; }
    else {
      const events = [...documents[index].events];
      incoming.events.forEach((event) => { if (!events.some((saved) => saved.id === event.id)) events.push(event); });
      documents[index] = { ...documents[index], ...incoming, events, fiscalStatus: eventStatus(events, incoming.fiscalStatus) };
      updated += 1;
    }
  }
  for (const incoming of incomingEvents) {
    const index = documents.findIndex((item) => item.accessKey === incoming.accessKey);
    if (index >= 0 && !documents[index].events.some((event) => event.id === incoming.event.id)) {
      const events = [...documents[index].events, incoming.event];
      documents[index] = { ...documents[index], events, fiscalStatus: eventStatus(events, documents[index].fiscalStatus) };
      updated += 1;
    }
  }
  return { documents, imported, updated };
}

export function BKProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BKStoredState>(loadLegacyState);
  const [storageReady, setStorageReady] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let active = true;
    if (!('indexedDB' in window)) {
      setStorageError('Este navegador não oferece IndexedDB. Use Chrome ou Edge atualizado.');
      setStorageReady(true);
      return () => { active = false; };
    }
    loadIndexedState().then(async (saved) => {
      if (!active) return;
      const loaded = saved ? normalizeState(saved) : loadLegacyState();
      setState(loaded); stateRef.current = loaded; setStorageReady(true);
      if (!saved) await saveIndexedState(loaded);
    }).catch((error) => { console.error('Falha ao abrir IndexedDB.', error); setStorageError('Não foi possível abrir o IndexedDB neste navegador.'); setStorageReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const timer = window.setTimeout(async () => {
      try {
        await saveIndexedState(state);
        if (state.folderName) {
          const handle = await loadDirectoryHandle();
          if (handle && await ensureDirectoryPermission(handle, false)) await writePortableBackup(handle, state);
        }
      } catch (error) { console.error('Falha ao salvar a base BK.', error); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state, storageReady]);

  const importBatch = useCallback<BKContextValue['importBatch']>((incomingDocuments, incomingEvents) => {
    const result = mergeFiscalData(stateRef.current.documents, incomingDocuments, incomingEvents);
    setState((current) => ({ ...current, documents: result.documents }));
    return { imported: result.imported, updated: result.updated };
  }, []);

  const saveDocument = useCallback((document: BKDocument) => {
    setState((current) => ({ ...current, documents: [...current.documents.filter((item) => item.id !== document.id), document] }));
  }, []);

  const deleteDocuments = useCallback<BKContextValue['deleteDocuments']>((ids) => {
    if (stateRef.current.documents.some((item) => ids.includes(item.id) && item.shipmentId))
      return { ok: false, message: 'Há documento vinculado a embarque. Desvincule-o antes de excluir.' };
    setState((current) => ({ ...current, documents: current.documents.filter((item) => !ids.includes(item.id)) }));
    return { ok: true, message: 'Documento(s) excluído(s).' };
  }, []);

  const saveConfigAndReclassify = useCallback<BKContextValue['saveConfigAndReclassify']>((config, deadlineDays, warningDays, from, to) => {
    const normalizedConfig = withRequiredExportCFOPs(config);
    const validation = validateCFOPConfig(normalizedConfig);
    if (validation) return { ok: false, message: validation, count: 0 };
    const current = stateRef.current;
    const result = reclassifyDocuments(current.documents, normalizedConfig, from, to);
    if (result.blocked) return { ok: false, message: 'Atualização bloqueada: uma nota vinculada a embarque deixaria de ser Exportação.', count: 0 };
    const next = { ...current, config: normalizedConfig, deadlineDays, warningDays, documents: result.classified };
    setState(next); stateRef.current = next;
    return { ok: true, message: `Configuração salva. ${result.count} nota(s) mudaram de departamento sem nova importação.`, count: result.count };
  }, []);

  const selectStorageFolder = useCallback(async () => {
    setStorageBusy(true);
    try {
      const handle = await requestDirectory();
      const backup = await readPortableBackup(handle);
      if (backup) {
        const imported = normalizeState(backup);
        const merged = mergeFiscalData(stateRef.current.documents, imported.documents, []);
        const next = { ...imported, documents: merged.documents, folderName: handle.name };
        setState(next); stateRef.current = next; await saveIndexedState(next);
        return `Pasta ${handle.name} configurada. Backup encontrado e ${merged.imported} documento(s) carregado(s).`;
      }
      setState((current) => ({ ...current, folderName: handle.name }));
      return `Pasta ${handle.name} configurada. O arquivo bk-documentos.json será criado automaticamente.`;
    } finally { setStorageBusy(false); }
  }, []);

  const syncStorageFolder = useCallback(async (requestPermission = true): Promise<BKSyncResult> => {
    setStorageBusy(true);
    try {
      const handle = await loadDirectoryHandle();
      if (!handle) return { ok: false, message: 'Selecione primeiro a pasta de armazenamento.', analyzed: 0, imported: 0, updated: 0, ignored: 0 };
      if (!await ensureDirectoryPermission(handle, requestPermission)) return { ok: false, message: 'A permissão da pasta precisa ser renovada.', analyzed: 0, imported: 0, updated: 0, ignored: 0 };
      const current = stateRef.current;
      const { changed, discovered } = await listChangedXmlFiles(handle, current.knownFiles);
      const parsedDocuments: BKDocument[] = []; const parsedEvents: Array<{ accessKey: string; event: BKEvent }> = [];
      let ignored = 0;
      for (const entry of changed) {
        try {
          const parsed = parseBKXml(await entry.file.text(), entry.path, current.config);
          if (parsed.kind === 'document') {
            const unit = current.units.find((candidate) => candidate.cnpj === parsed.document.issuerTaxId);
            if (!unit) { ignored += 1; continue; }
            parsed.document.unitId = unit.id; parsedDocuments.push(parsed.document);
          } else parsedEvents.push({ accessKey: parsed.accessKey, event: parsed.event });
        } catch { ignored += 1; }
      }
      const merged = mergeFiscalData(current.documents, parsedDocuments, parsedEvents);
      const next: BKStoredState = { ...current, documents: merged.documents, folderName: handle.name, knownFiles: discovered, lastSync: new Date().toISOString() };
      setState(next); stateRef.current = next; await saveIndexedState(next); await writePortableBackup(handle, next);
      return { ok: true, message: `Sincronização concluída: ${merged.imported} nova(s), ${merged.updated} atualizada(s), ${ignored} ignorada(s).`, analyzed: changed.length, imported: merged.imported, updated: merged.updated, ignored };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Falha ao sincronizar a pasta.', analyzed: 0, imported: 0, updated: 0, ignored: 0 };
    } finally { setStorageBusy(false); }
  }, []);

  const exportPortableBackup = useCallback(async () => {
    const handle = await loadDirectoryHandle();
    if (!handle || !await ensureDirectoryPermission(handle, true)) throw new Error('Selecione e autorize a pasta primeiro.');
    await writePortableBackup(handle, stateRef.current);
    return `Backup anterior substituído e gravação confirmada em ${handle.name}/bk-documentos.json.`;
  }, []);

  const importPortableBackup = useCallback(async () => {
    const handle = await loadDirectoryHandle();
    if (!handle || !await ensureDirectoryPermission(handle, true)) throw new Error('Selecione e autorize a pasta primeiro.');
    const backup = await readPortableBackup(handle);
    if (!backup) throw new Error('O arquivo bk-documentos.json não foi encontrado na pasta.');
    const imported = normalizeState(backup); const merged = mergeFiscalData(stateRef.current.documents, imported.documents, []);
    const next = { ...imported, documents: merged.documents, folderName: handle.name };
    setState(next); stateRef.current = next; await saveIndexedState(next);
    return `Backup importado: ${merged.imported} documento(s) novo(s).`;
  }, []);

  const setAutoSyncMinutes = useCallback((minutes: number) => {
    setState((current) => ({ ...current, autoSyncMinutes: Math.max(1, Math.min(1440, minutes || 5)) }));
  }, []);

  useEffect(() => {
    if (!storageReady || !state.folderName) return;
    const initialSync = window.setTimeout(() => void syncStorageFolder(false), 1_000);
    const timer = window.setInterval(() => void syncStorageFolder(false), state.autoSyncMinutes * 60_000);
    return () => { window.clearTimeout(initialSync); window.clearInterval(timer); };
  }, [state.autoSyncMinutes, state.folderName, storageReady, syncStorageFolder]);

  const value = useMemo(() => ({ ...state, storageReady, storageBusy, storageError, saveConfigAndReclassify, importBatch, saveDocument, deleteDocuments, selectStorageFolder, syncStorageFolder, exportPortableBackup, importPortableBackup, setAutoSyncMinutes }),
    [state, storageReady, storageBusy, storageError, saveConfigAndReclassify, importBatch, saveDocument, deleteDocuments, selectStorageFolder, syncStorageFolder, exportPortableBackup, importPortableBackup, setAutoSyncMinutes]);
  return <BKContext.Provider value={value}>{storageReady ? children : <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Abrindo a base central de documentos…</div>}</BKContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBK() {
  const context = useContext(BKContext);
  if (!context) throw new Error('useBK must be used within BKProvider');
  return context;
}
