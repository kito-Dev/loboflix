import { providerColor, providerShortName } from '../utils/movie';

export function StreamingPill({ name }: { name: string }) {
  return (
    <span className="streaming-pill">
      <span className="streaming-pill__dot" style={{ background: providerColor(name) }} />
      {providerShortName(name)}
    </span>
  );
}
