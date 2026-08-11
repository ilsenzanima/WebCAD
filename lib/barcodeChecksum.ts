/**
 * Verifica la cifra di controllo di un codice a barre EAN-8/UPC-A/EAN-13/GTIN-14.
 * Stesso algoritmo per tutte le lunghezze: partendo dalla cifra piu' a destra
 * (esclusa quella di controllo) si alternano i pesi 3 e 1.
 * Formati non numerici o di lunghezza diversa (es. QR, Code128 alfanumerico)
 * non vengono validati: si assume siano corretti.
 */
export function isValidBarcodeChecksum(code: string): boolean {
  if (!/^\d+$/.test(code)) return true;
  if (![8, 12, 13, 14].includes(code.length)) return true;

  const checkDigit = Number(code[code.length - 1]);
  const body = code.slice(0, -1);

  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }

  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}
