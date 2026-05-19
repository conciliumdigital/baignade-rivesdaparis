import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Heading, Eraser } from 'lucide-react';

// Éditeur WYSIWYG minimal, zéro dépendance (contentEditable + execCommand).
// Suffisant pour le corps des e-mails (paragraphes, gras, listes, liens) :
// le gabarit responsable du rendu e-mail reste contrôlé côté serveur.
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Synchronise le DOM uniquement si la valeur externe diffère
  // (évite de casser la position du curseur pendant la frappe).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function exec(command: string, arg?: string) {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    emit();
  }

  function addLink() {
    const url = window.prompt('URL du lien (https://… ou {{lien_compte}})');
    if (url) exec('createLink', url);
  }

  const Btn = ({ onAction, title, children }: { onAction: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // garde la sélection
      onClick={onAction}
      className="p-2 rounded hover:bg-slate-100 text-slate-600"
    >
      {children}
    </button>
  );

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1">
        <Btn onAction={() => exec('bold')} title="Gras"><Bold className="w-4 h-4" /></Btn>
        <Btn onAction={() => exec('italic')} title="Italique"><Italic className="w-4 h-4" /></Btn>
        <Btn onAction={() => exec('underline')} title="Souligné"><Underline className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn onAction={() => exec('formatBlock', 'H3')} title="Titre"><Heading className="w-4 h-4" /></Btn>
        <Btn onAction={() => exec('insertUnorderedList')} title="Liste à puces"><List className="w-4 h-4" /></Btn>
        <Btn onAction={() => exec('insertOrderedList')} title="Liste numérotée"><ListOrdered className="w-4 h-4" /></Btn>
        <Btn onAction={addLink} title="Lien"><Link2 className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn onAction={() => exec('removeFormat')} title="Effacer la mise en forme"><Eraser className="w-4 h-4" /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        role="textbox"
        aria-multiline="true"
        aria-label="Corps de l'e-mail"
        className="prose prose-sm max-w-none min-h-[260px] p-4 text-sm focus:outline-none"
      />
    </div>
  );
}
