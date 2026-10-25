import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAbrirAlarma } from '@/lib/alarma';
import { buildEstado, cuentaCambio, revisar, sincronizar, useAvisos } from '@/lib/avisos';
import { useAccount } from '@/lib/comunidad';
import { Book, getBooks } from '@/lib/data';
import { todayKey, usePlans } from '@/lib/planes';
import { useProgress } from '@/lib/progress';
import { useRacha } from '@/lib/racha';
import { rachaParaAvisos } from '@/lib/rachaTexto';
import { useCards } from '@/lib/tarjetas';
import { getLastRead } from '@/lib/theme';
import { navigate } from '@/lib/transition';

/**
 * Sin interfaz: con las notificaciones activas, mantiene al día lo que el servidor sabe para el recordatorio
 * diario (lo leído, las tarjetas y los planes), une o separa la suscripción de la cuenta al entrar o salir,
 * rehace la suscripción si se perdió y abre la pantalla de un aviso tocado con la app ya abierta. En la app
 * nativa, al tocar la alarma del despertador abre /despertar.
 */
export default function AvisosSync() {
  const { endpoint } = useAvisos();
  const plans = usePlans();
  const cards = useCards();
  const progress = useProgress();
  const r = useRacha();
  const racha = rachaParaAvisos(r);
  const rachaJson = JSON.stringify(racha ?? null);
  const { llave, ready } = useAccount();
  const [books, setBooks] = useState<Book[]>([]);
  const account = useRef<string | null | undefined>(undefined);
  useAbrirAlarma();

  useEffect(() => {
    if (endpoint) getBooks().then(setBooks).catch(() => {});
  }, [endpoint]);

  useEffect(() => {
    if (!endpoint || !books.length) return;
    let alive = true;
    getLastRead().then((last) => {
      if (alive) sincronizar(buildEstado({ plans, cards, days: progress.days, books, last, today: todayKey(), racha }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, books, plans, cards, progress, rachaJson]);

  useEffect(() => {
    if (!ready) return;
    if (account.current !== undefined && account.current !== llave) cuentaCambio();
    account.current = llave;
  }, [ready, llave]);

  // Al abrir la app, si reinstalarla o borrar sus datos rompió la suscripción, se rehace.
  useEffect(() => {
    revisar().catch(() => {});
  }, []);

  // Al tocar un aviso con la app abierta, el service worker pide abrir su pantalla.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const url = e.data?.tipo === 'abrir' && typeof e.data.url === 'string' ? e.data.url : null;
      if (url?.startsWith('/') && !url.startsWith('//')) navigate(() => router.push(url as never), 'forward');
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
