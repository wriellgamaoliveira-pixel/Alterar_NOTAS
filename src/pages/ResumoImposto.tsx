import { useState, useCallback, useMemo } from 'react';
import { useModule } from '@/context/ModuleContext';
import { processZipFile } from '@/parsers/zipProcessor';
import UploadDropzone from '@/components/shared/UploadDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import KpiCard from '@/components/shared/KpiCard';
import type { NotaFiscal, ImpostoSummary, ImpostoRetido } from '@/types/fiscal';
import {
  Receipt,
  FolderOpen,
  DollarSign,
  AlertTriangle,
  Search,
  Printer,
  Download,
} from 'lucide-react';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { useBK } from '@/context/BKContext';
import { bkDocumentsToNotas } from '@/services/bkFiscalAdapter';

export default function ResumoImposto() {
  const { activeModule } = useModule();
  const { documents } = useBK();
  const [uploadedNotas, setUploadedNotas] = useState<NotaFiscal[]>([]);
  const centralNotas = useMemo(() => activeModule === 'nfe' ? bkDocumentsToNotas(documents) : [], [activeModule, documents]);
  const notas = centralNotas.length ? centralNotas : uploadedNotas;
  const [progress, setProgress] = useState<{ current: number; total: number; message: string; status: 'idle' | 'processing' | 'completed' | 'error' }>({ current: 0, total: 0, message: '', status: 'idle' });
  const [filter, setFilter] = useState('');

  const handleFiles = useCallback(async (files: File[]) => {
    const zipFile = files.find(f => f.name.endsWith('.zip'));
    if (!zipFile) {
      setProgress({ current: 0, total: 0, message: 'Selecione um arquivo ZIP', status: 'idle' });
      return;
    }
    setProgress({ current: 0, total: 100, message: 'Iniciando...', status: 'idle' });
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

  const { impostos, retidos, totalICMS, totalImpostos } = useMemo(() => {
    const impMap = new Map<string, ImpostoSummary>();
    const retMap = new Map<string, ImpostoRetido>();
    let totalICMS = 0;
    let totalImpostos = 0;

    notas.forEach(nota => {
      nota.produtos.forEach(prod => {
        const key = `${prod.icms.cst || '000'}_${prod.cfop}`;
        if (!impMap.has(key)) {
          impMap.set(key, {
            cstICMS: prod.icms.cst || '000',
            cfop: prod.cfop,
            descricao: getCSTDesc(prod.icms.cst),
            baseCalc: 0, valorICMS: 0, valorICMSST: 0, valorTotal: 0, quantidade: 0,
          });
        }
        const item = impMap.get(key)!;
        item.baseCalc += prod.icms.baseCalc;
        item.valorICMS += prod.icms.valor;
        item.valorICMSST += prod.icms.valorST;
        item.valorTotal += prod.valorTotal;
        item.quantidade++;

        totalICMS += prod.icms.valor;
        totalImpostos += prod.icms.valor + prod.ipi.valor + prod.pis.valor + prod.cofins.valor;

        if (prod.ipi.valor > 0) {
          const ipiKey = `IPI_${prod.ipi.cst}`;
          if (!retMap.has(ipiKey)) {
            retMap.set(ipiKey, { tipo: 'IPI', baseCalc: 0, aliquota: prod.ipi.aliquota, valor: 0 });
          }
          retMap.get(ipiKey)!.valor += prod.ipi.valor;
          retMap.get(ipiKey)!.baseCalc += prod.ipi.baseCalc;
        }
        if (prod.pis.valor > 0) {
          const pisKey = `PIS_${prod.pis.cst}`;
          if (!retMap.has(pisKey)) {
            retMap.set(pisKey, { tipo: 'PIS', baseCalc: 0, aliquota: prod.pis.aliquota, valor: 0 });
          }
          retMap.get(pisKey)!.valor += prod.pis.valor;
          retMap.get(pisKey)!.baseCalc += prod.pis.baseCalc;
        }
        if (prod.cofins.valor > 0) {
          const cofKey = `COFINS_${prod.cofins.cst}`;
          if (!retMap.has(cofKey)) {
            retMap.set(cofKey, { tipo: 'COFINS', baseCalc: 0, aliquota: prod.cofins.aliquota, valor: 0 });
          }
          retMap.get(cofKey)!.valor += prod.cofins.valor;
          retMap.get(cofKey)!.baseCalc += prod.cofins.baseCalc;
        }
      });
    });

    return {
      impostos: Array.from(impMap.values()).sort((a, b) => b.valorICMS - a.valorICMS),
      retidos: Array.from(retMap.values()),
      totalICMS,
      totalImpostos,
    };
  }, [notas]);

  const totalValor = useMemo(() => notas.reduce((sum, n) => sum + n.totais.valorNota, 0), [notas]);

  const filteredImpostos = useMemo(() => {
    if (!filter) return impostos;
    const f = filter.toLowerCase();
    return impostos.filter(i =>
      i.cstICMS.includes(f) || i.cfop.includes(f) || i.descricao.toLowerCase().includes(f)
    );
  }, [impostos, filter]);

  const exportCSV = () => {
    const data = impostos.map(i => ({
      CST_ICMS: i.cstICMS,
      CFOP: i.cfop,
      Descricao: i.descricao,
      Base_Calc: i.baseCalc.toFixed(2),
      Valor_ICMS: i.valorICMS.toFixed(2),
      Valor_ICMS_ST: i.valorICMSST.toFixed(2),
      Valor_Total: i.valorTotal.toFixed(2),
      Quantidade: i.quantidade,
    }));
    const csv = Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `relatorio_imposto_${activeModule}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (notas.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Relatório por Imposto</h1>
          <p className="text-sm text-[#94a3b8]">A base central ainda não possui notas deste módulo.</p>
        </div>
        <UploadDropzone onFilesSelected={handleFiles} accept=".zip" label="Arraste um ZIP com XMLs aqui" sublabel="XMLs fiscais compactados em ZIP" />
        {progress.total > 0 && (
          <div className="mt-6">
            <ProgressBar progress={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} message={progress.message} status="processing" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Relatório por Imposto</h1>
          <p className="text-sm text-[#94a3b8]">{notas.length} notas da {centralNotas.length ? 'base central' : 'importação avulsa'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm text-[#f1f5f9] hover:bg-[#334155]">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 rounded-lg bg-[#38bdf8] px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#0ea5e9]">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          {!centralNotas.length && <button onClick={() => setUploadedNotas([])} className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm text-[#f1f5f9] hover:bg-[#334155]">Novo Upload</button>}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={FolderOpen} label="Total Arquivos" value={notas.length} color="#38bdf8" />
        <KpiCard icon={DollarSign} label="Valor Total" value={formatCurrency(totalValor)} color="#22c55e" />
        <KpiCard icon={Receipt} label="Total ICMS" value={formatCurrency(totalICMS)} color="#f59e0b" />
        <KpiCard icon={AlertTriangle} label="Total Impostos" value={formatCurrency(totalImpostos)} color="#ef4444" />
      </div>

      <div className="mb-6 rounded-xl border border-[#334155] bg-[#1e293b] p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-[#f1f5f9]">Tabela por CST ICMS + CFOP</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input type="text" placeholder="Filtrar CST ou CFOP..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full rounded-lg border border-[#334155] bg-[#0f172a] py-2 pl-9 pr-3 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none sm:w-72" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="py-2 text-left text-[#94a3b8]">CST ICMS</th>
                <th className="py-2 text-left text-[#94a3b8]">CFOP</th>
                <th className="py-2 text-left text-[#94a3b8]">Descrição</th>
                <th className="py-2 text-right text-[#94a3b8]">Qtd</th>
                <th className="py-2 text-right text-[#94a3b8]">Base Calc</th>
                <th className="py-2 text-right text-[#94a3b8]">ICMS</th>
                <th className="py-2 text-right text-[#94a3b8]">ICMS ST</th>
                <th className="py-2 text-right text-[#94a3b8]">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredImpostos.map((item, idx) => (
                <tr key={idx} className="border-b border-[#334155]/50 hover:bg-[#0f172a]/50">
                  <td className="py-2 font-mono font-medium text-[#f59e0b]">{item.cstICMS}</td>
                  <td className="py-2 font-mono text-[#38bdf8]">{item.cfop}</td>
                  <td className="py-2 text-[#94a3b8]">{item.descricao}</td>
                  <td className="py-2 text-right text-[#f1f5f9]">{item.quantidade}</td>
                  <td className="py-2 text-right text-[#f1f5f9]">{formatCurrency(item.baseCalc)}</td>
                  <td className="py-2 text-right font-medium text-[#ef4444]">{formatCurrency(item.valorICMS)}</td>
                  <td className="py-2 text-right text-[#f59e0b]">{formatCurrency(item.valorICMSST)}</td>
                  <td className="py-2 text-right font-medium text-[#22c55e]">{formatCurrency(item.valorTotal)}</td>
                </tr>
              ))}
              {filteredImpostos.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-[#94a3b8]">Nenhum resultado encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {retidos.length > 0 && (
        <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
          <h3 className="mb-4 text-sm font-semibold text-[#f1f5f9]">Impostos Retidos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="py-2 text-left text-[#94a3b8]">Tipo</th>
                  <th className="py-2 text-right text-[#94a3b8]">Base Calc</th>
                  <th className="py-2 text-right text-[#94a3b8]">Alíquota</th>
                  <th className="py-2 text-right text-[#94a3b8]">Valor Retido</th>
                </tr>
              </thead>
              <tbody>
                {retidos.map((item, idx) => (
                  <tr key={idx} className="border-b border-[#334155]/50 hover:bg-[#0f172a]/50">
                    <td className="py-2 font-medium text-[#f1f5f9]">{item.tipo}</td>
                    <td className="py-2 text-right text-[#f1f5f9]">{formatCurrency(item.baseCalc)}</td>
                    <td className="py-2 text-right text-[#94a3b8]">{item.aliquota.toFixed(2)}%</td>
                    <td className="py-2 text-right font-medium text-[#ef4444]">{formatCurrency(item.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getCSTDesc(cst: string): string {
  const map: Record<string, string> = {
    '00': 'Tributada integralmente',
    '10': 'Tributada com ICMS ST',
    '20': 'Com reducao de base calc',
    '30': 'Isenta ou nao tributada ST',
    '40': 'Isenta',
    '41': 'Nao tributada',
    '50': 'Suspensao',
    '51': 'Diferimento',
    '60': 'ICMS cobrado por ST',
    '70': 'Com reducao de BC e ICMS ST',
    '90': 'Outras',
    '101': 'Tributada SN com permissao credito',
    '102': 'Tributada SN sem permissao credito',
    '103': 'Isencao SN para faixa receita bruta',
    '201': 'Tributada SN com permissao credito e ST',
    '202': 'Tributada SN sem permissao credito e ST',
    '203': 'Isencao SN para faixa receita bruta e ST',
    '300': 'Imune',
    '400': 'Nao tributada SN',
    '500': 'ICMS cobrado por ST ou FCP',
    '900': 'Outros SN',
  };
  return map[cst] || 'CST ' + cst;
}
