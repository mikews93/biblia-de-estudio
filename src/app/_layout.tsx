import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import AudioBar from '@/components/AudioBar';
import AvisosSync from '@/components/AvisosSync';
import InvitacionSync from '@/components/InvitacionSync';
import Celebracion from '@/components/Celebracion';
import { LuceroNuevo } from '@/components/Servicio';
import Confeti from '@/components/Confeti';
import LlamaArranque from '@/components/LlamaArranque';
import PantallaRota from '@/components/PantallaRota';
import SincroniaCuenta from '@/components/Sincronia';
import { OfflineBanner } from '@/components/SinConexion';
import TabBar from '@/components/TabBar';
import { init as initDownloads } from '@/lib/descargas';
import { instalarAvisosDeErrores, seguirRuta } from '@/lib/errores';
import { fixedInTransition } from '@/lib/transition';
import { ESPACIO_NINOS, SettingsProvider, isDark, useColors, useSettings } from '@/lib/theme';

// La cabecera queda quieta en las transiciones (src/lib/transition.ts). headerStyle descarta los estilos
// que no conoce, así que se fija cada parte por separado; el Stack de la web pasa estas opciones a Header
// aunque los tipos de NativeStack no las declaren.
const fixedHeader = {
  headerBackgroundContainerStyle: fixedInTransition('cabecera'),
  headerLeftContainerStyle: fixedInTransition('cabecera-izq'),
  headerTitleContainerStyle: fixedInTransition('cabecera-titulo'),
  headerRightContainerStyle: fixedInTransition('cabecera-der'),
};

// En el Espacio Niños no hay comunidad, cuentas, Taller ni lecturas en vivo: si un enlace lleva ahí, vuelve a Hoy.
const SIN_NINOS = /^\/(comunidades|amigo|grupos|unirse|cuenta|entrar|registro|taller|vivo|eventos?|semana|notificaciones|jovenes|pareja|circulo|iglesia|cuidar)(\/|$)/;

// Los fallos se escuchan desde que carga el código, antes de la primera pantalla.
instalarAvisosDeErrores();

// Si una pantalla se rompe, se ve PantallaRota (con reintentar y volver a Hoy) y llega el aviso a /cuidar.
export const ErrorBoundary = PantallaRota;

/** Recuerda la pantalla abierta para decir dónde pasó un fallo (src/lib/errores.ts). */
function RutaDeErrores() {
  const path = usePathname();
  useEffect(() => seguirRuta(path), [path]);
  return null;
}

function GuardaNinos() {
  const path = usePathname();
  const { modo } = useSettings().settings;
  useEffect(() => {
    if (modo === 'ninos' && SIN_NINOS.test(path)) router.replace('/');
    // El Círculo de solteros es solo para adultos: en el Modo Jóvenes su portada lo explica y no se entra más allá.
    else if (modo === 'jovenes' && /^\/circulo\/./.test(path)) router.replace('/circulo');
    // En el teléfono no hay Espacio Niños (ver ESPACIO_NINOS en src/lib/theme.ts).
    else if (!ESPACIO_NINOS && /^\/ninos(\/|$)/.test(path)) router.replace('/');
  }, [modo, path]);
  return null;
}

