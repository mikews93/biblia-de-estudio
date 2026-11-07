import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {FILM_VO, Soundtrack, voTiming} from '../audio';
import {Llama} from '../components/Llama';
import {ease, glide, progress} from '../motion';
import {c, fonts, type Format, per} from '../theme';
import {Headline, Phone, phoneSize, Screens, type Shot, Sky} from './kit';

/**
 * El video promocional de Zarza (~47 s), en 16:9 (YouTube y la ficha de Google Play) y 9:16 (Reels y
 * Shorts). La llama se enciende, un teléfono enseña la app de verdad (capturas de scripts/capturas.mjs)
 * mientras Abel narra, y al final vuelve la llama con el nombre.
 */
export const FILM_FRAMES = 1412;

const PHONE_IN = 150;
const GROUP_AT = 968;
const CTA_AT = 1180;

const SHOTS: Shot[] = [
  {at: 0, src: '1-hoy'},
  {at: 335, src: '2a-lector', tap: {x: 748, y: 189}},
  {at: 400, src: '2b-versiculo', tap: {x: 422, y: 622}},
  {at: 462, src: '2c-palabra'},
  {at: 548, src: '3a-buscador', tap: {x: 540, y: 456}},
  {at: 598, src: '3b-tarjeta', tap: {x: 540, y: 1682}},
  {at: 680, src: '3c-respuesta', scroll: 520},
  {at: 775, src: '4a-podcast', tap: {x: 275, y: 532}},
  {at: 868, src: '4c-griego', scroll: 0},
  {at: GROUP_AT, src: '5a-guia'},
];

const HEADLINES = [
  {from: 168, to: 330, eyebrow: 'CADA MAÑANA', title: 'Una palabra para tu día'},
  {from: 340, to: 542, eyebrow: 'INTERLINEAL', title: 'Hasta el griego y el hebreo'},
  {from: 552, to: 768, eyebrow: 'PREGÚNTALE A LA BIBLIA', title: 'Respuestas, cita por cita'},
  {from: 778, to: 960, eyebrow: 'PARA ESCUCHAR', title: 'El capítulo, en tus oídos'},
  {from: GROUP_AT + 6, to: CTA_AT - 6, eyebrow: 'ESTUDIO EN GRUPO', title: 'Tu iglesia, en vivo'},
];

const layout = (format: Format) =>
  per(format, {
    landing: {screenH: 880, phoneX: 1320, phoneY: 540, groupX: 1210, head: {x: 170, y: 540, size: 92, align: 'left' as const, maxWidth: 780}},
    reel: {screenH: 1220, phoneX: 540, phoneY: 1090, groupX: 400, head: {x: 540, y: 300, size: 80, align: 'center' as const, maxWidth: 940}},
  });

export const Film = ({format}: {format: Format}) => {
  const f = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const L = layout(format);
  const ph = phoneSize(L.screenH);

  // El teléfono sube al terminar el gancho, respira despacio, se hace a un lado en el grupo y cae al final.
  const enter = glide(f, fps, PHONE_IN);
  const toGroup = progress(f, GROUP_AT + 10, 26, ease.quintInOut);
  const leave = progress(f, CTA_AT - 4, 22, ease.exitIn);
  const breathe = 1 + Math.min(1, Math.max(0, (f - PHONE_IN) / 1000)) * 0.04;
  const px = interpolate(toGroup, [0, 1], [L.phoneX, L.groupX]);
  const py = L.phoneY + (1 - enter) * (height * 0.75) + leave * height * 0.3;
  const phoneOpacity = 1 - leave;

  // La luz sigue a lo que importa: la llama, luego el teléfono, luego la llama otra vez.
  const glowOnPhone = progress(f, PHONE_IN, 40);
  const glowBack = progress(f, CTA_AT, 30);
  const glowX = interpolate(glowOnPhone - glowBack, [0, 1], [width / 2, px]);
  const glowY = interpolate(glowOnPhone - glowBack, [0, 1], [height * 0.42, py]);

  return (
    <AbsoluteFill style={{overflow: 'hidden', fontFamily: fonts.sans}}>
      <Sky glowX={glowX} glowY={glowY} glow={1} />

      {f < PHONE_IN + 30 && <Hook format={format} />}

      {f >= PHONE_IN - 2 && f < CTA_AT + 40 && (
        <>
          {f >= GROUP_AT && <GroupPhones format={format} screenH={L.screenH} x={L.groupX} y={L.phoneY} leave={leave} />}
          <Phone
            screenH={L.screenH}
            style={{left: px - ph.w / 2, top: py - ph.h / 2, opacity: phoneOpacity, transform: `scale(${breathe * (1 - toGroup * 0.04)}) rotate(${(1 - enter) * 4}deg)`, zIndex: 3}}
          >
            <Screens shots={SHOTS.map((s, i) => (i === 0 ? {...s, at: PHONE_IN} : s))} screenH={L.screenH} />
          </Phone>
        </>
      )}

      <div
        style={{
          position: 'absolute',
          left: L.head.align === 'center' ? 0 : L.head.x,
          right: L.head.align === 'center' ? 0 : undefined,
          top: L.head.y,
          transform: 'translateY(-50%)',
          display: 'flex',
          justifyContent: L.head.align === 'center' ? 'center' : 'flex-start',
          zIndex: 5,
        }}
      >
        {HEADLINES.map((h) => (
          <Headline key={h.from} {...h} size={L.head.size} align={L.head.align} maxWidth={L.head.maxWidth} />
        ))}
      </div>

      {f >= CTA_AT && <Cta format={format} />}
      {format === 'reel' && f >= PHONE_IN && f < CTA_AT && <Captions />}
      <Soundtrack cues={FILM_VO} total={FILM_FRAMES} />
    </AbsoluteFill>
  );
};

