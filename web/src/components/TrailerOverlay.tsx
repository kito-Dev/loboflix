import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function TrailerOverlay() {
  const { trailer, closeTrailer } = useApp();

  useEffect(() => {
    if (!trailer) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeTrailer();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [trailer, closeTrailer]);

  if (!trailer) return null;

  return (
    <div className="trailer-overlay" role="dialog" aria-modal="true" aria-label="Trailer">
      <div className="trailer-overlay__top">
        <button type="button" className="icon-btn-glass" onClick={closeTrailer} aria-label="Fechar">
          <X size={20} strokeWidth={1.8} />
        </button>
        <span className="trailer-overlay__label">Trailer</span>
        <span className="trailer-overlay__top-spacer" aria-hidden="true" />
      </div>

      <div className="trailer-overlay__center">
        <div className="trailer-overlay__stage">
          <iframe
            key={trailer.youtubeKey}
            className="trailer-overlay__player"
            src={`https://www.youtube.com/embed/${trailer.youtubeKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={`Trailer de ${trailer.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div className="trailer-overlay__meta">
          <h2>{trailer.title}</h2>
          <p>Trailer oficial</p>
        </div>
      </div>
    </div>
  );
}
