import { NextResponse } from 'next/server';

export function integrationUnavailable(name: string) {
  return NextResponse.json({
    error: 'integration_not_configured',
    message: `A integração de ${name} ainda não está configurada neste ambiente.`,
  }, { status: 503 });
}
