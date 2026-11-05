/** Strict server-side cap-customization contract; never trusts tenant identity from the browser. */
export interface CapCustomization {
  model: string;
  capColor: string;
  frontArtwork: string;
  backArtwork?: string;
  quantity: number;
}

function textField(value: unknown, label: string, min: number, max: number, optional = false): string | undefined {
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} inválido.`);
  const text = value.trim();
  if (text.length < min || text.length > max || /[\u0000-\u001f]/.test(text)) throw new Error(`${label} inválido.`);
  return text;
}

export function parseCapCustomization(value: unknown): CapCustomization {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Personalização do boné ausente.');
  const data = value as Record<string, unknown>;
  const keys = ['model', 'capColor', 'frontArtwork', 'backArtwork', 'quantity'];
  if (Object.keys(data).some((key) => !keys.includes(key))) throw new Error('Personalização contém campos não permitidos.');
  const quantity = data.quantity;
  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50) {
    throw new Error('Quantidade de bonés inválida.');
  }
  const backArtwork = textField(data.backArtwork, 'Arte traseira', 2, 400, true);
  return {
    model: textField(data.model, 'Modelo', 2, 100)!,
    capColor: textField(data.capColor, 'Cor', 2, 60)!,
    frontArtwork: textField(data.frontArtwork, 'Arte frontal', 3, 400)!,
    ...(backArtwork ? { backArtwork } : {}),
    quantity,
  };
}

export function describeCapCustomization(cap: CapCustomization): string {
  return [
    'Boné personalizado.',
    `Modelo: ${cap.model}.`,
    `Cor: ${cap.capColor}.`,
    `Frente: ${cap.frontArtwork}.`,
    ...(cap.backArtwork ? [`Verso: ${cap.backArtwork}.`] : []),
    `Quantidade: ${cap.quantity}.`,
  ].join(' ');
}

/** Allow custom caps only on explicit cap-brand tenants, leaving legacy cosplay unchanged. */
export function categoryMatchesBusinessType(category: string, businessType: 'cosmaker' | 'caps'): boolean {
  return category === 'custom_cap' ? businessType === 'caps' : businessType === 'cosmaker';
}
