import { House, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const TABS: { hash: string; label: string; Ico: LucideIcon; accent: string }[] = [
  { hash: '#/rickus', label: 'Rickus', Ico: User, accent: '#60a5fa' },
  { hash: '#/anjone', label: 'Anjoné', Ico: User, accent: '#fbbf24' },
  { hash: '#/trollip', label: 'Trollip', Ico: House, accent: '#2dd4bf' },
];

export function TabBar({ route }: { route: string }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <a
          key={t.hash}
          href={t.hash}
          className={route.startsWith(t.hash) ? 'active' : ''}
          style={{ ['--tab-accent' as string]: t.accent }}
        >
          <span className="ico" aria-hidden="true"><t.Ico size={17} strokeWidth={2.2} /></span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
