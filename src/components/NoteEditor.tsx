import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, IconText } from '@/components/comunidad/ui';
import { CloseIcon, LockIcon } from '@/components/icons';
import { setNote, useNotes, noteKey } from '@/lib/notas';
import { serif, useColors } from '@/lib/theme';

type Props = { book: string; chapter: number; verse: number; reference: string; text: string; onClose: () => void };

/** Preguntas para empezar a escribir: ayudan a pensar el versículo en vez de solo copiarlo. */
const PROMPTS = ['¿Qué me dice de Dios?', '¿Qué me pide a mí?', '¿Qué voy a hacer hoy?', 'Una oración'];

/** Nota personal de un versículo. Solo se guarda en este dispositivo. */
export default function NoteEditor({ book, chapter, verse, reference, text, onClose }: Props) {
  const colors = useColors();
  const existing = useNotes()[noteKey(book, chapter, verse)];
  const [draft, setDraft] = useState(existing?.text ?? '');

  const save = () => {
    setNote(book, chapter, verse, draft);
    onClose();
  };
  const remove = () => {
    setNote(book, chapter, verse, '');
    onClose();
  };
  const addPrompt = (p: string) => setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n${p} ` : `${p} `));

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.head}>
            <Text style={[styles.ref, { color: colors.accent }]}>Mi nota · {reference}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <CloseIcon color={colors.muted} size={20} />
            </Pressable>
          </View>
          <Text style={[styles.verse, { color: colors.text }]} numberOfLines={3}>
            {text}
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus={!existing}
            placeholder="¿Qué te dice este versículo?"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            accessibilityLabel="Texto de la nota"
          />
          <View style={styles.prompts}>
            {PROMPTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => addPrompt(p)}
                style={({ pressed }) => [styles.prompt, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
              >
                <Text style={{ color: colors.muted, fontSize: 13 }}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <IconText icon={LockIcon} color={colors.muted} size={13} style={{ marginTop: 12, alignItems: 'flex-start' }}>
            <Text style={[styles.private, { color: colors.muted }]}>
              Solo tú ves esta nota. Para compartir con tu grupo, usa la pestaña «Grupo» del versículo.
            </Text>
          </IconText>
          <View style={styles.buttons}>
            {existing && <Button label="Borrar" kind="quiet" onPress={remove} />}
            <Button label="Guardar" onPress={save} disabled={!draft.trim() && !existing} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 28,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 15, fontWeight: '700' },
  verse: { fontFamily: serif, fontSize: 16, lineHeight: 24, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, lineHeight: 22, minHeight: 140, marginTop: 14, textAlignVertical: 'top' },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  prompt: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  private: { fontSize: 12, flex: 1 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center' },
});
