import { useNavigate, useLocation } from 'react-router-dom';
import { useModule } from '@/context/ModuleContext';
import { MODULES, type FiscalModule } from '@/types/fiscal';
import {
  Home,
  FileText,
  BarChart3,
  Receipt,
  Edit3,
  FileSpreadsheet,
  FolderTree,
  Landmark,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navLinks = [
  { label: 'Início', path: '/', icon: Home },
  { label: 'Nota Única', path: '/nota-unica', icon: FileText },
  { label: 'cClass', path: '/resumo-cclass', icon: BarChart3 },
  { label: 'Imposto', path: '/resumo-imposto', icon: Receipt },
  { label: 'Alteração Lote', path: '/alteracao-lote', icon: Edit3 },
  { label: 'Apuração', path: '/apuracao/dashboard', icon: BarChart3 },
];



export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeModule, setActiveModule } = useModule();

  const currentModule = MODULES.find(m => m.id === activeModule);

  return (
    <nav className="sticky top-0 z-50 border-b border-[#334155] bg-[#0f172a]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1900px] flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => navigate('/')}
          >
            <FileSpreadsheet className="h-7 w-7 text-[#38bdf8]" />
            <span className="text-lg font-semibold text-[#f1f5f9]">
              Portal Fiscal XML
            </span>
          </div>
          <div
            className="ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${currentModule?.color}20`,
              color: currentModule?.color,
              border: `1px solid ${currentModule?.color}40`,
            }}
          >
            {currentModule?.name}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/bk/importacao')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${location.pathname.startsWith('/bk') ? 'bg-sky-500/15 text-sky-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
          >
            <Landmark className="h-4 w-4" /><span>BK Documentos</span>
          </button>
          {navLinks.map(link => {
            const isActive = location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#38bdf8]/10 text-[#38bdf8]'
                    : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-[#f1f5f9]'
                }`}
              >
                <link.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{link.label}</span>
              </button>
            );
          })}

          {(activeModule === 'nfe' || activeModule === 'nfce') && (
            <button
              onClick={() => navigate(`/${activeModule}/exportar-xml-por-ie`)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                location.pathname === `/${activeModule}/exportar-xml-por-ie`
                  ? 'bg-[#a78bfa]/20 text-[#c4b5fd]'
                  : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-[#f1f5f9]'
              }`}
            >
              <FolderTree className="h-4 w-4" />
              <span className="hidden lg:inline">Exportar XML</span>
            </button>
          )}

          <div className="ml-3 border-l border-[#334155] pl-3">
            <Select value={activeModule} onValueChange={(v) => setActiveModule(v as FiscalModule)}>
              <SelectTrigger className="h-9 w-[140px] border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#334155] bg-[#1e293b]">
                {MODULES.map(mod => (
                  <SelectItem
                    key={mod.id}
                    value={mod.id}
                    className="text-[#f1f5f9] focus:bg-[#334155] focus:text-[#f1f5f9]"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: mod.color }}
                      />
                      {mod.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </nav>
  );
}
