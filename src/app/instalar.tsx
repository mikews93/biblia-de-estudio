import * as Clipboard from 'expo-clipboard';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import Appear from '@/components/Appear';
import { text } from '@/components/comunidad/ui';
import { CheckIcon, CopyIcon, type IconProps, PhoneDownloadIcon, PlusSquareIcon, QrIcon, ShareIcon, ShieldIcon } from '@/components/icons';
import Qr from '@/components/Qr';
import { type Apk, dispositivo, ENLACE_APK, fechaCorta, megas, OFRECER_APK, PAGINA_INSTALAR, ultimoApk } from '@/lib/apk';
import { Colors, isDark, serif, useColors } from '@/lib/theme';

const PASOS: { titulo: string; detalle: string }[] = [
  {
    titulo: 'Descarga el archivo',
    detalle:
      'Si Chrome avisa que el archivo puede ser dañino, toca «Descargar de todas formas». Lo dice con toda app que no viene de Google Play.',
  },
  {
    titulo: 'Ábrelo',
    detalle: 'Toca el aviso de descarga, o búscalo en Archivos → Descargas con el nombre zarza.apk.',
  },
  {
    titulo: 'Permite la instalación',
    detalle: 'La primera vez Android pide permiso: toca Configuración, activa «Permitir de esta fuente» y vuelve atrás.',
  },
  {
    titulo: 'Instala y abre Zarza',
    detalle: 'Si Play Protect pregunta, toca «Más detalles» y luego «Instalar de todas formas». Entra con tu cuenta y lo tuyo sigue ahí.',
  },
];

const TRANQUILO = [
  'Es la misma Zarza de la web, firmada por nosotros y compilada desde el código del proyecto.',
  'Se actualiza sola: las mejoras le llegan al abrirla, sin volver a descargar nada.',
  'Cuando llegue a Google Play podrás pasarte allá; tus notas y tu progreso viajan con tu cuenta.',
];

/**
 * Instalar Zarza en Android sin pasar por Google Play: el último APK (src/lib/apk.ts), los pasos para instalarlo y,
 * en el computador, un QR para abrir esta misma página en el teléfono. Solo en la web.
 */
