import { expect, test } from 'vitest';
import { userMessage } from '@/lib/utils/user-message';
test('erro interno oferece uma orientação legível', () => { expect(userMessage('internal [0]')).toBe('O serviço está indisponível no momento. Aguarde e tente novamente.'); });
test('preserva mensagem de negócio que explica uma correção', () => { expect(userMessage('Informe o motivo da alteração.')).toBe('Informe o motivo da alteração.'); });
test('traduz sessão e permissão sem expor códigos internos', () => {
  expect(userMessage('functions/permission-denied')).toBe('Sua conta não tem permissão para esta ação.');
  expect(userMessage('functions/unauthenticated')).toBe('Sua sessão precisa ser renovada. Entre novamente na sua conta.');
});
