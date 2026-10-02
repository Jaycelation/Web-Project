'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage, browserRequest } from './api';
export function usePagedResource<T>(path: string, body: object, enabled = true, scopeKey = '') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const bodyKey = JSON.stringify(body);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) { setData(null); setError(''); setLoading(false); return; }
    let active = true;
    setLoading(true); setError(''); setData(null);
    void browserRequest<T>(path, JSON.parse(bodyKey)).then((result) => { if (active) setData(result); })
      .catch((cause) => { if (active) setError(apiErrorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, bodyKey, revision, enabled, scopeKey]);
  return { data, error, loading, reload };
}
