import type { BKCFOPConfig, BKDocument, BKEvent, BKProduct, ParsedFiscalFile } from '@/types/bk';
import { parseNFE } from '@/parsers/nfeParser';

const digits = (value = '') => value.replace(/\D/g, '');
const number = (value = '') => Number(value.replace(',', '.')) || 0;
const elements = (root: Document | Element, name: string) =>
  Array.from(root.getElementsByTagName('*')).filter((el) => el.localName === name);
const first = (root: Document | Element | undefined | null, name: string) => root ? elements(root, name)[0] : undefined;
const text = (root: Document | Element | undefined | null, name: string) => first(root, name)?.textContent?.trim() || '';
const direct = (root: Element | undefined, name: string) =>
  root ? Array.from(root.children).find((el) => el.localName === name)?.textContent?.trim() || '' : '';

export function classifyCFOP(cfops: string[], config: BKCFOPConfig) {
  const normalized = cfops.map(digits);
  const match = (values: string[]) => normalized.some((cfop) => values.includes(cfop));
  if (match(config.remessa)) return 'remessa' as const;
  if (match(config.exportacao)) return 'exportacao' as const;
  if (match(config['venda-interna'])) return 'venda-interna' as const;
  if (match(config.devolucao)) return 'devolucao' as const;
  return 'outras-saidas' as const;
}

function parseAddress(node: Element | undefined, prefix: 'enderEmit' | 'enderDest') {
  const address = first(node, prefix);
  if (!address) return { address: '', city: '', uf: '' };
  return {
    address: [text(address, 'xLgr'), text(address, 'nro'), text(address, 'xBairro')].filter(Boolean).join(', '),
    city: text(address, 'xMun'),
    uf: text(address, 'UF'),
  };
}

function eventId(event: Omit<BKEvent, 'id'>) {
  return [event.eventCode, event.sequence, event.protocol, event.date].filter(Boolean).join('|');
}

function parseEvent(doc: Document, fileName: string): ParsedFiscalFile {
  const request = elements(doc, 'infEvento')[0];
  const returns = elements(doc, 'retEvento').flatMap((ret) => elements(ret, 'infEvento'));
  const response = returns[0];
  const eventCode = direct(request, 'tpEvento') || direct(response, 'tpEvento');
  const responseCode = direct(response, 'cStat');
  const cancellationByName = /cancelad|ped-can/i.test(fileName);
  const isCancellation = eventCode === '110111' || cancellationByName;
  const baseEvent: Omit<BKEvent, 'id'> = {
    type: isCancellation ? 'cancelamento' : 'outro',
    eventCode,
    date: direct(response, 'dhRegEvento') || direct(request, 'dhEvento') || new Date().toISOString(),
    sequence: direct(request, 'nSeqEvento') || direct(response, 'nSeqEvento'),
    protocol: direct(response, 'nProt') || direct(request, 'nProt'),
    sefazCode: responseCode,
    reason: direct(request, 'xJust') || direct(response, 'xMotivo') || direct(request, 'descEvento'),
    sourceFile: fileName,
  };
  return {
    kind: 'event',
    accessKey: digits(direct(request, 'chNFe') || direct(response, 'chNFe')),
    event: { ...baseEvent, id: eventId(baseEvent) },
  };
}

