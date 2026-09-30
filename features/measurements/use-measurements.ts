'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMeasurementProfile, listClientMeasurementProfiles, listMeasurements } from '@/repositories/measurements.repository';
import { useAuth } from '@/providers/auth-provider';
import type { Measurement, MeasurementProfile } from '@/types/measurement';

export function useClientMeasurementProfiles() {
  const { user, firebaseUser } = useAuth();
  const [profiles, setProfiles] = useState<MeasurementProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!user?.id || firebaseUser?.emailVerified !== true) { setProfiles([]); setLoading(false); return; }
    setLoading(true); setError('');
    try { setProfiles(await listClientMeasurementProfiles(user.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar suas fichas.'); }
    finally { setLoading(false); }
  }, [user?.id, firebaseUser?.emailVerified]);
  useEffect(() => { void reload(); }, [reload]);
  return { profiles, loading, error, reload };
}

export function useMeasurementProfile(atelierId: string, profileId: string) {
  const [profile, setProfile] = useState<MeasurementProfile | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!atelierId || !profileId) { setProfile(null); setMeasurements([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [foundProfile, foundMeasurements] = await Promise.all([
        getMeasurementProfile(atelierId, profileId),
        listMeasurements(atelierId, profileId),
      ]);
      setProfile(foundProfile); setMeasurements(foundMeasurements);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a ficha de medidas.'); }
    finally { setLoading(false); }
  }, [atelierId, profileId]);
  useEffect(() => { void reload(); }, [reload]);
  return { profile, measurements, loading, error, reload };
}
