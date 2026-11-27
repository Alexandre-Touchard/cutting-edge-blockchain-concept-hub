import { describe, expect, it } from 'vitest';
import { mapEvent, mapStats } from '../../api/_map';
import { isNewPageView } from './usePageAnalytics';
import { TOURS } from '../map/data';

describe('map event names', () => {
  it('carry the id in the name (Upstash only counts names) and stay short', () => {
    expect(mapEvent.node('solana')).toBe('map:node:solana');
    expect(mapEvent.toDemo('makerdao-vault')).toBe('map:demo:makerdao-vault');
    expect(mapEvent.fromDemo('amm')).toBe('map:from-demo:amm');
    // /api/track truncates event names to 100 characters.
    for (const t of TOURS) expect(mapEvent.tourStart(t.id).length).toBeLessThanOrEqual(100);
  });
});

describe('mapStats', () => {
  const events = {
    [mapEvent.node('solana')]: 5,
    [mapEvent.node('ethereum')]: 7,
    [mapEvent.group('eth-l2s')]: 3,
    [mapEvent.tourStart('stablecoin')]: 4,
    [mapEvent.tourDone('stablecoin')]: 1,
    [mapEvent.tourStart('base-swap')]: 2,
    [mapEvent.toDemo('amm')]: 2,
    [mapEvent.toDemo('makerdao-vault')]: 3,
    'map:demo': 1, // older deployments: no id
    [mapEvent.fromDemo('amm')]: 6,
    'map:from-demo': 2,
    'quest:amm:1/3': 9, // not a map event
    demo_view: 50
  };
  const paths = { '/map': 10, '/map?vm=evm': 2, '/map#node=solana': 1, '/mapping': 4, '/demo/amm': 30 };
  const s = mapStats(events, paths);

  it('counts views of /map with any query or hash, and nothing else', () => {
    expect(s.views).toBe(13);
  });

  it('totals and ranks node details opened and group openings', () => {
    expect(s.detailsOpened).toBe(12);
    expect(s.topNodes).toEqual([
      { key: 'ethereum', count: 7 },
      { key: 'solana', count: 5 }
    ]);
    expect(s.groupOpens).toBe(3);
    expect(s.topGroups).toEqual([{ key: 'eth-l2s', count: 3 }]);
  });

  it('pairs tour starts with tour finishes, most started first', () => {
    expect(s.tours).toEqual([
      { id: 'stablecoin', started: 4, done: 1 },
      { id: 'base-swap', started: 2, done: 0 }
    ]);
  });

  it('counts map ↔ demo clicks both ways, legacy events in the totals only', () => {
    expect(s.toDemo).toBe(6);
    expect(s.topToDemos).toEqual([
      { key: 'makerdao-vault', count: 3 },
      { key: 'amm', count: 2 }
    ]);
    expect(s.fromDemo).toBe(8);
    expect(s.topFromDemos).toEqual([{ key: 'amm', count: 6 }]);
  });

  it('is empty without data', () => {
    const e = mapStats({}, {});
    expect(e.views + e.detailsOpened + e.groupOpens + e.toDemo + e.fromDemo).toBe(0);
    expect(e.tours).toEqual([]);
  });
});

describe('isNewPageView', () => {
  it('counts one map view per visit, whatever is selected or filtered', () => {
    expect(isNewPageView(null, '/map')).toBe(true);
    expect(isNewPageView('/', '/map')).toBe(true);
    expect(isNewPageView('/map', '/map')).toBe(false);
    expect(isNewPageView('/map', '/demo/amm')).toBe(true);
  });

  it('keeps counting every navigation elsewhere', () => {
    expect(isNewPageView('/', '/')).toBe(true);
    expect(isNewPageView('/demo/amm', '/demo/amm')).toBe(true);
  });
});
