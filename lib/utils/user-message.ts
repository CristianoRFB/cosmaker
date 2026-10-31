/** Translate transport diagnostics while preserving actionable domain messages. */
export function userMessage(message: string) {
  const diagnostic = message.trim();
  if (/^(?:functions\/)?permission-denied\b/i.test(diagnostic)) return 'Sua conta não tem permissão para esta ação.';
  if (/^(?:functions\/)?unauthenticated\b/i.test(diagnostic)) return 'Sua sessão precisa ser renovada. Entre novamente na sua conta.';
  if (!diagnostic || /^(?:(?:functions\/)?(?:internal|unavailable|deadline-exceeded)|FirebaseError:|Firebase:)/i.test(diagnostic)) return 'O serviço está indisponível no momento. Aguarde e tente novamente.';
  return message;
}
