import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useAccount } from '@/lib/comunidad';
import { acceptPending } from '@/lib/invitar';

/**
 * Sin interfaz: si se abrió una invitación a Zarza (/i/CODIGO) sin cuenta y la cuenta aparece en otra pantalla
 * (por ejemplo, al volver de Google a Comunidad), acepta la amistad y abre la invitación, que dice «Ya son amigos».
 */
export default function InvitacionSync() {
  const { ready, usuario } = useAccount();
  const path = usePathname();

  useEffect(() => {
    // En /registro y /entrar se espera: al terminar vuelven a la invitación, que acepta por su cuenta.
    if (!ready || !usuario || /^\/(i\/|registro|entrar)/.test(path)) return;
    acceptPending()
      .then((r) => r && router.push(`/i/${r.codigo}` as never))
      .catch(() => {});
  }, [ready, usuario?.id, path]);

  return null;
}
