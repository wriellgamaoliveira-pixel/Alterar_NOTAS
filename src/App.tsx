import { Routes, Route } from 'react-router-dom';
import { ModuleProvider } from '@/context/ModuleContext';
import Navbar from '@/components/shared/Navbar';
import Home from '@/pages/Home';
import NotaUnica from '@/pages/NotaUnica';
import ResumoCClass from '@/pages/ResumoCClass';
import ResumoImposto from '@/pages/ResumoImposto';
import AlteracaoLote from '@/pages/AlteracaoLote';
import RelatorioCST from '@/pages/RelatorioCST';
import ExportarXmlPorIE from '@/pages/ExportarXmlPorIE';
import DashboardApuracao from '@/pages/DashboardApuracao';
import EntradaDifal from '@/pages/EntradaDifal';
import { BKProvider } from '@/context/BKContext';
import BKShell from '@/components/shared/BKShell';
import BKImport from '@/pages/BKImport';
import BKDocuments from '@/pages/BKDocuments';
import BKConfigPage from '@/pages/BKConfig';

function App() {
  return (
    <ModuleProvider>
      <BKProvider>
        <div className="min-h-screen bg-[#0f172a]">
          <Navbar />
          <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/nota-unica" element={<NotaUnica />} />
            <Route path="/resumo-cclass" element={<ResumoCClass />} />
            <Route path="/resumo-imposto" element={<ResumoImposto />} />
            <Route path="/alteracao-lote" element={<AlteracaoLote />} />
            <Route path="/relatorio-cst" element={<RelatorioCST />} />
            <Route path="/apuracao" element={<DashboardApuracao />} />
            <Route path="/apuracao/dashboard" element={<DashboardApuracao />} />
            <Route path="/apuracao/difal" element={<EntradaDifal />} />
            <Route path="/nfe/exportar-xml-por-ie" element={<ExportarXmlPorIE />} />
            <Route path="/nfce/exportar-xml-por-ie" element={<ExportarXmlPorIE />} />
            <Route path="/bk" element={<BKShell />}>
              <Route index element={<BKImport />} />
              <Route path="importacao" element={<BKImport />} />
              <Route path=":category" element={<BKDocuments />} />
              <Route path="configuracao" element={<BKConfigPage />} />
            </Route>
          </Routes>
          </main>
        </div>
      </BKProvider>
    </ModuleProvider>
  );
}

export default App;
