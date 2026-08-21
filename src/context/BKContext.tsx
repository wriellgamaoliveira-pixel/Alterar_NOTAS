import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { classifyCFOP } from '@/parsers/bkParser';
import {
  DEFAULT_CFOP_CONFIG,
  DEFAULT_UNITS,
  type BKCFOPConfig,
  type BKDocument,
  type BKEvent,
  type BKUnit,
} from '@/types/bk';

const STORAGE_KEY = 'portal-fiscal-bk-v1';

interface StoredBKState {
  version: 1;
  documents: BKDocument[];
  config: BKCFOPConfig;
  units: BKUnit[];
  deadlineDays: number;
  warningDays: number;
}

interface BKContextValue extends StoredBKState {
  saveConfig: (config: BKCFOPConfig, deadlineDays: number, warningDays: number) => { ok: boolean; message: string };
  importBatch: (documents: BKDocument[], events: Array<{ accessKey: string; event: BKEvent }>) => { imported: number; updated: number };
  saveDocument: (document: BKDocument) => void;
  deleteDocuments: (ids: string[]) => { ok: boolean; message: string };
  reclassify: (from?: string, to?: string) => { ok: boolean; message: string; count: number };
}

const BKContext = createContext<BKContextValue | undefined>(undefined);

function loadState(): StoredBKState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '') as StoredBKState;
    if (parsed.version === 1 && Array.isArray(parsed.documents)) return parsed;
  } catch { /* inicia com configuração segura */ }
  return { version: 1, documents: [], config: DEFAULT_CFOP_CONFIG, units: DEFAULT_UNITS, deadlineDays: 180, warningDays: 30 };
}

function eventStatus(events: BKEvent[], fallback: BKDocument['fiscalStatus']) {
  const ordered = [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (ordered.some((event) => event.type === 'cancelamento' && (!event.sefazCode || ['101', '135', '155'].includes(event.sefazCode)))) return 'cancelada';
  if (ordered.some((event) => event.type === 'autorizacao' && (!event.sefazCode || ['100', '150'].includes(event.sefazCode)))) return 'autorizada';
  return fallback;
}

export function BKProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredBKState>(loadState);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { console.error('Não foi possível persistir o estado BK no navegador.', error); }
  }, [state]);

  const importBatch = useCallback<BKContextValue['importBatch']>((incomingDocuments, incomingEvents) => {
    let imported = 0;
    let updated = 0;
    setState((current) => {
      const snapshot = structuredClone(current);
      try {
        const documents = [...current.documents];
        for (const incoming of incomingDocuments) {
          const index = documents.findIndex((item) =>
            (incoming.accessKey && item.accessKey === incoming.accessKey) || item.complementaryId === incoming.complementaryId);
          if (index < 0) {
            documents.push(incoming);
            imported += 1;
          } else {
            const events = [...documents[index].events];
            incoming.events.forEach((event) => { if (!events.some((saved) => saved.id === event.id)) events.push(event); });
            documents[index] = { ...documents[index], events, fiscalStatus: eventStatus(events, documents[index].fiscalStatus) };
            updated += 1;
          }
        }
        for (const incoming of incomingEvents) {
          const index = documents.findIndex((item) => item.accessKey === incoming.accessKey);
          if (index < 0) continue;
          if (!documents[index].events.some((event) => event.id === incoming.event.id)) {
            const events = [...documents[index].events, incoming.event];
            documents[index] = { ...documents[index], events, fiscalStatus: eventStatus(events, documents[index].fiscalStatus) };
            updated += 1;
          }
        }
        return { ...current, documents };
      } catch (error) {
        console.error('Importação restaurada após falha', error);
        return snapshot;
      }
    });
    return { imported, updated };
  }, []);

  const saveDocument = useCallback((document: BKDocument) => {
    setState((current) => ({ ...current, documents: [...current.documents.filter((item) => item.id !== document.id), document] }));
  }, []);

  const deleteDocuments = useCallback<BKContextValue['deleteDocuments']>((ids) => {
    let result = { ok: true, message: 'Documento(s) excluído(s).' };
    setState((current) => {
      const blocked = current.documents.filter((item) => ids.includes(item.id) && item.shipmentId);
      if (blocked.length) {
        result = { ok: false, message: 'Há documento vinculado a embarque. Desvincule-o antes de excluir.' };
        return current;
      }
      return { ...current, documents: current.documents.filter((item) => !ids.includes(item.id)) };
    });
    return result;
  }, []);

  const saveConfig = useCallback<BKContextValue['saveConfig']>((config, deadlineDays, warningDays) => {
    const seen = new Map<string, string>();
    for (const [category, values] of Object.entries(config)) {
      for (const value of values) {
        if (seen.has(value)) return { ok: false, message: `CFOP ${value} repetido em ${seen.get(value)} e ${category}.` };
        seen.set(value, category);
      }
    }
    setState((current) => ({ ...current, config, deadlineDays, warningDays }));
    return { ok: true, message: 'Configuração salva. Use reclassificar para atualizar o histórico.' };
  }, []);

  const reclassify = useCallback<BKContextValue['reclassify']>((from, to) => {
    let count = 0;
    let blocked = false;
    setState((current) => {
      const documents = current.documents.map((document) => {
        const date = document.issueDate.slice(0, 10);
        if ((from && date < from) || (to && date > to)) return document;
        const category = classifyCFOP(document.cfops, current.config);
        if (document.category === 'exportacao' && category !== 'exportacao' && document.shipmentId) {
          blocked = true;
          return document;
        }
        if (category !== document.category) count += 1;
        return { ...document, category };
      });
      return blocked ? current : { ...current, documents };
    });
    return blocked
      ? { ok: false, message: 'Reclassificação bloqueada: há nota de exportação vinculada a embarque.', count: 0 }
      : { ok: true, message: `${count} documento(s) reclassificado(s).`, count };
  }, []);

  const value = useMemo(() => ({ ...state, saveConfig, importBatch, saveDocument, deleteDocuments, reclassify }),
    [state, saveConfig, importBatch, saveDocument, deleteDocuments, reclassify]);
  return <BKContext.Provider value={value}>{children}</BKContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBK() {
  const context = useContext(BKContext);
  if (!context) throw new Error('useBK must be used within BKProvider');
  return context;
}
