'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, CheckCircle2, ImagePlus, Info, Sparkles, X } from 'lucide-react';
import { quoteRequestSchema } from '@/schemas/quote-request.schema';
import { createPublicQuoteRequest, validateReferenceFiles, validateReferenceFileSignatures, type ReferenceUploadIssue } from '@/repositories/quote-requests.repository';
import { firebaseConfigured } from '@/services/firebase/firebase.client';
import { usePublicTenant } from '@/providers/public-tenant-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

const maxFiles = 5;
const today = new Date();
const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

export default function QuoteRequestPage() {
  const router = useRouter();
  const { tenantSlug, tenant, status: tenantStatus, loading: tenantLoading } = usePublicTenant();
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fileIssues, setFileIssues] = useState<ReferenceUploadIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const configured = firebaseConfigured && Boolean(tenant?.quoteRequestsEnabled);
  const setupMessage = !firebaseConfigured
    ? 'O Firebase ainda não está configurado neste ambiente. Defina as variáveis NEXT_PUBLIC_FIREBASE_* para conectar o formulário.'
    : tenantLoading
      ? 'Carregando a configuração pública do ateliê…'
      : tenantStatus === 'suspended'
        ? 'Este ateliê está temporariamente suspenso e não pode receber novas solicitações.'
        : tenantStatus === 'not_found' || tenantStatus === 'invalid_slug'
          ? 'Não encontramos um ateliê publicado com este endereço.'
          : !tenant?.quoteRequestsEnabled
            ? 'Este ateliê não está recebendo solicitações de orçamento no momento.'
      : '';

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    setFileIssues(validateReferenceFiles(next));
  }

  function removeFile(index: number) {
    const next = files.filter((_, fileIndex) => fileIndex !== index);
    setFiles(next);
    setFileIssues(validateReferenceFiles(next));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(''); setSuccess(''); setFieldErrors({});
    if (!configured) {
      setError(setupMessage || 'O envio ainda não está disponível neste ambiente.');
      return;
    }
    const parsed = quoteRequestSchema.safeParse(Object.fromEntries(new FormData(form).entries()));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setFieldErrors(next);
      return;
    }
    const issues = validateReferenceFiles(files);
    setFileIssues(issues);
    if (issues.length > 0) return;
    const signatureIssues = await validateReferenceFileSignatures(files);
    setFileIssues(signatureIssues);
    if (signatureIssues.length > 0) return;

    setPending(true);
    try {
      const result = await createPublicQuoteRequest(tenantSlug, parsed.data, files);
      if (result.failedFiles.length === 0) {
        router.push(`/${encodeURIComponent(tenantSlug)}/orcamento/sucesso?protocolo=${encodeURIComponent(result.requestId)}`);
        return;
      }
      setSuccess(`Sua solicitação foi registrada, mas não foi possível anexar: ${result.failedFiles.join(', ')}. Entre em contato com o ateliê para enviar essas referências. Protocolo: ${result.requestId}`);
      form.reset();
      setFiles([]);
      setFileIssues([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar sua solicitação. Tente novamente.');
    } finally {
      setPending(false);
    }
  }

  return <main className="bg-[linear-gradient(180deg,#f8f4ff_0%,#fcfbff_340px)]">
    <section className="mx-auto max-w-7xl px-5 pb-6 pt-12 sm:px-8 sm:pt-16">
      <div className="max-w-3xl"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.17em] text-violet-700"><Sparkles size={14} />{tenant?.name ? `Solicitação para ${tenant.name}` : 'Vamos conversar sobre seu projeto'}</p><h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">Solicite um <span className="bg-gradient-to-r from-violet-700 to-pink-500 bg-clip-text text-transparent">orçamento</span></h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Compartilhe os detalhes do cosplay, as referências e o prazo que você tem em mente. {tenant?.name ? `${tenant.name} usará essas informações para analisar a solicitação.` : 'O ateliê usará essas informações para analisar a solicitação.'}</p></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
        <Card className="p-5 sm:p-8">
          {!configured ? <div className="mb-7 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><Info className="mt-0.5 shrink-0" size={18} /><p>{setupMessage} O envio continuará protegido pelas regras do Firebase e só funcionará para um ateliê com captação pública habilitada.</p></div> : null}
          {success ? <div className="mb-7 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900" role="status"><CheckCircle2 className="mt-0.5 shrink-0" size={19} /><p>{success}</p></div> : null}
          {error ? <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p> : null}
          <form className="grid gap-8" noValidate onSubmit={submit}>
            <section aria-labelledby="project-heading" className="grid gap-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">01 · Projeto</p><h2 className="mt-1 text-xl font-semibold" id="project-heading">O que você gostaria de criar?</h2></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Personagem" name="character" error={fieldErrors.character} placeholder="Ex.: Miku Hatsune" /><Field label="Obra ou franquia" name="franchise" error={fieldErrors.franchise} placeholder="Ex.: Vocaloid" /></div>
              <Field label="Categoria do projeto" name="category" error={fieldErrors.category}><Select defaultValue="" id="category" name="category"><option disabled value="">Selecione uma categoria</option><option value="full_cosplay">Cosplay completo</option><option value="wig">Peruca</option><option value="armor">Armadura</option><option value="prop">Prop ou acessório</option><option value="accessory">Acessório</option><option value="other">Outro</option></Select></Field>
              <Field label="Descreva sua ideia" name="description" error={fieldErrors.description} hint="Inclua versões do personagem, materiais ou detalhes que não podem faltar."><Textarea id="description" maxLength={2000} name="description" placeholder="Conte como você imagina o projeto e quais detalhes são importantes…" /></Field>
            </section>

            <section aria-labelledby="reference-heading" className="grid gap-4 border-t border-slate-100 pt-7">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">02 · Referências</p><h2 className="mt-1 text-xl font-semibold" id="reference-heading">Imagens que ajudam a explicar</h2><p className="mt-1 text-sm text-slate-600">Até {maxFiles} imagens JPEG, PNG ou WebP, com até 10 MB cada.</p></div>
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 px-4 py-6 text-center transition hover:bg-violet-50" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}><ImagePlus className="text-violet-700" size={24} /><span className="mt-2 text-sm font-semibold text-slate-800">Selecionar imagens</span><span className="mt-1 text-xs text-slate-500">ou arraste os arquivos até aqui</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ''; }} type="file" /></label>
              {files.length ? <ul className="grid gap-2">{files.map((file, index) => <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm" key={`${file.name}-${index}`}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-violet-700"><ImagePlus size={15} /></span><span className="min-w-0 flex-1 truncate">{file.name}<span className="ml-2 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span></span><button aria-label={`Remover ${file.name}`} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-rose-600" onClick={() => removeFile(index)} type="button"><X size={16} /></button></li>)}</ul> : null}
              {fileIssues.length ? <ul className="grid gap-1 text-xs text-rose-700" role="alert">{fileIssues.map((issue, index) => <li key={`${issue.fileName}-${index}`}>{issue.fileName ? `${issue.fileName}: ` : ''}{issue.message}</li>)}</ul> : null}
            </section>

            <section aria-labelledby="schedule-heading" className="grid gap-5 border-t border-slate-100 pt-7">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">03 · Prazo e investimento</p><h2 className="mt-1 text-xl font-semibold" id="schedule-heading">Quando você precisa do projeto?</h2></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Data de entrega desejada" name="desiredDeliveryDate" error={fieldErrors.desiredDeliveryDate}><Input id="desiredDeliveryDate" min={localToday} name="desiredDeliveryDate" type="date" /></Field><Field label="Data do evento" name="eventDate" error={fieldErrors.eventDate} hint="Opcional"><Input id="eventDate" min={localToday} name="eventDate" type="date" /></Field></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Investimento mínimo" name="budgetMin" error={fieldErrors.budgetMin} hint="Opcional"><Input id="budgetMin" min="0" name="budgetMin" placeholder="R$ 0,00" type="number" /></Field><Field label="Investimento máximo" name="budgetMax" error={fieldErrors.budgetMax} hint="Opcional"><Input id="budgetMax" min="0" name="budgetMax" placeholder="R$ 0,00" type="number" /></Field></div>
              <Field label="Urgência" name="urgency" error={fieldErrors.urgency}><Select defaultValue="normal" id="urgency" name="urgency"><option value="normal">Prazo regular</option><option value="urgent">Tenho um prazo próximo</option></Select></Field>
              <Field label="Observações" name="observations" error={fieldErrors.observations} hint="Opcional"><Textarea id="observations" maxLength={1000} name="observations" placeholder="Alguma informação adicional para o ateliê?" /></Field>
            </section>

            <section aria-labelledby="contact-heading" className="grid gap-5 border-t border-slate-100 pt-7">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">04 · Contato</p><h2 className="mt-1 text-xl font-semibold" id="contact-heading">Como o ateliê pode falar com você?</h2></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Seu nome" name="name" error={fieldErrors.name} autoComplete="name" placeholder="Nome completo" /><Field label="E-mail" name="email" error={fieldErrors.email} autoComplete="email" placeholder="voce@exemplo.com" type="email" /></div>
              <Field label="Telefone ou WhatsApp" name="phone" error={fieldErrors.phone} hint="Opcional"><Input autoComplete="tel" id="phone" name="phone" placeholder="(11) 99999-9999" type="tel" /></Field>
            </section>

            <div className="border-t border-slate-100 pt-6"><Button className="w-full sm:w-auto" disabled={pending || !configured} type="submit">{pending ? 'Enviando solicitação…' : 'Enviar solicitação'}{!pending ? <ArrowRight size={17} /> : null}</Button><p className="mt-3 text-xs leading-5 text-slate-500">Ao enviar, suas informações serão compartilhadas com o ateliê selecionado para análise do projeto.</p></div>
          </form>
        </Card>

        <aside className="grid content-start gap-4">
          <Card className="overflow-hidden p-5"><span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><CalendarDays size={18} /></span><h2 className="mt-4 font-semibold">O que acontece depois?</h2><ol className="mt-4 grid gap-4">{[{title:'Análise',detail:'O ateliê confere referências, categoria e prazo.'},{title:'Alinhamento',detail:'Se faltar algum detalhe, o ateliê falará com você.'},{title:'Orçamento',detail:'Você recebe uma proposta para avaliar antes de confirmar.'}].map((step,index)=><li className="flex gap-3" key={step.title}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-50 text-xs font-bold text-violet-700">{index+1}</span><span><span className="block text-sm font-semibold">{step.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{step.detail}</span></span></li>)}</ol></Card>
          <Card className="bg-gradient-to-br from-violet-800 to-fuchsia-700 p-5 text-white"><Sparkles size={20} /><h2 className="mt-3 font-semibold">Cada detalhe ajuda</h2><p className="mt-2 text-sm leading-6 text-violet-100">Referências visuais, datas e observações ajudam {tenant?.name ?? 'o ateliê'} a entender o que você está imaginando.</p><Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white" href={`/${encodeURIComponent(tenantSlug)}`}>Voltar ao ateliê<ArrowRight size={15} /></Link></Card>
        </aside>
      </div>
    </section>
  </main>;
}

function Field({ label, name, error, hint, children, ...inputProps }: { label: string; name: string; error?: string; hint?: string; children?: ReactNode; autoComplete?: string; placeholder?: string; type?: string }) {
  return <div className="grid gap-1.5"><label className="flex items-baseline justify-between text-sm font-semibold text-slate-700" htmlFor={name}>{label}{hint ? <span className="text-xs font-normal text-slate-400">{hint}</span> : null}</label>{children ?? <Input id={name} name={name} {...inputProps} />}{error ? <p className="text-xs text-rose-700" id={`${name}-error`}>{error}</p> : null}</div>;
}
