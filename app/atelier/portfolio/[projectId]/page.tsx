'use client';
import { useParams } from 'next/navigation';
import { ShowcaseAdmin } from '@/components/portfolio/showcase-admin';
export default function PortfolioDetailPage() { const { projectId } = useParams<{ projectId: string }>(); return <ShowcaseAdmin section="portfolio" selectedId={projectId} />; }
