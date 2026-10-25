import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { confirm } from '@/components/comunidad/confirm';
import { Avatar, Button, Card, Chips, ErrorText, Field, Meter, SectionTitle, text, useAction } from '@/components/comunidad/ui';
import {
  BooksIcon,
  CheckIcon,
  ChevronRightIcon,
  ChurchIcon,
  CompassIcon,
  FlagIcon,
  HeartIcon,
  LockIcon,
  PeopleIcon,
  RouteIcon,
  ShieldIcon,
} from '@/components/icons';
import Reportar from '@/components/circulo/Reportar';
import TextoPasaje from '@/components/circulo/TextoPasaje';
import { ETAPAS_CAMINO } from '@/lib/camino';
import { type Etapa, EDAD_MINIMA, etapaCorta } from '@/lib/circulo';
import {
  type CirculoOpcion,
  type EstadoCirculo,
  type PersonaCirculo,
  borrarRespuestaSemana,
  cambiarEtapa,
  desmarcar,
  estadoCirculo,
  marcar,
  pedirEntrar,
  rangoEdad,
  responderSemana,
  salirCirculo,
} from '@/lib/circuloApi';
import { useAccount } from '@/lib/comunidad';
import { Colors, isDark, serif, useColors, useSettings } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const go = (href: string) => navigate(() => router.push(href as never), 'forward');

const ETAPAS_CIRCULO: { value: Etapa; label: string }[] = [
  { value: 'abierto', label: 'Abierto/a a conocer a alguien' },
  { value: 'soltero', label: 'Solo quiero amistades' },
];

