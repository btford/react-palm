import {makeTaskType, TaskType} from '../tasks';
import {history} from './history';

export const HISTORY_PUSH_TASK = (url: string): HistoryPushTask =>
  ({type: HISTORY_PUSH_TASK, url});

export type HistoryPushTask = {
  type: TaskType;
  url: string;
}

makeTaskType(HISTORY_PUSH_TASK, (tasks: HistoryPushTask[], dispatch) => {
  // the last one wins
  if (tasks.length) {
    const {url} = tasks[tasks.length - 1];
    history.push(url);
  }
});
