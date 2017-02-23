import {taskCreator, TaskType} from '../tasks';
import {getHistory} from '../bootstrap';

export type LocationPayload = {
  url: string;
}

// The last task should be prevalent over all the other ones.

export const HISTORY_PUSH_TASK = url => taskCreator(({url}: LocationPayload) => {
  getHistory().push(url);
}, 'HISTORY_PUSH_TASK')({url});

export const REPLACE_TASK = url => taskCreator(({url}: LocationPayload) => {
  getHistory().replace(url);
}, 'REPLACE_TASK')({url});
