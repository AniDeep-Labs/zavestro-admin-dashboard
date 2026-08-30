import React from 'react';
import { getAdminUser } from '../../api/adminApi';
import { PageHeader } from '../../components';
import { CONSOLE_HELP, ROLE_CONSOLE } from '../../data/consoleHelp';
import s from './HelpPage.module.css';
import { UilEye, UilSlidersV, UilBriefcaseAlt } from '@iconscout/react-unicons';

// T3-2 (W-U1): the in-product help page — "how this console works", per role. Super/legacy-admin
// oversee every console, so they can flip between them; a role user sees just their own.
export const HelpPage: React.FC = () => {
  // [SHL-2-12] A THIRD instance of the fail-open default, which the audit did not name:
  // defaulting to 'admin' made a role-less session an OVERSEER here, free to read every
  // console's help. Only a help page, so it leaked documentation rather than data — but it
  // is the same wrong direction, and the same one-word fix.
  const role = getAdminUser()?.role ?? 'pending';
  const isOverseer = role === 'super_admin' || role === 'admin';
  const ownConsole = ROLE_CONSOLE[role] ?? 'super';
  const [selected, setSelected] = React.useState(ownConsole);
  const view = isOverseer ? selected : ownConsole;
  const help = CONSOLE_HELP[view] ?? CONSOLE_HELP.super;

  const block = (label: string, icon: React.ReactNode, lines: string[]) => (
    <section className={s.block}>
      <h2 className={s.blockTitle}>
        <span className={s.blockIcon}>{icon}</span> {label}
      </h2>
      <ul className={s.list}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="Help"
        title={`How the ${help.console} console works`}
        subtitle="Your job-to-be-done, and what you own vs. what you don’t."
      />

      {isOverseer && (
        <div className={s.consoleTabs}>
          {Object.entries(CONSOLE_HELP).map(([key, c]) => (
            <button
              key={key}
              className={`${s.tab} ${view === key ? s.tabActive : ''}`}
              onClick={() => setSelected(key)}
            >
              {c.console}
            </button>
          ))}
        </div>
      )}

      <p className={s.summary}>{help.summary}</p>

      {block('What you SEE', <UilEye size={16} />, help.see)}
      {block('What you CONTROL', <UilSlidersV size={16} />, help.control)}
      {block('What you HANDLE', <UilBriefcaseAlt size={16} />, help.handle)}

      <p className={s.footnote}>
        Press <kbd>?</kbd> anywhere for keyboard shortcuts, or <kbd>⌘</kbd> <kbd>K</kbd> to jump to any page.
      </p>
    </div>
  );
};

export default HelpPage;
