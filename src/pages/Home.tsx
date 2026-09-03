import { useNavigate } from 'react-router-dom';
import { useModule } from '@/context/ModuleContext';
import { MODULES } from '@/types/fiscal';
import {
  BarChart3,
  Receipt,
  FileText,
  Edit3,
  ArrowRight,
  FileSpreadsheet,
  Zap,
  Shield,
  BarChart4,
  FolderTree,
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { activeModule } = useModule();

  const currentModule = MODULES.find(m => m.id === activeModule);

  const cards = [
    {
      title: 'Relatório por cClass',
      description: 'Análise detalhada por classificação fiscal com gráficos e drill-down',
      icon: BarChart3,
      path: '/resumo-cclass',
      color: '#38bdf8',
      bgColor: '#38bdf815',
    },
    {
      title: 'Relatório por Imposto',
      description: 'Análise de CST ICMS, CFOP e impostos retidos',
      icon: Receipt,
      path: '/resumo-imposto',
      color: '#f59e0b',
      bgColor: '#f59e0b15',
    },
    {
      title: 'Relatório CST',
      description: activeModule === 'nfe' ? 'Relatório CST NF-e (modelo 55)' : activeModule === 'nfce' ? 'Relatório CST NFC-e (modelo 65)' : 'Relatório CST - selecione NF-e ou NFC-e',
      icon: FileText,
      path: '/relatorio-cst',
      color: '#22c55e',
      bgColor: '#22c55e15',
      disabled: activeModule !== 'nfe' && activeModule !== 'nfce',
    },

    {
      title: 'Exportar XML por IE',
      description: 'Separar XMLs por inscrição estadual (IE) e baixar em ZIP organizado',
      icon: FolderTree,
      path: `/${activeModule}/exportar-xml-por-ie`,
      color: '#a78bfa',
      bgColor: '#a78bfa15',
      visible: activeModule === 'nfe' || activeModule === 'nfce',
    },

    {
      title: 'Alteração em Lote',
      description: 'Altere XMLs em massa: cClass, CFOP, descrição e mais',
      icon: Edit3,
      path: '/alteracao-lote',
      color: '#ef4444',
      bgColor: '#ef444415',
    },
    {
      title: 'Entrada DIFAL',
      description: 'Lançamento e cálculo do diferencial de alíquota interestadual',
      icon: Receipt,
      path: '/apuracao/difal',
      color: '#a78bfa',
      bgColor: '#a78bfa15',
    },
  ];

  const features = [
    { icon: FileSpreadsheet, label: 'Processamento XML/ZIP', desc: 'Upload e parsing automatico' },
    { icon: Zap, label: 'Análise em Tempo Real', desc: 'Gráficos e KPIs instantâneos' },
    { icon: BarChart4, label: 'Exportação CSV', desc: 'Compatível com Excel e Google Sheets' },
    { icon: Shield, label: 'Processamento Local', desc: 'Seus dados não saem do navegador' },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-[#f1f5f9]">
          Portal Fiscal XML
        </h1>
        <p className="mt-2 text-[#94a3b8]">
          Módulo ativo: <span className="font-semibold" style={{ color: currentModule?.color }}>{currentModule?.name}</span> — {currentModule?.description}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {cards.filter(card => card.visible !== false).map((card, idx) => (
          <button
            key={idx}
            onClick={() => !card.disabled && navigate(card.path)}
            disabled={card.disabled}
            className={`group relative flex flex-col items-start gap-4 rounded-xl border p-6 text-left transition-all duration-300 ${
              card.disabled
                ? 'cursor-not-allowed border-[#1e293b] bg-[#1e293b]/50 opacity-50'
                : 'border-[#334155] bg-[#1e293b] hover:border-[#475569] hover:shadow-lg hover:shadow-black/20'
            }`}
          >
            <div
              className="rounded-xl p-3"
              style={{ backgroundColor: card.bgColor }}
            >
              <card.icon className="h-7 w-7" style={{ color: card.color }} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[#f1f5f9]">{card.title}</h3>
              <p className="mt-1 text-sm text-[#94a3b8]">{card.description}</p>
            </div>
            {!card.disabled && (
              <ArrowRight className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#475569] transition-all group-hover:right-4 group-hover:text-[#f1f5f9]" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-[#334155] bg-[#1e293b] p-8">
        <h2 className="mb-6 text-center text-lg font-semibold text-[#f1f5f9]">
          Funcionalidades do Sistema
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat, idx) => (
            <div key={idx} className="flex flex-col items-center text-center">
              <div className="mb-3 rounded-lg bg-[#38bdf8]/10 p-3">
                <feat.icon className="h-6 w-6 text-[#38bdf8]" />
              </div>
              <p className="text-sm font-medium text-[#f1f5f9]">{feat.label}</p>
              <p className="mt-1 text-xs text-[#94a3b8]">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[#334155] bg-[#1e293b]/50 p-6">
        <h3 className="mb-4 text-base font-semibold text-[#f1f5f9]">Módulos Fiscais Suportados</h3>
        <div className="flex flex-wrap gap-3">
          {MODULES.map(mod => (
            <div
              key={mod.id}
              className="flex items-center gap-2 rounded-lg border px-4 py-2"
              style={{
                borderColor: `${mod.color}30`,
                backgroundColor: `${mod.color}10`,
              }}
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mod.color }} />
              <span className="text-sm font-medium text-[#f1f5f9]">{mod.name}</span>
              <span className="text-xs text-[#94a3b8]">{mod.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
