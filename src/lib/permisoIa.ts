// Permiso para la IA en el teléfono: antes de mandar por primera vez una pregunta o un pasaje a la IA, la app explica
// adónde va y pide permiso (App Store 5.1.2(i)). En la web lo cuenta la página de privacidad.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

const KEY = 'permiso-ia';
export const SIN_PERMISO_IA = 'La IA queda apagada hasta que des permiso. Puedes darlo la próxima vez que la uses.';

let given: boolean | null = null;

/** Resuelve si hay permiso; si nunca se pidió, lo pide. Lanza un error si la persona dice que no. */
export async function pedirPermisoIa(): Promise<void> {
  if (Platform.OS === 'web') return;
  given ??= (await AsyncStorage.getItem(KEY).catch(() => null)) === 'si';
  if (given) return;
  const ok = await new Promise<boolean>((resolve) =>
    Alert.alert(
      'Antes de usar la IA',
      'Para preparar estudios y responder tus preguntas, Zarza envía el pasaje y lo que escribes a Anthropic (Claude), un servicio de IA. No envía tu nombre ni tu correo, y Anthropic no usa esos datos para entrenar sus modelos. Más detalles en Privacidad, dentro de tu cuenta.',
      [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Dar permiso', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (!ok) throw new Error(SIN_PERMISO_IA);
  given = true;
  await AsyncStorage.setItem(KEY, 'si').catch(() => {});
}
