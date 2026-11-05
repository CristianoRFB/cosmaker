'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ImagePlus, ShieldCheck, X } from 'lucide-react';
import { usePublicTenant } from '@/providers/public-tenant-provider';
import { firebaseConfigured } from '@/services/firebase/firebase.client';
import { capRequestSchema, toCapQuotePayload } from '@/schemas/cap-request.schema';
import { createPublicQuoteRequest, validateReferenceFiles, validateReferenceFileSignatures } from '@/repositories/quote-requests.repository';

const baseInput = 'mt-1 w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-violet-600';
const today = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function Field({ name, label, children, error, optional }: {
  name: string; label: string; children: ReactNode; error?: string; optional?: boolean;
}) {
  return <div className="grid gap-1"><label className="text-sm font-semibold text-slate-800" htmlFor={name}>
    {label}{optional ? <span className="ml-2 font-normal text-slate-500">(opcional)</span> : null}
  </label>{children}{error ? <p id={name + '-error'} className="text-sm text-red-700">{error}</p> : null}</div>;
}

export function CapRequestForm() {
  const router = useRouter();
  const { tenant, tenantSlug, status, loading } = usePublicTenant();
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const isDemo = tenant?.demoWorkspace === true;
  const enabled = !loading && firebaseConfigured && status === 'available' && tenant?.businessType === 'caps'
    && tenant.published && tenant.quoteRequestsEnabled;
  const accent = tenant?.brandColor || '#7f1d1d';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setFields({}); setSuccess('');
    if (!enabled) { setError('Esta marca ainda não está recebendo solicitações.'); return; }
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries());
    const parsed = capRequestSchema.safeParse({ ...raw, quantity: Number(raw.quantity) });
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[String(issue.path[0] || 'form')] = issue.message;
      setFields(issues);
      return;
    }
    const selectedFiles = isDemo ? [] : files;
    const issues = validateReferenceFiles(selectedFiles);
    if (issues.length) { setError(issues.map(x => x.message).join(' ')); return; }
    const signatures = await validateReferenceFileSignatures(selectedFiles);
    if (signatures.length) { setError(signatures.map(x => x.message).join(' ')); return; }
    setSubmitting(true);
    try {
      const result = await createPublicQuoteRequest(tenantSlug, toCapQuotePayload(parsed.data), selectedFiles);
      if (!result.failedFiles.length) {
        router.push('/' + encodeURIComponent(tenantSlug) + '/orcamento/sucesso?protocolo=' + encodeURIComponent(result.requestId));
        return;
      }
      setSuccess('Solicitação registrada. Alguns anexos não foram enviados. Protocolo: ' + result.requestId);
      form.reset(); setFiles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao enviar. Tente novamente.');
    } finally { setSubmitting(false); }
  }

  return <main className="min-h-[75vh] bg-[#f8f6f3] px-4 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-4xl">
      <Link className="text-sm font-semibold text-slate-700 underline underline-offset-4" href={'/' + encodeURIComponent(tenantSlug)}>
        Voltar para {tenant?.name || 'a marca'}
      </Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-red-800">Encomenda personalizada</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Conte como quer seu boné.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
        Escolha modelo, cor e descreva as artes da frente e do verso. A marca analisará os detalhes
        e enviará uma proposta; este formulário não é uma compra nem processa pagamentos.
      </p>
      {isDemo ? <p role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Ambiente demonstrativo: dados fictícios, sem pedidos comerciais, cobrança ou upload de imagens.
      </p> : null}
      {!enabled ? <p role="status" className="mt-5 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
        {loading ? 'Carregando informações da marca…' : 'O recebimento de encomendas ainda não foi habilitado.'}
      </p> : null}
      {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {success ? <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">{success}</p> : null}
      <form onSubmit={submit} noValidate className="mt-8 grid gap-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <section className="grid gap-5" aria-labelledby="cap-details">
          <h2 id="cap-details" className="text-xl font-bold text-slate-900">01 · Seu boné</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="model" label="Modelo ou referência" error={fields.model}><input className={baseInput} id="model" name="model" placeholder="Ex.: modelo autoral de aba curva" required maxLength={100} aria-describedby={fields.model ? 'model-error' : undefined}/></Field>
            <Field name="capColor" label="Cor do boné" error={fields.capColor}><input className={baseInput} id="capColor" name="capColor" placeholder="Ex.: vinho" required maxLength={60}/></Field>
          </div>
          <Field name="frontArtwork" label="Arte ou personalização da frente" error={fields.frontArtwork}><textarea className={baseInput} id="frontArtwork" name="frontArtwork" rows={3} placeholder="Descreva o desenho, bordado, texto ou referência" required maxLength={400}/></Field>
          <Field name="backArtwork" label="Arte do verso" error={fields.backArtwork} optional><textarea className={baseInput} id="backArtwork" name="backArtwork" rows={2} placeholder="Nome, frase, símbolo ou sem arte" maxLength={400}/></Field>
          <Field name="quantity" label="Quantidade" error={fields.quantity}><input className={baseInput} id="quantity" name="quantity" type="number" defaultValue="1" min="1" max="50" step="1" required/></Field>
          <p className="text-xs text-slate-600">A descrição enviada serve para orçamento, não garante disponibilidade de modelo, cor ou técnica de personalização.</p>
        </section>
        <section aria-labelledby="cap-deadline" className="grid gap-5 border-t border-slate-200 pt-6">
          <h2 id="cap-deadline" className="text-xl font-bold">02 · Prazo e referência</h2>
          <Field name="desiredDeliveryDate" label="Data desejada" error={fields.desiredDeliveryDate}><input className={baseInput} id="desiredDeliveryDate" name="desiredDeliveryDate" type="date" min={today()} required/></Field>
          <Field name="urgency" label="Urgência" error={fields.urgency}><select className={baseInput} id="urgency" name="urgency" defaultValue="normal"><option value="normal">Prazo regular</option><option value="urgent">Prazo próximo</option></select></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="budgetMin" label="Orçamento mínimo (R$)" optional error={fields.budgetMin}><input className={baseInput} id="budgetMin" name="budgetMin" min="0" step="0.01" type="number"/></Field>
            <Field name="budgetMax" label="Orçamento máximo (R$)" optional error={fields.budgetMax}><input className={baseInput} id="budgetMax" name="budgetMax" min="0" step="0.01" type="number"/></Field>
          </div>
          <Field name="observations" label="Outros detalhes" optional error={fields.observations}><textarea className={baseInput} id="observations" name="observations" rows={3} maxLength={1000} placeholder="Técnica desejada, materiais ou outras preferências"/></Field>
          {!isDemo ? <Field name="referenceFiles" label="Imagens de referência" optional>
            <label htmlFor="referenceFiles" className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-400 bg-slate-50 px-3 text-sm text-slate-700"><ImagePlus size={20}/>Selecionar até cinco imagens (10 MB por arquivo)</label>
            <input className="sr-only" id="referenceFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              setFiles(selected);
              const issues = validateReferenceFiles(selected);
              setError(issues.map(x => x.message).join(' '));
            }}/>
            {files.length > 0 ? <ul className="grid gap-2 text-sm">{files.map((file,index)=><li className="flex justify-between gap-2 rounded-lg bg-slate-50 p-2" key={index}>
              <span className="truncate">{file.name}</span><button type="button" aria-label={'Remover ' + file.name} onClick={()=>setFiles(value=>value.filter((_,i)=>i!==index))}><X size={16}/></button>
            </li>)}</ul> : null}
          </Field> : null}
        </section>
        <section aria-labelledby="cap-contact" className="grid gap-5 border-t border-slate-200 pt-6">
          <h2 id="cap-contact" className="text-xl font-bold">03 · Contato</h2>
          <Field name="name" label="Seu nome" error={fields.name}><input className={baseInput} id="name" name="name" autoComplete="name" required maxLength={100}/></Field>
          <Field name="email" label="Seu e-mail" error={fields.email}><input className={baseInput} id="email" name="email" type="email" autoComplete="email" required/></Field>
          <Field name="phone" label="Telefone ou WhatsApp" optional error={fields.phone}><input className={baseInput} id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30}/></Field>
        </section>
        <div className="border-t border-slate-200 pt-6">
          <button disabled={!enabled || submitting} style={{ backgroundColor: accent }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" type="submit">
            {submitting ? 'Enviando…' : 'Enviar solicitação de orçamento'}<ArrowRight size={17}/>
          </button>
          <p className="mt-3 flex gap-2 text-xs leading-5 text-slate-600"><ShieldCheck size={16} className="shrink-0"/>Seus dados serão usados para avaliar a solicitação pela marca selecionada. Nenhuma compra será concluída automaticamente.</p>
        </div>
      </form>
    </div>
  </main>;
}
