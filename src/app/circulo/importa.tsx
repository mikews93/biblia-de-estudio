import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Appear from "@/components/Appear";
import Welcome from "@/components/comunidad/Welcome";
import {
  Button,
  Card,
  Chips,
  ErrorText,
  Field,
  text,
  useAction,
} from "@/components/comunidad/ui";
import { CheckIcon, LockIcon } from "@/components/icons";
import {
  CAMINO,
  IMPORTA,
  type Importa,
  MAX_PROPOSITO,
  MAX_SIRVO,
  type Respuesta,
} from "@/lib/camino";
import { useCaminoDiario } from "@/lib/caminoDiario";
import { estadoCamino, guardarImporta } from "@/lib/circuloApi";
import { useAccount } from "@/lib/comunidad";
import { Colors, serif, useColors } from "@/lib/theme";
import { navigate } from "@/lib/transition";

const VACIO: Importa = {
  respuestas: {},
  innegociables: [],
  sirvo: "",
  proposito: "",
  solteria: false,
};
const ETAPA_PROPOSITO = CAMINO.find((e) => e.proposito !== undefined)!;

/** «Lo que sí importa»: ser directo sobre hacia dónde va tu vida, para entrar al círculo. */
export default function ImportaScreen() {
  const colors = useColors();
  const { usuario, ready } = useAccount();
  const [importa, setImporta] = useState<Importa | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    estadoCamino().then(
      (e) => setImporta(e.importa ?? VACIO),
      (e: Error) => setError(e.message),
    );
  }, [usuario]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Lo que sí importa" }} />
      <Appear>
        <Text style={[styles.kicker, { color: colors.warm }]}>
          PARA EL CÍRCULO DE SOLTEROS
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Lo que sí importa
        </Text>
        <Text style={[text.body, { color: colors.text, marginTop: 8 }]}>
          Ser claro desde el principio ahorra tiempo y corazón. «¿Andarán dos
          juntos, si no estuvieren de acuerdo?» (Amós 3:3)
        </Text>
        <View style={[styles.nota, { backgroundColor: colors.accentSoft }]}>
          <LockIcon color={colors.accent} size={15} strokeWidth={2} />
          <Text
            style={[
              text.small,
              { color: colors.text, flex: 1, lineHeight: 19 },
            ]}
          >
            Nadie ve tus respuestas. Tu círculo solo ve en qué coinciden
            («Coinciden: hijos») y lo que escribas sobre tu propósito y dónde
            sirves.
          </Text>
        </View>
      </Appear>
      {ready && !usuario ? (
        <Welcome intro="Entra con tu cuenta para responder." />
      ) : !importa ? (
        error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        )
      ) : (
        <Formulario inicial={importa} usuario={usuario!.id} colors={colors} />
      )}
    </ScrollView>
  );
}

