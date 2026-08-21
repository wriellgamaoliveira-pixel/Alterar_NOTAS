export type FiscalModule = 'nfcom' | 'nfe' | 'nfce' | 'nfse';

export interface ModuleConfig {
  id: FiscalModule;
  name: string;
  description: string;
  model: string;
  color: string;
}

export const MODULES: ModuleConfig[] = [
  { id: 'nfe', name: 'NF-e', description: 'Nota Fiscal Eletrônica', model: '55', color: '#38bdf8' },
  { id: 'nfce', name: 'NFC-e', description: 'Nota Fiscal Consumidor', model: '65', color: '#22c55e' },
  { id: 'nfcom', name: 'NFCom', description: 'Nota Fiscal de Comunicação', model: '62', color: '#8b5cf6' },
  { id: 'nfse', name: 'NFS-e', description: 'Nota Fiscal Serviços', model: '', color: '#f59e0b' },
];

export interface Produto {
  nome: string;
  ncm: string;
  cest: string;
  cfop: string;
  cClass: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  icms: ImpostoICMS;
  ipi: ImpostoIPI;
  pis: ImpostoPIS;
  cofins: ImpostoCOFINS;
}

export interface ImpostoICMS {
  cst: string;
  baseCalc: number;
  aliquota: number;
  valor: number;
  baseCalcST: number;
  valorST: number;
  percentualReducao: number;
  modalidadeBC: string;
}

export interface ImpostoIPI {
  cst: string;
  baseCalc: number;
  aliquota: number;
  valor: number;
  codEnquadramento: string;
}

export interface ImpostoPIS {
  cst: string;
  baseCalc: number;
  aliquota: number;
  valor: number;
  vAliqProd: number;
}

export interface ImpostoCOFINS {
  cst: string;
  baseCalc: number;
  aliquota: number;
  valor: number;
  vAliqProd: number;
}

export interface Emitente {
  cnpj: string;
  nome: string;
  ie: string;
  endereco: string;
  municipio: string;
  uf: string;
}

export interface Destinatario {
  cnpj?: string;
  cpf?: string;
  nome: string;
  ie?: string;
  endereco: string;
  municipio: string;
  uf: string;
}

export interface NotaFiscal {
  chave: string;
  numero: string;
  serie: string;
  modelo: string;
  dataEmissao: string;
  dataSaida?: string;
  emitente: Emitente;
  destinatario: Destinatario;
  produtos: Produto[];
  totais: Totais;
  infoAdicional?: string;
  duplicatas?: Duplicata[];
  tipoOperacao: string;
  naturezaOperacao: string;
  xmlContent?: string;
}

export interface Totais {
  baseCalcICMS: number;
  valorICMS: number;
  baseCalcICMSST: number;
  valorICMSST: number;
  valorProdutos: number;
  valorFrete: number;
  valorSeguro: number;
  valorDesconto: number;
  valorII: number;
  valorIPI: number;
  valorPIS: number;
  valorCOFINS: number;
  valorOutras: number;
  valorNota: number;
}

export interface Duplicata {
  numero: string;
  vencimento: string;
  valor: number;
}

export interface CClassSummary {
  cClass: string;
  descricao: string;
  quantidade: number;
  valorTotal: number;
  percentual: number;
  cfops: Map<string, CFOPSummary>;
}

export interface CFOPSummary {
  cfop: string;
  quantidade: number;
  valorTotal: number;
  notas: Map<string, NotaSummary>;
}

export interface NotaSummary {
  chave: string;
  numero: string;
  emitente: string;
  valorTotal: number;
  itens: ItemSummary[];
}

export interface ItemSummary {
  produto: string;
  ncm: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ImpostoSummary {
  cstICMS: string;
  cfop: string;
  descricao: string;
  baseCalc: number;
  valorICMS: number;
  valorICMSST: number;
  valorTotal: number;
  quantidade: number;
}

export interface ImpostoRetido {
  tipo: string;
  baseCalc: number;
  aliquota: number;
  valor: number;
}

export interface ProcessamentoState {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  total: number;
  current: number;
  message: string;
  error?: string;
}

export interface RelatorioCClass {
  kpis: {
    totalArquivos: number;
    valorTotal: number;
    totalItens: number;
    mediaPorNota: number;
  };
  cClassList: CClassSummary[];
  itens: ItemRelatorio[];
}

export interface ItemRelatorio {
  arquivo: string;
  chave: string;
  emitente: string;
  produto: string;
  ncm: string;
  cClass: string;
  cfop: string;
  valor: number;
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
}

export interface RelatorioImposto {
  kpis: {
    totalArquivos: number;
    valorTotal: number;
    totalICMS: number;
    totalImpostos: number;
  };
  impostos: ImpostoSummary[];
  retidos: ImpostoRetido[];
}

export interface LoteConfig {
  tipo: 'cclass' | 'descricao' | 'remover-icms' | 'remover-cclass';
  cClassOrigem?: string;
  cClassDestino?: string;
  cfopOrigem?: string;
  cfopDestino?: string;
  aliquotaICMS?: number;
  cClassAlvo?: string;
  csvMap?: Map<string, string>;
}