/* ── El gancho ─────────────────────────────────────────────────────────── */

const Hook = ({format}: {format: Format}) => {
  const f = useCurrentFrame();
  const out = progress(f, PHONE_IN - 16, 22, ease.exitIn);
  const size = per(format, {landing: 300, reel: 420});
  const line1 = 'Hay libros que se leen…';
  const line2 = 'y hay uno que te lee a ti.';
  // Cada media frase entra cuando Abel la dice.
  const words = voTiming.hook.words;
  const at = Math.round(0.6 * 30);
  const second = at + Math.round(words[4].end * 30) + 4;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: per(format, {landing: 30, reel: 60}), opacity: 1 - out, transform: `translateY(${-out * 60}px)`}}>
      <div style={{transform: `scale(${1 + f * 0.0006})`}}>
        <Llama size={size} start={2} />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
        <Line text={line1} start={at + 2} size={per(format, {landing: 64, reel: 70})} color={c.muted} />
        <Line text={line2} start={second} size={per(format, {landing: 64, reel: 70})} color={c.text} italicFrom={4} />
      </div>
    </AbsoluteFill>
  );
};

const Line = ({text, start, size, color, italicFrom}: {text: string; start: number; size: number; color: string; italicFrom?: number}) => {
  const f = useCurrentFrame();
  return (
    <div style={{fontFamily: fonts.display, fontSize: size, color, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.24, letterSpacing: -size * 0.015, padding: '0 60px'}}>
      {text.split(' ').map((w, i) => {
        const t = progress(f, start + i * 3, 18, ease.expoOut);
        const accent = italicFrom !== undefined && i >= italicFrom;
        return (
          <span key={i} style={{overflow: 'hidden', display: 'inline-block', paddingBottom: size * 0.16, marginBottom: -size * 0.16}}>
            <span style={{display: 'inline-block', transform: `translateY(${(1 - t) * 110}%)`, fontStyle: accent ? 'italic' : undefined, color: accent ? c.warm : undefined}}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

/* ── El grupo: la misma sección llega a otros teléfonos ────────────────── */

const GroupPhones = ({format, screenH, x, y, leave}: {format: Format; screenH: number; x: number; y: number; leave: number}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const others = per(format, {
    landing: [
      {src: '5b-miembro', dx: 340, scale: 0.86, at: GROUP_AT + 34, rot: 3},
      {src: '5c-responder', dx: 610, scale: 0.74, at: GROUP_AT + 52, rot: 6},
    ],
    reel: [
      {src: '5b-miembro', dx: 330, scale: 0.8, at: GROUP_AT + 34, rot: 4},
      {src: '5c-responder', dx: 560, scale: 0.66, at: GROUP_AT + 52, rot: 8},
    ],
  });
  const ph = phoneSize(screenH);
  return (
    <>
      {[...others].reverse().map((o) => {
        const t = glide(f, fps, o.at);
        return (
          <Phone
            key={o.src}
            screenH={screenH}
            style={{
              left: x + o.dx * t - ph.w / 2,
              top: y - ph.h / 2 + (1 - t) * 80 + leave * 300,
              transform: `scale(${o.scale}) rotate(${o.rot * t}deg)`,
              opacity: Math.min(1, t * 1.4) * (1 - leave),
              zIndex: 2,
            }}
          >
            <Screens shots={[{at: o.at, src: o.src}]} screenH={screenH} />
            <Pulse at={o.at + 18} />
          </Phone>
        );
      })}
    </>
  );
};

/** «En vivo»: una onda ámbar cuando la sección llega al teléfono. */
const Pulse = ({at}: {at: number}) => {
  const f = useCurrentFrame();
  const t = progress(f, at, 30, ease.expoOut);
  if (f < at || t >= 1) return null;
  return <AbsoluteFill style={{boxShadow: `inset 0 0 0 ${6 * (1 - t)}px ${c.warm}`, opacity: 1 - t, borderRadius: 40}} />;
};

/* ── El cierre ─────────────────────────────────────────────────────────── */

const Cta = ({format}: {format: Format}) => {
  const f = useCurrentFrame();
  const at = CTA_AT + 10;
  const name = progress(f, at + 14, 22, ease.expoOut);
  const motto = progress(f, at + 40, 22, ease.expoOut);
  const store = progress(f, at + 96, 20, ease.quintOut);
  const size = per(format, {landing: 250, reel: 360});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
      <Llama size={size} start={at} glow={1.3} />
      <div style={{overflow: 'hidden', marginTop: per(format, {landing: 6, reel: 24})}}>
        <div style={{fontFamily: fonts.display, fontSize: per(format, {landing: 132, reel: 168}), color: c.text, letterSpacing: -3, lineHeight: 1.1, transform: `translateY(${(1 - name) * 105}%)`}}>Zarza</div>
      </div>
      <div style={{fontFamily: fonts.display, fontStyle: 'italic', fontSize: per(format, {landing: 46, reel: 54}), color: c.warm, opacity: motto, transform: `translateY(${(1 - motto) * 20}px)`, marginTop: 4}}>
        Arde y no se consume
      </div>
      <div style={{display: 'flex', flexDirection: per(format, {landing: 'row' as const, reel: 'column' as const}), alignItems: 'center', gap: per(format, {landing: 28, reel: 22}), marginTop: per(format, {landing: 54, reel: 80}), opacity: store, transform: `translateY(${(1 - store) * 24}px)`}}>
        <div style={{fontFamily: fonts.sans, fontWeight: 600, fontSize: per(format, {landing: 30, reel: 40}), color: c.night, background: c.warm, padding: per(format, {landing: '16px 32px', reel: '22px 44px'}), borderRadius: 999}}>Gratis en Google Play</div>
        <div style={{fontFamily: fonts.sans, fontWeight: 500, fontSize: per(format, {landing: 30, reel: 40}), color: c.text, letterSpacing: 0.5}}>zarzabiblia.com</div>
      </div>
    </AbsoluteFill>
  );
};

/* ── Subtítulos quemados (solo 9:16, que se ve sin sonido) ─────────────── */

const Captions = () => {
  const f = useCurrentFrame();
  const sec = f / 30;
  for (const {id, at} of FILM_VO) {
    const t = voTiming[id];
    const start = at / 30;
    if (sec < start + t.speechStart - 0.1 || sec > start + t.speechEnd + 0.5) continue;
    // Trozos de hasta 5 palabras, cortados también después de una coma o unos puntos.
    const chunks: (typeof t.words)[] = [[]];
    for (const w of t.words) {
      const cur = chunks[chunks.length - 1];
      cur.push(w);
      if (cur.length >= 5 || /[,.…:]$/.test(w.w)) chunks.push([]);
    }
    const rel = sec - start;
    const chunk = chunks.filter((ch) => ch.length).find((ch, i, all) => rel < (all[i + 1]?.[0].start ?? Infinity) - 0.05) ?? [];
    return (
      <div style={{position: 'absolute', left: 60, right: 60, bottom: 66, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: 14, zIndex: 9}}>
        {chunk.map((w, i) => (
          <span key={i} style={{fontFamily: fonts.sans, fontWeight: 700, fontSize: 50, color: rel >= w.start ? c.text : 'rgba(236,234,230,0.4)', textShadow: '0 2px 18px rgba(0,0,0,0.8)'}}>
            {w.w}
          </span>
        ))}
      </div>
    );
  }
  return null;
};
