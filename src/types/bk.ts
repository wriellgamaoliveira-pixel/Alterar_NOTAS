export type BKCategory = 'remessa' | 'exportacao' | 'venda-interna' | 'outras-saidas' | 'devolucao';

export type FiscalStatus = 'autorizada' | 'cancelada' | 'pendente';

export interface BKUnit {
  id: string;
  uf: string;
  cidade: string;
  cnpj: string;
  nome: string;
}

export interface BKEvent {
  id: string;
  type: 'autorizacao' | 'cancelamento' | 'outro';
  eventCode?: string;
  date: string;
  sequence?: string;
  protocol?: string;
  sefazCode?: string;
  reason?: string;
  sourceFile: string;
}

export interface BKProduct {
  code?: string;
  description: string;
  ncm?: string;
  cfop: string;
  unit?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  cClass?: string;
  cest?: string;
  fiscal?: import('@/types/fiscal').Produto;
}

export interface BKInstallment {
  number: string;
  dueDate?: string;
  value: number;
}

export interface BKDocument {
  id: string;
  accessKey: string;
  complementaryId: string;
  number: string;
  series: string;
  model: string;
  operationNature: string;
  operationType: 'entrada' | 'saida';
  issueDate: string;
  exitDate?: string;
  issuerName: string;
  issuerTaxId: string;
  issuerIe?: string;
  issuerAddress?: string;
  issuerCity?: string;
  issuerUf?: string;
  recipientName: string;
  recipientTaxId?: string;
  recipientIe?: string;
  recipientAddress?: string;
  recipientCity?: string;
  recipientUf?: string;
  unitId: string;
  cfops: string[];
  category: BKCategory;
  products: BKProduct[];
  references: string[];
  netWeight: number;
  grossWeight: number;
  volumeQuantity: number;
  commercialQuantity: number;
  invoiceValue: number;
  productsValue: number;
  freightValue: number;
  insuranceValue: number;
  discountValue: number;
  icmsBase: number;
  icmsValue: number;
  ipiValue: number;
  pisValue: number;
  cofinsValue: number;
  otherValue: number;
  authorizationProtocol?: string;
  authorizationDate?: string;
  sefazCode?: string;
  sefazReason?: string;
  fiscalStatus: FiscalStatus;
  events: BKEvent[];
  sourceFile: string;
  importedAt: string;
  additionalInfo?: string;
  carrierName?: string;
  carrierTaxId?: string;
  invoiceNumber?: string;
  originalValue?: number;
  invoiceDiscount?: number;
  netInvoiceValue?: number;
  installments: BKInstallment[];
  shipmentId?: string;
  manual?: boolean;
  rawXml?: string;
}

export interface ParsedEvent {
  kind: 'event';
  accessKey: string;
  event: BKEvent;
}

export interface ParsedDocument {
  kind: 'document';
  document: BKDocument;
}

export type ParsedFiscalFile = ParsedEvent | ParsedDocument;

export interface BKPreviewItem {
  id: string;
  fileName: string;
  parsed?: ParsedFiscalFile;
  result: 'pronta' | 'atualizar' | 'incluido' | 'registrado' | 'inconsistencia' | 'fora-periodo';
  message: string;
}

export interface BKCFOPConfig {
  remessa: string[];
  exportacao: string[];
  'venda-interna': string[];
  devolucao: string[];
}

export interface BKStoredState {
  version: 1;
  documents: BKDocument[];
  config: BKCFOPConfig;
  units: BKUnit[];
  deadlineDays: number;
  warningDays: number;
  folderName?: string;
  autoSyncMinutes: number;
  lastSync?: string;
  knownFiles: Record<string, string>;
}

export interface BKSyncResult {
  ok: boolean;
  message: string;
  analyzed: number;
  imported: number;
  updated: number;
  ignored: number;
}

export const CATEGORY_LABELS: Record<BKCategory, string> = {
  remessa: 'Remessa',
  exportacao: 'Exportação',
  'venda-interna': 'Venda Interna',
  'outras-saidas': 'Outras Saídas',
  devolucao: 'Devolução',
};

export const DEFAULT_UNITS: BKUnit[] = [
  { id: 'filial-4', uf: 'PA', cidade: 'Tailândia', cnpj: '35515657000419', nome: 'Filial 4' },
  { id: 'matriz-1', uf: 'PR', cidade: 'Curitiba', cnpj: '35515657000176', nome: 'Matriz 1' },
  { id: 'filial-2', uf: 'MT', cidade: 'Canarana', cnpj: '35515657000257', nome: 'Filial 2' },
  { id: 'filial-5', uf: 'TO', cidade: 'Paraíso do Tocantins', cnpj: '35515657000508', nome: 'Filial 5' },
];

export const DEFAULT_CFOP_CONFIG: BKCFOPConfig = {
  remessa: ['5501', '5502', '5504', '5505', '6501', '6502', '6504', '6505'],
  exportacao: ['7101', '7102', '7105', '7106', '7127', '7501', '7504'],
  'venda-interna': ['5101', '5102', '6101', '6102'],
  devolucao: ['1201', '1202', '2201', '2202', '5201', '5202', '6201', '6202'],
};
