'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MeasurementProfileEditor } from '@/components/medidas/measurement-profile-editor';
export default function ClientMeasurementProfilePage() {
  const { profileId } = useParams<{ profileId: string }>();
  const [atelierId, setAtelierId] = useState('');
  useEffect(() => { setAtelierId(new URLSearchParams(window.location.search).get('atelierId') || ''); }, []);
  return <MeasurementProfileEditor key={`${atelierId}/${profileId}`} atelierId={atelierId} profileId={profileId} />;
}
