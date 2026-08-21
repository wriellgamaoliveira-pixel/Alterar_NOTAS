import { useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
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
  const { config, deadlineDays, warningDays, saveConfig, reclassify } = useBK();
  const [values, setValues] = useState<Record<keyof BKCFOPConfig, string>>({
    remessa: serialize(config.remessa), exportacao: serialize(config.exportacao),
    'venda-interna': serialize(config['venda-interna']), devolucao: serialize(config.devolucao),
  });
  const [days, setDays] = useState(deadlineDays);
  const [warning, setWarning] = useState(warningDays);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');

  function save() {
    const next = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, parse(value)])) as unknown as BKCFOPConfig;
    const result = saveConfig(next, Math.min(1000, Math.max(1, days)), Math.max(0, warning));
    setMessage(result.message);
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h1 className="text-xl font-bold text-white">Configuração CFOP</h1>
      <p className="mt-1 text-sm text-slate-400">Separe vários códigos por ponto e vírgula, vírgula ou espaço. Um CFOP só pode pertencer a uma categoria.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{fields.map((field) => <label key={field.key} className="bk-label">{field.label}<span className="font-normal text-slate-500">{field.description}</span><textarea value={values[field.key]} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="bk-input min-h-24 resize-y" placeholder="6505; 6501; 5505" /></label>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <label className="bk-label">Prazo da remessa (dias)<input className="bk-input" type="number" min={1} max={1000} value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
        <label className="bk-label">Alerta antes do vencimento (dias)<input className="bk-input" type="number" min={0} max={999} value={warning} onChange={(event) => setWarning(Number(event.target.value))} /></label>
      </div>
      <button onClick={save} className="bk-button mt-5"><Save className="h-4 w-4" />Salvar configuração</button>
    </section>
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <h2 className="font-semibold text-white">Atualização de classificação</h2><p className="mt-1 text-sm text-slate-400">Aplica a configuração vigente às notas já gravadas, sem reimportar XML.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl"><label className="bk-label">Data inicial<input className="bk-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="bk-label">Data final<input className="bk-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
      <button onClick={() => setMessage(reclassify(from, to).message)} className="bk-button-secondary mt-5"><RefreshCw className="h-4 w-4" />Atualizar consulta</button>
    </section>
    {message && <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div>}
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">CFOPs não configurados são mantidos em <strong>Outras Saídas</strong>. Notas de exportação vinculadas a embarques não podem perder essa categoria.</div>
  </div>;
}
