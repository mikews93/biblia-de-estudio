import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Guia, ago, api } from '@/lib/comunidad';
import { serif, useColors } from '@/lib/theme';
import { navigate } from '@/lib/transition';

import { confirm } from './confirm';
import { Button, Card, SectionTitle, text } from './ui';

/** Guías de encuentro que los líderes prepararon en el Taller y enviaron al grupo. */
export default function Guides({ group, admin }: { group: string; admin: boolean }) {
  const colors = useColors();
  const [guides, setGuides] = useState<Guia[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = () =>
    api<{ guias: Guia[] }>('guias', { grupo: group })
      .then((r) => {
        setGuides(r.guias);
        setOpen((o) => o ?? r.guias[0]?.id ?? null);
      })
      .catch(() => setGuides([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const remove = async (g: Guia) => {
    if (!(await confirm('¿Quitar esta guía del grupo?', 'Quien la preparó la conserva en su Taller.', 'Quitar'))) return;
    await api('borrarGuia', { guia: g.id }).catch(() => {});
    load();
  };

  return (
    <View style={{ marginBottom: 8 }}>
      {guides?.length ? (
        <View style={{ gap: 10 }}>
          {guides.map((g) => (
            <Card key={g.id}>
              <Pressable onPress={() => setOpen(open === g.id ? null : g.id)} accessibilityRole="button" aria-expanded={open === g.id}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {g.autor} · {ago(g.creado)}
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>{g.titulo}</Text>
              </Pressable>
              {open === g.id && (
                <View style={{ marginTop: 6 }}>
                  {g.texto
                    .split('\n')
                    .slice(1)
                    .map((line, i) =>
                      line.startsWith('## ') ? (
                        <Text key={i} style={[styles.heading, { color: colors.accent }]}>
                          {line.slice(3)}
                        </Text>
                      ) : line.trim() ? (
                        <Text key={i} style={[text.body, { color: colors.text }]}>
                          {line}
                        </Text>
                      ) : null,
                    )}
                  {(g.mia || admin) && <Button label="Quitar del grupo" kind="quiet" onPress={() => remove(g)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />}
                </View>
              )}
            </Card>
          ))}
        </View>
      ) : (
        guides && (
          <Text style={[text.body, { color: colors.muted }]}>
            Prepara el próximo encuentro en el Taller, con dinámicas y preguntas, y envíaselo al grupo.
          </Text>
        )
      )}
      <Button
        label="Preparar un encuentro en el Taller"
        kind="outline"
        onPress={() => navigate(() => router.push('/taller'), 'forward')}
        style={{ marginTop: 12 }}
      />
      <SectionTitle>Preguntas rápidas</SectionTitle>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: serif, fontSize: 18, fontWeight: '700', marginTop: 2 },
  heading: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
});
