'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { getMeasurementProfile, listClientMeasurementProfiles, listMeasurements } from '@/repositories/measurements.repository';
import { useAuth } from '@/providers/auth-provider';
import type { Measurement, MeasurementProfile } from '@/types/measurement';

export function useClientMeasurementProfiles() {
  const { user, firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || '';
  const verified = firebaseUser?.emailVerified === true;
  const [profiles, setProfiles] = useState<MeasurementProfile[]>([]);
  const [loadedUid, setLoadedUid] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const invalidate = useCallback(() => { revision.current++; }, []);
  const reload = useCallback(async () => {
    const current = ++revision.current;
    setProfiles([]); setLoadedUid(''); setError('');
    if (!uid || !verified || !user?.active || user.accountType !== 'client') { setLoading(false); return; }
    setLoading(true);
    try { const result = await listClientMeasurementProfiles(); if (current === revision.current) { setProfiles(result); setLoadedUid(uid); } }
    catch (reason) { if (current === revision.current) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar suas fichas.'); }
    finally { if (current === revision.current) setLoading(false); }
  }, [uid, verified, user?.active, user?.accountType]);
  useEffect(() => { void reload(); return invalidate; }, [reload, invalidate]);
  return { profiles: loadedUid === uid ? profiles : [], loading, error, reload };
}

export function useMeasurementProfile(atelierId: string, profileId: string) {
  const [profile, setProfile] = useState<MeasurementProfile | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const invalidate = useCallback(() => { revision.current++; }, []);
  const key = `${atelierId}/${profileId}`;
  const reload = useCallback(async () => {
    const current = ++revision.current;
    setProfile(null); setMeasurements([]); setLoadedKey(''); setError('');
    if (!atelierId || !profileId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [foundProfile, foundMeasurements] = await Promise.all([getMeasurementProfile(atelierId, profileId), listMeasurements(atelierId, profileId)]);
      if (current === revision.current) { setProfile(foundProfile); setMeasurements(foundMeasurements); setLoadedKey(key); }
    } catch (reason) { if (current === revision.current) { setLoadedKey(key); setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a ficha de medidas.'); } }
    finally { if (current === revision.current) setLoading(false); }
  }, [atelierId, profileId, key]);
  useEffect(() => { void reload(); return invalidate; }, [reload, invalidate]);
  return { profile: loadedKey === key ? profile : null, measurements: loadedKey === key ? measurements : [], loading, error, reload };
}
