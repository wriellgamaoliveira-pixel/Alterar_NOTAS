import { useState } from 'react';
import { Database, Download, FolderOpen, RefreshCw, Save, Upload } from 'lucide-react';
import { useBK } from '@/context/BKContext';
import type { BKCFOPConfig } from '@/types/bk';

const fields: Array<{ key: keyof BKCFOPConfig; label: string; description: string }> = [
  { key: 'remessa', label: 'Remessa', description: 'Notas enviadas para exportação ou armazenagem vinculada.' },
  { key: 'exportacao', label: 'Exportação', description: 'Notas que podem averbar remessas e vincular a embarques.' },
  { key: 'venda-interna', label: 'Venda Interna', description: 'Vendas realizadas no mercado interno.' },
  { key: 'devolucao', label: 'Devolução', description: 'Documentos fiscais de devolução.' },
];

const serialize = (values: string[]) => values.join('; ');
const parse = (value: string) => [...new Set(value.split(/[;,\s]+/).map((item) => item.replace(/\D/g, '')).filter(Boolean))];

export default function BKConfigPage() {
  const {
    config, documents, deadlineDays, warningDays, folderName, autoSyncMinutes, lastSync,
    storageReady, storageBusy, storageError, saveConfigAndReclassify, selectStorageFolder,
    syncStorageFolder, exportPortableBackup, importPortableBackup, setAutoSyncMinutes,
  } = useBK();
  const [values, setValues] = useState<Record<keyof BKCFOPConfig, string>>({
    remessa: serialize(config.remessa), exportacao: serialize(config.exportacao),
    'venda-interna': serialize(config['venda-interna']), devolucao: serialize(config.devolucao),
  });
  const [days, setDays] = useState(deadlineDays);
  const [warning, setWarning] = useState(warningDays);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [syncMinutes, setSyncMinutes] = useState(autoSyncMinutes);

  async function run(action: () => Promise<string>) {
    try { setMessage(await action()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação.'); }
  }

  function currentConfig() {
    const next = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, parse(value)])) as unknown as BKCFOPConfig;
    const required = ['7501', '7504'];
    next.remessa = next.remessa.filter((cfop) => !required.includes(cfop));
    next['venda-interna'] = next['venda-interna'].filter((cfop) => !required.includes(cfop));
    next.devolucao = next.devolucao.filter((cfop) => !required.includes(cfop));
    next.exportacao = [...new Set([...next.exportacao.filter((cfop) => !required.includes(cfop)), ...required])];
    return next;
  }

  function save() {
    const next = currentConfig();
    const result = saveConfigAndReclassify(next, Math.min(1000, Math.max(1, days)), Math.max(0, warning));
    if (result.ok) setValues({ remessa: serialize(next.remessa), exportacao: serialize(next.exportacao), 'venda-interna': serialize(next['venda-interna']), devolucao: serialize(next.devolucao) });
    setMessage(result.message);
  }

  function updatePeriod() {
    const next = currentConfig();
    const result = saveConfigAndReclassify(next, Math.min(1000, Math.max(1, days)), Math.max(0, warning), from, to);
    if (result.ok) setValues({ remessa: serialize(next.remessa), exportacao: serialize(next.exportacao), 'venda-interna': serialize(next['venda-interna']), devolucao: serialize(next.devolucao) });
    setMessage(result.message);
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-sky-500/30 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><Database className="h-5 w-5 text-sky-400" /><h1 className="text-xl font-bold text-white">Armazenamento local</h1></div><p className="mt-1 text-sm text-slate-400">IndexedDB para velocidade e um arquivo portátil <strong className="text-slate-300">bk-documentos.json</strong> na pasta escolhida.</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${storageError ? 'bg-red-300 text-slate-950' : storageReady ? 'bg-emerald-300 text-slate-950' : 'bg-amber-300 text-slate-950'}`}>{storageError ? 'Navegador incompatível' : storageReady ? 'IndexedDB pronto' : 'Inicializando…'}</span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4"><p className="text-xs text-slate-500">Pasta configurada</p><p className="mt-1 font-semibold text-white">{folderName || 'Nenhuma pasta selecionada'}</p><p className="mt-1 text-xs text-slate-500">Última sincronização: {lastSync ? new Date(lastSync).toLocaleString('pt-BR') : 'ainda não realizada'}</p></div>
        <label className="bk-label">Pesquisar automaticamente a cada<input className="bk-input" type="number" min={1} max={1440} value={syncMinutes} onChange={(event) => setSyncMinutes(Number(event.target.value))} onBlur={() => setAutoSyncMinutes(syncMinutes)} /><span className="font-normal text-slate-500">minutos, enquanto a página estiver aberta</span></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={storageBusy || Boolean(storageError)} onClick={() => void run(selectStorageFolder)} className="bk-button"><FolderOpen className="h-4 w-4" />Escolher pasta do BK</button>
        <button disabled={storageBusy || !folderName} onClick={() => void run(async () => (await syncStorageFolder(true)).message)} className="bk-button-secondary"><RefreshCw className={`h-4 w-4 ${storageBusy ? 'animate-spin' : ''}`} />Sincronizar agora</button>
        <button disabled={storageBusy || !folderName} onClick={() => void run(exportPortableBackup)} className="bk-button-secondary"><Download className="h-4 w-4" />Substituir backup na pasta</button>
        <button disabled={storageBusy || !folderName} onClick={() => void run(importPortableBackup)} className="bk-button-secondary"><Upload className="h-4 w-4" />Ler backup da pasta</button>
      </div>
      {storageError && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{storageError}</p>}
      <p className="mt-4 text-xs leading-relaxed text-slate-500">Para usar em outro computador, copie a pasta com o arquivo <strong>bk-documentos.json</strong>, abra esta página no Chrome ou Edge e clique em “Escolher pasta do BK”. O arquivo será carregado para o IndexedDB daquele navegador.</p>
    </section>
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="text-xl font-bold text-white">Configuração CFOP</h2>
      <p className="mt-1 text-sm text-slate-400">Há uma única base central com {documents.length} nota(s). Remessa, Exportação, Venda Interna, Outras Saídas e Devolução são apenas departamentos de consulta, sem cópias da nota.</p>
      <p className="mt-2 text-sm text-slate-400">Separe vários códigos por ponto e vírgula, vírgula ou espaço. Um CFOP só pode pertencer a uma categoria. Os CFOPs <strong className="text-sky-300">7501 e 7504</strong> são mantidos automaticamente em Exportação.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{fields.map((field) => <label key={field.key} className="bk-label">{field.label}<span className="font-normal text-slate-500">{field.description}</span><textarea value={values[field.key]} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="bk-input min-h-24 resize-y" placeholder="6505; 6501; 5505" /></label>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <label className="bk-label">Prazo da remessa (dias)<input className="bk-input" type="number" min={1} max={1000} value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
        <label className="bk-label">Alerta antes do vencimento (dias)<input className="bk-input" type="number" min={0} max={999} value={warning} onChange={(event) => setWarning(Number(event.target.value))} /></label>
      </div>
      <button onClick={save} className="bk-button mt-5"><Save className="h-4 w-4" />Salvar CFOP e atualizar todas as notas</button>
      <p className="mt-2 text-xs text-slate-500">Exemplo: ao incluir o CFOP 7501 em Exportação, as notas já importadas mudam imediatamente para esse departamento. Não é necessário importar o XML novamente.</p>
    </section>
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="font-semibold text-white">Atualização de classificação</h2><p className="mt-1 text-sm text-slate-400">Aplica a configuração vigente às notas já gravadas, sem reimportar XML.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl"><label className="bk-label">Data inicial<input className="bk-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="bk-label">Data final<input className="bk-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
      <button onClick={updatePeriod} className="bk-button-secondary mt-5"><RefreshCw className="h-4 w-4" />Salvar CFOP e atualizar o período</button>
    </section>
    {message && <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div>}
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">CFOPs não configurados são mantidos em <strong>Outras Saídas</strong>. Notas de exportação vinculadas a embarques não podem perder essa categoria.</div>
  </div>;
}
