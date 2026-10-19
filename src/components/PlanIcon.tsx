// El ícono de línea de un plan de lectura o de un reto de temporada.
import IconoHistoria from '@/components/IconoHistoria';
import { OpenBookIcon, SunIcon } from '@/components/icons';
import { STROKE } from '@/components/iconLine';
import type { PlanIcono } from '@/lib/planesCatalogo';

export default function PlanIcon({ icono, color, size = 22, strokeWidth = STROKE }: { icono: PlanIcono; color: string; size?: number; strokeWidth?: number }) {
  if (icono === 'libro') return <OpenBookIcon color={color} size={size} strokeWidth={strokeWidth} />;
  if (icono === 'sol') return <SunIcon color={color} size={size} strokeWidth={strokeWidth} />;
  return <IconoHistoria icono={icono} color={color} size={size} grosor={strokeWidth} />;
}
