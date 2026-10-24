import { describe, expect, it } from 'vitest';
import { formatScheduleTime, scheduleWallTimeToIso } from '../../lib/utils/schedule-time';

describe('assignee wall clock independent of browser timezone', () => {
  it('renders persisted instants in the stored slot timezone', () => {
    expect(formatScheduleTime('2026-10-25T12:00:00.000Z', 'America/Sao_Paulo')).toBe('09:00');
    expect(formatScheduleTime('2026-10-25T12:00:00.000Z', 'UTC')).toBe('12:00');
  });
  it('keeps São Paulo office hours and non-whole-hour offsets', () => {
    expect(scheduleWallTimeToIso('2026-10-25T09:00', 'America/Sao_Paulo')).toBe('2026-10-25T12:00:00.000Z');
    expect(scheduleWallTimeToIso('2026-10-25T09:00', 'Asia/Kathmandu')).toBe('2026-10-25T03:15:00.000Z');
    expect(scheduleWallTimeToIso('2026-10-25T00:00', 'UTC')).toBe('2026-10-25T00:00:00.000Z');
  });
  it('rejects nonexistent, ambiguous and invalid wall clocks instead of shifting them', () => {
    expect(() => scheduleWallTimeToIso('2026-03-08T02:30', 'America/New_York')).toThrow('inexistente ou ambíguo');
    expect(() => scheduleWallTimeToIso('2026-11-01T01:30', 'America/New_York')).toThrow('inexistente ou ambíguo');
    expect(() => scheduleWallTimeToIso('2026-02-30T09:00', 'UTC')).toThrow('válidos');
    expect(() => scheduleWallTimeToIso('2026-10-25T09:00', 'Not/AZone')).toThrow('fuso horário válido');
    expect(() => scheduleWallTimeToIso('', 'UTC')).toThrow('válidos');
  });
});
