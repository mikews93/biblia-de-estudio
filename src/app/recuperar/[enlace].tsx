import { useLocalSearchParams } from 'expo-router';

import { ElegirClave } from '@/components/comunidad/RecuperarClave';

export default function ResetPassword() {
  const { enlace } = useLocalSearchParams<{ enlace: string }>();
  return <ElegirClave enlace={enlace} />;
}
