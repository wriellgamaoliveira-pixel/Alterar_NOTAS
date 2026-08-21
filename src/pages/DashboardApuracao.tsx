import { useMemo } from 'react';
import { useBK } from '@/context/BKContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DashboardApuracao() {
  const { documents } = useBK();
  const rows = useMemo(() => {
    const grouped = new Map<string, { company: string; period: string; invoices: number; outputs: number; products: number; icms: number; ipi: number; pis: number; cofins: number; other: number }>();
    documents.filter((document) => document.fiscalStatus !== 'cancelada').forEach((document) => {
      const month = document.issueDate.slice(0, 7);
      const key = `${document.issuerTaxId}|${month}`;
      const current = grouped.get(key) || { company: document.issuerName, period: month, invoices: 0, outputs: 0, products: 0, icms: 0, ipi: 0, pis: 0, cofins: 0, other: 0 };
      current.invoices += 1; current.outputs += document.invoiceValue; current.products += document.productsValue;
      current.icms += document.icmsValue; current.ipi += document.ipiValue; current.pis += document.pisValue;
      current.cofins += document.cofinsValue; current.other += document.otherValue;
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => b.period.localeCompare(a.period) || a.company.localeCompare(b.company));
  }, [documents]);

  return <div className="space-y-6 p-6">
    <div><h1 className="text-2xl font-bold">Dashboard de Apuração</h1><p className="text-sm text-slate-400">Calculado automaticamente com as NF-e da base central; notas canceladas são desconsideradas.</p></div>
    <Card><CardHeader><CardTitle>Resultado da Apuração</CardTitle></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Competência</TableHead><TableHead>Notas</TableHead><TableHead>Saídas</TableHead><TableHead>Produtos</TableHead><TableHead>ICMS</TableHead><TableHead>IPI</TableHead><TableHead>PIS</TableHead><TableHead>COFINS</TableHead><TableHead>Outros</TableHead></TableRow></TableHeader>
      <TableBody>{rows.length ? rows.map((row) => <TableRow key={`${row.company}-${row.period}`}><TableCell>{row.company}</TableCell><TableCell>{row.period ? `${row.period.slice(5, 7)}/${row.period.slice(0, 4)}` : '—'}</TableCell><TableCell>{row.invoices}</TableCell><TableCell>{money(row.outputs)}</TableCell><TableCell>{money(row.products)}</TableCell><TableCell>{money(row.icms)}</TableCell><TableCell>{money(row.ipi)}</TableCell><TableCell>{money(row.pis)}</TableCell><TableCell>{money(row.cofins)}</TableCell><TableCell>{money(row.other)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={10} className="py-10 text-center text-slate-400">Importe as NF-e uma única vez no BK para preencher a apuração.</TableCell></TableRow>}</TableBody></Table>
    </CardContent></Card>
  </div>;
}