export default function Instalar() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [apk, setApk] = useState<Apk | null | undefined>();
  const [buscando, setBuscando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const donde = useMemo(() => dispositivo(), []);
  const ancho = width >= 760;

  useEffect(() => {
    ultimoApk().then((a) => {
      setApk(a);
      setBuscando(false);
    });
  }, []);

  if (!OFRECER_APK) return <Redirect href="/" />;

  const copiar = async () => {
    await Clipboard.setStringAsync(PAGINA_INSTALAR);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  };

  const iphone = donde === 'iphone';
  const computador = donde === 'computador';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Zarza en tu Android' }} />

      <Appear>
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadow(colors),
            computador && ancho && styles.heroAncho,
          ]}
        >
          <View style={[styles.heroTexto, computador && ancho && { alignItems: 'flex-start' }]}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={[styles.titulo, { color: colors.text }, computador && ancho && { textAlign: 'left' }]}>Zarza en tu Android</Text>
            <Text style={[text.body, styles.lema, { color: colors.muted }, computador && ancho && { textAlign: 'left' }]}>
              Instala la app en tu teléfono sin esperar a Google Play. Es gratis, sin anuncios, y se actualiza sola.
            </Text>
            {!iphone && <Descargar colors={colors} apk={apk} buscando={buscando} secundario={computador} />}
          </View>
          {computador && (
            <View style={[styles.qrCaja, { borderColor: colors.border }, ancho ? null : { alignSelf: 'stretch' }]} testID="qr-instalar">
              <View style={styles.qr}>
                <Qr value={PAGINA_INSTALAR} size={168} />
              </View>
              <View style={styles.qrPie}>
                <QrIcon color={colors.accent} size={16} />
                <Text style={[text.small, { color: colors.text, fontWeight: '700' }]}>Escanéalo con tu Android</Text>
              </View>
              <Text style={[text.small, { color: colors.muted, textAlign: 'center', maxWidth: 220 }]}>
                Se abre esta página en el teléfono, lista para descargar.
              </Text>
            </View>
          )}
        </View>
      </Appear>

      {iphone && (
        <Appear delay={40}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]} testID="iphone">
            <CardHead colors={colors} Icon={PlusSquareIcon} titulo="¿Tienes iPhone?" />
            <Text style={[text.body, { color: colors.muted, marginTop: 8 }]}>
              Este archivo es solo para Android y la app de iPhone todavía no está en el App Store. Mientras tanto, puedes tener Zarza como
              app desde Safari:
            </Text>
            <View style={{ gap: 10, marginTop: 12 }}>
              <Paso
                colors={colors}
                n={1}
                titulo="Toca Compartir"
                detalle="El cuadrado con la flecha hacia arriba, abajo en Safari."
                Icon={ShareIcon}
              />
              <Paso colors={colors} n={2} titulo="Elige «Agregar a inicio»" detalle="Zarza queda con su ícono, como cualquier app." />
            </View>
          </View>
        </Appear>
      )}

      {!iphone && (
        <Appear delay={60}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]} testID="pasos">
            <Text style={[styles.cardTitle, { color: colors.text }]}>Cómo instalarla</Text>
            <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>
              Toma un minuto. Solo la primera vez hay que dar permiso.
            </Text>
            <View style={{ gap: 14, marginTop: 14 }}>
              {PASOS.map((p, i) => (
                <Paso key={p.titulo} colors={colors} n={i + 1} titulo={p.titulo} detalle={p.detalle} />
              ))}
            </View>
          </View>
        </Appear>
      )}

      {!iphone && (
        <Appear delay={90}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
            <CardHead colors={colors} Icon={ShieldIcon} titulo="Tranquilo, es segura" />
            <View style={{ gap: 8, marginTop: 10 }}>
              {TRANQUILO.map((t) => (
                <View key={t} style={styles.punto}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <Text style={[text.small, { color: colors.muted, flex: 1, lineHeight: 19 }]}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </Appear>
      )}

      <Appear delay={120}>
        <Pressable
          onPress={copiar}
          accessibilityRole="button"
          accessibilityLabel="Copiar el enlace para instalar Zarza"
          style={({ pressed }) => [styles.compartir, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
        >
          {copiado ? <CheckIcon color={colors.accent} size={16} /> : <CopyIcon color={colors.muted} size={16} />}
          <Text style={[text.small, { color: colors.muted, flex: 1 }]}>
            ¿Se la pasas a alguien? <Text style={{ color: colors.text, fontWeight: '700' }}>zarzabiblia.com/instalar</Text>
          </Text>
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>{copiado ? 'Copiado' : 'Copiar'}</Text>
        </Pressable>
      </Appear>
    </ScrollView>
  );
}

/** El botón de descarga con la versión, el tamaño y la fecha del último APK. Sin APK publicado todavía, «Muy pronto». */
function Descargar({
  colors,
  apk,
  buscando,
  secundario,
}: {
  colors: Colors;
  apk: Apk | null | undefined;
  buscando: boolean;
  secundario: boolean;
}) {
  const hay = apk !== null;
  const detalle = buscando
    ? 'Buscando la última versión…'
    : apk
      ? [`Versión ${apk.version}${apk.build ? ` (${apk.build})` : ''}`, megas(apk.bytes), fechaCorta(apk.fecha)].filter(Boolean).join(' · ')
      : apk === null
        ? 'Estamos preparando la primera versión para descargar.'
        : 'Para Android 7 o más nuevo';
  const [tocado, setTocado] = useState(false);
  const bajar = () => {
    if (!hay) return;
    setTocado(true);
    window.location.assign(apk?.url ?? ENLACE_APK);
  };
  const lleno = hay && !secundario;
  return (
    <View style={[styles.descargar, secundario && { alignItems: 'flex-start' }]}>
      <Pressable
        onPress={bajar}
        disabled={!hay || buscando}
        accessibilityRole="link"
        accessibilityLabel={hay ? 'Descargar Zarza para Android' : 'Descargar Zarza: muy pronto'}
        testID="descargar-apk"
        style={({ pressed }) => [
          styles.boton,
          lleno
            ? { backgroundColor: colors.accent }
            : {
                borderWidth: 1.5,
                borderColor: hay ? colors.accent : colors.border,
              },
          pressed && { opacity: 0.85 },
        ]}
      >
        {buscando ? (
          <ActivityIndicator color={lleno ? colors.background : colors.accent} />
        ) : (
          <PhoneDownloadIcon color={lleno ? colors.background : hay ? colors.accent : colors.muted} size={20} strokeWidth={2} />
        )}
        <Text
          style={[
            styles.botonTexto,
            {
              color: lleno ? colors.background : hay ? colors.accent : colors.muted,
            },
          ]}
        >
          {hay ? (secundario ? 'Descargar el APK' : 'Descargar Zarza') : 'Muy pronto'}
        </Text>
      </Pressable>
      <Text style={[text.small, { color: colors.muted, textAlign: secundario ? 'left' : 'center' }]} accessibilityLiveRegion="polite">
        {detalle}
      </Text>
      {tocado && !secundario && (
        <View style={[styles.trabada, { backgroundColor: colors.accentSoft }]} testID="descarga-trabada" accessibilityLiveRegion="polite">
          <Text style={[text.small, { color: colors.text, fontWeight: '700' }]}>¿Se quedó al 100 % sin terminar?</Text>
          <Text style={[text.small, { color: colors.muted, lineHeight: 19 }]}>
            Es Chrome revisando el archivo. Cancélala y abre esta página en Samsung Internet u otro navegador, o en Chrome cambia ⋮ →
            Configuración → Privacidad y seguridad → Navegación segura a «Protección estándar» y vuelve a descargar.
          </Text>
        </View>
      )}
    </View>
  );
}

function Paso({
  colors,
  n,
  titulo,
  detalle,
  Icon,
}: {
  colors: Colors;
  n: number;
  titulo: string;
  detalle: string;
  Icon?: (p: IconProps) => React.ReactNode;
}) {
  return (
    <View style={styles.paso}>
      <View style={[styles.numero, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14 }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15.5 }}>{titulo}</Text>
          {Icon && <Icon color={colors.muted} size={16} />}
        </View>
        <Text style={[text.small, { color: colors.muted, lineHeight: 19 }]}>{detalle}</Text>
      </View>
    </View>
  );
}

function CardHead({ colors, Icon, titulo }: { colors: Colors; Icon: (p: IconProps) => React.ReactNode; titulo: string }) {
  return (
    <View style={styles.cardHead}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Icon color={colors.accent} size={18} />
      </View>
      <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>{titulo}</Text>
    </View>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors)
    ? null
    : {
        boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)',
      };

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 64,
    gap: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  heroAncho: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 28,
    gap: 28,
  },
  heroTexto: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 6 },
  titulo: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  lema: { textAlign: 'center', maxWidth: 420 },
  descargar: {
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    alignSelf: 'stretch',
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 240,
  },
  botonTexto: { fontSize: 16.5, fontWeight: '700' },
  qrCaja: {
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 16,
  },
  qr: { borderRadius: 12, overflow: 'hidden' },
  qrPie: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: serif, fontSize: 20 },
  paso: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  punto: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  trabada: { alignSelf: 'stretch', borderRadius: 16, padding: 14, gap: 4, marginTop: 4 },
  compartir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
});
