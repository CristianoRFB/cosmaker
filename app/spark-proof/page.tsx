import { notFound } from 'next/navigation';
import { SparkProof } from './proof';
export const dynamic = 'force-dynamic';
export default function SparkProofPage() {
  if (process.env.COSMAKER_SPARK_PROOF !== 'true' || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-cosmaker'
    || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') notFound();
  return <SparkProof />;
}
