import { useCallback, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import UploadDropzone from '@/components/shared/UploadDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import { useModule } from '@/context/ModuleContext';
import { AlertCircle, CheckCircle, Download } from 'lucide-react';
import { useBK } from '@/context/BKContext';

type Status = 'idle' | 'processing' | 'completed' | 'error';

function normalizeIE(ie: string) {
  return ie.replace(/[\\/:*?"<>|]/g, '_').trim() || 'ISENTO';
}

function extractIE(xmlContent: string): string {
  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
  const infNFe = doc.getElementsByTagName('infNFe')[0];
  if (!infNFe) return 'SEM_DEST';

  const dest = infNFe.getElementsByTagName('dest')[0];
  if (!dest) return 'SEM_DEST';

  const ieNode = dest.getElementsByTagName('IE')[0];
  const ieValue = ieNode?.textContent?.trim();
  return ieValue ? normalizeIE(ieValue) : 'ISENTO';
}

export default function ExportarXmlPorIE() {
  const { activeModule } = useModule();
  const { documents, loadDocumentXmlFiles } = useBK();
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const processarZip = useCallback(async (files: File[]) => {
    if (activeModule !== 'nfe' && activeModule !== 'nfce') {
      setStatus('error');
      setError('Funcionalidade disponível apenas para NF-e e NFC-e.');
      return;
    }

    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
    if (!zipFile) {
      setStatus('error');
      setError('Selecione um arquivo ZIP.');
      return;
    }

    setStatus('processing');
    setProgress(0);
    setError('');
    setResultBlob(null);

    try {
      const inputZip = await JSZip.loadAsync(zipFile);
      const xmlEntries = Object.values(inputZip.files).filter(entry => !entry.dir && entry.name.toLowerCase().endsWith('.xml'));

      if (xmlEntries.length === 0) {
        throw new Error('Nenhum XML encontrado no ZIP enviado.');
      }

      const grouped = new Map<string, Array<{ name: string; content: string }>>();

      for (let i = 0; i < xmlEntries.length; i++) {
        const entry = xmlEntries[i];
        const content = await entry.async('string');
        const ie = extractIE(content);

        if (!grouped.has(ie)) grouped.set(ie, []);
        grouped.get(ie)?.push({ name: entry.name.split('/').pop() || `nfe_${i + 1}.xml`, content });

        setProgress(((i + 1) / xmlEntries.length) * 100);
        setMessage(`Processando ${i + 1} de ${xmlEntries.length} XMLs...`);
      }

      const outputZip = new JSZip();
      grouped.forEach((items, ie) => {
        const folder = outputZip.folder(ie);
        items.forEach((item, index) => {
          const fallback = `nfe_${String(index + 1).padStart(4, '0')}.xml`;
          folder?.file(item.name || fallback, item.content);
        });
      });

      const blob = await outputZip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        metadata => {
          setMessage(`Compactando ZIP final... ${Math.round(metadata.percent)}%`);
        },
      );

      setResultBlob(blob);
      setStatus('completed');
      setProgress(100);
      setMessage(`Exportação concluída. ${xmlEntries.length} XMLs organizados por IE.`);
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
    }
  }, [activeModule]);

  const processarBaseCentral = useCallback(async () => {
    const savedXmls = await loadDocumentXmlFiles(documents.map((document) => document.id));
    if (!savedXmls.length) { setStatus('error'); setError('As notas antigas ainda não possuem o XML completo. Clique em Sincronizar agora na configuração BK para atualizar a base uma única vez.'); return; }
    const source = new JSZip();
    savedXmls.forEach((document) => source.file(document.name.split('/').pop() || `${document.id}.xml`, document.content));
    const blob = await source.generateAsync({ type: 'blob' });
    await processarZip([new File([blob], 'base-central.zip', { type: 'application/zip' })]);
  }, [documents, loadDocumentXmlFiles, processarZip]);

  const baixarZip = () => {
    if (!resultBlob) return;
    saveAs(resultBlob, 'exportacao_xml_por_ie.zip');
  };

  const moduloValido = activeModule === 'nfe' || activeModule === 'nfce';

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Exportar XML por IE</h1>
        <p className="text-sm text-[#94a3b8]">Agrupa os XMLs por infNFe/dest/IE sem alterar o conteúdo original.</p>
      </div>

      {!moduloValido && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#7f1d1d] bg-[#450a0a] p-3 text-sm text-[#fecaca]">
          <AlertCircle className="h-4 w-4" />
          Recurso disponível apenas para módulos NF-e e NFC-e.
        </div>
      )}

      <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-5">
        <button disabled={!moduloValido || !documents.length} onClick={() => void processarBaseCentral()} className="mb-4 flex items-center gap-2 rounded-lg bg-[#38bdf8] px-4 py-2 text-sm font-medium text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-40">Usar {documents.length} nota(s) da base central</button>
        <UploadDropzone
          onFilesSelected={processarZip}
          accept=".zip"
          label="Arraste o ZIP com XMLs aqui"
          sublabel="Os arquivos serão reorganizados em pastas por IE"
        />

        {status === 'processing' && <div className="mt-4"><ProgressBar progress={progress} message={message} status="processing" /></div>}

        {status === 'completed' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-[#22c55e]"><CheckCircle className="h-4 w-4" />{message}</div>
            <button onClick={baixarZip} className="flex items-center gap-2 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-white hover:bg-[#16a34a]">
              <Download className="h-4 w-4" /> Baixar exportacao_xml_por_ie.zip
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#ef4444]">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
