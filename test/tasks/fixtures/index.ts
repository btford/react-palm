import {
  taskMiddleware,
  withTask,
  taskCreator,
  drainTasksForTesting,
  Task,
} from '../../../src/tasks';

import {createStore, applyMiddleware} from 'redux';

export const ECHO_TASK = taskCreator<string, string>((payload, success) =>
  success(payload), 'ECHO_TASK');

// sync set task
export const SET_TASK_SYNC = taskCreator((payload, success) => success(payload), 'SET_TASK_SYNC');

// async set task
export const SET_TASK_ASYNC = taskCreator((payload, success) =>
  new Promise(resolve => {
    setTimeout(() => {
      success(payload);
      resolve();
    }, 0);
  }), 'SET_TASK_ASYNC');

// action creators
export const ADD = payload => ({type: ADD, payload});
export const SET_SYNC = payload => ({type: SET_SYNC, payload});
export const SET_ASYNC = payload => ({type: SET_ASYNC, payload});
export const SET_SUCCESS = payload => ({type: SET_SUCCESS, payload});
export const BAD = () => ({type: BAD, payload: {}});

export function taskStore(reducer) {
  return createStore(reducer, applyMiddleware(taskMiddleware));
}
