import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import i18n from '../../i18n';
import { NextQuestCard, newlyCompleted, useDemoQuests, type QuestDef } from './DemoQuests';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

beforeEach(async () => {
  (globalThis as any).localStorage = new MemoryStorage();
  await i18n.changeLanguage('en');
});

describe('newlyCompleted', () => {
  it('returns quests that are done now but not saved yet', () => {
    const defs: QuestDef[] = [
      { id: 'a', text: 'A', tip: '', done: true },
      { id: 'b', text: 'B', tip: '', done: true },
      { id: 'c', text: 'C', tip: '', done: false }
    ];
    expect(newlyCompleted(defs, { a: true })).toEqual(['b']);
  });
});

function Probe({ defs }: { defs: QuestDef[] }) {
  const q = useDemoQuests('probe-demo', defs);
  return <NextQuestCard q={q} />;
}

describe('useDemoQuests + NextQuestCard', () => {
  const defs: QuestDef[] = [
    { id: 'first', text: 'Do the first thing', tip: 'Click the first button', done: true, target: 'one' },
    { id: 'second', text: 'Do the second thing', tip: 'Click the second button', done: false, target: 'two' }
  ];

  it('shows the first unfinished quest with its hint and a Show me button', () => {
    const html = renderToString(<Probe defs={defs} />);
    expect(html).toContain('Next quest (2/2)');
    expect(html).toContain('Do the second thing');
    expect(html).toContain('Click the second button');
    expect(html).toContain('Show me');
  });

  it('counts quests saved earlier in the browser as complete', () => {
    localStorage.setItem('quests:probe-demo', JSON.stringify({ first: true, second: true }));
    const html = renderToString(<Probe defs={defs.map((d) => ({ ...d, done: false }))} />);
    expect(html).toContain('All quests complete!');
  });
});