function Formulario({
  inicial,
  usuario,
  colors,
}: {
  inicial: Importa;
  usuario: string;
  colors: Colors;
}) {
  const [v, setV] = useState<Importa>(inicial);
  const { diario } = useCaminoDiario(usuario);
  const act = useAction();
  const deEtapa =
    diario?.[ETAPA_PROPOSITO.n]?.[ETAPA_PROPOSITO.proposito!]?.trim() ?? "";
  const completo = IMPORTA.every((q) => v.respuestas[q.clave]);

  const responder = (clave: string, r: Respuesta) =>
    setV((x) => ({
      ...x,
      respuestas: { ...x.respuestas, [clave]: r },
      // «Abierto» y «no lo negocio» no van juntos.
      innegociables:
        r === "abierto"
          ? x.innegociables.filter((k) => k !== clave)
          : x.innegociables,
    }));
  const negociar = (clave: string) =>
    setV((x) => ({
      ...x,
      innegociables: x.innegociables.includes(clave)
        ? x.innegociables.filter((k) => k !== clave)
        : [...x.innegociables, clave],
    }));
  const guardar = async () => {
    if (await act.run(() => guardarImporta(v)))
      navigate(() => router.back(), "back");
  };

  return (
    <>
      <View style={{ gap: 12, marginTop: 20 }}>
        {IMPORTA.map((q, i) => {
          const r = v.respuestas[q.clave];
          const fijo = v.innegociables.includes(q.clave);
          return (
            <Appear key={q.clave} delay={40 + i * 30}>
              <View testID={`importa-${q.clave}`}>
                <Card>
                  <Text style={[styles.pregunta, { color: colors.text }]}>
                    {q.pregunta}
                  </Text>
                  <View style={{ marginTop: 10 }}>
                    <Chips
                      options={q.opciones}
                      value={r ?? ("" as Respuesta)}
                      onChange={(x) => responder(q.clave, x)}
                    />
                  </View>
                  {q.innegociable && r && r !== "abierto" && (
                    <Casilla
                      on={fijo}
                      onPress={() => negociar(q.clave)}
                      label="No lo negocio"
                      colors={colors}
                    />
                  )}
                </Card>
              </View>
            </Appear>
          );
        })}
      </View>
      <Text
        style={[
          text.small,
          { color: colors.muted, marginTop: 10, lineHeight: 19 },
        ]}
      >
        Marca como «no lo negocio» solo lo que de verdad define tu vida.
        Estudio, trabajo y finanzas nunca separan a nadie: son temas para
        conversar.
      </Text>

      <Card style={{ marginTop: 18, gap: 12 }}>
        <Field
          label="¿En qué sirves hoy en tu iglesia?"
          accessibilityLabel="¿En qué sirves hoy en tu iglesia?"
          value={v.sirvo}
          onChangeText={(t) => setV({ ...v, sirvo: t })}
          maxLength={MAX_SIRVO}
          placeholder="Alabanza, escuela dominical, bienvenida…"
        />
        <Field
          label="Tu propósito en una o dos frases"
          accessibilityLabel="Tu propósito en una o dos frases"
          value={v.proposito}
          onChangeText={(t) => setV({ ...v, proposito: t })}
          maxLength={MAX_PROPOSITO}
          multiline
          placeholder="Lo que sientes que Dios te llama a hacer con tu vida."
        />
        {!!deEtapa && deEtapa !== v.proposito.trim() && (
          <Pressable
            onPress={() =>
              setV({ ...v, proposito: deEtapa.slice(0, MAX_PROPOSITO) })
            }
            hitSlop={6}
            accessibilityRole="button"
          >
            <Text
              style={{ color: colors.accent, fontWeight: "600", fontSize: 14 }}
            >
              Usar lo que escribí en la etapa {ETAPA_PROPOSITO.n}
            </Text>
          </Pressable>
        )}
        <Text style={[text.small, { color: colors.muted }]}>
          Esto sí lo ve tu círculo.
        </Text>
      </Card>

      <Card style={{ marginTop: 18 }}>
        <Casilla
          on={v.solteria}
          onPress={() => setV({ ...v, solteria: !v.solteria })}
          label="Me siento llamado o llamada a la soltería en esta etapa"
          colors={colors}
        />
        <Text
          style={[
            text.small,
            { color: colors.muted, marginTop: 8, lineHeight: 19 },
          ]}
        >
          Participas del círculo para leer y hacer amistades, y nadie podrá
          marcarte. Es una vocación digna, no una espera.
        </Text>
      </Card>

      <Button
        label="Guardar"
        onPress={guardar}
        busy={act.busy}
        disabled={!completo}
        style={{ marginTop: 20 }}
      />
      {!completo && (
        <Text
          style={[
            text.small,
            { color: colors.muted, marginTop: 8, textAlign: "center" },
          ]}
        >
          Responde las {IMPORTA.length} preguntas.
        </Text>
      )}
      <ErrorText>{act.error}</ErrorText>
    </>
  );
}

function Casilla({
  on,
  onPress,
  label,
  colors,
}: {
  on: boolean;
  onPress: () => void;
  label: string;
  colors: Colors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={styles.casilla}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: on ? colors.accent : colors.border,
            backgroundColor: on ? colors.accent : "transparent",
          },
        ]}
      >
        {on && <CheckIcon color={colors.surface} size={13} strokeWidth={2.6} />}
      </View>
      <Text style={[text.body, { color: colors.text, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 64,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  title: { fontFamily: serif, fontSize: 30, lineHeight: 36, marginTop: 6 },
  nota: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  pregunta: { fontFamily: serif, fontSize: 18, lineHeight: 25 },
  casilla: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
