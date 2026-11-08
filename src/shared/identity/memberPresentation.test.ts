import { expect, it } from 'vitest';
import { memberNumber } from './memberPresentation';

it('keeps long numbers intact and prefers server-assigned member numbers', () => {
  expect(memberNumber({ userNo: 'USER-2' })).toBe('MEM-000002');
  expect(memberNumber({ userNo: 'USER-123456789' })).toBe('MEM-123456789');
  expect(memberNumber({ userNo: 'USER-1234567890' })).toBe('MEM-1234567890');
  expect(memberNumber({ userNo: 'USER-old', memberNo: 'MEM-000009' })).toBe('MEM-000009');
  expect(memberNumber({ userNo: 'USER-test' })).toBe('编号待同步');
});
