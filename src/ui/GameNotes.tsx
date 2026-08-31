import { useState, type FormEvent } from "react";

interface GameNotesProps {
  notes: string[];
  onChange: (notes: string[]) => void;
}

/** Game-level notes, captured during scoring and exported as a separate CSV. */
export function GameNotes({ notes, onChange }: GameNotesProps) {
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();

  function add() {
    if (!trimmed) return;
    onChange([...notes, trimmed]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    add();
  }

  function remove(index: number) {
    onChange(notes.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="card game-notes">
      <h2>Notes</h2>
      {notes.length > 0 && (
        <ol className="notes-list">
          {notes.map((note, index) => (
            <li key={index} className="notes-item">
              <span className="notes-item-text">{note}</span>
              <button
                type="button"
                className="ghost notes-action"
                aria-label={`Delete note ${index + 1}`}
                onClick={() => remove(index)}
              >
                Delete
              </button>
            </li>
          ))}
        </ol>
      )}
      <form className="notes-compose" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="New note"
          aria-label="New note"
        />
        <button type="submit" className="ghost notes-action" disabled={!trimmed}>
          Add
        </button>
      </form>
    </div>
  );
}
