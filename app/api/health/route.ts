import { NextResponse } from 'next/server';

export async function GET() {
  const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  return NextResponse.json({ status: 'ok', firebaseConfigured }, { headers: { 'Cache-Control': 'no-store' } });
}
