import { Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function FAB() {
  const { openAddFilm } = useApp();

  return (
    <button type="button" className="fab" onClick={openAddFilm} aria-label="Adicionar filme">
      <Plus size={26} strokeWidth={2.2} />
    </button>
  );
}
