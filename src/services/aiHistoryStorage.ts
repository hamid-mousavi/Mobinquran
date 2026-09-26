export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  agentName?: string;
  tafsirCitations?: string[];
  socraticQuestions?: string[];
}

export interface AiChatSession {
  id: string;
  title: string;
  timestamp: number;
  verseRef?: {
    surahId: number;
    surahName: string;
    verseNumber: number;
  };
  messages: AiChatMessage[];
}

const STORAGE_KEY = 'mobin_ai_chat_history_v1';

export function getAiHistory(): AiChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading AI history:', err);
    return [];
  }
}

export function saveAiSession(session: AiChatSession): void {
  try {
    const history = getAiHistory();
    const existingIndex = history.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      history[existingIndex] = session;
    } else {
      history.unshift(session);
    }
    // سقف نگهداری ۵۰ جلسه گفتگو در مرورگر
    const trimmed = history.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Error saving AI session:', err);
  }
}

export function deleteAiSession(id: string): void {
  try {
    const history = getAiHistory().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Error deleting AI session:', err);
  }
}

export function clearAllAiHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing AI history:', err);
  }
}
