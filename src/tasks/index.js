// @flow
import {all, fromCallback, fromPromise} from './core';
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
export {taskCreator} from './legacy';
export {
  taskMiddleware,
  withTask,
  withTasks,
  disableStackCapturing
} from './redux';

// In the future, test utils will not be exported from
// this main bundle
export * from './test-utils';

// This default export provides a nice alias:
// ```
// import Task from 'react-palm/tasks';
// Task.all([...])
// ```
export default {
  all,
  fromCallback,
  fromPromise
};
