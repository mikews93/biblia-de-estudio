import {AbsoluteFill, useVideoConfig} from 'remotion';
import {Headline, Phone, phoneSize, Screens, Sky} from '../film/kit';
import {c, fonts} from '../theme';

/**
 * Las capturas de la ficha de Google Play (1080×1920): titular, una línea que lo explica y el teléfono con una
 * pantalla real de los videos de funciones, cortado abajo. Se sacan con scripts/ficha.sh.
 */
export const FICHA = [
  {src: 'preguntar/1-hoy', eyebrow: 'ZARZA', title: 'Arde y no se consume', sub: 'La Biblia de estudio gratis, sin anuncios.'},
  {src: 'preguntar/5-respuesta', eyebrow: 'PREGÚNTALE A LA BIBLIA', title: 'Pregunta como te salga', sub: 'Te responde con la Biblia abierta y las citas para que las leas tú.'},
  {src: 'interlineal/4-palabra', eyebrow: 'INTERLINEAL', title: 'El original, a un toque', sub: 'El griego y el hebreo: qué significa cada palabra y su historia en toda la Biblia.'},
  {src: 'podcast/3-sonando', eyebrow: 'PÓDCAST', title: 'Cada capítulo, conversado', sub: 'Un pódcast corto para escuchar en el camino.'},
  {src: 'dramatizado/3-sonando', eyebrow: 'AUDIO DRAMATIZADO', title: 'La Biblia, dramatizada', sub: 'Voces, música y ambiente, versículo a versículo.'},
  {src: 'preparar/7-borrador', eyebrow: 'PREPARAR UN MENSAJE', title: 'Del pasaje al mensaje', sub: 'Contexto, fuentes y un borrador que tú revisas y cambias.'},
  {src: 'presentar/4-todos-ven-la-cita', eyebrow: 'EN VIVO', title: 'Tu grupo, en vivo', sub: 'Cada uno en su teléfono: la cita, las preguntas y la dinámica.'},
  {src: 'historia/4-jesus', eyebrow: 'LÍNEA DE TIEMPO Y FAMILIAS', title: 'La Biblia y su historia', sub: 'Siglo a siglo, y el linaje de cada persona a un toque.'},
];

const SCREEN_H = 1560;

export const Ficha = ({n}: {n: number}) => {
  const {width} = useVideoConfig();
  const s = FICHA[n];
  const ph = phoneSize(SCREEN_H);
  return (
    <AbsoluteFill style={{overflow: 'hidden', fontFamily: fonts.sans}}>
      <Sky glowX={width / 2} glowY={1100} glow={1} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 190, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center'}}>
        <Headline eyebrow={s.eyebrow} title={s.title} from={-100} to={10000} size={76} align="center" maxWidth={960} />
      </div>
      <div style={{position: 'absolute', left: 90, right: 90, top: 330, textAlign: 'center', color: c.muted, fontSize: 36, lineHeight: 1.3}}>{s.sub}</div>
      <Phone screenH={SCREEN_H} style={{left: width / 2 - ph.w / 2, top: 470}}>
        <Screens shots={[{at: -100, src: `funciones/${s.src}`}]} screenH={SCREEN_H} />
      </Phone>
    </AbsoluteFill>
  );
};
