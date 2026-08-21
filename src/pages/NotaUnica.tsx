import { useState, useCallback } from 'react';
import { useModule } from '@/context/ModuleContext';
import { processXmlFile } from '@/parsers/zipProcessor';
import UploadDropzone from '@/components/shared/UploadDropzone';
import type { NotaFiscal } from '@/types/fiscal';
import type { BKDocument } from '@/types/bk';
import { useBK } from '@/context/BKContext';
import { bkDocumentToNotaFiscal } from '@/services/bkFiscalAdapter';
import { openDanfe } from '@/services/danfe';
import {
  Building2,
  User,
  Package,
  Receipt,
  AlertCircle,
} from 'lucide-react';

const dayLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const today = new Date();
const initialPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
const finalPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

export default function NotaUnica() {
  const { activeModule } = useModule();
  const { documents } = useBK();
  const [notaAvulsa, setNota] = useState<NotaFiscal | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [results, setResults] = useState<BKDocument[]>([]);
  const [dateFrom, setDateFrom] = useState(initialPeriod); const [dateTo, setDateTo] = useState(finalPeriod); const [term, setTerm] = useState(''); const [limit, setLimit] = useState(50);
  const selectedDocument = results.find((item) => item.accessKey === selectedKey) || results[0];
  const nota = notaAvulsa || (selectedDocument ? bkDocumentToNotaFiscal(selectedDocument) : null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    setError('');
    setNota(null);
    setLoading(true);

    try {
      const xmlFile = files.find(f => f.name.endsWith('.xml'));
      if (!xmlFile) {
        setError('Por favor, selecione um arquivo XML');
        setLoading(false);
        return;
      }
      const result = await processXmlFile(xmlFile, activeModule);
      setNota(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeModule]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Nota Única</h1>
        <p className="text-sm text-[#94a3b8]">Visualize uma nota já importada na base central, sem carregar o XML novamente.</p>
      </div>

      <section className="mb-5 rounded-xl border border-sky-500/30 bg-[#1e293b] p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[170px_170px_1fr_150px_auto]"><label className="text-xs text-[#94a3b8]">Data inicial<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-white" /></label><label className="text-xs text-[#94a3b8]">Data final<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-white" /></label><label className="text-xs text-[#94a3b8]">Número da nota ou fornecedor<input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Digite para consultar" className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-white" /></label><label className="text-xs text-[#94a3b8]">Quantidade na lista<select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-white">{[10,20,50,100,200,500,1000,2000,5000].map((value) => <option key={value}>{value}</option>)}</select></label><button onClick={() => { const normalized = term.toLowerCase().trim(); setNota(null); setSelectedKey(''); setResults(documents.filter((item) => { const issueDay = item.issueDate.slice(0, 10); return activeModule === 'nfe' && item.model === '55' && (!dateFrom || issueDay >= dateFrom) && (!dateTo || issueDay <= dateTo) && (!normalized || `${item.number} ${item.issuerName}`.toLowerCase().includes(normalized)); }).slice(0, limit)); }} className="self-end rounded-lg bg-[#38bdf8] px-4 py-2 font-semibold text-[#0f172a]">Consultar banco</button></div></section>

      {results.length > 0 && <label className="mb-5 block text-sm text-[#94a3b8]">Nota encontrada<select value={notaAvulsa ? '' : (selectedDocument?.accessKey || '')} onChange={(event) => { setNota(null); setSelectedKey(event.target.value); }} className="mt-2 w-full rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-[#f1f5f9]"><option value="" disabled>Selecione uma nota</option>{results.map((item) => <option key={item.id} value={item.accessKey}>{item.number} — {item.issuerName} — {dayLabel(item.issueDate)}</option>)}</select></label>}

      {!nota && (
        <UploadDropzone
          onFilesSelected={handleFiles}
          accept=".xml"
          label="Arraste um arquivo XML aqui ou clique para selecionar"
          sublabel="Apenas arquivos XML de nota fiscal"
        />
      )}

      {loading && (
        <div className="mt-6 rounded-xl border border-[#334155] bg-[#1e293b] p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#38bdf8] border-t-transparent" />
          <p className="text-sm text-[#94a3b8]">Processando XML...</p>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4">
          <AlertCircle className="h-5 w-5 text-[#ef4444]" />
          <p className="text-sm text-[#ef4444]">{error}</p>
        </div>
      )}

      {nota && (
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#f1f5f9]">
              Nota Fiscal {nota.numero} - Série {nota.serie}
            </h2>
            <div className="flex gap-2">{selectedDocument && <><button onClick={() => openDanfe(selectedDocument)} className="rounded-lg bg-[#38bdf8] px-4 py-2 text-sm font-semibold text-[#0f172a]">Visualizar DANFE</button><button onClick={() => openDanfe(selectedDocument, true)} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white">Imprimir</button></>}<button
              onClick={() => { setNota(null); setError(''); setSelectedKey(''); }}
              className="rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm text-[#f1f5f9] transition-colors hover:bg-[#334155]"
            >
              Voltar à base central
            </button></div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#38bdf8]" />
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Dados da Nota</h3>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Chave</span>
                  <span className="max-w-[200px] truncate font-mono text-[#f1f5f9]">{nota.chave}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Número</span>
                  <span className="text-[#f1f5f9]">{nota.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Série</span>
                  <span className="text-[#f1f5f9]">{nota.serie}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Modelo</span>
                  <span className="text-[#f1f5f9]">{nota.modelo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Emissão</span>
                  <span className="text-[#f1f5f9]">{formatDate(nota.dataEmissao)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Tipo</span>
                  <span className="text-[#f1f5f9]">{nota.tipoOperacao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Natureza</span>
                  <span className="text-[#f1f5f9]">{nota.naturezaOperacao}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#22c55e]" />
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Emitente</h3>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">CNPJ</span>
                  <span className="font-mono text-[#f1f5f9]">{nota.emitente.cnpj}</span>
                </div>
                <div>
                  <span className="text-[#94a3b8]">Nome</span>
                  <p className="mt-0.5 text-[#f1f5f9]">{nota.emitente.nome}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">IE</span>
                  <span className="text-[#f1f5f9]">{nota.emitente.ie}</span>
                </div>
                <div>
                  <span className="text-[#94a3b8]">Endereço</span>
                  <p className="mt-0.5 text-[#f1f5f9]">{nota.emitente.endereco}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Município</span>
                  <span className="text-[#f1f5f9]">{nota.emitente.municipio} - {nota.emitente.uf}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-[#f59e0b]" />
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Destinatário</h3>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Doc</span>
                  <span className="font-mono text-[#f1f5f9]">{nota.destinatario.cnpj || nota.destinatario.cpf || '-'}</span>
                </div>
                <div>
                  <span className="text-[#94a3b8]">Nome</span>
                  <p className="mt-0.5 text-[#f1f5f9]">{nota.destinatario.nome}</p>
                </div>
                {nota.destinatario.ie && (
                  <div className="flex justify-between">
                    <span className="text-[#94a3b8]">IE</span>
                    <span className="text-[#f1f5f9]">{nota.destinatario.ie}</span>
                  </div>
                )}
                <div>
                  <span className="text-[#94a3b8]">Endereço</span>
                  <p className="mt-0.5 text-[#f1f5f9]">{nota.destinatario.endereco}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Município</span>
                  <span className="text-[#f1f5f9]">{nota.destinatario.municipio} - {nota.destinatario.uf}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#38bdf8]" />
              <h3 className="text-sm font-semibold text-[#f1f5f9]">
                Itens / Produtos ({nota.produtos.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="py-2 text-left text-[#94a3b8]">Produto</th>
                    <th className="py-2 text-left text-[#94a3b8]">NCM</th>
                    <th className="py-2 text-left text-[#94a3b8]">CFOP</th>
                    <th className="py-2 text-left text-[#94a3b8]">cClass</th>
                    <th className="py-2 text-right text-[#94a3b8]">Qtd</th>
                    <th className="py-2 text-right text-[#94a3b8]">V. Unit</th>
                    <th className="py-2 text-right text-[#94a3b8]">V. Total</th>
                    <th className="py-2 text-center text-[#94a3b8]">CST</th>
                    <th className="py-2 text-right text-[#94a3b8]">ICMS</th>
                  </tr>
                </thead>
                <tbody>
                  {nota.produtos.map((prod, idx) => (
                    <tr key={idx} className="border-b border-[#334155]/50 transition-colors hover:bg-[#0f172a]/50">
                      <td className="max-w-[250px] truncate py-2 text-[#f1f5f9]">{prod.nome}</td>
                      <td className="py-2 font-mono text-[#94a3b8]">{prod.ncm}</td>
                      <td className="py-2 font-mono text-[#94a3b8]">{prod.cfop}</td>
                      <td className="py-2 text-[#94a3b8]">{prod.cClass}</td>
                      <td className="py-2 text-right text-[#f1f5f9]">{prod.quantidade}</td>
                      <td className="py-2 text-right text-[#f1f5f9]">{formatCurrency(prod.valorUnitario)}</td>
                      <td className="py-2 text-right font-medium text-[#f1f5f9]">{formatCurrency(prod.valorTotal)}</td>
                      <td className="py-2 text-center font-mono text-[#f59e0b]">{prod.icms.cst}</td>
                      <td className="py-2 text-right text-[#ef4444]">{formatCurrency(prod.icms.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Valor Produtos', value: formatCurrency(nota.totais.valorProdutos), color: '#38bdf8' },
              { label: 'Valor ICMS', value: formatCurrency(nota.totais.valorICMS), color: '#ef4444' },
              { label: 'Valor IPI', value: formatCurrency(nota.totais.valorIPI), color: '#f59e0b' },
              { label: 'Valor Total', value: formatCurrency(nota.totais.valorNota), color: '#22c55e' },
            ].map((item, idx) => (
              <div key={idx} className="rounded-xl border border-[#334155] bg-[#1e293b] p-4 text-center">
                <p className="text-xs text-[#94a3b8]">{item.label}</p>
                <p className="mt-1 text-xl font-bold" style={{ color: item.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {nota.infoAdicional && (
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
              <h3 className="mb-2 text-sm font-semibold text-[#f1f5f9]">Informações Adicionais</h3>
              <p className="text-sm text-[#94a3b8]">{nota.infoAdicional}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
