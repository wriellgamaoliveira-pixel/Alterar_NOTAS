import { NavLink, Outlet } from 'react-router-dom';
import { FileInput, FileOutput, PackageCheck, ReceiptText, RotateCcw, Settings2, ShoppingCart } from 'lucide-react';

const links = [
  { label: 'Importação XML', path: '/bk/importacao', icon: FileInput },
  { label: 'Remessa', path: '/bk/remessa', icon: PackageCheck },
  { label: 'Exportação', path: '/bk/exportacao', icon: FileOutput },
  { label: 'Venda Interna', path: '/bk/venda-interna', icon: ShoppingCart },
  { label: 'Outras Saídas', path: '/bk/outras-saidas', icon: ReceiptText },
  { label: 'Devolução', path: '/bk/devolucao', icon: RotateCcw },
  { label: 'Configuração CFOP', path: '/bk/configuracao', icon: Settings2 },
];

export default function BKShell() {
  return <div className="mx-auto flex max-w-[1900px] gap-4 px-3 py-4 sm:px-5">
    <aside className="hidden w-56 shrink-0 self-start rounded-2xl border border-slate-700 bg-slate-900/70 p-3 lg:sticky lg:top-20 lg:block"><div className="mb-3 px-3 py-2"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">BK</p><span className="text-[10px] text-slate-600">v1.34</span></div><p className="text-sm font-bold text-white">Documentos Fiscais</p></div><nav className="space-y-1">{links.map((link) => <NavLink key={link.path} to={link.path} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><link.icon className="h-4 w-4" />{link.label}</NavLink>)}</nav></aside>
    <div className="min-w-0 flex-1"><div className="mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">{links.map((link) => <NavLink key={link.path} to={link.path} className={({ isActive }) => `shrink-0 rounded-lg border px-3 py-2 text-xs ${isActive ? 'border-sky-500/40 bg-sky-500/15 text-sky-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>{link.label}</NavLink>)}</div><Outlet /></div>
  </div>;
}
