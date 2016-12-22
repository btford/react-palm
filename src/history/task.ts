import {makeTaskType, TaskType} from '../tasks';
import {getHistory} from '../bootstrap';

export type LocationTask = {
  type: TaskType;
  url: string;
}

export const HISTORY_PUSH_TASK = (url: string): LocationTask =>
  ({type: HISTORY_PUSH_TASK, url});

export const REPLACE_TASK = (url: string): LocationTask =>
  ({type: REPLACE_TASK, url});

// The last task should be prevalent over all the other ones.

makeTaskType(HISTORY_PUSH_TASK, (tasks: LocationTask[], dispatch) => {
  if (tasks.length) {
    const {url} = tasks[tasks.length - 1];
    getHistory().push(url);
  }
});

makeTaskType(REPLACE_TASK, (tasks: LocationTask[], dispatch) => {
  if (tasks.length) {
    const {url} = tasks[tasks.length - 1];
    getHistory().replace(url);
  }
});
