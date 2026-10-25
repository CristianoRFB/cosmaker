import { notFound } from 'next/navigation';
import { MediaProof } from './proof';
export const dynamic = 'force-dynamic';
export default function MediaProofPage() {
  if (process.env.COSMAKER_MEDIA_PROOF !== 'true' || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-cosmaker' || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') notFound();
  return <MediaProof />;
}
