-- Formato del codice tessera fedeltà (es. "QR_CODE", "CODE_128", "EAN_13"),
-- rilevato dalla fotocamera al momento della scansione: serve per
-- rigenerare la tessera a schermo nello stesso formato da mostrare in
-- negozio (QR code vs barcode lineare hanno una resa grafica diversa).
ALTER TABLE public.stores ADD COLUMN loyalty_card_format VARCHAR(30);
