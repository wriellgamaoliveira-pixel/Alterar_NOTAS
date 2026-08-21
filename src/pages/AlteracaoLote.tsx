import { useState, useCallback } from 'react';
import { useModule } from '@/context/ModuleContext';
import UploadDropzone from '@/components/shared/UploadDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tag,
  FileText,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBK } from '@/context/BKContext';

type OpType = 'cclass' | 'descricao' | 'remover-icms' | 'remover-cclass';

interface OpState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  resultZip?: JSZip;
  error?: string;
}

function OpCard({ tipo, title, icon: Icon, children, onProcess, state, centralCount, onCentral, onDownload }: {
  tipo: OpType; title: string; icon: LucideIcon; children: React.ReactNode; onProcess: (files: File[]) => void;
  state: OpState; centralCount: number; onCentral: () => void; onDownload: (tipo: OpType) => void;
}) {
  return <div className="space-y-4"><div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
    <div className="mb-4 flex items-center gap-2"><Icon className="h-5 w-5 text-[#38bdf8]" /><h3 className="font-semibold text-[#f1f5f9]">{title}</h3></div>
    {children}
    <div className="mt-4"><button disabled={!centralCount} onClick={onCentral} className="mb-3 flex items-center gap-2 rounded-lg bg-[#38bdf8] px-4 py-2 text-sm font-medium text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-40">Usar {centralCount} XML(s) da base central</button><UploadDropzone onFilesSelected={onProcess} accept=".zip" label="Arraste o ZIP com XMLs aqui" sublabel="Arquivos serão processados e modificados" /></div>
    {state.status === 'processing' && <div className="mt-4"><ProgressBar progress={state.progress} message={state.message} status="processing" /></div>}
    {state.status === 'completed' && <div className="mt-4 space-y-2"><div className="flex items-center gap-2 text-sm text-[#22c55e]"><CheckCircle className="h-4 w-4" /><span>{state.message}</span></div><button onClick={() => onDownload(tipo)} className="flex items-center gap-2 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-white hover:bg-[#16a34a]"><Download className="h-4 w-4" /> Baixar ZIP Modificado</button></div>}
    {state.status === 'error' && <div className="mt-4 flex items-center gap-2 text-sm text-[#ef4444]"><AlertCircle className="h-4 w-4" /><span>{state.error}</span></div>}
  </div></div>;
}

