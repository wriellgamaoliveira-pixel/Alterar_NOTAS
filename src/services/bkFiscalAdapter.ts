import type { BKDocument } from '@/types/bk';
import type { NotaFiscal, Produto } from '@/types/fiscal';

const zeroProductTaxes = (document: BKDocument, index: number): Produto => {
  const product = document.products[index];
  return {
    nome: product.description,
    ncm: product.ncm || '',
    cest: product.cest || '',
    cfop: product.cfop,
    cClass: product.cClass || 'SEM_CLASS',
    unidade: product.unit || '',
    quantidade: product.quantity,
    valorUnitario: product.unitValue,
    valorTotal: product.totalValue,
    icms: { cst: '', baseCalc: 0, aliquota: 0, valor: 0, baseCalcST: 0, valorST: 0, percentualReducao: 0, modalidadeBC: '' },
    ipi: { cst: '', baseCalc: 0, aliquota: 0, valor: 0, codEnquadramento: '' },
    pis: { cst: '', baseCalc: 0, aliquota: 0, valor: 0, vAliqProd: 0 },
    cofins: { cst: '', baseCalc: 0, aliquota: 0, valor: 0, vAliqProd: 0 },
  };
};

export function bkDocumentToNotaFiscal(document: BKDocument): NotaFiscal {
  return {
    chave: document.accessKey,
    numero: document.number,
    serie: document.series,
    modelo: document.model,
    dataEmissao: document.issueDate,
    dataSaida: document.exitDate,
    emitente: { cnpj: document.issuerTaxId, nome: document.issuerName, ie: document.issuerIe || '', endereco: document.issuerAddress || '', municipio: document.issuerCity || '', uf: document.issuerUf || '' },
    destinatario: { cnpj: document.recipientTaxId?.length === 14 ? document.recipientTaxId : undefined, cpf: document.recipientTaxId?.length === 11 ? document.recipientTaxId : undefined, nome: document.recipientName, ie: document.recipientIe, endereco: document.recipientAddress || '', municipio: document.recipientCity || '', uf: document.recipientUf || '' },
    produtos: document.products.map((product, index) => product.fiscal || zeroProductTaxes(document, index)),
    totais: {
      baseCalcICMS: document.icmsBase, valorICMS: document.icmsValue, baseCalcICMSST: 0, valorICMSST: 0,
      valorProdutos: document.productsValue, valorFrete: document.freightValue, valorSeguro: document.insuranceValue,
      valorDesconto: document.discountValue, valorII: 0, valorIPI: document.ipiValue, valorPIS: document.pisValue,
      valorCOFINS: document.cofinsValue, valorOutras: document.otherValue, valorNota: document.invoiceValue,
    },
    infoAdicional: document.additionalInfo,
    duplicatas: document.installments.map((item) => ({ numero: item.number, vencimento: item.dueDate || '', valor: item.value })),
    tipoOperacao: document.operationType,
    naturezaOperacao: document.operationNature,
    xmlContent: document.rawXml,
  };
}

export const bkDocumentsToNotas = (documents: BKDocument[]) => documents.filter((document) => document.model === '55').map(bkDocumentToNotaFiscal);
