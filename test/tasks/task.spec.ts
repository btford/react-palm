import test from 'ava';
import {spy} from 'sinon';

import {
  taskMiddleware,
  withTask,
  taskCreator,
  drainTasksForTesting,
  Task,
} from '../../src/tasks';

import {
  taskStore,
  SET_TASK_SYNC,
  SET_TASK_ASYNC
} from './fixtures';

// tasks
const xhrHandlerSpy = spy();
const XHR_TASK = taskCreator(xhrHandlerSpy, 'XHR_TASK');

const ADD = payload => ({type: ADD, payload});
const SET_SYNC = payload => ({type: SET_SYNC, payload});
const SET_ASYNC = payload => ({type: SET_ASYNC, payload});
const SET_SUCCESS = payload => ({type: SET_SUCCESS, payload});
const BAD = () => ({type: BAD, payload: {}});

export const reducer = (state = 0, action) => {
  const {payload} = action;

  switch (action.type) {
  case ADD:
    const newAmount = state + payload;
    return withTask(newAmount, [XHR_TASK(newAmount)]);
  case SET_SYNC:
    return withTask(state, [SET_TASK_SYNC(payload).map(SET_SUCCESS)]);
  case SET_ASYNC:
    return withTask(state, [SET_TASK_ASYNC(payload).map(SET_SUCCESS)]);
  case SET_SUCCESS:
    return payload;
  case BAD:
    return withTask(state, BAD() as Task<any, any>);
  default:
    return state;
  }
};

export const withHelpers = testFn => {
  const store = taskStore(reducer);
  return t => testFn({t, store});
}

test('Task middleware runs handlers', withHelpers(({t, store}) => {
  store.dispatch(ADD(3));
  const firstCallFirstArg = xhrHandlerSpy.args[0][0];
  t.is(firstCallFirstArg, 3);
  t.is(store.getState(), 3);

  // the middleware should consume all of the tasks
  const tasks = drainTasksForTesting();
  t.deepEqual(tasks, []);
}));

test('Task middleware throws when task not created properly', withHelpers(({t, store}) => {
  t.throws(() => store.dispatch(BAD()),
    `Task of type "Function(BAD)" does not have a handler. Make sure that you created it with "taskCreator".`);
}));

test('Task middleware throws when tasks were added incorrectly', withHelpers(({t, store}) => {

  const incorrectTaskAdd = () => withTask(null, XHR_TASK('test123'));

  incorrectTaskAdd();
  t.throws(() => store.dispatch(ADD(3)), `Tasks should not be added outside of reducers.`);

  drainTasksForTesting();
  let stack = '';

  try {
    incorrectTaskAdd();
    store.dispatch(ADD(3));
  } catch (e) {
    stack = e.stack;
  }

  t.regex(stack, /incorrectTaskAdd/, 'Error includes stack of the first incorrect task usage');

  drainTasksForTesting();

}));

test.cb('Task middleware works with sync task handler', withHelpers(({t, store}) => {

  t.plan(3);

  t.is(store.getState(), 0);
  store.dispatch(SET_SYNC(42));

  // Fake tick to wait for the dispatchAsync to be finished
  setTimeout(() => {
    t.is(store.getState(), 42);
    t.end();
  }, 0);

  const tasks = drainTasksForTesting();
  t.deepEqual(tasks, []);

}));

test.cb('Task middleware works with async task handler', withHelpers(({t, store}) => {
  t.plan(4);

  t.is(store.getState(), 0);
  const promise = store.dispatch(SET_ASYNC(43));

  t.is(store.getState(), 0);

  const tasks = drainTasksForTesting();
  t.deepEqual(tasks, []);

  promise.then(() => {
    t.is(store.getState(), 43);
    t.end();
  });
}));