function AppStack() {
  const colors = useColors();

  // Fondo de la página con el color del tema: lo que se ve debajo durante las transiciones. Si quedaba
  // blanco, el fundido entre pantallas destellaba (sobre todo en modo oscuro y sepia).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = colors.background;
    document.documentElement.style.setProperty('--papel', colors.background);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.background);
  }, [colors.background]);

  useEffect(() => {
    if (Platform.OS === 'web') hidePortadaWhenReady();
  }, []);

  // Lee qué hay descargado y, en la web, mantiene al día la copia de la app para abrirla sin conexión.
  useEffect(() => {
    initDownloads().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark(colors) ? 'light' : 'dark'} />
      <View nativeID="pantallas" style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            ...fixedHeader,
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="[book]/[chapter]/index" options={{ title: '' }} />
          <Stack.Screen name="[book]/[chapter]/[verse]" options={{ title: '' }} />
          <Stack.Screen name="mapa/[book]/[chapter]" options={{ title: 'Lugares' }} />
          <Stack.Screen name="recorrido/[book]/[chapter]" options={{ title: 'En el mapa' }} />
          <Stack.Screen name="recorridos" options={{ title: 'Recorridos' }} />
          <Stack.Screen name="ocasiones" options={{ title: 'Para alguien' }} />
          <Stack.Screen name="recibidos" options={{ title: 'Versículos para ti' }} />
          <Stack.Screen name="mi-ano" options={{ title: 'Mi año' }} />
          <Stack.Screen name="podcast/[book]/[chapter]" options={{ title: 'Resumen en audio' }} />
          <Stack.Screen name="comparar/[book]/[chapter]" options={{ title: 'Comparar versiones' }} />
          <Stack.Screen name="concordancia/[strong]" options={{ title: 'Concordancia' }} />
          <Stack.Screen name="palabras/index" options={{ title: 'La historia de una palabra' }} />
          <Stack.Screen name="palabras/[id]/index" options={{ title: 'La historia de una palabra' }} />
          <Stack.Screen name="palabras/[id]/podcast" options={{ title: 'Pódcast de la palabra' }} />
          <Stack.Screen name="mapa-mental/[book]/[chapter]" options={{ title: 'Mapa mental' }} />
          <Stack.Screen name="tarjetas/[book]/[chapter]" options={{ title: 'Tarjetas de repaso' }} />
          <Stack.Screen name="repaso" options={{ title: 'Repaso' }} />
          <Stack.Screen name="buscar" options={{ title: '' }} />
          <Stack.Screen name="preguntar" options={{ title: '' }} />
          <Stack.Screen name="libros" options={{ title: 'Libros', presentation: 'modal' }} />
          <Stack.Screen name="genealogia/index" options={{ title: 'Genealogías' }} />
          <Stack.Screen name="genealogia/[id]" options={{ title: '' }} />
          <Stack.Screen name="ficha/[id]" options={{ title: '' }} />
          <Stack.Screen name="historia" options={{ title: 'Línea de tiempo' }} />
          <Stack.Screen name="promesas/index" options={{ title: 'Promesa y cumplimiento' }} />
          <Stack.Screen name="promesas/[id]" options={{ title: '' }} />
          <Stack.Screen name="conexiones" options={{ title: 'Conexiones' }} />
          <Stack.Screen name="comunidades/index" options={{ title: 'Comunidad' }} />
          <Stack.Screen name="comunidades/amigos" options={{ title: 'Amigos' }} />
          <Stack.Screen name="comunidades/publicar" options={{ title: 'Publicar' }} />
          <Stack.Screen name="comunidades/publicacion/[id]" options={{ title: '' }} />
          <Stack.Screen name="comunidades/persona/[id]" options={{ title: '' }} />
          <Stack.Screen name="amigo/[codigo]" options={{ title: 'Amistad' }} />
          <Stack.Screen name="i/[codigo]" options={{ title: 'Invitación' }} />
          <Stack.Screen name="invitar" options={{ title: 'Invitar amigos' }} />
          <Stack.Screen name="grupos/index" options={{ title: 'Planes en grupo' }} />
          <Stack.Screen name="grupos/[id]" options={{ title: '' }} />
          <Stack.Screen name="grupos/nuevo" options={{ title: 'Nuevo grupo' }} />
          <Stack.Screen name="cuenta" options={{ title: 'Tu cuenta' }} />
          <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="despertador" options={{ title: 'Despertador' }} />
          <Stack.Screen name="despertar" options={{ headerShown: false }} />
          <Stack.Screen name="entrar" options={{ title: '' }} />
          <Stack.Screen name="registro" options={{ title: '' }} />
          <Stack.Screen name="unirse/[codigo]" options={{ title: 'Invitación' }} />
          <Stack.Screen name="vivo/index" options={{ title: 'Lectura en vivo' }} />
          <Stack.Screen name="vivo/[codigo]" options={{ headerShown: false }} />
          <Stack.Screen name="planes/index" options={{ title: 'Planes de lectura' }} />
          <Stack.Screen name="planes/[id]" options={{ title: '' }} />
          <Stack.Screen name="notas" options={{ title: 'Mis resaltados y notas' }} />
          <Stack.Screen name="diario" options={{ title: 'Mi diario' }} />
          <Stack.Screen name="descargas" options={{ title: 'Sin conexión' }} />
          <Stack.Screen name="privacidad" options={{ title: 'Privacidad' }} />
          <Stack.Screen name="terminos" options={{ title: 'Términos' }} />
          <Stack.Screen name="acerca" options={{ title: 'Acerca de Zarza' }} />
          <Stack.Screen name="todo" options={{ title: '' }} />
          <Stack.Screen name="sostener" options={{ title: 'Sostén Zarza' }} />
          <Stack.Screen name="iglesia/index" options={{ title: 'Iglesia anfitriona' }} />
          <Stack.Screen name="iglesia/postular" options={{ title: 'Postular mi iglesia' }} />
          <Stack.Screen name="iglesia/[codigo]" options={{ title: 'Iglesia anfitriona' }} />
          <Stack.Screen name="cuidar" options={{ title: 'Cuidar Zarza' }} />
          <Stack.Screen name="modo" options={{ title: '' }} />
          <Stack.Screen name="jovenes/index" options={{ title: 'Misiones' }} />
          <Stack.Screen name="jovenes/[ruta]/index" options={{ title: '' }} />
          <Stack.Screen name="jovenes/[ruta]/[mision]" options={{ title: '' }} />
          <Stack.Screen name="ninos/index" options={{ title: '' }} />
          <Stack.Screen name="ninos/memoria" options={{ title: '' }} />
          <Stack.Screen name="ninos/[historia]" options={{ title: '' }} />
          <Stack.Screen name="taller/index" options={{ title: 'Taller' }} />
          <Stack.Screen name="taller/dinamicas" options={{ title: 'Dinámicas' }} />
          <Stack.Screen name="taller/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="taller/[id]/presentar" options={{ headerShown: false }} />
          <Stack.Screen name="taller/[id]/documento" options={{ title: 'Documento' }} />
          <Stack.Screen name="semana/index" options={{ title: 'Del sermón a tu semana' }} />
          <Stack.Screen name="semana/nueva" options={{ title: 'Del sermón a tu semana' }} />
          <Stack.Screen name="semana/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="semana/[id]/[dia]" options={{ title: '' }} />
          <Stack.Screen name="eventos" options={{ title: 'Eventos' }} />
          <Stack.Screen name="sellos" options={{ title: 'Mis sellos' }} />
          <Stack.Screen name="pareja/index" options={{ title: 'En pareja' }} />
          <Stack.Screen name="pareja/[plan]/[dia]" options={{ title: '' }} />
          <Stack.Screen name="pareja/unirse/[codigo]" options={{ title: 'Invitación' }} />
          <Stack.Screen name="pareja/ayuda" options={{ title: 'Ayuda' }} />
          <Stack.Screen name="circulo/index" options={{ title: 'Círculo de solteros' }} />
          <Stack.Screen name="circulo/conocer/[id]" options={{ title: 'Conocernos' }} />
          <Stack.Screen name="circulo/lider/[id]" options={{ title: 'Liderar el círculo' }} />
          <Stack.Screen name="circulo/camino/index" options={{ title: 'Camino de preparación' }} />
          <Stack.Screen name="circulo/camino/[n]" options={{ title: 'Etapa' }} />
          <Stack.Screen name="circulo/importa" options={{ title: 'Lo que sí importa' }} />
          <Stack.Screen name="hombres/index" options={{ title: 'Hombres de pie' }} />
          <Stack.Screen name="hombres/[n]" options={{ title: 'Semana' }} />
          <Stack.Screen name="evento/[codigo]/index" options={{ title: '' }} />
          <Stack.Screen name="evento/[codigo]/proyectar" options={{ headerShown: false }} />
        </Stack>
      </View>
      <AudioBar />
      <OfflineBanner />
      <TabBar />
      {Platform.OS === 'web' && <AvisosSync />}
      <InvitacionSync />
      <SincroniaCuenta />
      <Celebracion />
      <LuceroNuevo />
      <Confeti />
      <GuardaNinos />
      <RutaDeErrores />
      {Platform.OS !== 'web' && <LlamaArranque />}
      {Platform.OS === 'web' && (
        <>
          <View nativeID="pliegue-sombra" pointerEvents="none" style={fixedInTransition('pliegue-sombra')} />
          <View nativeID="pliegue" pointerEvents="none" style={fixedInTransition('pliegue')} />
          <View nativeID="pliegue-brillo" pointerEvents="none" style={fixedInTransition('pliegue-brillo')} />
        </>
      )}
    </View>
  );
}

// En la web cada pantalla llega en su propio archivo de código. La portada de public/index.html sigue a la vista
// hasta que la primera pantalla tiene algo que mostrar; si no, se veía un momento la barra de abajo sola.
function hidePortadaWhenReady() {
  const portada = document.getElementById('portada');
  if (!portada) return;
  const started = Date.now();
  const check = () => {
    const screens = document.getElementById('pantallas');
    if (screens?.innerText.trim() || Date.now() - started > 8000) {
      portada.classList.add('fuera');
      setTimeout(() => portada.remove(), 300);
    } else requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppStack />
    </SettingsProvider>
  );
}
