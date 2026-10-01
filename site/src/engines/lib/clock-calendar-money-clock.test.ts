import { describe, expect, it } from 'vitest';
import {
  angleOf, diagnoseTime, dragHour, dragMinute, formatTime, handAngles, isoTime, minutesBetween, parseTime, stepTime, timeParts,
} from './clock-calendar-money-clock';

const t = parseTime;

describe('parse and format', () => {
  it('parses Latin and Persian digits', () => {
    expect(t('7:30')).toBe(450);
    expect(t('16:05')).toBe(965);
    expect(t('۱۶:۳۰')).toBe(990);
    expect(t('00:00')).toBe(0);
    expect(t('24:00')).toBe(0);
    expect(() => t('7.30')).toThrow();
    expect(() => t('7:75')).toThrow();
  });

  it('12-hour shows 1–12, 24-hour pads like a phone', () => {
    expect(formatTime(0, false)).toBe('12:00');
    expect(formatTime(t('12:30'), false)).toBe('12:30');
    expect(formatTime(t('16:30'), false)).toBe('4:30');
    expect(formatTime(t('16:30'), true)).toBe('16:30');
    expect(formatTime(t('8:05'), true)).toBe('08:05');
    expect(timeParts(t('9:00'), false)).toEqual({ h: '9', m: '00' });
    expect(isoTime(t('7:30'))).toBe('07:30');
  });
});

describe('hands', () => {
  it('angles: the hour hand moves on with the minutes', () => {
    expect(handAngles(t('3:00'))).toEqual({ hour: 90, minute: 0 });
    expect(handAngles(t('7:30'))).toEqual({ hour: 225, minute: 180 });
    expect(handAngles(t('15:00'))).toEqual({ hour: 90, minute: 0 });
    expect(handAngles(t('12:15'))).toEqual({ hour: 7.5, minute: 90 });
  });

  it('angleOf measures clockwise from 12 with y down', () => {
    expect(angleOf(0, -1)).toBe(0);
    expect(angleOf(1, 0)).toBe(90);
    expect(angleOf(0, 1)).toBe(180);
    expect(angleOf(-1, 0)).toBe(270);
  });

  it('minute drag snaps to the step and gears the hour past 12', () => {
    expect(dragMinute(t('7:00'), 180, 5)).toBe(t('7:30'));
    expect(dragMinute(t('7:00'), 182, 5)).toBe(t('7:30'));
    expect(dragMinute(t('7:00'), 100, 15)).toBe(t('7:15'));
    expect(dragMinute(t('7:50'), 10, 5)).toBe(t('8:00')); // forward past 12 → next hour
    expect(dragMinute(t('8:05'), 340, 5)).toBe(t('7:55')); // back past 12 → previous hour
    expect(dragMinute(t('11:55'), 0, 5)).toBe(0); // 12:00 on a 12-hour cycle
    expect(dragMinute(t('23:55'), 0, 5, 1440)).toBe(0);
    expect(dragMinute(t('11:55'), 0, 5, 1440)).toBe(t('12:00'));
  });

  it('hour drag keeps the minutes and takes the shortest way round', () => {
    expect(dragHour(t('12:00'), 90)).toBe(t('3:00'));
    expect(dragHour(t('7:30'), 255)).toBe(t('8:30'));
    expect(dragHour(t('7:30'), 225)).toBe(t('7:30'));
    expect(dragHour(t('1:00'), 330)).toBe(t('11:00'));
    expect(dragHour(t('13:00'), 330, 1440)).toBe(t('11:00'));
    expect(dragHour(t('11:00'), 30, 1440)).toBe(t('13:00'));
  });

  it('stepTime wraps', () => {
    expect(stepTime(t('11:55'), 5)).toBe(0);
    expect(stepTime(0, -5)).toBe(t('11:55'));
    expect(stepTime(t('23:00'), 60, 1440)).toBe(0);
  });
});

describe('diagnoseTime', () => {
  it('passes the right time, and on a 12-hour face either half of the day', () => {
    expect(diagnoseTime(t('3:00'), t('3:00'))).toBeNull();
    expect(diagnoseTime(t('15:00'), t('3:00'))).toBeNull();
    expect(diagnoseTime(t('4:30'), t('16:30'), true)).toBe('am-pm');
    expect(diagnoseTime(t('16:30'), t('16:30'), true)).toBeNull();
  });

  it('spots swapped hands', () => {
    expect(diagnoseTime(t('12:15'), t('3:00'))).toBe('hands-swapped');
    expect(diagnoseTime(t('6:15'), t('3:30'))).toBe('hands-swapped');
  });

  it('spots the half-past hour slip and other hour errors', () => {
    expect(diagnoseTime(t('8:30'), t('7:30'))).toBe('hour-off-by-one');
    expect(diagnoseTime(t('6:30'), t('7:30'))).toBe('hour-off-by-one');
    expect(diagnoseTime(t('12:00'), t('1:00'))).toBe('hour-off-by-one');
    expect(diagnoseTime(t('10:30'), t('7:30'))).toBe('wrong-hour');
  });

  it('spots minute errors', () => {
    expect(diagnoseTime(t('7:06'), t('7:30'))).toBe('minute-as-number');
    expect(diagnoseTime(t('7:45'), t('7:30'))).toBe('wrong-minute');
    expect(diagnoseTime(t('16:06'), t('16:30'), true)).toBe('minute-as-number');
    expect(diagnoseTime(t('9:10'), t('7:30'))).toBe('wrong');
  });

  it('durations go forward through midnight', () => {
    expect(minutesBetween(t('8:15'), t('9:00'))).toBe(45);
    expect(minutesBetween(t('23:30'), t('0:15'))).toBe(45);
  });
});