/** «Círculo de solteros»: los solteros de una iglesia se conocen en grupos pequeños, con la Palabra en el centro. */
export default function CirculoScreen() {
  const colors = useColors();
  const { usuario, ready } = useAccount();
  const { modo } = useSettings().settings;
  const [estado, setEstado] = useState<EstadoCirculo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!usuario) return;
    estadoCirculo().then(
      (e) => {
        setEstado(e);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [usuario]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  let contenido;
  if (modo === 'jovenes') {
    contenido = (
      <>
        <Portada colors={colors} />
        <Card style={{ marginTop: 16 }}>
          <Text style={[text.body, { color: colors.text }]}>
            El círculo es para personas de {EDAD_MINIMA} años o más. Sal del Modo Jóvenes en Ajustes si eres adulto.
          </Text>
        </Card>
      </>
    );
  } else if (ready && !usuario) {
    contenido = (
      <>
        <Portada colors={colors} />
        <Welcome intro="Para entrar al círculo de tu iglesia necesitas una cuenta gratuita." />
      </>
    );
  } else if (!estado) {
    contenido = error ? (
      <Text style={[text.body, { color: colors.text, marginTop: 40 }]}>{error}</Text>
    ) : (
      <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
    );
  } else {
    contenido = (
      <>
        {estado.lidero.length > 0 && <Lidero estado={estado} colors={colors} />}
        {!estado.miembro ? (
          <Entrar estado={estado} colors={colors} onDone={reload} />
        ) : estado.miembro.estado === 'pendiente' ? (
          <Espera estado={estado} colors={colors} onDone={reload} />
        ) : estado.miembro.estado === 'pausado' ? (
          <Pausado estado={estado} colors={colors} onDone={reload} />
        ) : (
          <Dentro estado={estado} colors={colors} onDone={reload} />
        )}
      </>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Círculo de solteros' }} />
      {contenido}
    </ScrollView>
  );
}

function Portada({ colors }: { colors: Colors }) {
  const puntos = [
    { icon: ChurchIcon, texto: 'Solo personas de tu iglesia, mayores de 18 años, que un líder aprueba.' },
    { icon: RouteIcon, texto: 'Antes de buscar pareja, un camino de preparación: tu identidad, tu llamado, lo que duele y lo que importa.' },
    { icon: BooksIcon, texto: 'Cada semana leen un pasaje y responden juntos una pregunta.' },
    { icon: LockIcon, texto: '«Me gustaría conocerte» es secreto. Solo si los dos se eligen, se avisa a los dos.' },
  ];
  return (
    <Appear>
      <View style={[styles.hero, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Anillos colors={colors} />
        <Text style={[styles.kicker, { color: colors.warm, marginTop: 14 }]}>CÍRCULO DE SOLTEROS</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Conocerse creciendo en la Palabra</Text>
        <Text style={[styles.verse, { color: colors.muted }]}>
          «Sigue la justicia, la fe, el amor y la paz, con los que de corazón limpio invocan al Señor.» 2 Timoteo 2:22
        </Text>
        <View style={{ gap: 12, marginTop: 18 }}>
          {puntos.map(({ icon: Icon, texto }) => (
            <View key={texto} style={styles.punto}>
              <View style={[styles.puntoIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon color={colors.accent} size={16} strokeWidth={2} />
              </View>
              <Text style={[text.body, { color: colors.text, flex: 1 }]}>{texto}</Text>
            </View>
          ))}
        </View>
      </View>
    </Appear>
  );
}

/** Un círculo de puntos: las personas del grupo, sin rostros. */
function Anillos({ colors }: { colors: Colors }) {
  const n = 10;
  return (
    <View style={{ width: 64, height: 64 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const on = i === 0 || i === 4;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 28 + Math.cos(a) * 26,
              top: 28 + Math.sin(a) * 26,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: on ? colors.warm : colors.border,
            }}
          />
        );
      })}
      <View style={{ position: 'absolute', left: 22, top: 22, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
        <BooksIcon color={colors.muted} size={18} />
      </View>
    </View>
  );
}

/** Los círculos que la persona lidera, arriba de todo. */
function Lidero({ estado, colors }: { estado: EstadoCirculo; colors: Colors }) {
  return (
    <Appear>
      <SectionTitle>Círculos que lideras</SectionTitle>
      <View style={{ gap: 10, marginBottom: 8 }}>
        {estado.lidero.map((c) => {
          const avisos = c.pendientes + c.reportes;
          return (
            <Pressable
              key={c.id}
              onPress={() => go(`/circulo/lider/${c.id}`)}
              accessibilityRole="link"
              style={({ pressed }) => [styles.row, shadow(colors), { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}>
                <ShieldIcon color={colors.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{c.nombre}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                  {c.iglesia}
                  {c.pendientes ? ` · ${c.pendientes} ${c.pendientes === 1 ? 'pedido' : 'pedidos'}` : ''}
                  {c.reportes ? ` · ${c.reportes} ${c.reportes === 1 ? 'reporte' : 'reportes'}` : ''}
                </Text>
              </View>
              {avisos > 0 && (
                <View style={[styles.count, { backgroundColor: colors.warm }]}>
                  <Text style={{ color: colors.surface, fontWeight: '700', fontSize: 12 }}>{avisos}</Text>
                </View>
              )}
              <ChevronRightIcon color={colors.muted} size={20} />
            </Pressable>
          );
        })}
      </View>
    </Appear>
  );
}

function Entrar({ estado, colors, onDone }: { estado: EstadoCirculo; colors: Colors; onDone: () => void }) {
  const circulos = estado.circulos ?? [];
  const [etapa, setEtapa] = useState<Etapa>(estado.etapa === 'soltero' ? 'soltero' : 'abierto');
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState('');
  const [circulo, setCirculo] = useState<string | null>(circulos.length === 1 && !circulos[0].lleno ? circulos[0].id : null);
  const [acepto, setAcepto] = useState(false);
  const act = useAction();
  const casado = estado.etapa === 'casado' || estado.etapa === 'relacion';
  const nacimiento = `${anio.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  const completo = dia.length > 0 && mes.length > 0 && anio.length === 4 && !!circulo && acepto;

  if (!estado.iglesia) {
    return (
      <>
        <Portada colors={colors} />
        <Appear delay={80}>
          <Card style={{ marginTop: 16 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Primero, tu iglesia</Text>
            <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
              El círculo vive dentro de una iglesia que usa Zarza. Entra con el código o el QR de tu iglesia, y vuelve aquí.
            </Text>
            <Button label="Entrar con el código de mi iglesia" icon={ChurchIcon} onPress={() => go('/iglesia')} style={{ marginTop: 14 }} />
          </Card>
        </Appear>
      </>
    );
  }
  if (!circulos.length) {
    return (
      <>
        <Portada colors={colors} />
        <Appear delay={80}>
          <Card style={{ marginTop: 16 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{estado.iglesia.nombre} todavía no abrió un círculo</Text>
            <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
              Cuando tu iglesia nombre a sus líderes, el círculo aparecerá aquí. Si quieres que lo abran, cuéntaselo a tu pastor.
            </Text>
          </Card>
        </Appear>
      </>
    );
  }
  if (casado) {
    return (
      <>
        <Portada colors={colors} />
        <Card style={{ marginTop: 16 }}>
          <Text style={[text.body, { color: colors.text }]}>
            En tu perfil dice «{etapaCorta(estado.etapa)}». El círculo es para personas solteras. Si cambió tu situación, cámbiala aquí.
          </Text>
          <Button label="Soy soltero o soltera" kind="outline" onPress={() => act.run(() => cambiarEtapa('soltero')).then(onDone)} style={{ marginTop: 12 }} />
        </Card>
      </>
    );
  }

  if (!estado.importa) {
    return (
      <>
        <Portada colors={colors} />
        <Appear delay={80}>
          <CaminoTarjeta estado={estado} colors={colors} />
          <Card style={{ marginTop: 12 }}>
            <View style={styles.punto}>
              <View style={[styles.puntoIcon, { backgroundColor: colors.warmSoft }]}>
                <CompassIcon color={colors.warm} size={16} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Antes de entrar: lo que sí importa</Text>
                <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
                  Cinco preguntas directas sobre hijos, misiones, ministerio, estudio y trabajo, y finanzas. Tu círculo no ve tus
                  respuestas, solo en qué coinciden.
                </Text>
              </View>
            </View>
            <Button label="Responder" onPress={() => go('/circulo/importa')} style={{ marginTop: 14 }} />
          </Card>
        </Appear>
      </>
    );
  }

  const opciones = estado.importa.solteria ? ETAPAS_CIRCULO.filter((e) => e.value === 'soltero') : ETAPAS_CIRCULO;
  const enviar = async () => {
    if (await act.run(() => pedirEntrar(circulo!, nacimiento, estado.importa!.solteria ? 'soltero' : etapa))) onDone();
  };
  const numero = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

  return (
    <>
      <Portada colors={colors} />
      <Appear delay={80}>
        <CaminoTarjeta estado={estado} colors={colors} />
        <Card style={{ marginTop: 12, gap: 4 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pide entrar al círculo de {estado.iglesia.nombre}</Text>
          <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>Un líder del círculo revisa cada pedido.</Text>

          <Text style={[styles.label, { color: colors.muted }]}>¿Qué buscas?</Text>
          <Chips options={opciones} value={estado.importa.solteria ? 'soltero' : etapa} onChange={setEtapa} />
          <Text style={[text.small, { color: colors.muted, marginTop: 6, lineHeight: 19 }]}>
            {etapa === 'abierto' && !estado.importa.solteria
              ? `Las personas de tu círculo verán que estás abierto o abierta a conocer a alguien. Con el camino terminado podrás usar «Me gustaría conocerte».`
              : 'Participas en las lecturas y conversaciones. Nadie podrá marcarte con «Me gustaría conocerte».'}
          </Text>

          <Text style={[styles.label, { color: colors.muted }]}>Tu fecha de nacimiento</Text>
          <View style={styles.fecha}>
            <Field value={dia} onChangeText={(t) => setDia(numero(t, 2))} placeholder="Día" keyboardType="number-pad" style={styles.fechaCorta} accessibilityLabel="Día" />
            <Field value={mes} onChangeText={(t) => setMes(numero(t, 2))} placeholder="Mes" keyboardType="number-pad" style={styles.fechaCorta} accessibilityLabel="Mes" />
            <Field value={anio} onChangeText={(t) => setAnio(numero(t, 4))} placeholder="Año" keyboardType="number-pad" style={styles.fechaLarga} accessibilityLabel="Año" />
          </View>
          <Text style={[text.small, { color: colors.muted, marginTop: 6 }]}>Solo la ven los líderes. El círculo es para mayores de {EDAD_MINIMA}.</Text>

          <Text style={[styles.label, { color: colors.muted }]}>Tu círculo</Text>
          <View style={{ gap: 8 }}>
            {circulos.map((c) => (
              <OpcionCirculo key={c.id} c={c} on={circulo === c.id} onPress={() => setCirculo(c.id)} colors={colors} />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>El acuerdo del círculo</Text>
          <View style={[styles.acuerdo, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {estado.acuerdo.map((a) => (
              <View key={a} style={styles.punto}>
                <CheckIcon color={colors.warm} size={15} strokeWidth={2.2} />
                <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 20 }]}>{a}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => setAcepto(!acepto)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acepto }}
            style={[styles.check, { marginTop: 10 }]}
          >
            <View style={[styles.box, { borderColor: acepto ? colors.accent : colors.border, backgroundColor: acepto ? colors.accent : 'transparent' }]}>
              {acepto && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
            </View>
            <Text style={[text.body, { color: colors.text, flex: 1 }]}>Acepto el acuerdo</Text>
          </Pressable>

          <Button label="Pedir entrar" onPress={enviar} busy={act.busy} disabled={!completo} style={{ marginTop: 14 }} />
          <ErrorText>{act.error}</ErrorText>
        </Card>
      </Appear>
    </>
  );
}

/** Dónde va la persona en el camino de preparación, con el acceso para seguir. */
function CaminoTarjeta({ estado, colors }: { estado: EstadoCirculo; colors: Colors }) {
  const c = estado.camino;
  return (
    <Pressable
      onPress={() => go('/circulo/camino')}
      accessibilityRole="link"
      style={({ pressed }) => [styles.row, shadow(colors), { backgroundColor: colors.surface, borderColor: c.completo ? colors.border : colors.warm, marginTop: 16 }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: c.completo ? colors.accentSoft : colors.warmSoft }]}>
        {c.completo ? <CheckIcon color={colors.accent} size={20} strokeWidth={2.4} /> : <RouteIcon color={colors.warm} size={20} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.kicker, { color: c.completo ? colors.muted : colors.warm }]}>
          CAMINO DE PREPARACIÓN · {c.completo ? 'TERMINADO' : `${c.hechas} DE ${ETAPAS_CAMINO}`}
        </Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 3 }}>
          {c.completo ? 'Vuelve a tus respuestas cuando quieras' : c.hechas ? 'Sigue tu camino' : 'Prepárate primero con Dios'}
        </Text>
        {!c.completo && (
          <View style={{ marginTop: 8 }}>
            <Meter value={c.hechas} max={ETAPAS_CAMINO} colors={colors} />
          </View>
        )}
      </View>
      <ChevronRightIcon color={colors.muted} size={20} />
    </Pressable>
  );
}

function OpcionCirculo({ c, on, onPress, colors }: { c: CirculoOpcion; on: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={c.lleno}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled: c.lleno }}
      style={[
        styles.opcion,
        { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface },
        c.lleno && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.radio, { borderColor: on ? colors.accent : colors.border }]}>{on && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{c.nombre}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
          {rangoEdad(c)} · {c.lleno ? 'Lleno' : `${c.miembros} ${c.miembros === 1 ? 'persona' : 'personas'}`}
        </Text>
      </View>
    </Pressable>
  );
}

function Espera({ estado, colors, onDone }: { estado: EstadoCirculo; colors: Colors; onDone: () => void }) {
  return (
    <>
      <Portada colors={colors} />
      <Appear delay={80}>
        <View style={[styles.today, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
          <View style={[styles.stripe, { backgroundColor: colors.warm }]} />
          <Text style={[styles.kicker, { color: colors.warm }]}>PEDIDO ENVIADO</Text>
          <Text style={[styles.todayTitle, { color: colors.text }]}>{estado.miembro!.circulo.nombre}</Text>
          <Text style={[text.body, { color: colors.text, marginTop: 8 }]}>
            Un líder revisará tu pedido. Te avisaremos cuando entres, si tienes las notificaciones activas.
          </Text>
        </View>
      </Appear>
      <Salir colors={colors} onDone={onDone} texto="Retirar mi pedido" />
    </>
  );
}

function Pausado({ estado, colors, onDone }: { estado: EstadoCirculo; colors: Colors; onDone: () => void }) {
  return (
    <>
      <Card style={{ marginTop: 8 }}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Tu participación está en pausa</Text>
        <Text style={[text.body, { color: colors.muted, marginTop: 6 }]}>
          Alguien de {estado.miembro!.circulo.nombre} reportó una situación. Un líder la revisará y conversará contigo.
        </Text>
      </Card>
      <Salir colors={colors} onDone={onDone} />
    </>
  );
}

function Dentro({ estado, colors, onDone }: { estado: EstadoCirculo; colors: Colors; onDone: () => void }) {
  const m = estado.miembro!;
  const lideres = estado.lideres ?? [];
  return (
    <>
      <Appear style={styles.head}>
        <View style={styles.faces}>
          {(estado.personas ?? []).slice(0, 5).map((p, i) => (
            <View key={p.id} style={[styles.face, { marginLeft: i ? -10 : 0, borderColor: colors.background, backgroundColor: colors.background }]}>
              <Avatar name={p.nombre} foto={p.foto} size={38} />
            </View>
          ))}
        </View>
        <Text style={[styles.kicker, { color: colors.muted, marginTop: 12 }]}>
          {estado.iglesia?.nombre?.toUpperCase()} · {(estado.personas?.length ?? 0) + 1} PERSONAS
        </Text>
        <Text style={[styles.pairTitle, { color: colors.text }]}>{m.circulo.nombre}</Text>
        {lideres.length > 0 && (
          <Text style={[text.small, { color: colors.muted, marginTop: 4 }]}>
            {lideres.length === 1 ? 'Líder' : 'Líderes'}: {lideres.map((l) => l.nombre).join(', ')}
          </Text>
        )}
      </Appear>

      {estado.conocer && (
        <Appear delay={40}>
          <Pressable
            onPress={() => go(`/circulo/conocer/${estado.conocer!.id}`)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.today, { backgroundColor: colors.warmSoft, borderColor: colors.warm, marginBottom: 14 }, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.conocerRow}>
              <Avatar name={estado.conocer.otro.nombre} foto={estado.conocer.otro.foto} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: colors.warm }]}>
                  CONOCERNOS · {estado.conocer.progreso.terminado ? 'SEMANA COMPLETA' : `DÍA ${estado.conocer.progreso.dia} DE 7`}
                </Text>
                <Text style={[styles.cardTitle, { color: colors.text, marginTop: 2 }]}>Tú y {estado.conocer.otro.nombre.split(' ')[0]}</Text>
                <Text style={[text.small, { color: colors.muted, marginTop: 2 }]}>
                  {estado.conocer.mensajesNuevos
                    ? `${estado.conocer.mensajesNuevos} ${estado.conocer.mensajesNuevos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`
                    : estado.conocer.progreso.abierto
                      ? 'Hay una pregunta esperándote'
                      : 'El siguiente día se abre mañana'}
                </Text>
              </View>
              <ChevronRightIcon color={colors.warm} size={20} />
            </View>
          </Pressable>
        </Appear>
      )}

      <Appear delay={70}>
        <Semana
          key={`${estado.semana!.clave}-${estado.semana!.respuestas.find((r) => r.mia)?.texto ?? ''}`}
          estado={estado}
          colors={colors}
          onDone={onDone}
        />
      </Appear>

      <Appear delay={110}>
        {!estado.camino.completo && <CaminoTarjeta estado={estado} colors={colors} />}
        <TuEtapa estado={estado} colors={colors} onDone={onDone} />
      </Appear>

      <SectionTitle>Las personas del círculo</SectionTitle>
      <Marcas estado={estado} colors={colors} />
      <View style={{ gap: 10 }}>
        {(estado.personas ?? []).map((p) => (
          <FilaPersona key={p.id} p={p} estado={estado} colors={colors} onDone={onDone} />
        ))}
        {!estado.personas?.length && (
          <Text style={[text.body, { color: colors.muted }]}>Eres la primera persona del círculo. Pronto llegarán más.</Text>
        )}
      </View>

      <Salir colors={colors} onDone={onDone} />
    </>
  );
}

/** El pasaje y la pregunta de la semana, con lo que respondió el círculo. */
function Semana({ estado, colors, onDone }: { estado: EstadoCirculo; colors: Colors; onDone: () => void }) {
  const s = estado.semana!;
  const mia = s.respuestas.find((r) => r.mia);
  const [editando, setEditando] = useState(!mia);
  const [borrador, setBorrador] = useState(mia?.texto ?? '');
  const act = useAction();

  const guardar = async () => {
    if (await act.run(() => responderSemana(borrador))) {
      setEditando(false);
      onDone();
    }
  };
  const otros = s.respuestas.filter((r) => !r.mia);

  return (
    <View style={[styles.today, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.stripe, { backgroundColor: colors.warm }]} />
      <Text style={[styles.kicker, { color: colors.warm }]}>ESTA SEMANA · {s.referencia.toUpperCase()}</Text>
      <Text style={[styles.todayTitle, { color: colors.text }]}>{s.titulo}</Text>
      <TextoPasaje pasaje={s.pasaje} colors={colors} />
      <Text style={[styles.pregunta, { color: colors.text }]}>{s.pregunta}</Text>

      {editando ? (
        <>
          <Field value={borrador} onChangeText={setBorrador} multiline maxLength={1200} placeholder="Escribe lo que piensas. Lo leerá tu círculo." style={{ marginTop: 10 }} />
          <View style={[styles.rowButtons, { marginTop: 10 }]}>
            <Button label={mia ? 'Guardar' : 'Compartir con el círculo'} onPress={guardar} busy={act.busy} disabled={!borrador.trim()} style={{ flex: 1 }} />
            {mia && <Button label="Cancelar" kind="outline" onPress={() => setEditando(false)} style={{ flex: 1 }} />}
          </View>
          <ErrorText>{act.error}</ErrorText>
        </>
      ) : (
        <View style={[styles.respuesta, { borderColor: colors.border }]}>
          <Text style={[text.small, { color: colors.muted }]}>Tu respuesta</Text>
          <Text style={[styles.respuestaTexto, { color: colors.text }]}>{mia?.texto}</Text>
          <View style={[styles.rowButtons, { marginTop: 4 }]}>
            <Button label="Cambiar" kind="quiet" onPress={() => setEditando(true)} />
            <Button label="Borrar" kind="quiet" onPress={() => act.run(() => borrarRespuestaSemana()).then(onDone)} />
          </View>
        </View>
      )}

      {otros.length > 0 && (
        <View style={{ marginTop: 14, gap: 12 }}>
          <Text style={[styles.kicker, { color: colors.muted }]}>
            {otros.length} {otros.length === 1 ? 'RESPUESTA' : 'RESPUESTAS'} DEL CÍRCULO
          </Text>
          {otros.map((r) => (
            <View key={r.usuario.id} style={styles.otra}>
              <Avatar name={r.usuario.nombre} foto={r.usuario.foto} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{r.usuario.nombre}</Text>
                <Text style={[text.body, { color: colors.text, marginTop: 2 }]}>{r.texto}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {!otros.length && !mia && (
        <Text style={[text.small, { color: colors.muted, marginTop: 10 }]}>Nadie respondió todavía esta semana. Puedes ser la primera persona.</Text>
      )}
    </View>
  );
}

function TuEtapa({ estado, colors, onDone }: { estado: EstadoCirculo; colors: Colors; onDone: () => void }) {
  const act = useAction();
  const valor: Etapa = estado.etapa === 'abierto' ? 'abierto' : 'soltero';
  const cambiar = async (e: Etapa) => {
    if (e === valor) return;
    if (await act.run(() => cambiarEtapa(e))) onDone();
  };
  return (
    <Card style={{ marginTop: 14 }}>
      <Text style={[styles.kicker, { color: colors.muted }]}>LO QUE VE TU CÍRCULO</Text>
      <View style={{ marginTop: 10 }}>
        <Chips options={estado.importa?.solteria ? ETAPAS_CIRCULO.filter((e) => e.value === 'soltero') : ETAPAS_CIRCULO} value={valor} onChange={cambiar} />
      </View>
      <Text style={[text.small, { color: colors.muted, marginTop: 8, lineHeight: 19 }]}>
        Solo lo ven las personas de tu círculo. Si dejas de estar abierto o abierta, tus marcas se retiran sin que nadie lo sepa.
      </Text>
      {!!estado.importa?.proposito && <Text style={[styles.proposito, { color: colors.text, borderColor: colors.border }]}>«{estado.importa.proposito}»</Text>}
      <Pressable onPress={() => go('/circulo/importa')} accessibilityRole="link" hitSlop={6} style={styles.cambiarImporta}>
        <CompassIcon color={colors.accent} size={15} />
        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>Cambiar «Lo que sí importa»</Text>
      </Pressable>
      <ErrorText>{act.error}</ErrorText>
    </Card>
  );
}

function Marcas({ estado, colors }: { estado: EstadoCirculo; colors: Colors }) {
  const m = estado.marcas!;
  return (
    <View style={[styles.marcas, { backgroundColor: colors.accentSoft }]}>
      <LockIcon color={colors.accent} size={16} strokeWidth={2} />
      <Text style={[text.small, { color: colors.text, flex: 1, lineHeight: 19 }]}>
        {estado.etapa !== 'abierto'
          ? 'Para usar «Me gustaría conocerte», elige arriba que estás abierto o abierta a conocer a alguien.'
          : !estado.camino.completo
            ? `Para usar «Me gustaría conocerte», termina el camino de preparación (llevas ${estado.camino.hechas} de ${ETAPAS_CAMINO}). Mientras tanto, conózcanse leyendo juntos.`
            : estado.conocer
            ? 'Mientras estés en «Conocernos» no puedes marcar a nadie más.'
              : `«Me gustaría conocerte» es secreto. Tienes ${m.maxAbiertas - m.abiertas} de ${m.maxAbiertas} marcas libres y ${Math.max(0, m.maxMes - m.mes)} de ${m.maxMes} este mes. Se puede marcar a alguien después de responder los dos ${m.semanasEnComun} preguntas de la semana, y cada marca vence en ${m.dias} días.`}
      </Text>
    </View>
  );
}

function FilaPersona({ p, estado, colors, onDone }: { p: PersonaCirculo; estado: EstadoCirculo; colors: Colors; onDone: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [reportando, setReportando] = useState(false);
  const [mutuo, setMutuo] = useState<string | null>(null);
  const act = useAction();
  const nombre = p.nombre.split(' ')[0];
  const faltan = Math.max(0, (estado.marcas?.semanasEnComun ?? 2) - p.enComun);

  const toggleMarca = async () => {
    await act.run(async () => {
      if (p.marcada) await desmarcar(p.id);
      else {
        const r = await marcar(p.id);
        if (r.mutuo) setMutuo(r.mutuo);
      }
    });
    onDone();
  };

  let motivo: string | null = null;
  if (!p.marcada && !p.puedoMarcar && estado.etapa === 'abierto') {
    if (p.etapa !== 'abierto' || !p.coincidencias) motivo = `${nombre} participa solo para hacer amistades.`;
    else if (!estado.camino.completo) motivo = 'Podrás marcar a alguien cuando termines el camino de preparación.';
    else if (p.coincidencias.choca) motivo = `Por lo que respondieron, van hacia lugares distintos en algo que no se negocia. Pueden ser buenos amigos en el círculo.`;
    else if (faltan > 0) motivo = `Para poder marcarse, respondan los dos ${faltan === 1 ? 'una pregunta más' : `${faltan} preguntas más`} de la semana.`;
    else if (estado.conocer) motivo = null;
    else motivo = 'Ahora no puedes marcar a esta persona.';
  }

  return (
    <View style={[styles.persona, { backgroundColor: colors.surface, borderColor: p.marcada ? colors.warm : colors.border }]}>
      <Pressable onPress={() => setAbierta(!abierta)} accessibilityRole="button" accessibilityState={{ expanded: abierta }} style={styles.personaHead}>
        <Avatar name={p.nombre} foto={p.foto} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
            {p.nombre}
          </Text>
          <View style={styles.tags}>
            {p.etapa === 'abierto' && (
              <View style={[styles.tag, { borderColor: colors.warm }]}>
                <Text style={{ color: colors.warm, fontSize: 12, fontWeight: '600' }}>Abierto/a a conocer a alguien</Text>
              </View>
            )}
            {p.enComun > 0 && (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {p.enComun} {p.enComun === 1 ? 'semana' : 'semanas'} en común
              </Text>
            )}
          </View>
        </View>
        {p.marcada && <HeartIcon color={colors.warm} size={20} filled />}
      </Pressable>

      {abierta && (
        <View style={[styles.personaBody, { borderTopColor: colors.border }]}>
          {!!p.bio && <Text style={[text.body, { color: colors.text }]}>{p.bio}</Text>}
          {!!p.proposito && (
            <View style={{ marginTop: p.bio ? 12 : 0 }}>
              <Text style={[styles.kicker, { color: colors.muted }]}>SU PROPÓSITO</Text>
              <Text style={[styles.proposito, { color: colors.text, borderColor: colors.warm, marginTop: 4 }]}>«{p.proposito}»</Text>
            </View>
          )}
          {!!p.sirvo && <Text style={[text.small, { color: colors.muted, marginTop: 8 }]}>Sirve en: {p.sirvo}</Text>}
          {p.coincidencias && !p.coincidencias.choca && (p.coincidencias.coinciden.length > 0 || p.coincidencias.conversar.length > 0) && (
            <View style={[styles.tags, { marginTop: 12, marginBottom: 12 }]}>
              {p.coincidencias.coinciden.map((t) => (
                <View key={t} style={[styles.chip, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                  <CheckIcon color={colors.accent} size={12} strokeWidth={2.6} />
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Coinciden: {t}</Text>
                </View>
              ))}
              {p.coincidencias.conversar.map((t) => (
                <View key={t} style={[styles.chip, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>Para conversar: {t}</Text>
                </View>
              ))}
            </View>
          )}
          {mutuo ? (
            <View style={[styles.mutuo, { backgroundColor: colors.warmSoft }]}>
              <Text style={[styles.kicker, { color: colors.warm }]}>ES MUTUO</Text>
              <Text style={[text.body, { color: colors.text, marginTop: 4 }]}>{nombre} también quiere conocerte.</Text>
              <Button label="Empezar «Conocernos»" onPress={() => go(`/circulo/conocer/${mutuo}`)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </View>
          ) : p.marcada || p.puedoMarcar ? (
            <>
              <Button
                label={p.marcada ? 'Quitar «Me gustaría conocerte»' : 'Me gustaría conocerte'}
                icon={HeartIcon}
                kind={p.marcada ? 'outline' : 'primary'}
                onPress={toggleMarca}
                busy={act.busy}
                style={{ marginTop: p.bio ? 12 : 0, alignSelf: 'flex-start' }}
              />
              <Text style={[text.small, { color: colors.muted, marginTop: 8, lineHeight: 19 }]}>
                {p.marcada
                  ? `${nombre} no lo sabe. Si también te marca, se avisará a los dos.`
                  : `${nombre} no se enterará a menos que también te marque.`}
              </Text>
            </>
          ) : (
            motivo && <Text style={[text.small, { color: colors.muted, marginTop: p.bio ? 10 : 0, lineHeight: 19 }]}>{motivo}</Text>
          )}
          <ErrorText>{act.error}</ErrorText>
          {reportando ? (
            <Reportar usuario={p.id} nombre={nombre} colors={colors} onDone={() => { setReportando(false); onDone(); }} />
          ) : (
            <Pressable onPress={() => setReportando(true)} accessibilityRole="button" hitSlop={6} style={[styles.reportLink]}>
              <FlagIcon color={colors.muted} size={14} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Reportar o bloquear</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Salir({ colors, onDone, texto = 'Salir del círculo' }: { colors: Colors; onDone: () => void; texto?: string }) {
  const salir = async () => {
    const ok = await confirm(
      '¿Salir del círculo?',
      'Se borran tus marcas y se cierra «Conocernos» si estabas en uno. Tus respuestas de la semana se quedan con el grupo.',
      'Salir',
    );
    if (ok) await salirCirculo().catch(() => {});
    onDone();
  };
  return (
    <View style={[styles.ajustes, { borderTopColor: colors.border }]}>
      <View style={styles.punto}>
        <PeopleIcon color={colors.muted} size={16} />
        <Text style={[text.small, { color: colors.muted, flex: 1, lineHeight: 19 }]}>
          Los líderes no leen tus conversaciones: solo ven lo que alguien reporta. El círculo no reemplaza el consejo pastoral.
        </Text>
      </View>
      <Button label={texto} kind="quiet" onPress={salir} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
    </View>
  );
}

const shadow = (colors: Colors) => (isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.06), 0 8px 24px rgba(60, 40, 20, 0.06)' });

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 12, paddingBottom: 64, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 22 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  heroTitle: { fontFamily: serif, fontSize: 30, lineHeight: 36, marginTop: 6 },
  verse: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, lineHeight: 22, marginTop: 8 },
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  puntoIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: serif, fontSize: 20 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  fecha: { flexDirection: 'row', gap: 8 },
  fechaCorta: { width: 72, textAlign: 'center' },
  fechaLarga: { width: 96, textAlign: 'center' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  acuerdo: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  today: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 20, paddingLeft: 24, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  todayTitle: { fontFamily: serif, fontSize: 25, lineHeight: 31, marginTop: 6 },
  head: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  faces: { flexDirection: 'row' },
  face: { borderWidth: 3, borderRadius: 24 },
  pairTitle: { fontFamily: serif, fontSize: 28, marginTop: 2, textAlign: 'center' },
  conocerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pregunta: { fontFamily: serif, fontSize: 19, lineHeight: 26, marginTop: 14, fontStyle: 'italic' },
  respuesta: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 12 },
  respuestaTexto: { fontFamily: serif, fontSize: 17, lineHeight: 25, marginTop: 4 },
  rowButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  otra: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  marcas: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 14, padding: 14, marginBottom: 12 },
  persona: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  personaHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  personaBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  tag: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  proposito: { fontFamily: serif, fontStyle: 'italic', fontSize: 16, lineHeight: 23, borderLeftWidth: 3, paddingLeft: 10, marginTop: 10 },
  cambiarImporta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  mutuo: { borderRadius: 14, padding: 14, marginTop: 4 },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  reportar: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14 },
  ajustes: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 28, paddingTop: 16 },
});
