// @flow
import {
  all,
  allSettled,
  fromCallback,
  fromPromise,
  fromPromiseWithProgress
} from './core';
export {reportTasksForTesting} from './core';
export type {
  Task,
  TaskCreator,
  AnyTask,
  AnyTasks,
  MixedTask,
  MixedTasks,
  EffectReport
} from './core';

// export individual functions
export {
  all,
  allSettled,
  fromCallback,
  fromPromise,
  fromPromiseWithProgress
} from './core';

export {taskCreator} from './legacy';
export {
  taskMiddleware,
  withTask,
  withTasks,
  disableStackCapturing
} from './redux';

export {getGlobalTaskQueue} from './global';
// In the future, test utils will not be exported from
// this main bundle
export * from './test-utils';

// ```
// import {Task} from 'react-palm/tasks';
// Task.all([...])
// ```

export const Tasks = {
  all,
  allSettled,
  fromCallback,
  fromPromise,
  fromPromiseWithProgress
};

export default Tasks;
