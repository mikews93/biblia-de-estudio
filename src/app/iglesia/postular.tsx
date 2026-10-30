import { Stack, router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Appear from '@/components/Appear';
import Welcome from '@/components/comunidad/Welcome';
import { Button, ErrorText, Field, text, useAction } from '@/components/comunidad/ui';
import { CheckIcon, ChurchIcon, ClockIcon, QrIcon, type IconProps } from '@/components/icons';
import { useAccount } from '@/lib/comunidad';
import { DECLARACION_FE, DatosPostulacion, Postulacion, miEncargo, postularIglesia } from '@/lib/iglesias';
import { Colors, isDark, serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

const VACIO: DatosPostulacion = {
  nombre: '',
  ciudad: '',
  direccion: '',
  denominacion: '',
  responsable: '',
  cargo: '',
  contacto: '',
  enlace: '',
  mensaje: '',
};

/**
 * «Postula tu iglesia»: un pastor o líder envía los datos de su iglesia para que sea anfitriona. Alguien de Cuidar
 * Zarza comprueba que exista y la aprueba; entonces quien la postuló recibe el código y queda como su encargado.
 */
export default function PostularIglesia() {
  const colors = useColors();
  const { ready, usuario } = useAccount();
  const [estado, setEstado] = useState<{ postulacion: Postulacion | null; encargado: boolean } | null>(null);
  const [datos, setDatos] = useState<DatosPostulacion>(() => ({ ...VACIO }));
  const [fe, setFe] = useState(false);
  const send = useAction();
  const userId = usuario?.id;

  useEffect(() => {
    if (!userId) return;
    miEncargo()
      .then((r) => setEstado({ postulacion: r.postulacion, encargado: !!r.iglesia }))
      .catch(() => setEstado({ postulacion: null, encargado: false }));
  }, [userId]);

  // Con la cuenta, el nombre de quien postula ya se sabe; se puede cambiar.
  const responsable = datos.responsable || (usuario?.nombre ?? '');
  const campo = (k: keyof DatosPostulacion) => (v: string) => setDatos((d) => ({ ...d, [k]: v }));
  const listo = !!(datos.nombre.trim() && datos.ciudad.trim() && responsable.trim() && datos.contacto.trim() && fe);
  const enviar = () =>
    send.run(async () => {
      const r = await postularIglesia({ ...datos, responsable });
      setEstado({ postulacion: r.postulacion, encargado: false });
      setDatos({ ...VACIO });
      setFe(false);
    });

  const cargando = !ready || (!!usuario && !estado);
  const postulacion = estado?.postulacion;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Postular mi iglesia' }} />
      <Appear>
        <View style={styles.hero}>
          <View style={[styles.emblem, { backgroundColor: colors.accentSoft }]}>
            <ChurchIcon color={colors.accent} size={30} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Postula tu iglesia</Text>
          <Text style={[text.body, { color: colors.muted, textAlign: 'center', maxWidth: 460 }]}>
            Las iglesias anfitrionas ayudan a sostener Zarza, y sus miembros tienen más preguntas a la IA cada día. Si eres pastor o
            líder, cuéntanos de tu iglesia.
          </Text>
        </View>
      </Appear>

      <Appear delay={40}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(colors)]}>
          <Paso colors={colors} n={1} icon={ChurchIcon} title="Nos envías sus datos" done={!!postulacion}>
            El nombre, dónde está y cómo contactarla.
          </Paso>
          <Paso colors={colors} n={2} icon={ClockIcon} title="Comprobamos que exista" done={postulacion?.estado === 'aprobada'}>
            Una persona revisa su sitio, el mapa o sus redes, y puede llamar al contacto. Suele tardar unos días.
          </Paso>
          <Paso colors={colors} n={3} icon={QrIcon} title="Recibes el código y el QR" done={postulacion?.estado === 'aprobada'} last>
            Quedas como encargado: lo compartes con tu congregación y ves cuántos entraron.
          </Paso>
        </View>
      </Appear>

      {cargando ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : !usuario ? (
        <Appear delay={80}>
          <Welcome intro="Para postular tu iglesia necesitas una cuenta gratuita. Así te avisamos cuando la revisemos." />
        </Appear>
      ) : estado?.encargado || postulacion?.estado === 'aprobada' ? (
        <Appear delay={80}>
          <Estado colors={colors} tone="ok" title="Tu iglesia ya es anfitriona" body="Su código, el QR y cuántos entraron están en tu iglesia.">
            <Button label="Ver mi iglesia" onPress={() => navigate(() => router.replace('/iglesia'), 'forward')} style={{ marginTop: 14 }} />
          </Estado>
        </Appear>
      ) : postulacion?.estado === 'pendiente' ? (
        <Appear delay={80}>
          <Estado
            colors={colors}
            tone="wait"
            title={`${postulacion.nombre} está en revisión`}
            body="Te avisaremos con una notificación cuando la revisemos. Si hace falta algo, te escribiremos al contacto que nos diste."
          />
        </Appear>
      ) : (
        <>
          {postulacion?.estado === 'rechazada' && (
            <Appear delay={60}>
              <Estado colors={colors} tone="warn" title={`Aún no pudimos aprobar ${postulacion.nombre}`} body={postulacion.motivo ?? ''}>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>Corrige lo que haga falta y envíala de nuevo.</Text>
              </Estado>
            </Appear>
          )}
          <Appear delay={80}>
            <Seccion colors={colors} title="La iglesia">
              <Field label="Nombre" value={datos.nombre} onChangeText={campo('nombre')} placeholder="Iglesia Bautista La Roca" maxLength={80} />
              <Field label="Ciudad y país" value={datos.ciudad} onChangeText={campo('ciudad')} placeholder="Cali, Colombia" maxLength={80} />
              <Field
                label="Dirección (opcional)"
                value={datos.direccion}
                onChangeText={campo('direccion')}
                placeholder="Calle 5 # 10-20"
                maxLength={160}
              />
              <Field
                label="Denominación (opcional)"
                value={datos.denominacion}
                onChangeText={campo('denominacion')}
                placeholder="Bautista, pentecostal, independiente…"
                maxLength={80}
              />
              <Field
                label="Sitio web o redes (opcional)"
                value={datos.enlace}
                onChangeText={campo('enlace')}
                placeholder="facebook.com/tu-iglesia"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                maxLength={200}
              />
            </Seccion>
          </Appear>
          <Appear delay={110}>
            <Seccion colors={colors} title="Quién la postula">
              <Field label="Tu nombre" value={responsable} onChangeText={campo('responsable')} maxLength={80} />
              <Field label="Tu cargo (opcional)" value={datos.cargo} onChangeText={campo('cargo')} placeholder="Pastor, anciano, líder de jóvenes…" maxLength={60} />
              <Field
                label="Teléfono o correo de la iglesia"
                value={datos.contacto}
                onChangeText={campo('contacto')}
                placeholder="Para confirmar que existe"
                autoCapitalize="none"
                maxLength={120}
              />
              <Field
                label="¿Algo más? (opcional)"
                value={datos.mensaje}
                onChangeText={campo('mensaje')}
                placeholder="Cuántas personas se congregan, cómo conocieron Zarza…"
                multiline
                maxLength={600}
              />
            </Seccion>
          </Appear>
          <Appear delay={140}>
            <Pressable
              onPress={() => setFe((v) => !v)}
              accessibilityRole="checkbox"
              aria-checked={fe}
              style={[styles.fe, { backgroundColor: colors.surface, borderColor: fe ? colors.accent : colors.border }]}
              testID="declaracion-fe"
            >
              <View style={[styles.check, { borderColor: fe ? colors.accent : colors.border, backgroundColor: fe ? colors.accent : 'transparent' }]}>
                {fe && <CheckIcon color={colors.surface} size={14} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: colors.accent }]}>DECLARACIÓN DE FE</Text>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 4 }}>{DECLARACION_FE}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Nuestra iglesia está de acuerdo con esta declaración.</Text>
              </View>
            </Pressable>
            <Button label="Enviar postulación" icon={ChurchIcon} onPress={enviar} busy={send.busy} disabled={!listo} style={{ marginTop: 16 }} />
            <ErrorText>{send.error}</ErrorText>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 }}>
              Solo quienes cuidan Zarza ven estos datos, para comprobar que la iglesia existe.
            </Text>
          </Appear>
        </>
      )}
    </ScrollView>
  );
}

