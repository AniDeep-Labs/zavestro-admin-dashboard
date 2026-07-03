import React, { useState } from 'react';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import styles from './NotesPanel.module.css';

/**
 * NotesPanel - the canonical internal-notes block (FABLE-ADMIN-UIUX 2.8) used
 * on order / customer / ticket details. Shows the note thread newest-first and
 * an add-note composer. Stateless about persistence: `onAdd` does the write and
 * the parent re-feeds `notes`. Read-only when `onAdd` is omitted.
 */
export interface NoteEntry {
  id: string;
  author: React.ReactNode;
  /** Pre-formatted timestamp. */
  at: string;
  body: React.ReactNode;
}

export interface NotesPanelProps {
  notes: NoteEntry[];
  onAdd?: (text: string) => void | Promise<void>;
  placeholder?: string;
  emptyText?: string;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  onAdd,
  placeholder = 'Add an internal note...',
  emptyText = 'No notes yet.',
}) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !onAdd) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      {onAdd && (
        <div className={styles.composer}>
          <Textarea value={text} onChange={setText} placeholder={placeholder} rows={3} />
          <div className={styles.composerActions}>
            <Button
              size="sm"
              onClick={submit}
              disabled={!text.trim() || busy}
              state={busy ? 'loading' : 'default'}
            >
              Add note
            </Button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((n) => (
            <li key={n.id} className={styles.note}>
              <div className={styles.noteHead}>
                <span className={styles.author}>{n.author}</span>
                <time className={styles.time}>{n.at}</time>
              </div>
              <div className={styles.body}>{n.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
