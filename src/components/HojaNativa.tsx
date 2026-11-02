import { type ComponentRef, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, type LayoutChangeEvent, PanResponder, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import type { Swap } from '@/lib/pageSwipe';

/** Distancia antes de decidir que el gesto es horizontal, y cuánto arrastre pasa la hoja entera (como en la web). */
const SLOP = 12;
const FULL = 0.8;
/** Como pageTurn.ts: duración y número de fotogramas calculados. */
const DURATION = 680;
const FRAMES = 40;

type Hoja = {
  delta: 1 | -1;
  /** Foto del capítulo que se deja (hacia adelante es la hoja que se levanta; hacia atrás, la de debajo). */
  viejo: string;
  /** Hacia atrás: foto del capítulo anterior, la hoja que cae encima. */
  nuevo: string | null;
};

type Opciones = {
  /** El texto del lector (su ScrollView): de él se sacan las fotos de las hojas. La cabecera queda quieta encima. */
  pagina: RefObject<ComponentRef<typeof ScrollView> | null>;
  /** Cambia de capítulo en el mismo lector (el mismo swap que usa la web), o null si no se puede. */
  swap: Swap;
  /** Si un toque que empieza en (x, y) puede pasar la hoja (fuera de la cabecera, de la barra del versículo...). */
  puedeEmpezar: (x: number, y: number) => boolean;
  /** El capítulo que el lector ya pintó con sus versículos («juan/3»), o '' mientras carga. */
  pintado: string;
  /** El color del papel, para el dorso de la hoja. */
  papel: string;
};

type Turno = {
  delta: 1 | -1;
  progress: number;
  lista: boolean;
  swapped: { go: () => void; back: () => void };
  /** Al soltar antes de tener la hoja lista: si pasa o vuelve. */
  soltado: boolean | null;
  conDedo: boolean;
  /** Ya se cambió de capítulo debajo. */
  cambiado: boolean;
  /** Lo siguiente que espera el turno: que cargue una foto o que el lector pinte el capítulo nuevo. */
  alCargar: (() => void) | null;
  alPintar: (() => void) | null;
};

/**
 * Pasar la hoja en el teléfono (Android e iPhone) con el mismo doblez que la web (pageTurn.ts).
 *
 * La web usa View Transitions, que no existen en la app nativa, así que aquí las hojas son fotos del texto del
 * lector (react-native-view-shot). La hoja se dobla por una línea diagonal que nace en la esquina inferior derecha
 * y barre la página hasta el lomo, enderezándose al final. Lo que aún no se ha pasado queda recortado a un lado
 * de la línea; el dorso de papel aparece reflejado al otro lado, con la sombra que proyecta sobre la página de
 * debajo y el doblez oscurecido. Los recortes son vistas giradas con overflow hidden (en nativo no hay
 * clip-path) y cada fotograma se calcula aquí y se interpola con el driver nativo, así que va fluido.
 *
 * Hacia adelante, la foto del capítulo de ahora se levanta y debajo ya está el siguiente, vivo. Hacia atrás es
 * la misma animación al revés: cae encima la foto del capítulo anterior (se saca en cuanto el lector lo pinta,
 * tapado por la foto del de ahora). Con el dedo la hoja sigue el gesto; al soltar termina si se arrastró lo
 * bastante o se lanzó rápido, y si no vuelve y el capítulo de antes regresa debajo. Solo JavaScript y módulos
 * que ya están en la app, así que llega con una actualización.
 */
export function useHojaNativa({ pagina, swap, puedeEmpezar, pintado, papel }: Opciones) {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [tam, setTam] = useState({ W: 0, H: 0 });
  const t = useRef(new Animated.Value(0)).current;
  const latest = useRef({ swap, puedeEmpezar, tam });
  latest.current = { swap, puedeEmpezar, tam };
  const turno = useRef<Turno | null>(null);

  // El lector pintó otro capítulo: si un turno hacia atrás lo esperaba para sacarle la foto, sigue.
  useEffect(() => {
    if (pintado) turno.current?.alPintar?.();
  }, [pintado]);

  const quitar = () => {
    turno.current = null;
    setHoja(null);
  };

  const terminar = (pasa: boolean, velocidad = 0) => {
    const g = turno.current;
    if (!g) return;
    if (!g.lista) {
      g.soltado = pasa;
      return;
    }
    const destino = pasa ? 1 : 0;
    const resto = Math.abs(destino - g.progress);
    Animated.timing(t, {
      toValue: destino,
      // Con un lanzamiento rápido la hoja acaba antes. Con los botones, la misma curva que la web.
      duration: Math.max(160, (DURATION * resto) / Math.max(1, Math.abs(velocidad) * 1.5)),
      easing: g.conDedo ? Easing.out(Easing.cubic) : Easing.bezier(0.42, 0, 0.3, 1),
      useNativeDriver: true,
    }).start(() => {
      if (pasa) return quitar();
      // La hoja vuelve a tapar todo: debajo regresa el capítulo de antes y se quita en cuanto se ha pintado.
      g.swapped.back();
      setTimeout(quitar, 260);
    });
  };

  const arrancar = (g: Turno) => {
    g.lista = true;
    t.setValue(g.progress);
    if (!g.conDedo) terminar(true);
    else if (g.soltado !== null) terminar(g.soltado);
  };

  const foto = () => captureRef(pagina, { format: 'jpg', quality: 0.92, result: 'tmpfile' });

  /** Empieza a pasar la hoja: foto del texto, la hoja encima y, ya tapado, el capítulo nuevo debajo. */
  const empezar = (delta: 1 | -1, conDedo: boolean): boolean => {
    if (turno.current || !latest.current.tam.W) return false;
    const swapped = latest.current.swap(delta);
    if (!swapped || !pagina.current) return false;
    const g: Turno = { delta, progress: 0, lista: false, swapped, soltado: null, conDedo, cambiado: false, alCargar: null, alPintar: null };
    turno.current = g;
    t.setValue(0);
    const cambiar = () => {
      g.cambiado = true;
      swapped.go();
    };
    const fallo = () => {
      // Sin foto no hay hoja: el capítulo queda como si se hubiera pasado sin animación (o vuelve si se soltó sin pasarla).
      if (turno.current !== g) return;
      quitar();
      const pasa = !conDedo || g.soltado !== false;
      if (pasa && !g.cambiado) swapped.go();
      if (!pasa && g.cambiado) swapped.back();
    };
    foto()
      .then((viejo) => {
        if (turno.current !== g) return;
        g.alCargar = () => {
          g.alCargar = null;
          if (delta > 0) {
            // Hacia adelante la hoja que se levanta es esta foto: debajo, el capítulo siguiente vivo.
            cambiar();
            arrancar(g);
            return;
          }
          // Hacia atrás la foto tapa el lector mientras pinta el capítulo anterior, y se le saca otra foto.
          g.alPintar = () => {
            g.alPintar = null;
            setTimeout(() => {
              if (turno.current !== g) return;
              foto()
                .then((nuevo) => {
                  if (turno.current !== g) return;
                  g.alCargar = () => {
                    g.alCargar = null;
                    arrancar(g);
                  };
                  setHoja({ delta, viejo, nuevo });
                })
                .catch(fallo);
            }, 90);
          };
          cambiar();
          // Si el capítulo no llega a pintarse (sin conexión, por ejemplo), la hoja cae igual.
          setTimeout(() => g.alPintar?.(), 1500);
        };
        setHoja({ delta, viejo, nuevo: null });
      })
      .catch(fallo);
    return true;
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (e, s) => {
        if (turno.current) return false;
        if (Math.abs(s.dx) < SLOP || Math.abs(s.dx) < Math.abs(s.dy) * 1.4) return false;
        // x0/y0 solo se llenan al conceder el gesto: el punto de partida es donde está el dedo menos lo recorrido.
        if (!latest.current.puedeEmpezar(e.nativeEvent.pageX - s.dx, e.nativeEvent.pageY - s.dy)) return false;
        return empezar(s.dx < 0 ? 1 : -1, true);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, s) => {
        const g = turno.current;
        if (!g) return;
        g.progress = Math.min(1, Math.max(0, (g.delta > 0 ? -s.dx : s.dx) / (latest.current.tam.W * FULL)));
        if (g.lista) t.setValue(g.progress);
      },
      onPanResponderRelease: (_, s) => {
        const g = turno.current;
        if (!g) return;
        const v = g.delta > 0 ? -s.vx : s.vx;
        terminar(g.progress > 0.4 || (v > 0.5 && g.progress > 0.05), v);
      },
      onPanResponderTerminate: () => terminar(false),
    }),
  ).current;

  const doblez = useMemo(() => (tam.W ? fotogramas(tam.W, tam.H) : null), [tam.W, tam.H]);

  let capa: ReactNode = null;
  if (hoja && doblez) {
    const { W, H } = tam;
    const { M, input, k, flap, sombra, brillo } = doblez;
    // Hacia atrás es la misma animación al revés: la hoja está en el fotograma 1 - avance.
    const f: Animated.AnimatedInterpolation<number> = t.interpolate({ inputRange: [0, 1], outputRange: hoja.delta > 0 ? [0, 1] : [1, 0] });
    const at = (values: number[]) => f.interpolate({ inputRange: input, outputRange: values });
    const deg = (values: number[]) => f.interpolate({ inputRange: input, outputRange: values.map((v) => `${v}deg`) });
    const hojaQuePasa = hoja.delta > 0 ? hoja.viejo : hoja.nuevo;
    const cargada = () => turno.current?.alCargar?.();
    const recorte = { width: M, height: 2 * M, transform: [{ translateX: at(k.x) }, { translateY: at(k.y) }, { rotate: deg(k.rot) }] };
    capa = (
      <View style={[StyleSheet.absoluteFill, styles.capa]} pointerEvents="none">
        {/* Hacia atrás, debajo queda la foto del capítulo que se deja. */}
        {hoja.delta < 0 && <Foto uri={hoja.viejo} W={W} H={H} onLoad={hoja.nuevo ? undefined : cargada} />}
        {hojaQuePasa && (
          <>
            {/* La sombra que la hoja proyecta sobre la página de debajo. */}
            <Animated.View
              style={[styles.origen, { width: 90, height: 3 * H, transform: [{ translateX: at(sombra.x) }, { translateY: at(sombra.y) }, { rotate: deg(sombra.rot) }] }]}
            >
              <Degradado
                id="sombra"
                stops={[
                  [0, '#000', 0.32],
                  [0.35, '#000', 0.1],
                  [1, '#000', 0],
                ]}
              />
            </Animated.View>
            {/* Lo que aún no se ha pasado: la foto recortada a un lado del doblez. */}
            <Animated.View style={[styles.origen, styles.recorte, recorte]}>
              <Animated.View style={[styles.origen, { width: W, height: H, transform: [{ translateX: at(k.cx) }, { translateY: M }, { rotate: deg(k.crot) }] }]}>
                <Foto uri={hojaQuePasa} W={W} H={H} onLoad={cargada} />
              </Animated.View>
            </Animated.View>
            {/* El dorso de la hoja: papel reflejado sobre el doblez. */}
            <Animated.View style={[styles.origen, styles.recorte, recorte]}>
              <Animated.View
                style={[
                  styles.origen,
                  {
                    width: W,
                    height: H,
                    backgroundColor: papel,
                    transform: [{ translateX: at(flap.x) }, { translateY: M }, { scaleX: -1 }, { rotate: deg(k.crot) }],
                  },
                ]}
              >
                <Svg width={W} height={H}>
                  <Defs>
                    <LinearGradient id="dorso" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor="#808080" stopOpacity={0.1} />
                      <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.04} />
                      <Stop offset="1" stopColor="#808080" stopOpacity={0.12} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width={W} height={H} fill="url(#dorso)" />
                </Svg>
              </Animated.View>
            </Animated.View>
            {/* El doblez se oscurece y brilla un poco sobre el dorso. */}
            <Animated.View
              style={[styles.origen, { width: 120, height: 3 * H, transform: [{ translateX: at(brillo.x) }, { translateY: at(brillo.y) }, { rotate: deg(brillo.rot) }] }]}
            >
              <Degradado
                id="brillo"
                stops={[
                  [0, '#000', 0.2],
                  [0.22, '#000', 0.04],
                  [0.48, '#FFF', 0.14],
                  [1, '#FFF', 0],
                ]}
              />
            </Animated.View>
          </>
        )}
      </View>
    );
  }

  return {
    /** Para la vista del lector: el gesto con el dedo. Solo en el teléfono; en la web lo hace usePageSwipe. */
    props: Platform.OS === 'web' ? {} : responder.panHandlers,
    /** Para el texto del lector: su tamaño, que es el de las hojas. */
    medir: (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setTam((s) => (s.W === width && s.H === height ? s : { W: width, H: height }));
    },
    /** La hoja que se pasa: va justo después del texto, encima de él y debajo de la cabecera y los botones. */
    capa,
    /** Pasar la hoja con los botones del lector; false si no se pudo (ahí se navega como siempre). */
    pasar: (delta: 1 | -1) => Platform.OS !== 'web' && empezar(delta, false),
  };
}

