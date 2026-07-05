const TABS = [
  { hash: '#/rickus', label: 'Rickus', ico: '👤', accent: '#60a5fa' },
  { hash: '#/anjone', label: 'Anjoné', ico: '👤', accent: '#fbbf24' },
  { hash: '#/trollip', label: 'Trollip', ico: '🏠', accent: '#2dd4bf' },
  { hash: '#/import', label: 'Import', ico: '📥', accent: '#2dd4bf' },
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
          <span className="ico" aria-hidden="true">{t.ico}</span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
