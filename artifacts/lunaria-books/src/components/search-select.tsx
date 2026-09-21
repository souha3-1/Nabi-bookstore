import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { normalize } from '@/lib/search';

export type SelectOption = { value: string; label: string; hint?: string; search: string };

type SearchSelectProps = {
  id: string; label: string; options: SelectOption[]; value: string; onChange: (value: string) => void;
  placeholder?: string; disabled?: boolean; error?: string; noResults?: string; testId?: string;
};

// A list to choose from that can also be searched by typing (accents and capitals are ignored).
export function SearchSelect({ id, label, options, value, onChange, placeholder, disabled, error, noResults = 'Nothing matches that', testId }: SearchSelectProps) {
  const selected = options.find((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const words = normalize(text).split(/\s+/).filter(Boolean);
    return words.length === 0 ? options : options.filter((option) => { const haystack = normalize(option.search); return words.every((word) => haystack.includes(word)); });
  }, [options, text]);

  useEffect(() => { list.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active, open]);

  const close = () => { setOpen(false); setText(''); };
  const choose = (option: SelectOption | undefined) => { if (!option) return; onChange(option.value); close(); };
  const openList = () => {
    if (disabled || open) return;
    setOpen(true);
    setText('');
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); if (!open) openList(); else setActive((index) => Math.min(shown.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (open) setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && open) { event.preventDefault(); choose(shown[active]); }
    else if (event.key === 'Escape' && open) { event.preventDefault(); close(); }
  };

  return <div>
    <label htmlFor={id} className="block text-xs font-bold uppercase tracking-[.1em] text-[#746875]">{label}</label>
    <div className="relative">
      <input
        id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${id}-option-${active}` : undefined}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off" disabled={disabled} data-testid={testId}
        value={open ? text : selected?.label ?? ''}
        placeholder={open && selected ? selected.label : placeholder}
        onChange={(event) => { setText(event.target.value); setOpen(true); setActive(0); }}
        onFocus={openList} onClick={openList} onBlur={close} onKeyDown={onKeyDown}
        className={`mt-2 w-full border-b bg-transparent py-3 pr-8 text-sm outline-none focus:border-[#48458F] disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-[#B23A48]' : 'border-[#d9c5cb]'}`}
      />
      <ChevronDown size={16} className="pointer-events-none absolute right-1 top-[1.4rem] text-[#B274A2]" />
      {open && <ul id={`${id}-list`} ref={list} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-64 w-full overflow-auto border border-[#d9c5cb] bg-[#FFF9F7] shadow-lg">
        {shown.length === 0
          ? <li className="px-4 py-3 text-sm text-[#746875]">{noResults}</li>
          : shown.map((option, index) => <li
              key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value}
              onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)} onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm text-[#30263B] ${index === active ? 'bg-[#FCE0E0]' : ''} ${option.value === value ? 'font-bold' : ''}`}
              data-testid={`option-${id}-${option.value}`}
            ><span>{option.label}</span>{option.hint && <span dir="auto" className="text-xs font-normal text-[#746875]">{option.hint}</span>}</li>)}
      </ul>}
    </div>
    {error && <p id={`${id}-error`} className="mt-2 text-xs text-[#B23A48]" role="alert">{error}</p>}
  </div>;
}
