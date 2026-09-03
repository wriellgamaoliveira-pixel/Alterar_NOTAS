import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertTriangle, Calculator, CheckSquare, FileUp, Info, LoaderCircle, Square } from 'lucide-react';
import { loadDifalNcmTable, saveDifalNcmTable } from '@/services/difalIndexedDb';

type NcmItem = { Codigo: string; Descricao: string };
type DifalItem = { id: string; fileName: string; noteNumber: string; issuerUf: string; destinationUf: string; cfop: string; ncm: string; description: string; ncmDescription: string; value: number; annexAlert: boolean; selected: boolean };

const annexPrefixes = new Set('02063000 02068000 02069000 02102000 02109900 11010010 11010020 12119090 15021019 15029000 15079011 15100000 15121911 15122910 15122990 15151900 15152910 15179010 16010000 160231 16023100 160232 16023210 16023220 16024100 16024900 16025000 16042010 170191 17019100 17019900 210500 210690 21069010 21069090 22011000 22021000 22029000 22029100 22029900 22030000 22060010 22060090 220720 22082000 220830 22084000 22085000 22086000 22087000 22089000 30051010 30051090 300630 30066000 32041700 32050000 32061119 321000 33030010 33030020 33041000 33042010 33042090 33043000 33049100 33049910 33049990 33051000 33052000 33059000 33061000 33062000 33069000 33071000 33072010 33072090 33079000 34011190 34011900 34012010 34013000 36061119 38151210 38151290 39181000 39191000 39199000 39233000 39233090 39241000 39249000 39251000 392590 39262000 39263000 39264000 39269040 39269090 40081100 40111000 40114000 401290 40141000 40149090 40151100 40151900 40161010 40169300 40169990 42022210 42022220 42022900 42023900 42029200 42029900 45049000 48182000 48192000 48194000 48211000 48234000 482390 49111090 56012219 57032000 57033000 57050000 59039000 59090000 59100000 59119000 61159900 62171000 63026000 63079090 65061000 65069900 68129910 69039099 70071100 70072100 70072900 70091000 70102000 70140000 73110000 73145000 73151100 73151210 73229010 73259100 780600 80070090 82121020 82122010 82141000 82142000 830120 830160 830170 83021000 83023000 831000 840820 84123110 84131900 841330 84135090 84136019 84137010 84138100 84139190 84141000 84145910 84145990 841480 841490 84149010 84149039 841520 84189900 841950 84212300 84212990 84213100 84213920 84213990 84241000 84249090 84254200 84254910 84311010 84314100 843149 84339090 84811000 84818092 85011019 85013110 85016100 85041000 85045000 850520 850710 85071010 850720 850730 85078000 851220 85123000 851240 85129000 851712 85171213 85171231 85185000 851981 85219090 85235200 852550 85256010 85272100 85272190 85272900 852790 85291090 85311090 853400 85340000 853530 85361000 85362000 853650 853910 85395000 85395200 85437099 85442000 85443000 87082999 871690 87169090 90141000 901831 901832 90189099 90251990 90259010 902610 902620 902690 90271000 90303321 90318040 90321010 90321090 90322000 903289 91040000 94012000 94019090 95059000 96032100 96032900 96033000 96138000 96161000 96162000 96190000'.split(' '));
const states = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const digits = (value = '') => value.replace(/\D/g, '');
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const findTag = (root: Element, name: string) => Array.from(root.getElementsByTagName('*')).find((node) => node.localName === name)?.textContent?.trim() || '';
const hasAnnexAlert = (ncm: string) => [...annexPrefixes].some((prefix) => ncm.startsWith(prefix) || prefix.startsWith(ncm));