export function parseBKXml(xmlContent: string, fileName: string, config: BKCFOPConfig): ParsedFiscalFile {
  const doc = new DOMParser().parseFromString(xmlContent, 'application/xml');
  if (elements(doc, 'parsererror').length) throw new Error('XML inválido ou corrompido');
  if (elements(doc, 'infEvento').length) return parseEvent(doc, fileName);

  const infNFe = first(doc, 'infNFe');
  const ide = first(doc, 'ide');
  const emit = first(doc, 'emit');
  const dest = first(doc, 'dest');
  if (!infNFe || !ide || !emit) throw new Error('Arquivo não contém uma NF-e reconhecível');
  const model = text(ide, 'mod');
  if (model !== '55') throw new Error(`Documento modelo ${model || 'desconhecido'} não é NF-e modelo 55`);
  const fiscalNote = parseNFE(xmlContent);

  const products: BKProduct[] = elements(doc, 'det').map((item, index) => {
    const product = first(item, 'prod');
    const fiscal = fiscalNote.produtos[index];
    return {
      code: text(product, 'cProd'), description: text(product, 'xProd'), ncm: text(product, 'NCM'),
      cfop: digits(text(product, 'CFOP')), unit: text(product, 'uCom'), quantity: number(text(product, 'qCom')),
      unitValue: number(text(product, 'vUnCom')), totalValue: number(text(product, 'vProd')),
      cClass: fiscal?.cClass, cest: fiscal?.cest, fiscal,
    };
  });
  const cfops = [...new Set(products.map((product) => product.cfop).filter(Boolean))];
  const volumes = elements(doc, 'vol');
  const total = first(doc, 'ICMSTot');
  const protocol = first(doc, 'infProt');
  const issuerAddress = parseAddress(emit, 'enderEmit');
  const recipientAddress = parseAddress(dest, 'enderDest');
  const accessKey = digits(text(protocol, 'chNFe') || infNFe.getAttribute('Id') || '');
  const issuerTaxId = digits(text(emit, 'CNPJ') || text(emit, 'CPF'));
  const issueDate = text(ide, 'dhEmi') || text(ide, 'dEmi');
  const authorizationCode = text(protocol, 'cStat');
  const authorizationEvent: BKEvent | undefined = protocol ? {
    id: `authorization|${text(protocol, 'nProt')}|${text(protocol, 'dhRecbto')}`,
    type: 'autorizacao', date: text(protocol, 'dhRecbto') || issueDate,
    protocol: text(protocol, 'nProt'), sefazCode: authorizationCode,
    reason: text(protocol, 'xMotivo'), sourceFile: fileName,
  } : undefined;
  const numberValue = text(ide, 'nNF');
  const series = text(ide, 'serie');
  const installments = elements(doc, 'dup').map((dup) => ({
    number: text(dup, 'nDup'), dueDate: text(dup, 'dVenc'), value: number(text(dup, 'vDup')),
  }));
  const invoice = first(doc, 'fat');
  const carrier = first(doc, 'transporta');
  const complementaryId = [model, numberValue, series, issuerTaxId, issueDate.slice(0, 10)].join('|');
  const created: BKDocument = {
    id: accessKey || complementaryId,
    accessKey,
    complementaryId,
    number: numberValue,
    series,
    model,
    operationNature: text(ide, 'natOp'),
    operationType: text(ide, 'tpNF') === '0' ? 'entrada' : 'saida',
    issueDate,
    exitDate: text(ide, 'dhSaiEnt') || text(ide, 'dSaiEnt') || undefined,
    issuerName: text(emit, 'xNome'),
    issuerTaxId,
    issuerIe: text(emit, 'IE'),
    issuerAddress: issuerAddress.address,
    issuerCity: issuerAddress.city,
    issuerUf: issuerAddress.uf,
    recipientName: text(dest, 'xNome'),
    recipientTaxId: digits(text(dest, 'CNPJ') || text(dest, 'CPF')),
    recipientIe: text(dest, 'IE'),
    recipientAddress: recipientAddress.address,
    recipientCity: recipientAddress.city,
    recipientUf: recipientAddress.uf,
    unitId: '',
    cfops,
    category: classifyCFOP(cfops, config),
    products,
    references: [...new Set(elements(ide, 'refNFe').map((ref) => digits(ref.textContent || '')).filter(Boolean))],
    netWeight: volumes.reduce((sum, volume) => sum + number(text(volume, 'pesoL')), 0),
    grossWeight: volumes.reduce((sum, volume) => sum + number(text(volume, 'pesoB')), 0),
    volumeQuantity: volumes.reduce((sum, volume) => sum + number(text(volume, 'qVol')), 0),
    commercialQuantity: products.reduce((sum, product) => sum + product.quantity, 0),
    invoiceValue: number(text(total, 'vNF')),
    productsValue: number(text(total, 'vProd')),
    freightValue: number(text(total, 'vFrete')),
    insuranceValue: number(text(total, 'vSeg')),
    discountValue: number(text(total, 'vDesc')),
    icmsBase: number(text(total, 'vBC')),
    icmsValue: number(text(total, 'vICMS')),
    ipiValue: number(text(total, 'vIPI')),
    pisValue: number(text(total, 'vPIS')),
    cofinsValue: number(text(total, 'vCOFINS')),
    otherValue: number(text(total, 'vOutro')),
    authorizationProtocol: text(protocol, 'nProt'),
    authorizationDate: text(protocol, 'dhRecbto'),
    sefazCode: authorizationCode,
    sefazReason: text(protocol, 'xMotivo'),
    fiscalStatus: authorizationCode === '100' || authorizationCode === '150' ? 'autorizada' : 'pendente',
    events: authorizationEvent ? [authorizationEvent] : [],
    sourceFile: fileName,
    importedAt: new Date().toISOString(),
    additionalInfo: text(first(doc, 'infAdic'), 'infCpl'),
    carrierName: text(carrier, 'xNome'),
    carrierTaxId: digits(text(carrier, 'CNPJ') || text(carrier, 'CPF')),
    invoiceNumber: text(invoice, 'nFat'),
    originalValue: number(text(invoice, 'vOrig')),
    invoiceDiscount: number(text(invoice, 'vDesc')),
    netInvoiceValue: number(text(invoice, 'vLiq')),
    installments,
    rawXml: xmlContent,
  };
  return { kind: 'document', document: created };
}
