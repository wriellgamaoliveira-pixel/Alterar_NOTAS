import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FolderOpen, Play, Save, Upload, XCircle } from 'lucide-react';
import { useBK } from '@/context/BKContext';
import { parseBKXml } from '@/parsers/bkParser';
import type { BKPreviewItem } from '@/types/bk';

const resultLabel: Record<BKPreviewItem['result'], string> = {
  pronta: 'Pronta para importar', atualizar: 'Atualizar histórico', incluido: 'Incluído na nova nota',
  registrado: 'Já registrado', inconsistencia: 'Com inconsistência', 'fora-periodo': 'Fora do período',
};

export default function BKImport() {
  const { documents, config, units, importBatch } = useBK();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<BKPreviewItem[]>([]);
  const [progress, setProgress] = useState({ active: false, current: 0, total: 0, file: '', status: '' });
  const [message, setMessage] = useState('');

  const readyCount = useMemo(() => preview.filter((item) => ['pronta', 'atualizar', 'incluido'].includes(item.result)).length, [preview]);

  async function readFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []).filter((file) => file.name.toLowerCase().endsWith('.xml'));
    if (!files.length) { setMessage('Nenhum arquivo XML foi selecionado.'); return; }
    setMessage('');
    setPreview([]);
    setProgress({ active: true, current: 0, total: files.length, file: '', status: 'Lendo arquivos localmente…' });
    const parsed: BKPreviewItem[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress({ active: true, current: index + 1, total: files.length, file: file.webkitRelativePath || file.name, status: 'Analisando XML' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        const result = parseBKXml(await file.text(), file.webkitRelativePath || file.name, config);
        const fiscalDate = result.kind === 'document' ? result.document.issueDate : result.event.date;
        const day = fiscalDate.slice(0, 10);
        let status: BKPreviewItem['result'] = 'pronta';
        let detail = 'Validação concluída';
        if ((from && day < from) || (to && day > to)) {
          status = 'fora-periodo'; detail = 'Data fiscal fora do intervalo escolhido';
        } else if (result.kind === 'document') {
          const unit = units.find((candidate) => candidate.cnpj === result.document.issuerTaxId);
          if (!unit) { status = 'inconsistencia'; detail = `CNPJ emitente ${result.document.issuerTaxId || 'não informado'} não pertence às unidades cadastradas`; }
          else {
            result.document.unitId = unit.id;
            const saved = documents.find((item) =>
              (result.document.accessKey && item.accessKey === result.document.accessKey) || item.complementaryId === result.document.complementaryId);
            status = saved ? (result.document.events.some((event) => !saved.events.some((old) => old.id === event.id)) ? 'atualizar' : 'registrado') : 'pronta';
            detail = status === 'registrado' ? 'Nota e eventos já registrados' : `Unidade: ${unit.nome}`;
          }
        } else {
          const saved = documents.find((item) => item.accessKey === result.accessKey);
          const selected = parsed.find((item) => item.parsed?.kind === 'document' && item.parsed.document.accessKey === result.accessKey);
          if (!saved && !selected) { status = 'inconsistencia'; detail = 'NF-e correspondente não foi encontrada no sistema nem nesta seleção'; }
          else if (saved?.events.some((event) => event.id === result.event.id)) { status = 'registrado'; detail = 'Evento já consta no histórico'; }
          else { status = saved ? 'atualizar' : 'incluido'; detail = saved ? 'Novo evento para nota existente' : 'Evento será anexado à NF-e desta seleção'; }
        }
        parsed.push({ id: `${file.name}-${index}`, fileName: file.webkitRelativePath || file.name, parsed: result, result: status, message: detail });
      } catch (error) {
        parsed.push({ id: `${file.name}-${index}`, fileName: file.webkitRelativePath || file.name, result: 'inconsistencia', message: error instanceof Error ? error.message : 'Falha ao ler XML' });
      }
    }
    const reconciled = parsed.map((item) => {
      if (item.parsed?.kind !== 'event' || item.result !== 'inconsistencia') return item;
      const eventKey = item.parsed.accessKey;
      const hasSelectedDocument = parsed.some((candidate) => candidate.parsed?.kind === 'document' && candidate.parsed.document.accessKey === eventKey);
      return hasSelectedDocument ? { ...item, result: 'incluido' as const, message: 'Evento será anexado à NF-e desta seleção' } : item;
    });
    setPreview(reconciled);
    setProgress({ active: false, current: files.length, total: files.length, file: '', status: 'Prévia concluída' });
  }

  function save() {
    const accepted = preview.filter((item) => ['pronta', 'atualizar', 'incluido'].includes(item.result) && item.parsed);
    const incomingDocuments = accepted.flatMap((item) => item.parsed?.kind === 'document' ? [item.parsed.document] : []);
    const events = accepted.flatMap((item) => item.parsed?.kind === 'event' ? [{ accessKey: item.parsed.accessKey, event: item.parsed.event }] : []);
    importBatch(incomingDocuments, events);
    setPreview((items) => items.map((item) => accepted.some((acceptedItem) => acceptedItem.id === item.id) ? { ...item, result: 'registrado', message: 'Gravado com segurança' } : item));
    setMessage(`${incomingDocuments.length} NF-e(s) e ${events.length} evento(s) processados. Histórico e duplicidades foram preservados.`);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-xl font-bold text-white">Importação XML</h1><p className="mt-1 text-sm text-slate-400">Leitura local em duas etapas. Nada é salvo antes da sua confirmação.</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileInput.current?.click()} className="bk-button"><Upload className="h-4 w-4" />Selecionar XMLs</button>
            <button onClick={() => folderInput.current?.click()} className="bk-button-secondary"><FolderOpen className="h-4 w-4" />Selecionar pasta N:\</button>
            <input ref={fileInput} className="hidden" type="file" accept=".xml,text/xml" multiple onChange={(event) => readFiles(event.target.files)} />
            <input ref={(node) => { folderInput.current = node; node?.setAttribute('webkitdirectory', ''); }} className="hidden" type="file" multiple onChange={(event) => readFiles(event.target.files)} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <label className="bk-label">Data inicial<input className="bk-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="bk-label">Data final<input className="bk-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
      </section>

      {progress.active && <aside className="fixed bottom-5 right-5 z-[80] w-80 rounded-xl border border-sky-500/40 bg-slate-950 p-4 shadow-2xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Play className="h-4 w-4 text-sky-400" />{progress.status}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-sky-500 transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
        <p className="mt-2 text-xs text-slate-400">{progress.current} de {progress.total} — {Math.round((progress.current / progress.total) * 100)}%</p>
        <p className="mt-1 truncate text-xs text-slate-500">{progress.file}</p>
      </aside>}

      {message && <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-4">
          <div><h2 className="font-semibold text-white">Prévia da importação</h2><p className="text-xs text-slate-400">{preview.length} analisado(s), {readyCount} apto(s) para gravação</p></div>
          <button disabled={!readyCount} onClick={save} className="bk-button disabled:cursor-not-allowed disabled:opacity-40"><Save className="h-4 w-4" />Gravar notas e atualizações</button>
        </div>
        <div className="overflow-x-auto">
          <table className="bk-table min-w-[1100px]"><thead><tr><th>Arquivo</th><th>Tipo</th><th>Número</th><th>Emitente / fornecedor</th><th>Unidade</th><th>Data</th><th>CFOP</th><th>Categoria</th><th>Peso</th><th>Valor</th><th>Validação</th></tr></thead>
          <tbody>{preview.length === 0 ? <tr><td colSpan={11} className="py-12 text-center text-slate-500">Selecione XMLs ou uma pasta para gerar a prévia.</td></tr> : preview.map((item) => {
            const doc = item.parsed?.kind === 'document' ? item.parsed.document : undefined;
            const unit = units.find((candidate) => candidate.id === doc?.unitId);
            return <tr key={item.id}><td className="max-w-[220px] truncate" title={item.fileName}>{item.fileName}</td><td>{item.parsed?.kind === 'event' ? 'Evento fiscal' : 'NF-e'}</td><td>{doc?.number || '—'}</td><td>{doc?.issuerName || '—'}</td><td>{unit?.nome || '—'}</td><td>{(doc?.issueDate || (item.parsed?.kind === 'event' ? item.parsed.event.date : '')).slice(0, 10) || '—'}</td><td>{doc?.cfops.join(', ') || '—'}</td><td>{doc?.category || '—'}</td><td>{doc ? `${(doc.netWeight || doc.commercialQuantity).toLocaleString('pt-BR')} kg` : '—'}</td><td>{doc?.invoiceValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '—'}</td><td><div className={`flex items-center gap-1.5 ${item.result === 'inconsistencia' ? 'text-red-300' : item.result === 'registrado' || item.result === 'fora-periodo' ? 'text-slate-400' : 'text-emerald-300'}`}>{item.result === 'inconsistencia' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}<span title={item.message}>{resultLabel[item.result]}</span></div></td></tr>;
          })}</tbody></table>
        </div>
      </section>
    </div>
  );
}
