import { beforeEach, describe, expect, it } from 'vitest';
import { completedEventName, learningFunnel, questEventName } from '../../api/_learning';
import { reportQuestProgress } from '../demos/questProgress';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('quest milestone events', () => {
  it('sends one event per newly reached quest count, and a completion event once', () => {
    const sent: string[] = [];
    const track = (e: string) => sent.push(e);
    reportQuestProgress('amm', 2, 3, 1, track); // jumps 0 → 2
    reportQuestProgress('amm', 2, 3, 2, track); // unchanged
    reportQuestProgress('amm', 0, 3, 3, track); // reset inside the demo: best stays 2
    reportQuestProgress('amm', 3, 3, 4, track); // finishes
    reportQuestProgress('amm', 3, 3, 5, track); // nothing new
    expect(sent).toEqual([questEventName('amm', 1, 3), questEventName('amm', 2, 3), questEventName('amm', 3, 3), completedEventName('amm')]);
  });

  it('never sends events for demos without quests', () => {
    const sent: string[] = [];
    reportQuestProgress('x', 1, 0, 1, (e) => sent.push(e));
    expect(sent).toEqual([]);
  });
});

describe('learningFunnel', () => {
  it('builds per-demo rows: views, started, completed and the drop-off per quest', () => {
    const rows = learningFunnel(
      {
        [questEventName('amm', 1, 3)]: 40,
        [questEventName('amm', 2, 3)]: 25,
        [questEventName('amm', 3, 3)]: 10,
        [completedEventName('amm')]: 10,
        demo_start: 99 // unrelated events are ignored
      },
      { amm: 200, peerdas: 50 }
    );
    expect(rows).toEqual([
      { demoId: 'amm', views: 200, started: 40, completed: 10, total: 3, reached: [40, 25, 10] },
      { demoId: 'peerdas', views: 50, started: 0, completed: 0, total: 0, reached: [] }
    ]);
  });

  it('fills gaps in the reached list with zeros', () => {
    const [row] = learningFunnel({ [questEventName('d', 3, 4)]: 2 }, {});
    expect(row.reached).toEqual([0, 0, 2, 0]);
    expect(row.started).toBe(0);
  });
});
