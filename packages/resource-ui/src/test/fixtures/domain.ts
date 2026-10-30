import { EMPTY_SCHEDULE, type Schedule } from '@/domain/types';

/** A schedule holding only the lists a test names. */
export const scheduleOf = (over: Partial<Schedule> = {}): Schedule => ({ ...EMPTY_SCHEDULE, ...over });
