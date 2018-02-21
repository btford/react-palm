// @flow
import {spy} from 'sinon';

import {
  taskMiddleware,
  withTask,
  withTasks,
  taskCreator,
  drainTasksForTesting
} from '../src/tasks';

import {taskStore, SET_TASK_SYNC, SET_TASK_ASYNC} from './fixtures';

// tasks
const xhrHandlerSpy = spy();
const XHR_TASK = taskCreator(xhrHandlerSpy, 'XHR_TASK');

const ADD = payload => ({type: ADD, payload});
const SET_SYNC = payload => ({type: SET_SYNC, payload});
const SET_ASYNC = payload => ({type: SET_ASYNC, payload});
const SET_SUCCESS = payload => ({type: SET_SUCCESS, payload});
const BAD = () => ({type: BAD, payload: {}});

export const reducer = (
  state?: number = 0,
  action: {type: string, payload: any}
) => {
  const {payload} = action;

  switch (action.type) {
    case ADD:
      const newAmount = state + payload;
      return withTasks(newAmount, [XHR_TASK(newAmount)]);
    case SET_SYNC:
      return withTasks(state, [SET_TASK_SYNC(payload).map(SET_SUCCESS)]);
    case SET_ASYNC:
      return withTasks(state, [SET_TASK_ASYNC(payload).map(SET_SUCCESS)]);
    case SET_SUCCESS:
      return payload;
    case BAD:
      return withTask(state, (BAD(): any));
    default:
      return state;
  }
};

test('Task middleware runs handlers', () => {
  const store = taskStore(reducer);
  store.dispatch(ADD(3));
  const firstCallFirstArg = xhrHandlerSpy.args[0][0];
  expect(firstCallFirstArg).toBe(3);
  expect(store.getState()).toBe(3);

  // the middleware should consume all of the tasks
  const tasks = drainTasksForTesting();
  expect(tasks).toEqual([]);
});

test('Task middleware throws when task not created properly', () => {
  const store = taskStore(reducer);
  expect(() => store.dispatch(BAD())).toThrowError(
    `Attempted to run something that is not a task.`
  );
});

test('Task middleware throws when tasks were added incorrectly', () => {
  const store = taskStore(reducer);

  const incorrectTaskAdd = () => withTask(null, XHR_TASK('test123'));

  incorrectTaskAdd();
  expect(() => store.dispatch(ADD(3))).toThrowError(
    `Tasks should not be added outside of reducers.`
  );

  drainTasksForTesting();
  let stack = '';

  try {
    incorrectTaskAdd();
    store.dispatch(ADD(3));
  } catch (e) {
    stack = e.stack;
  }

  expect(stack).toMatch(/incorrectTaskAdd/);

  drainTasksForTesting();
});

test('Task middleware works with sync task handler', () => {
  const store = taskStore(reducer);

  expect(store.getState()).toBe(0);
  store.dispatch(SET_SYNC(42));

  // Fake tick to wait for the dispatchAsync to be finished
  setTimeout(() => {
    expect(store.getState()).toBe(42);
  });

  const tasks = drainTasksForTesting();
  expect(tasks).toEqual([]);
});

test('Task middleware works with async task handler', () => {
  const store = taskStore(reducer);

  expect(store.getState()).toBe(0);
  const promise = store.dispatch(SET_ASYNC(43));

  expect(store.getState()).toBe(0);

  const tasks = drainTasksForTesting();
  expect(tasks).toEqual([]);

  promise.then(() => {
    expect(store.getState()).toBe(43);
  });
});
