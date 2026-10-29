// La tarjeta vertical de «Mi año con la Palabra» dibujada con vistas: la vista previa en la pantalla y, en el
// teléfono, la imagen que se comparte. En la web la imagen sale del canvas (src/lib/miAnoImagen.ts), con el mismo diseño.
import { ComponentRef, Ref, useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { IMAGE_SIZE } from '@/lib/compartir';
import { idsUnicos, useLetras } from '@/lib/fondos';
import { FONDO_AÑO, LETRA_AÑO, Tarjeta, cifras } from '@/lib/miAnoImagen';
import { sans, serif } from '@/lib/theme';

type Props = { tarjeta: Tarjeta; width: number; viewRef?: Ref<ComponentRef<typeof View>> };

export default function MiAnoTarjeta({ tarjeta, width, viewRef }: Props) {
  const f = FONDO_AÑO;
  const { width: W, height: H } = IMAGE_SIZE.historia;
  const s = width / W;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const xml = useMemo(() => idsUnicos(f.svg!(W, H), `a${id}`), [f, W, H, id]);
  useLetras();
  const family = LETRA_AÑO.family ?? serif;
  const r = tarjeta.resumen;
  const sombra = { textShadowColor: f.sombra ?? 'transparent', textShadowRadius: 12 * s };
  const kicker = (t: string, top: number) => (
    <Text style={[styles.kicker, sombra, { color: f.accent, fontSize: 32 * s, letterSpacing: 4 * s, marginTop: top * s }]}>{t}</Text>
  );

  return (
    <View ref={viewRef} collapsable={false} style={{ width, height: H * s, backgroundColor: f.background, overflow: 'hidden' }}>
      <SvgXml xml={xml} width={width} height={H * s} style={StyleSheet.absoluteFill} />
      <View style={{ alignItems: 'center', paddingTop: 150 * s, paddingHorizontal: 90 * s }}>
        {kicker('MI AÑO CON LA PALABRA', 0)}
        <Text style={[sombra, { color: f.text, fontFamily: family, fontSize: 150 * s, lineHeight: 180 * s, marginTop: 14 * s }]}>{r.año}</Text>
        <Text style={[sombra, { color: f.accent, fontFamily: family, fontSize: 170 * s, lineHeight: 200 * s, marginTop: 6 * s }]}>{r.dias}</Text>
        <Text style={[sombra, { color: f.text, fontFamily: sans, fontWeight: '500', fontSize: 44 * s }]}>
          {r.dias === 1 ? 'día con la Palabra' : 'días con la Palabra'}
        </Text>
        <View style={[styles.grid, { marginTop: 56 * s, rowGap: 36 * s }]}>
          {cifras(r).map((c) => (
            <View key={c.label} style={{ width: '50%', alignItems: 'center' }}>
              <Text style={[sombra, { color: f.text, fontFamily: family, fontSize: 76 * s, lineHeight: 92 * s }]}>{c.n}</Text>
              <Text style={[sombra, { color: f.muted, fontFamily: sans, fontSize: 30 * s, textAlign: 'center' }]}>{c.label}</Text>
            </View>
          ))}
        </View>
        {tarjeta.versiculo && (
          <>
            {kicker('MI VERSÍCULO DEL AÑO', 64)}
            <Text
              numberOfLines={5}
              style={[sombra, { color: f.text, fontFamily: serif, fontStyle: 'italic', fontSize: 44 * s, lineHeight: 58 * s, textAlign: 'center', marginTop: 18 * s }]}
            >
              «{tarjeta.versiculo.texto}»
            </Text>
            <Text style={[sombra, { color: f.accent, fontFamily: sans, fontWeight: '700', fontSize: 34 * s, marginTop: 14 * s }]}>
              {tarjeta.versiculo.referencia}
            </Text>
          </>
        )}
        {tarjeta.palabra && (
          <>
            {kicker('UNA PALABRA QUE DESCUBRÍ', 52)}
            <Text style={[sombra, { color: f.text, fontFamily: serif, fontSize: 72 * s, lineHeight: 92 * s, marginTop: 10 * s }]}>{tarjeta.palabra.lemma}</Text>
            <Text style={[sombra, { color: f.muted, fontFamily: serif, fontStyle: 'italic', fontSize: 36 * s }]}>
              {tarjeta.palabra.translit} · {tarjeta.palabra.glosa}
            </Text>
          </>
        )}
      </View>
      <Text style={[styles.site, { color: f.muted, fontSize: 28 * s, bottom: (250 - 28) * s }]}>zarzabiblia.com</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: sans, fontWeight: '800', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'stretch' },
  site: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: sans },
});
