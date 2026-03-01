import { useState, useEffect, useRef } from 'react';
import { fetchTWSELive } from '../utils/twseLive';

const useTWSELive = (ticker) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!ticker) { setData(null); setError(null); return; }

    const load = () =>
      fetchTWSELive(ticker)
        .then((d) => { setData(d); setError(null); })
        .catch((e) => setError(e.message));

    load();
    timerRef.current = setInterval(load, 5000);
    return () => clearInterval(timerRef.current);
  }, [ticker]);

  return { data, error };
};

export default useTWSELive;