export default function AlteracaoLote() {
  const { activeModule } = useModule();
  const { documents, loadDocumentXmlFiles } = useBK();

  const [opStates, setOpStates] = useState<Record<OpType, OpState>>({
    'cclass': { status: 'idle', progress: 0, message: '' },
    'descricao': { status: 'idle', progress: 0, message: '' },
    'remover-icms': { status: 'idle', progress: 0, message: '' },
    'remover-cclass': { status: 'idle', progress: 0, message: '' },
  });

  const [cClassOrigem, setCClassOrigem] = useState('');
  const [cClassDestino, setCClassDestino] = useState('');
  const [cfopOrigem, setCfopOrigem] = useState('');
  const [cfopDestino, setCfopDestino] = useState('');
  const [aliquotaICMS, setAliquotaICMS] = useState('');
  const [cClassAlvo, setCClassAlvo] = useState('');
  const [csvMap, setCsvMap] = useState<Map<string, string>>(new Map());

  const updateOp = (tipo: OpType, update: Partial<OpState>) => {
    setOpStates(prev => ({ ...prev, [tipo]: { ...prev[tipo], ...update } }));
  };

  const processarCClassCFOP = useCallback(async (files: File[]) => {
    const zipFile = files.find(f => f.name.endsWith('.zip'));
    if (!zipFile) { updateOp('cclass', { status: 'error', error: 'Selecione um ZIP' }); return; }

    updateOp('cclass', { status: 'processing', progress: 0, message: 'Processando...' });

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const xmlEntries = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.xml'));
      const resultZip = new JSZip();
      let processed = 0;

      for (const entry of xmlEntries) {
        const content = await entry.async('string');
        let modified = content;

        if (cClassOrigem && cClassDestino) {
          const regex = new RegExp(`(<cClass>?)${cClassOrigem}(</cClass>?)`, 'gi');
          modified = modified.replace(regex, `$1${cClassDestino}$2`);
          const regex2 = new RegExp(`(<xPed>?)${cClassOrigem}(</xPed>?)`, 'gi');
          modified = modified.replace(regex2, `$1${cClassDestino}$2`);
        }
        if (cfopOrigem && cfopDestino) {
          const regex = new RegExp(`(<CFOP>?)${cfopOrigem}(</CFOP>?)`, 'g');
          modified = modified.replace(regex, `$1${cfopDestino}$2`);
        }

        resultZip.file(entry.name, modified);
        processed++;
        updateOp('cclass', { progress: (processed / xmlEntries.length) * 100, message: `Processando ${processed} de ${xmlEntries.length}...` });
      }

      updateOp('cclass', { status: 'completed', progress: 100, message: `${processed} arquivos processados`, resultZip });
    } catch (err) {
      updateOp('cclass', { status: 'error', error: (err as Error).message });
    }
  }, [cClassOrigem, cClassDestino, cfopOrigem, cfopDestino]);

  const processarDescricao = useCallback(async (files: File[]) => {
    const zipFile = files.find(f => f.name.endsWith('.zip'));
    if (!zipFile) { updateOp('descricao', { status: 'error', error: 'Selecione um ZIP' }); return; }
    if (csvMap.size === 0) { updateOp('descricao', { status: 'error', error: 'Carregue um CSV de mapeamento primeiro' }); return; }

    updateOp('descricao', { status: 'processing', progress: 0, message: 'Processando...' });

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const xmlEntries = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.xml'));
      const resultZip = new JSZip();
      let processed = 0;

      for (const entry of xmlEntries) {
        const content = await entry.async('string');
        let modified = content;

        csvMap.forEach((novaDesc, descOrigem) => {
          const regex = new RegExp(`(<xProd>?)${descOrigem}(</xProd>?)`, 'gi');
          modified = modified.replace(regex, `$1${novaDesc}$2`);
        });

        resultZip.file(entry.name, modified);
        processed++;
        updateOp('descricao', { progress: (processed / xmlEntries.length) * 100, message: `Processando ${processed} de ${xmlEntries.length}...` });
      }

      updateOp('descricao', { status: 'completed', progress: 100, message: `${processed} arquivos processados`, resultZip });
    } catch (err) {
      updateOp('descricao', { status: 'error', error: (err as Error).message });
    }
  }, [csvMap]);

  const processarRemoverICMS = useCallback(async (files: File[]) => {
    const zipFile = files.find(f => f.name.endsWith('.zip'));
    if (!zipFile) { updateOp('remover-icms', { status: 'error', error: 'Selecione um ZIP' }); return; }
    if (!aliquotaICMS) { updateOp('remover-icms', { status: 'error', error: 'Informe a alíquota ICMS' }); return; }

    updateOp('remover-icms', { status: 'processing', progress: 0, message: 'Processando...' });

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const xmlEntries = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.xml'));
      const resultZip = new JSZip();
      const aliq = parseFloat(aliquotaICMS);
      let processed = 0;

      for (const entry of xmlEntries) {
        const content = await entry.async('string');
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');

        const allElements = doc.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];
          if (el.tagName.includes('ICMS')) {
            const pICMS = el.getElementsByTagName('pICMS')[0];
            if (pICMS) {
              const val = parseFloat(pICMS.textContent || '0');
              if (Math.abs(val - aliq) < 0.01) {
                const cfopEl = el.parentElement?.parentElement?.getElementsByTagName('CFOP')[0];
                if (cfopEl) cfopEl.textContent = '';
              }
            }
          }
        }

        const serializer = new XMLSerializer();
        resultZip.file(entry.name, serializer.serializeToString(doc));
        processed++;
        updateOp('remover-icms', { progress: (processed / xmlEntries.length) * 100, message: `Processando ${processed} de ${xmlEntries.length}...` });
      }

      updateOp('remover-icms', { status: 'completed', progress: 100, message: `${processed} arquivos processados`, resultZip });
    } catch (err) {
      updateOp('remover-icms', { status: 'error', error: (err as Error).message });
    }
  }, [aliquotaICMS]);

  const processarRemoverCClass = useCallback(async (files: File[]) => {
    const zipFile = files.find(f => f.name.endsWith('.zip'));
    if (!zipFile) { updateOp('remover-cclass', { status: 'error', error: 'Selecione um ZIP' }); return; }
    if (!cClassAlvo) { updateOp('remover-cclass', { status: 'error', error: 'Informe o cClass alvo' }); return; }

    updateOp('remover-cclass', { status: 'processing', progress: 0, message: 'Processando...' });

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const xmlEntries = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.xml'));
      const resultZip = new JSZip();
      let processed = 0;

      for (const entry of xmlEntries) {
        const content = await entry.async('string');
        let modified = content;

        const regex = new RegExp(`(<CFOP>)[^<]*(</CFOP>)(?=[^]*?<cClass>${cClassAlvo}</cClass>)`, 'gi');
        modified = modified.replace(regex, '$1$2');

        resultZip.file(entry.name, modified);
        processed++;
        updateOp('remover-cclass', { progress: (processed / xmlEntries.length) * 100, message: `Processando ${processed} de ${xmlEntries.length}...` });
      }

      updateOp('remover-cclass', { status: 'completed', progress: 100, message: `${processed} arquivos processados`, resultZip });
    } catch (err) {
      updateOp('remover-cclass', { status: 'error', error: (err as Error).message });
    }
  }, [cClassAlvo]);

  const handleCsvUpload = useCallback(async (files: File[]) => {
    const csvFile = files.find(f => f.name.endsWith('.csv'));
    if (!csvFile) return;
    const text = await csvFile.text();
    const lines = text.split('\n');
    const map = new Map<string, string>();
    for (const line of lines) {
      const parts = line.split(';').map(s => s.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        map.set(parts[0], parts[1]);
      }
    }
    setCsvMap(map);
  }, []);

  const baixarResultado = async (tipo: OpType) => {
    const state = opStates[tipo];
    if (!state.resultZip) return;
    const blob = await state.resultZip.generateAsync({ type: 'blob' });
    saveAs(blob, `alteracao_${tipo}_${activeModule}_${new Date().toISOString().split('T')[0]}.zip`);
  };

  const processarBaseCentral = async (onProcess: (files: File[]) => void) => {
    const centralXmls = await loadDocumentXmlFiles(documents.map((document) => document.id));
    if (!centralXmls.length) { window.alert('Os XMLs completos não estão disponíveis. Sincronize a pasta BK para recuperá-los.'); return; }
    const zip = new JSZip();
    centralXmls.forEach((document) => zip.file(document.name.split('/').pop() || `${document.id}.xml`, document.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    onProcess([new File([blob], 'base-central.zip', { type: 'application/zip' })]);
  };

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Alteração em Lote</h1>
        <p className="text-sm text-[#94a3b8]">Use diretamente os XMLs já importados na base central; o resultado modificado é baixado sem alterar o banco.</p>
      </div>

      <Tabs defaultValue="cclass" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-4 border border-[#334155] bg-[#1e293b]">
          <TabsTrigger value="cclass" className="text-xs text-[#94a3b8] data-[state=active]:bg-[#38bdf8] data-[state=active]:text-[#0f172a]">
            <Tag className="mr-1 h-3.5 w-3.5" /> cClass/CFOP
          </TabsTrigger>
          <TabsTrigger value="descricao" className="text-xs text-[#94a3b8] data-[state=active]:bg-[#38bdf8] data-[state=active]:text-[#0f172a]">
            <FileText className="mr-1 h-3.5 w-3.5" /> Descrição
          </TabsTrigger>
          <TabsTrigger value="remover-icms" className="text-xs text-[#94a3b8] data-[state=active]:bg-[#38bdf8] data-[state=active]:text-[#0f172a]">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover por ICMS
          </TabsTrigger>
          <TabsTrigger value="remover-cclass" className="text-xs text-[#94a3b8] data-[state=active]:bg-[#38bdf8] data-[state=active]:text-[#0f172a]">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover por cClass
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cclass">
          <OpCard tipo="cclass" title="Alterar por cClass/CFOP" icon={Tag} onProcess={processarCClassCFOP} state={opStates.cclass} centralCount={documents.length} onCentral={() => void processarBaseCentral(processarCClassCFOP)} onDownload={baixarResultado}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#94a3b8]">cClass Origem</label>
                <input type="text" value={cClassOrigem} onChange={e => setCClassOrigem(e.target.value)} placeholder="Ex: MERCADORIA" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94a3b8]">cClass Destino</label>
                <input type="text" value={cClassDestino} onChange={e => setCClassDestino(e.target.value)} placeholder="Ex: MATÉRIA PRIMA" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94a3b8]">CFOP Origem</label>
                <input type="text" value={cfopOrigem} onChange={e => setCfopOrigem(e.target.value)} placeholder="Ex: 5102" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#94a3b8]">CFOP Destino</label>
                <input type="text" value={cfopDestino} onChange={e => setCfopDestino(e.target.value)} placeholder="Ex: 5101" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none" />
              </div>
            </div>
          </OpCard>
        </TabsContent>

        <TabsContent value="descricao">
          <OpCard tipo="descricao" title="Alterar por Descrição" icon={FileText} onProcess={processarDescricao} state={opStates.descricao} centralCount={documents.length} onCentral={() => void processarBaseCentral(processarDescricao)} onDownload={baixarResultado}>
            <div className="mb-4">
              <label className="mb-2 block text-sm text-[#94a3b8]">CSV de Mapeamento (descrição original ; nova descrição)</label>
              <UploadDropzone onFilesSelected={handleCsvUpload} accept=".csv" label="Arraste o CSV de mapeamento" sublabel="Formato: descrição original ; nova descrição" />
              {csvMap.size > 0 && (
                <p className="mt-2 text-sm text-[#22c55e]">{csvMap.size} mapeamentos carregados</p>
              )}
            </div>
          </OpCard>
        </TabsContent>

        <TabsContent value="remover-icms">
          <OpCard tipo="remover-icms" title="Remover CFOP por ICMS" icon={Trash2} onProcess={processarRemoverICMS} state={opStates['remover-icms']} centralCount={documents.length} onCentral={() => void processarBaseCentral(processarRemoverICMS)} onDownload={baixarResultado}>
            <div>
              <label className="mb-1 block text-xs text-[#94a3b8]">Alíquota ICMS (%)</label>
              <input type="number" step="0.01" value={aliquotaICMS} onChange={e => setAliquotaICMS(e.target.value)} placeholder="Ex: 18.00" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none" />
              <p className="mt-1 text-xs text-[#94a3b8]">CFOP será removido dos itens com esta alíquota de ICMS</p>
            </div>
          </OpCard>
        </TabsContent>

        <TabsContent value="remover-cclass">
          <OpCard tipo="remover-cclass" title="Remover CFOP por cClass" icon={Trash2} onProcess={processarRemoverCClass} state={opStates['remover-cclass']} centralCount={documents.length} onCentral={() => void processarBaseCentral(processarRemoverCClass)} onDownload={baixarResultado}>
            <div>
              <label className="mb-1 block text-xs text-[#94a3b8]">cClass Alvo</label>
              <input type="text" value={cClassAlvo} onChange={e => setCClassAlvo(e.target.value)} placeholder="Ex: SERVICO" className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:border-[#38bdf8] focus:outline-none" />
              <p className="mt-1 text-xs text-[#94a3b8]">CFOP será removido dos itens com este cClass</p>
            </div>
          </OpCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
