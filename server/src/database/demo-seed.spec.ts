import {
  buildDemoSeed,
  DEMO_SEED_COUNT,
  DEMO_SYSTEM_MESSAGE_ID,
} from './demo-seed';

describe('buildDemoSeed', () => {
  const now = Date.parse('2026-11-09T12:00:00.000Z');

  it('builds a system notice plus 500 ordered dialogue messages', () => {
    const seed = buildDemoSeed({
      nextSequence: 0,
      now,
      includeSystem: true,
    });

    expect(seed.rows).toHaveLength(DEMO_SEED_COUNT + 1);
    expect(seed.rows[0]?.id).toBe(DEMO_SYSTEM_MESSAGE_ID);
    expect(seed.rows[0]?.metadata).toEqual({ system: true });
    expect(seed.nextSequence).toBe(DEMO_SEED_COUNT + 1);
    expect(seed.rows.map((row) => row.sequence)).toEqual(
      seed.rows.map((_, index) => index + 1),
    );
    expect(seed.rows[1]?.senderId).toBe('user-2');
    expect(seed.rows[2]?.senderId).toBe('user-1');
    expect(seed.rows.at(-1)?.createdAt.getTime()).toBeGreaterThan(
      seed.rows[1]?.createdAt.getTime() ?? 0,
    );
  });

  it('continues after an existing system notice', () => {
    const seed = buildDemoSeed({
      nextSequence: 1,
      now,
      includeSystem: false,
    });

    expect(seed.rows).toHaveLength(DEMO_SEED_COUNT);
    expect(seed.rows[0]?.sequence).toBe(2);
    expect(seed.nextSequence).toBe(DEMO_SEED_COUNT + 1);
    expect(seed.rows.some((row) => row.id === DEMO_SYSTEM_MESSAGE_ID)).toBe(
      false,
    );
  });
});
