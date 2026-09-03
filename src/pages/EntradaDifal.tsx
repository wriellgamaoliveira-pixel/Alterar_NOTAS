import { useMemo, useState } from 'react';
import { Calculator, Info, Plus, Trash2 } from 'lucide-react';

type DifalEntry = {
  id: string;
  description: string;
  base: number;
  interstateRate: number;
  internalRate: number;
};

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function EntradaDifal() {
  const [description, setDescription] = useState('Operação interestadual');
  const [baseText, setBaseText] = useState('1000,00');
  const [interstateText, setInterstateText] = useState('7');
  const [internalText, setInternalText] = useState('18');
  const [entries, setEntries] = useState<DifalEntry[]>([]);

  const parse = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0;
  const base = parse(baseText);
  const interstateRate = parse(interstateText);
  const internalRate = parse(internalText);
  const interstateValue = base * interstateRate / 100;
  const destinationValue = base * internalRate / 100;
  const difal = Math.max(0, destinationValue - interstateValue);
  const rateDifference = Math.max(0, internalRate - interstateRate);

  const totals = useMemo(() => entries.reduce((current, entry) => {
    const source = entry.base * entry.interstateRate / 100;
    const destination = entry.base * entry.internalRate / 100;
    return { base: current.base + entry.base, source: current.source + source, destination: current.destination + destination, difal: current.difal + Math.max(0, destination - source) };
  }, { base: 0, source: 0, destination: 0, difal: 0 }), [entries]);

  const addEntry = () => {
    if (base <= 0 || internalRate <= 0) return;
    setEntries((current) => [...current, { id: crypto.randomUUID(), description: description.trim() || 'Operação interestadual', base, interstateRate, internalRate }]);
  };

  return <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Calculator className="h-6 w-6 text-sky-400" />Entrada de imposto — DIFAL</h1>
      <p className="mt-1 text-sm text-slate-400">Lance operações interestaduais para calcular o diferencial entre a alíquota interna de destino e a alíquota interestadual.</p>
    </div>

    <section className="rounded-xl border border-sky-500/30 bg-slate-900/70 p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <label className="bk-label">Descrição da operação<input value={description} onChange={(event) => setDescription(event.target.value)} className="bk-input" placeholder="Ex.: Venda SP para consumidor final TO" /></label>
        <label className="bk-label">Base de cálculo (R$)<input inputMode="decimal" value={baseText} onChange={(event) => setBaseText(event.target.value)} className="bk-input" /></label>
        <label className="bk-label">Alíquota interestadual (%)<input inputMode="decimal" value={interstateText} onChange={(event) => setInterstateText(event.target.value)} className="bk-input" /></label>
        <label className="bk-label">Alíquota interna destino (%)<input inputMode="decimal" value={internalText} onChange={(event) => setInternalText(event.target.value)} className="bk-input" /></label>
        <button onClick={addEntry} disabled={base <= 0 || internalRate <= 0} className="bk-button self-end disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />Adicionar</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard label="ICMS origem" value={money(interstateValue)} detail={`${number(interstateRate)}% sobre ${money(base)}`} />
        <ResultCard label="ICMS destino" value={money(destinationValue)} detail={`${number(internalRate)}% sobre ${money(base)}`} />
        <ResultCard label="Diferença de alíquotas" value={`${number(rateDifference)}%`} detail={`${number(internalRate)}% − ${number(interstateRate)}%`} />
        <ResultCard label="DIFAL a recolher" value={money(difal)} detail={`(${money(destinationValue)}) − (${money(interstateValue)})`} highlight />
      </div>
    </section>

    <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100"><div className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p>Fórmula usada: <strong>DIFAL = (base × alíquota interna de destino) − (base × alíquota interestadual)</strong>. Confirme as alíquotas aplicáveis e demais regras fiscais da operação antes da escrituração.</p></div></section>

    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/70">
      <div className="flex items-center justify-between border-b border-slate-700 p-4"><div><h2 className="font-semibold text-white">Lançamentos da apuração</h2><p className="text-xs text-slate-400">Os lançamentos desta tela permanecem somente durante esta consulta.</p></div><div className="text-right text-sm"><p className="text-slate-400">DIFAL total</p><p className="font-semibold text-sky-300">{money(totals.difal)}</p></div></div>
      <div className="overflow-x-auto"><table className="bk-table min-w-[900px]"><thead><tr><th>Operação</th><th>Base</th><th>Interestadual</th><th>Interna destino</th><th>ICMS origem</th><th>ICMS destino</th><th>DIFAL</th><th>Ação</th></tr></thead><tbody>{entries.length ? entries.map((entry) => { const source = entry.base * entry.interstateRate / 100; const destination = entry.base * entry.internalRate / 100; const value = Math.max(0, destination - source); return <tr key={entry.id}><td>{entry.description}</td><td>{money(entry.base)}</td><td>{number(entry.interstateRate)}%</td><td>{number(entry.internalRate)}%</td><td>{money(source)}</td><td>{money(destination)}</td><td className="font-semibold text-sky-300">{money(value)}</td><td><button title="Excluir lançamento" onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))} className="bk-icon text-red-300"><Trash2 className="h-4 w-4" /></button></td></tr>; }) : <tr><td colSpan={8} className="py-10 text-center text-slate-500">Nenhum lançamento adicionado. Use o formulário acima para iniciar a apuração.</td></tr>}</tbody><tfoot>{entries.length > 0 && <tr className="border-t-2 border-slate-600 font-semibold text-white"><td>Total</td><td>{money(totals.base)}</td><td>—</td><td>—</td><td>{money(totals.source)}</td><td>{money(totals.destination)}</td><td className="text-sky-300">{money(totals.difal)}</td><td /></tr>}</tfoot></table></div>
    </section>
  </div>;
}

function ResultCard({ label, value, detail, highlight = false }: { label: string; value: string; detail: string; highlight?: boolean }) {
  return <div className={`rounded-lg border p-4 ${highlight ? 'border-sky-400/60 bg-sky-500/10' : 'border-slate-700 bg-slate-950/40'}`}><p className="text-xs font-medium text-slate-400">{label}</p><p className={`mt-1 text-xl font-bold ${highlight ? 'text-sky-300' : 'text-white'}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