function Foto({ uri, W, H, onLoad }: { uri: string; W: number; H: number; onLoad?: () => void }) {
  return (
    <Image
      source={{ uri }}
      style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}
      resizeMode="stretch"
      fadeDuration={0}
      onLoad={onLoad}
      onError={onLoad}
    />
  );
}

function Degradado({ id, stops }: { id: string; stops: [number, string, number][] }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map(([offset, color, opacity]) => (
            <Stop key={offset} offset={String(offset)} stopColor={color} stopOpacity={opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Los fotogramas del doblez, con la misma geometría que pageTurn.ts. El doblez es la recta p·n = d, con n a
 * beta grados de la horizontal. Para recortar sin clip-path, una vista de M × 2M girada beta grados tiene su
 * borde derecho sobre la recta (lo que aún no se ha pasado queda dentro) y dentro va la foto deshaciendo el
 * giro; el dorso es la misma vista con el papel reflejado (scaleX -1) sobre la recta.
 */
function fotogramas(W: number, H: number) {
  const M = 2 * Math.hypot(W, H);
  const L = 1.5 * Math.hypot(W, H);
  const input: number[] = [];
  const k = { x: [] as number[], y: [] as number[], rot: [] as number[], cx: [] as number[], crot: [] as number[] };
  const flap = { x: [] as number[] };
  const sombra = { x: [] as number[], y: [] as number[], rot: [] as number[] };
  const brillo = { x: [] as number[], y: [] as number[], rot: [] as number[] };
  for (let i = 0; i <= FRAMES; i++) {
    const t = i / FRAMES;
    // Ángulo del doblez respecto a la vertical: diagonal al levantar la esquina, casi recto al llegar al lomo.
    const beta = ((24 - 21 * t) * Math.PI) / 180;
    const n = [Math.cos(beta), Math.sin(beta)];
    const u = [-n[1], n[0]];
    const start = W * n[0] + H * n[1];
    const end = -0.04 * W;
    const d = start + (end - start) * t;
    const deg = (beta * 180) / Math.PI;
    input.push(t);
    // El recorte: su esquina de arriba a la izquierda va a (d - M)·n - M·u, girado beta.
    k.x.push((d - M) * n[0] - M * u[0]);
    k.y.push((d - M) * n[1] - M * u[1]);
    k.rot.push(deg);
    // La foto dentro del recorte vuelve a su sitio en la página.
    k.cx.push(M - d);
    k.crot.push(-deg);
    // El dorso: reflejo de la página sobre la recta.
    flap.x.push(M + d);
    sombra.x.push(d * n[0] - L * u[0]);
    sombra.y.push(d * n[1] - L * u[1]);
    sombra.rot.push(deg);
    brillo.x.push(d * n[0] + L * u[0]);
    brillo.y.push(d * n[1] + L * u[1]);
    brillo.rot.push(deg + 180);
  }
  return { M, input, k, flap, sombra, brillo };
}

const styles = StyleSheet.create({
  capa: { overflow: 'hidden' },
  origen: { position: 'absolute', left: 0, top: 0, transformOrigin: 'left top' },
  recorte: { overflow: 'hidden' },
});
