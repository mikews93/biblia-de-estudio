import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { NoEstasSolo } from '@/components/ParaTi';
import { CheckIcon, HeartIcon, LockIcon } from '@/components/icons';
import { Animo, ResumenGrupo, ago, api } from '@/lib/comunidad';
import { ANIMOS_SUGERIDOS, DIAS_VISIBLE, MAX_ANIMO, revisarPeticion } from '@/lib/pedirOracion';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { Button, ErrorText, Field, IconText, useAction } from './ui';

/**
 * Escribir una petición para un grupo: sin detalles, con la opción de ir sin nombre y, si habla de hacerse daño,
 * primero quién puede ayudar hoy. Se usa en la pestaña Oración del grupo y desde el diario (src/lib/pedirOracion.ts).
 */
export function ComponerPeticion({
  inicial = '',
  grupo,
  grupos,
  boton = 'Pedir oración',
  onEnviada,
}: {
  inicial?: string;
  /** Grupo fijo (la pestaña del grupo); si no, se elige entre `grupos`. */
  grupo?: string;
  grupos?: ResumenGrupo[];
  boton?: string;
  onEnviada: (r: { id: string; grupo: string }) => void;
}) {
  const colors = useColors();
  const [texto, setTexto] = useState(inicial);
  const [anonima, setAnonima] = useState(false);
  const [elegido, setElegido] = useState<string | null>(grupo ?? (grupos?.length === 1 ? grupos[0].id : null));
  const [seguir, setSeguir] = useState(false);
  const { busy, error, run } = useAction();
  const revision = revisarPeticion(texto);

  const enviar = () =>
    run(async () => {
      if (!elegido) return;
      const r = await api<{ id: string }>('nuevaPeticion', { grupo: elegido, texto, anonima });
      setTexto('');
      setAnonima(false);
      setSeguir(false);
      onEnviada({ id: r.id, grupo: elegido });
    });

  return (
    <View style={{ gap: 10 }} testID="componer-peticion">
      {!grupo && grupos && grupos.length > 1 && (
        <View style={{ gap: 6 }}>
          <Text style={[styles.label, { color: colors.muted }]}>¿A qué grupo?</Text>
          <View style={styles.chips}>
            {grupos.map((g) => {
              const on = elegido === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setElegido(g.id)}
                  accessibilityRole="radio"
                  aria-checked={on}
                  style={[styles.chip, { borderColor: on ? colors.accent : colors.border }, on && { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={{ color: on ? colors.accent : colors.text, fontWeight: on ? '700' : '600', fontSize: 14 }}>{g.nombre}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Field
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={500}
        placeholder="¿Por qué podemos orar contigo?"
        accessibilityLabel="Petición para el grupo"
      />
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        No hace falta contar detalles: tu grupo puede orar contigo sin saberlo todo. Lo más personal, mejor en persona con
        alguien de confianza.
      </Text>

      <Pressable
        onPress={() => setAnonima((a) => !a)}
        accessibilityRole="checkbox"
        aria-checked={anonima}
        style={styles.check}
        testID="sin-mi-nombre"
      >
        <View style={[styles.box, { borderColor: anonima ? colors.accent : colors.border }, anonima && { backgroundColor: colors.accent }]}>
          {anonima && <CheckIcon color={colors.surface} size={14} strokeWidth={2.6} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Sin mi nombre</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>Saldrá como «Alguien del grupo». Igual recibirás los ánimos.</Text>
        </View>
      </Pressable>

      {revision.riesgo ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.aviso, { color: colors.text, fontFamily: serif }]}>
            Lo que escribiste pesa mucho. Antes de contarlo al grupo, habla hoy con alguien que pueda estar contigo: tu
            pastor, alguien de tu familia o una de estas líneas.
          </Text>
          <NoEstasSolo colors={colors} />
          {!seguir && (
            <Pressable onPress={() => setSeguir(true)} hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button">
              <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Ya hablé con alguien; quiero pedir oración</Text>
            </Pressable>
          )}
        </View>
      ) : (
        revision.larga && (
          <Text style={{ color: colors.warm, fontSize: 13, lineHeight: 19 }}>
            Puedes decirlo más corto. Por ejemplo: «Oren por mí, estoy pasando un tiempo difícil en casa».
          </Text>
        )
      )}

      <ErrorText>{error}</ErrorText>
      {(!revision.riesgo || seguir) && (
        <Button label={boton} onPress={enviar} busy={busy} disabled={!texto.trim() || !elegido} />
      )}
      <IconText icon={LockIcon} color={colors.muted} size={12} style={{ justifyContent: 'center' }}>
        <Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}>
          Solo la ve tu grupo, nunca el muro, y deja de verse a los {DIAS_VISIBLE} días.
        </Text>
      </IconText>
    </View>
  );
}

/** Enviar ánimo a quien pidió oración: unas palabras que solo lee esa persona. */
export function EnviarAnimo({ peticion, onEnviado, onCancelar }: { peticion: string; onEnviado: () => void; onCancelar: () => void }) {
  const colors = useColors();
  const [texto, setTexto] = useState('');
  const { busy, error, run } = useAction();
  const enviar = () =>
    run(async () => {
      await api('animar', { peticion, texto });
      onEnviado();
    });
  return (
    <View style={[styles.animo, { backgroundColor: colors.accentSoft }]} testID="enviar-animo">
      <View style={styles.chips}>
        {ANIMOS_SUGERIDOS.map((a) => (
          <Pressable
            key={a}
            onPress={() => setTexto(a)}
            style={[styles.sugerido, { backgroundColor: colors.surface, borderColor: texto === a ? colors.accent : colors.border }]}
            accessibilityRole="button"
          >
            <Text style={{ color: colors.text, fontSize: 13 }}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <Field
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={MAX_ANIMO}
        placeholder="Unas palabras de ánimo, un versículo…"
        accessibilityLabel="Tu ánimo"
      />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
        Solo lo leerá quien pidió. Anima, no aconsejes: no hace falta saber qué pasó.
      </Text>
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Button label="Ahora no" kind="quiet" onPress={onCancelar} />
        <Button label="Enviar ánimo" icon={HeartIcon} onPress={enviar} busy={busy} disabled={!texto.trim()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/** Los ánimos que recibió una petición mía. */
export function MisAnimos({ peticion }: { peticion: string }) {
  const colors = useColors();
  const [animos, setAnimos] = useState<Animo[] | null>(null);
  useEffect(() => {
    api<{ animos: Animo[] }>('animos', { peticion })
      .then((r) => setAnimos(r.animos))
      .catch(() => setAnimos([]));
  }, [peticion]);
  if (!animos) return <ActivityIndicator color={colors.accent} style={{ marginTop: 10 }} />;
  return (
    <View style={{ gap: 8, marginTop: 10 }} testID="mis-animos">
      {animos.map((a, i) => (
        <View key={i} style={[styles.recibido, { backgroundColor: colors.warmSoft }]}>
          <Text style={[styles.recibidoTexto, { color: colors.text, fontFamily: serif }]}>{a.texto}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            {a.autor} · {ago(a.creado)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Sin cuenta o sin grupo: a dónde ir para pedir oración. */
export function SinGrupo({ cuenta }: { cuenta: boolean }) {
  const colors = useColors();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
        {cuenta
          ? 'Todavía no estás en un grupo. Únete al de tu iglesia o tu célula, o crea uno con tu familia o tus amigos: allí pueden orar contigo.'
          : 'Para pedir oración a tu grupo necesitas una cuenta. Tu diario sigue siendo privado: solo se comparte lo que tú envíes.'}
      </Text>
      <Button
        label={cuenta ? 'Ir a Comunidad' : 'Crear mi cuenta'}
        kind="outline"
        onPress={() => navigate(() => router.push((cuenta ? '/comunidades' : '/registro') as never), 'forward')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  aviso: { fontSize: 16, lineHeight: 24 },
  animo: { borderRadius: 16, padding: 14, gap: 10, marginTop: 10 },
  sugerido: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  recibido: { borderRadius: 14, padding: 12 },
  recibidoTexto: { fontSize: 16, lineHeight: 23, fontStyle: 'italic' },
});
