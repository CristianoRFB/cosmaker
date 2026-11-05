/** Validated, no-billing, fail-closed real-tenant onboarding inputs. */
export const RESERVED_SLUGS = new Set([
  'admin','api','atelier','cliente','login','logout','cadastro','orcamento',
  'portfolio','servicos','agenda','contato','sobre','privacidade','termos','auth','health'
]);

export function parseArguments(argv) {
  const args = {};
  for (const value of argv) {
    const position = value.indexOf('=');
    if (!value.startsWith('--') || position < 3) throw new Error('Use --chave=valor.');
    const key = value.slice(2, position);
    if (Object.hasOwn(args, key)) throw new Error('Argumento duplicado: ' + key);
    args[key] = value.slice(position + 1);
  }
  return args;
}
export function validateArguments(args) {
  const accepted = new Set(['mode','project-id','name','slug','owner-uid','owner-email',
    'operator-uid','tagline','brand-color','production-apply','confirm-project',
    'confirm-slug','confirm-owner-uid']);
  if (Object.keys(args).some((key) => !accepted.has(key))) throw new Error('Parâmetro não reconhecido.');
  const mode = args.mode || 'preflight';
  if (!['preflight','apply'].includes(mode)) throw new Error('Modo inválido.');
  const projectId = String(args['project-id'] || '').trim();
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(projectId)) throw new Error('Project ID inválido.');
  const name = String(args.name || '').trim();
  if (name.length < 3 || name.length > 100 || /[\u0000-\u001f]/.test(name)) throw new Error('Nome inválido.');
  const slug = String(args.slug || '').trim();
  if (slug.length < 3 || slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      || RESERVED_SLUGS.has(slug)) throw new Error('Slug inválido ou reservado.');
  const ownerUid = String(args['owner-uid'] || '').trim();
  const operatorUid = String(args['operator-uid'] || '').trim();
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(ownerUid) || !/^[a-zA-Z0-9_-]{4,128}$/.test(operatorUid)
      || ownerUid === operatorUid) throw new Error('UIDs inválidos.');
  const email = String(args['owner-email'] || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
  const brandColor = args['brand-color'] || '#6d28d9';
  if (!/^#[0-9A-Fa-f]{6}$/.test(brandColor)) throw new Error('Cor inválida.');
  const tagline = String(args.tagline || '').trim();
  if (tagline.length > 180 || /[\u0000-\u001f]/.test(tagline)) throw new Error('Tagline inválida.');
  if (args['production-apply'] !== undefined && args['production-apply'] !== 'true')
    throw new Error('Flag de produção inválida.');
  return {mode,projectId,name,slug,ownerUid,operatorUid,email,brandColor,tagline,
    productionApply:args['production-apply']==='true',confirmProject:args['confirm-project'],
    confirmSlug:args['confirm-slug'],confirmOwnerUid:args['confirm-owner-uid']};
}
export function validateEnvironment(values, env) {
  const firestore = Boolean(env.FIRESTORE_EMULATOR_HOST);
  const auth = Boolean(env.FIREBASE_AUTH_EMULATOR_HOST);
  if (firestore !== auth) throw new Error('Auth/Firestore Emulator precisam estar ambos ligados ou ambos desligados.');
  if (firestore && !values.projectId.startsWith('demo-')) throw new Error('Emulator exige project ID demo-.');
  if (values.mode==='apply' && !firestore && !(values.productionApply
      && values.confirmProject===values.projectId && values.confirmSlug===values.slug
      && values.confirmOwnerUid===values.ownerUid)) throw new Error('Escrita real bloqueada: confirmação tripla necessária.');
  return firestore;
}
export function validateIdentities(owner,operator,operatorProfile,values) {
  if (!owner || owner.disabled || owner.emailVerified !== true || owner.email?.toLowerCase() !== values.email)
    throw new Error('Owner Auth não existe ou e-mail não foi verificado.');
  if (!operator || operator.disabled || operator.emailVerified !== true
    || operator.customClaims?.platformAdmin !== true || operatorProfile?.active !== true
    || operatorProfile?.accountType !== 'platform_admin') throw new Error('Operador sem privilégio Platform Owner validado.');
}
export function decideExisting(slugRecord,atelier,profile,values) {
  if (slugRecord) {
    if (!atelier || atelier.demoWorkspace===true || atelier.ownerId!==values.ownerUid || atelier.name!==values.name
        || profile?.accountType!=='atelier_member' || profile?.atelierId!==slugRecord.atelierId
        || profile?.active!==true) throw new Error('Slug ocupado ou dados do tenant existente inconsistentes.');
    return 'already_provisioned';
  }
  if (profile) throw new Error('UID já possui perfil; nunca converter nem sobrescrever automaticamente.');
  return 'ready';
}