export default function EntradaDifal() {
  const [destinationUf, setDestinationUf] = useState('TO');
  const [interstateText, setInterstateText] = useState('7');
  const [internalText, setInternalText] = useState('18');
  const [ncmDescriptions, setNcmDescriptions] = useState<Map<string, string>>(new Map());
  const [ncmFileName, setNcmFileName] = useState('');
  const [items, setItems] = useState<DifalItem[]>([]);
  const [reading, setReading] = useState(false);
  const [summary, setSummary] = useState('');
  const parseNumber = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0;
  const interstateRate = parseNumber(interstateText);
  const internalRate = parseNumber(internalText);
  useEffect(() => {
    loadDifalNcmTable().then((saved) => {
      if (!saved) return;
      const loaded = new Map(Object.entries(saved)); setNcmDescriptions(loaded); setNcmFileName(`Tabela NCM local (${loaded.size.toLocaleString('pt-BR')} NCMs)`);
    }).catch(() => undefined);
  }, []);
  const totals = useMemo(() => items.filter((item) => item.selected).reduce((total, item) => {
    const source = item.value * interstateRate / 100; const destination = item.value * internalRate / 100;
    return { items: total.items + 1, base: total.base + item.value, source: total.source + source, destination: total.destination + destination, difal: total.difal + Math.max(0, destination - source) };
  }, { items: 0, base: 0, source: 0, destination: 0, difal: 0 }), [items, interstateRate, internalRate]);

  const loadNcmTable = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { Nomenclaturas?: NcmItem[] }; const next = new Map<string, string>();
      (parsed.Nomenclaturas || []).forEach((item) => next.set(digits(item.Codigo), item.Descricao.replace(/<[^>]+>/g, '')));
      if (!next.size) throw new Error('Tabela sem nomenclaturas.');
      setNcmDescriptions(next); setNcmFileName(`${file.name} (${next.size.toLocaleString('pt-BR')} NCMs)`); void saveDifalNcmTable(Object.fromEntries(next)); setSummary('Tabela NCM carregada e salva localmente neste navegador.');
    } catch { setSummary('Não foi possível ler a tabela NCM. Selecione o arquivo JSON informado.'); }
    event.target.value = '';
  };

  const descriptionForNcm = (ncm: string, fallback: string) => {
    if (ncmDescriptions.has(ncm)) return ncmDescriptions.get(ncm)!;
    for (let length = ncm.length - 1; length >= 2; length -= 1) if (ncmDescriptions.has(ncm.slice(0, length))) return ncmDescriptions.get(ncm.slice(0, length))!;
    return fallback || 'NCM sem descrição na tabela carregada';
  };

  const importXmls = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.name.toLowerCase().endsWith('.xml')); event.target.value = '';
    if (!files.length) return; setReading(true);
    let sameState = 0; let wrongDestination = 0; let cfopSkipped = 0; let accepted = 0; const imported: DifalItem[] = [];
    for (const file of files) try {
      const xml = new DOMParser().parseFromString(await file.text(), 'application/xml'); const infNFe = Array.from(xml.getElementsByTagName('*')).find((node) => node.localName === 'infNFe'); if (!infNFe) continue;
      const emit = Array.from(infNFe.children).find((node) => node.localName === 'emit'); const dest = Array.from(infNFe.children).find((node) => node.localName === 'dest');
      const issuerUf = emit ? findTag(emit, 'UF') : ''; const recipientUf = dest ? findTag(dest, 'UF') : '';
      if (issuerUf === destinationUf) { sameState += 1; continue; } if (recipientUf !== destinationUf) { wrongDestination += 1; continue; }
      const noteNumber = findTag(infNFe, 'nNF') || 'Sem número'; const details = Array.from(infNFe.children).filter((node) => node.localName === 'det');
      details.forEach((detail, index) => { const product = Array.from(detail.children).find((node) => node.localName === 'prod'); if (!product) return; const cfop = digits(findTag(product, 'CFOP')); if (!cfop.startsWith('6')) { cfopSkipped += 1; return; }
        const ncm = digits(findTag(product, 'NCM')); const annexAlert = destinationUf === 'TO' && !!ncm && hasAnnexAlert(ncm); const productDescription = findTag(product, 'xProd');
        imported.push({ id: `${file.name}-${noteNumber}-${index}-${crypto.randomUUID()}`, fileName: file.name, noteNumber, issuerUf, destinationUf: recipientUf, cfop, ncm, description: productDescription, ncmDescription: descriptionForNcm(ncm, productDescription), value: parseNumber(findTag(product, 'vProd')), annexAlert, selected: !annexAlert }); accepted += 1;
      });
    } catch { /* XML inválido não entra no cálculo */ }
    setItems((current) => [...current, ...imported]); setSummary(`${accepted} item(ns) elegível(is) lido(s). Ignorados: ${sameState} nota(s) do próprio estado, ${wrongDestination} com destino diferente de ${destinationUf} e ${cfopSkipped} item(ns) com CFOP fora de 6.xxx.`); setReading(false);
  };

  const toggle = (id: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
  const selectByRule = (annex: boolean) => setItems((current) => current.map((item) => item.annexAlert === annex ? { ...item, selected: true } : item));

  return <div className="mx-auto max-w-[1500px] space-y-6 px-6 py-8">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Calculator className="h-6 w-6 text-sky-400" />Entrada de imposto — DIFAL</h1><p className="mt-1 text-sm text-slate-400">Importe vários XMLs. O sistema considera apenas itens com CFOP 6.xxx recebidos de outra UF para o estado de destino selecionado.</p></div>
    <section className="rounded-xl border border-sky-500/30 bg-slate-900/70 p-5"><div className="grid gap-4 lg:grid-cols-[170px_170px_170px_1fr]"><label className="bk-label">Estado de destino<select value={destinationUf} onChange={(event) => setDestinationUf(event.target.value)} className="bk-input">{states.map((state) => <option key={state}>{state}</option>)}</select></label><label className="bk-label">Alíquota interestadual (%)<input value={interstateText} inputMode="decimal" onChange={(event) => setInterstateText(event.target.value)} className="bk-input" /></label><label className="bk-label">Alíquota interna destino (%)<input value={internalText} inputMode="decimal" onChange={(event) => setInternalText(event.target.value)} className="bk-input" /></label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-950/40 px-4 py-3 text-sm text-sky-300 hover:border-sky-400"><FileUp className="h-4 w-4" /><span>{ncmFileName || 'Carregar tabela NCM (.json)'}</span><input type="file" accept="application/json,.json" onChange={loadNcmTable} className="hidden" /></label></div></section>
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-5"><label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 p-8 text-center hover:border-sky-400"><FileUp className="mb-3 h-10 w-10 text-sky-300" /><span className="font-medium text-white">Selecionar vários XMLs de NF-e</span><span className="mt-1 text-xs text-slate-400">Os arquivos são lidos localmente. Notas do mesmo estado e itens fora de CFOP 6.xxx não entram na apuração.</span><input type="file" accept=".xml,text/xml,application/xml" multiple onChange={importXmls} className="hidden" /></label>{reading && <p className="mt-3 flex items-center gap-2 text-sm text-sky-300"><LoaderCircle className="h-4 w-4 animate-spin" />Lendo XMLs...</p>}{summary && <p className="mt-3 text-sm text-slate-300">{summary}</p>}</section>
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100"><div className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p>Quando o destino for <strong>TO</strong>, itens encontrados no <strong>Anexo XXI do RICMS/TO</strong> ficam desmarcados e recebem alerta de possível substituição tributária. O sistema não decide a tributação: revise e selecione somente os NCMs que devem gerar DIFAL.</p></div></section>
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/70"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-4"><div><h2 className="font-semibold text-white">Itens importados para conferência</h2><p className="text-xs text-slate-400">Clique na seleção para definir quais NCMs gerarão o imposto.</p></div><div className="flex gap-2"><button onClick={() => selectByRule(false)} className="bk-button-secondary text-xs"><CheckSquare className="h-4 w-4" />Selecionar sem alerta</button><button onClick={() => selectByRule(true)} className="bk-button-secondary text-xs"><CheckSquare className="h-4 w-4" />Selecionar alertas</button></div></div><div className="overflow-x-auto"><table className="bk-table min-w-[1350px]"><thead><tr><th>Gerar</th><th>Nota</th><th>Origem / destino</th><th>CFOP</th><th>NCM</th><th>Descrição NCM</th><th>Produto XML</th><th>Valor</th><th>Anexo XXI</th><th>DIFAL</th></tr></thead><tbody>{items.length ? items.map((item) => { const source = item.value * interstateRate / 100; const destination = item.value * internalRate / 100; const difal = Math.max(0, destination - source); return <tr key={item.id} className={item.selected ? '' : 'opacity-60'}><td><button title={item.selected ? 'Não gerar DIFAL' : 'Gerar DIFAL'} onClick={() => toggle(item.id)} className="text-sky-300">{item.selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}</button></td><td title={item.fileName}>{item.noteNumber}</td><td>{item.issuerUf} → {item.destinationUf}</td><td>{item.cfop}</td><td className="font-mono">{item.ncm || '—'}</td><td className="max-w-80 whitespace-normal">{item.ncmDescription}</td><td className="max-w-64 whitespace-normal">{item.description}</td><td>{money(item.value)}</td><td>{item.annexAlert ? <span className="flex items-center gap-1 text-amber-300"><AlertTriangle className="h-4 w-4" />Conferir retenção</span> : <span className="text-emerald-300">Sem alerta</span>}</td><td className="font-semibold text-sky-300">{money(difal)}</td></tr>; }) : <tr><td colSpan={10} className="py-12 text-center text-slate-500">Carregue a tabela NCM e selecione os XMLs para iniciar a conferência.</td></tr>}</tbody></table></div></section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Result label="Itens selecionados" value={String(totals.items)} /><Result label="Base selecionada" value={money(totals.base)} /><Result label="ICMS origem" value={money(totals.source)} /><Result label="ICMS destino" value={money(totals.destination)} /><Result label="DIFAL a recolher" value={money(totals.difal)} highlight /></section>
  </div>;
}

function Result({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) { return <div className={`rounded-xl border p-4 ${highlight ? 'border-sky-400/60 bg-sky-500/10' : 'border-slate-700 bg-slate-900/70'}`}><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 text-xl font-bold ${highlight ? 'text-sky-300' : 'text-white'}`}>{value}</p></div>; }
