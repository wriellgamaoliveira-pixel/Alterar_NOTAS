import { useState, useCallback, useMemo } from 'react';
import { useModule } from '@/context/ModuleContext';
import { processZipFile } from '@/parsers/zipProcessor';
import UploadDropzone from '@/components/shared/UploadDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import KpiCard from '@/components/shared/KpiCard';
import type { NotaFiscal, CClassSummary, ItemRelatorio } from '@/types/fiscal';
import {
  FolderOpen,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Search,
  Printer,
  Download,
  ArrowUpDown,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { useBK } from '@/context/BKContext';
import { bkDocumentsToNotas } from '@/services/bkFiscalAdapter';

export default function ResumoCClass() {
  const { activeModule } = useModule();
  const { documents } = useBK();
  const [uploadedNotas, setUploadedNotas] = useState<NotaFiscal[]>([]);
  const [centralNotas, setCentralNotas] = useState<NotaFiscal[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [limit, setLimit] = useState(100);
  const notas = centralNotas.length ? centralNotas : uploadedNotas;
  const [progress, setProgress] = useState<{ current: number; total: number; message: string; status: 'idle' | 'processing' | 'completed' | 'error' }>({ current: 0, total: 0, message: '', status: 'idle' });
  const [filter, setFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const handleFiles = useCallback(async (files: File[]) => {
    const zipFile = files.find(f => f.name.endsWith('.zip'));
    if (!zipFile) {
      setProgress({ current: 0, total: 0, message: 'Selecione um arquivo ZIP', status: 'idle' });
      return;
    }
    setProgress({ current: 0, total: 100, message: 'Iniciando processamento...', status: 'idle' });

    try {
      const result = await processZipFile(zipFile, activeModule, (current, total, message) => {
        setProgress({ current, total, message, status: 'idle' });
      });
      setUploadedNotas(result.notas);
      setProgress({ current: result.processedFiles, total: result.totalFiles, message: 'Concluido!', status: 'completed' as const });
    } catch (err) {
      setProgress({ current: 0, total: 0, message: (err as Error).message, status: 'idle' });
    }
  }, [activeModule]);

  const cClassData = useMemo(() => {
    const map = new Map<string, CClassSummary>();
    let totalValor = 0;
    let totalItens = 0;

    notas.forEach(nota => {
      nota.produtos.forEach(prod => {
        totalValor += prod.valorTotal;
        totalItens++;
        const cClass = prod.cClass || 'SEM_CLASS';
        if (!map.has(cClass)) {
          map.set(cClass, { cClass, descricao: getCClassDesc(cClass), quantidade: 0, valorTotal: 0, percentual: 0, cfops: new Map() });
        }
        const item = map.get(cClass)!;
        item.quantidade++;
        item.valorTotal += prod.valorTotal;

        const cfop = prod.cfop || '0000';
        if (!item.cfops.has(cfop)) {
          item.cfops.set(cfop, { cfop, quantidade: 0, valorTotal: 0, notas: new Map() });
        }
        const cfopItem = item.cfops.get(cfop)!;
        cfopItem.quantidade++;
        cfopItem.valorTotal += prod.valorTotal;
      });
    });

    map.forEach(item => {
      item.percentual = totalValor > 0 ? (item.valorTotal / totalValor) * 100 : 0;
    });

    return { list: Array.from(map.values()), totalValor, totalItens };
  }, [notas]);

  const itensList = useMemo<ItemRelatorio[]>(() => {
    const items: ItemRelatorio[] = [];
    notas.forEach(nota => {
      nota.produtos.forEach(prod => {
        items.push({
          arquivo: nota.numero,
          chave: nota.chave,
          emitente: nota.emitente.nome,
          produto: prod.nome,
          ncm: prod.ncm,
          cClass: prod.cClass || 'SEM_CLASS',
          cfop: prod.cfop,
          valor: prod.valorTotal,
          icms: prod.icms.valor,
          ipi: prod.ipi.valor,
          pis: prod.pis.valor,
          cofins: prod.cofins.valor,
        });
      });
    });
    return items;
  }, [notas]);

  const chartData = useMemo(() => {
    return [...cClassData.list]
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .slice(0, 12)
      .map(item => ({
        name: item.cClass.length > 15 ? item.cClass.substring(0, 15) + '...' : item.cClass,
        valor: item.valorTotal,
        fullName: item.cClass,
      }));
  }, [cClassData]);

  const filteredItems = useMemo(() => {
    let data = itensList;
    if (filter) {
      const f = filter.toLowerCase();
      data = data.filter(i =>
        i.produto.toLowerCase().includes(f) ||
        i.ncm.includes(f) ||
        i.cClass.toLowerCase().includes(f) ||
        i.cfop.includes(f) ||
        i.emitente.toLowerCase().includes(f)
      );
    }
    if (sortConfig) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortConfig.key as keyof ItemRelatorio] as number;
        const bVal = b[sortConfig.key as keyof ItemRelatorio] as number;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return data;
  }, [itensList, filter, sortConfig]);

  const toggleRow = (cClass: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(cClass)) newSet.delete(cClass);
    else newSet.add(cClass);
    setExpandedRows(newSet);
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const exportCSV = () => {
    const csv = Papa.unparse(itensList, { delimiter: ';', header: true });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `relatorio_cclass_${activeModule}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (notas.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Relatório por cClass</h1>
          <p className="text-sm text-[#94a3b8]">A base central ainda não possui notas deste módulo.</p>
        </div>
        <div className="mb-5 grid gap-3 rounded-xl border border-sky-500/30 bg-[#1e293b] p-4 sm:grid-cols-[200px_180px_auto]"><label className="text-xs text-[#94a3b8]">Mês de emissão<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-white" /></label><label className="text-xs text-[#94a3b8]">Quantidade<select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-white">{[10,20,50,100,200,500,1000,2000,5000].map((value) => <option key={value}>{value}</option>)}</select></label><button onClick={() => setCentralNotas(bkDocumentsToNotas(documents.filter((item) => activeModule === 'nfe' && (!month || item.issueDate.startsWith(month))).slice(0, limit)))} className="self-end rounded-lg bg-[#38bdf8] px-4 py-2 font-semibold text-[#0f172a]">Buscar no banco de dados</button></div>
        <UploadDropzone
          onFilesSelected={handleFiles}
          accept=".zip"
          label="Arraste um arquivo ZIP com XMLs aqui"
          sublabel="Aceita apenas arquivos ZIP contendo XMLs fiscais"
        />
        {progress.total > 0 && (
          <div className="mt-6">
            <ProgressBar
              progress={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
              message={progress.message}
              status="processing"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Relatório por cClass</h1>
          <p className="text-sm text-[#94a3b8]">{notas.length} notas da {centralNotas.length ? 'base central' : 'importação avulsa'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm text-[#f1f5f9] transition-colors hover:bg-[#334155]">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 rounded-lg bg-[#38bdf8] px-4 py-2 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#0ea5e9]">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => { setCentralNotas([]); setUploadedNotas([]); setProgress({ current: 0, total: 0, message: '', status: 'idle' }); }} className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm text-[#f1f5f9] transition-colors hover:bg-[#334155]">Nova consulta</button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={FolderOpen} label="Total Arquivos" value={notas.length} color="#38bdf8" />
        <KpiCard icon={DollarSign} label="Valor Total" value={formatCurrency(cClassData.totalValor)} color="#22c55e" />
        <KpiCard icon={ShoppingCart} label="Total Itens" value={cClassData.totalItens} color="#f59e0b" />
        <KpiCard icon={TrendingUp} label="Média por Nota" value={formatCurrency(cClassData.totalValor / notas.length || 0)} color="#8b5cf6" />
      </div>

      <div className="mb-6 rounded-xl border border-[#334155] bg-[#1e293b] p-5 print:hidden">
        <h3 className="mb-4 text-sm font-semibold text-[#f1f5f9]">Top 12 cClass por Valor</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" stroke="#94a3b8" width={120} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar dataKey="valor" fill="#38bdf8" radius={[0, 4, 4, 0]}>
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={['#38bdf8', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6', '#a855f7', '#eab308'][idx % 12]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 rounded-xl border border-[#334155] bg-[#1e293b] p-5">
        <h3 className="mb-4 text-sm font-semibold text-[#f1f5f9]">Resumo por cClass</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="py-2 text-left text-[#94a3b8]"></th>
                <th className="py-2 text-left text-[#94a3b8]">cClass</th>
                <th className="py-2 text-left text-[#94a3b8]">Descrição</th>
                <th className="py-2 text-right text-[#94a3b8]">Qtd Itens</th>
                <th className="py-2 text-right text-[#94a3b8]">Valor Total</th>
                <th className="py-2 text-right text-[#94a3b8]">%</th>
              </tr>
            </thead>
            <tbody>
              {[...cClassData.list].sort((a, b) => b.valorTotal - a.valorTotal).map((item) => (
                <>
                  <tr key={item.cClass} className="border-b border-[#334155]/50 transition-colors hover:bg-[#0f172a]/50 cursor-pointer" onClick={() => toggleRow(item.cClass)}>
                    <td className="py-2">
                      {expandedRows.has(item.cClass) ? <ChevronDown className="h-4 w-4 text-[#94a3b8]" /> : <ChevronRight className="h-4 w-4 text-[#94a3b8]" />}
                    </td>
                    <td className="py-2 font-mono font-medium text-[#38bdf8]">{item.cClass}</td>
                    <td className="py-2 text-[#f1f5f9]">{item.descricao}</td>
                    <td className="py-2 text-right text-[#f1f5f9]">{item.quantidade}</td>
                    <td className="py-2 text-right font-medium text-[#f1f5f9]">{formatCurrency(item.valorTotal)}</td>
                    <td className="py-2 text-right text-[#94a3b8]">{item.percentual.toFixed(1)}%</td>
                  </tr>
                  {expandedRows.has(item.cClass) && (
                    <tr>
                      <td colSpan={6} className="bg-[#0f172a]/30 px-8 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[#334155]/50">
                              <th className="py-1 text-left text-[#94a3b8]">CFOP</th>
                              <th className="py-1 text-right text-[#94a3b8]">Qtd</th>
                              <th className="py-1 text-right text-[#94a3b8]">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(item.cfops.values()).sort((a, b) => b.valorTotal - a.valorTotal).map(cfop => (
                              <tr key={cfop.cfop} className="border-b border-[#334155]/30">
                                <td className="py-1 font-mono text-[#f59e0b]">{cfop.cfop}</td>
                                <td className="py-1 text-right text-[#f1f5f9]">{cfop.quantidade}</td>
                                <td className="py-1 text-right text-[#f1f5f9]">{formatCurrency(cfop.valorTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[#f1f5f9]">Todos os Itens ({filteredItems.length})</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Filtrar por produto, NCM, CFOP..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full rounded-lg border border-[#334155] bg-[#0f172a] py-2 pl-9 pr-3 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none sm:w-80"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="py-2 text-left text-[#94a3b8]">Arquivo</th>
                <th className="py-2 text-left text-[#94a3b8]">Emitente</th>
                <th className="py-2 text-left text-[#94a3b8]">Produto</th>
                <th className="py-2 text-left text-[#94a3b8]">NCM</th>
                <th className="py-2 text-left text-[#94a3b8]">cClass</th>
                <th className="py-2 text-left text-[#94a3b8]">CFOP</th>
                <th className="cursor-pointer py-2 text-right text-[#94a3b8]" onClick={() => handleSort('valor')}>
                  <div className="flex items-center justify-end gap-1">
                    Valor <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2 text-right text-[#94a3b8]">ICMS</th>
                <th className="py-2 text-right text-[#94a3b8]">PIS</th>
                <th className="py-2 text-right text-[#94a3b8]">COFINS</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 200).map((item, idx) => (
                <tr key={idx} className="border-b border-[#334155]/50 transition-colors hover:bg-[#0f172a]/50">
                  <td className="max-w-[100px] truncate py-2 font-mono text-[#94a3b8]">{item.arquivo}</td>
                  <td className="max-w-[150px] truncate py-2 text-[#f1f5f9]">{item.emitente}</td>
                  <td className="max-w-[200px] truncate py-2 text-[#f1f5f9]">{item.produto}</td>
                  <td className="py-2 font-mono text-[#94a3b8]">{item.ncm}</td>
                  <td className="py-2 font-mono text-[#38bdf8]">{item.cClass}</td>
                  <td className="py-2 font-mono text-[#f59e0b]">{item.cfop}</td>
                  <td className="py-2 text-right font-medium text-[#f1f5f9]">{formatCurrency(item.valor)}</td>
                  <td className="py-2 text-right text-[#ef4444]">{formatCurrency(item.icms)}</td>
                  <td className="py-2 text-right text-[#94a3b8]">{formatCurrency(item.pis)}</td>
                  <td className="py-2 text-right text-[#94a3b8]">{formatCurrency(item.cofins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length > 200 && (
          <p className="mt-3 text-center text-xs text-[#94a3b8]">Exibindo 200 de {filteredItems.length} itens. Use o filtro para refinar.</p>
        )}
      </div>
    </div>
  );
}

function getCClassDesc(cClass: string): string {
  const map: Record<string, string> = {
    'SEM_CLASS': 'Sem Classificacao',
    'MERCADORIA': 'Mercadoria para Revenda',
    'MATERIA_PRIMA': 'Materia Prima',
    'EMBALAGEM': 'Embalagem',
    'SERVICO': 'Servicos',
    'ATIVO': 'Ativo Imobilizado',
    'USO_CONSUMO': 'Uso e Consumo',
  };
  return map[cClass] || cClass;
}