function Paso({
  colors,
  n,
  icon: Icon,
  title,
  done,
  last,
  children,
}: {
  colors: Colors;
  n: number;
  icon: (p: IconProps) => ReactNode;
  title: string;
  done?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.paso}>
      <View style={{ alignItems: 'center' }}>
        <View style={[styles.pasoIcon, { backgroundColor: done ? colors.accent : colors.accentSoft }]}>
          {done ? <CheckIcon color={colors.surface} size={16} /> : <Icon color={colors.accent} size={16} />}
        </View>
        {!last && <View style={[styles.pasoLine, { backgroundColor: colors.border }]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
          {n}. {title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{children}</Text>
      </View>
    </View>
  );
}

function Seccion({ colors, title, children }: { colors: Colors; title: string; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 14 }, shadow(colors)]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Estado({
  colors,
  tone,
  title,
  body,
  children,
}: {
  colors: Colors;
  tone: 'ok' | 'wait' | 'warn';
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const Icon = tone === 'ok' ? CheckIcon : tone === 'wait' ? ClockIcon : ChurchIcon;
  return (
    <View style={[styles.estado, { backgroundColor: tone === 'warn' ? colors.surface : colors.accentSoft, borderColor: colors.border }]}>
      <View style={[styles.pasoIcon, { backgroundColor: tone === 'ok' ? colors.accent : colors.surface }]}>
        <Icon color={tone === 'ok' ? colors.surface : colors.accent} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        {!!body && <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{body}</Text>}
        {children}
      </View>
    </View>
  );
}

const shadow = (colors: Colors) =>
  isDark(colors) ? null : { boxShadow: '0 1px 2px rgba(60, 40, 20, 0.05), 0 6px 20px rgba(60, 40, 20, 0.05)' };

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 60, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 4 },
  emblem: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  sectionTitle: { fontFamily: serif, fontSize: 20, fontWeight: '700' },
  paso: { flexDirection: 'row', gap: 12 },
  pasoIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pasoLine: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  estado: { flexDirection: 'row', gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  fe: { flexDirection: 'row', gap: 12, borderRadius: 20, borderWidth: 1, padding: 16 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
});
