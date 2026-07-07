import { useState } from 'react';

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <h3
        className="collapsible-head"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(!open); }}
      >
        <span className={`chevron ${open ? 'open' : ''}`}>&#x203A;</span>
        {title}
      </h3>
      {open && children}
    </div>
  );
}
