// @flow
import Task, {
  taskMiddleware,
  taskCreator,
  drainTasksForTesting
} from '../src/tasks';

import {createStore, applyMiddleware} from 'redux';

export const ECHO_TASK = taskCreator(
  (payload, success) => success(payload),
  'ECHO_TASK'
);

// sync set task
export const SET_TASK_SYNC = taskCreator(
  (payload, success) => success(payload),
  'SET_TASK_SYNC'
);

// async set task
export const SET_TASK_ASYNC = taskCreator(
  (payload, success) =>
    new Promise(resolve => {
      setTimeout(() => {
        success(payload);
        resolve();
      }, 0);
    }),
  'SET_TASK_ASYNC'
);

// action creators
export const ADD = (payload: number) => ({type: ADD, payload});
export const SET_SYNC = (payload: any) => ({type: SET_SYNC, payload});
export const SET_ASYNC = (payload: any) => ({type: SET_ASYNC, payload});
export const SET_SUCCESS = (payload: any) => ({type: SET_SUCCESS, payload});
export const BAD = () => ({type: BAD, payload: {}});

export function taskStore(reducer: Function) {
  return createStore(reducer, applyMiddleware(taskMiddleware));
}
