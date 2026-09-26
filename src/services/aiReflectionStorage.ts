const STORAGE_KEY = 'mobin_ai_reflections_v1';

interface ReflectionNote {
  surahId: number;
  verseNumber: number;
  text: string;
  updatedAt: number;
}

function readNotes(): ReflectionNote[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const notes = JSON.parse(stored);
    return Array.isArray(notes)
      ? notes.filter(
          (note): note is ReflectionNote =>
            note !== null &&
            Number.isInteger(note.surahId) &&
            Number.isInteger(note.verseNumber) &&
            typeof note.text === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export function getVerseReflection(surahId: number, verseNumber: number): string {
  return readNotes().find((note) => note.surahId === surahId && note.verseNumber === verseNumber)?.text ?? '';
}

export function saveVerseReflection(surahId: number, verseNumber: number, text: string): boolean {
  try {
    const notes = readNotes().filter(
      (note) => note.surahId !== surahId || note.verseNumber !== verseNumber
    );
    const normalizedText = text.trim();
    if (normalizedText) {
      notes.unshift({ surahId, verseNumber, text: normalizedText, updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.slice(0, 500)));
    return true;
  } catch (error) {
    console.error('Failed to save verse reflection:', error);
    return false;
  }
}