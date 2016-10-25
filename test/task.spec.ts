import test from 'ava';
import {spy} from 'sinon';
import {createStore, applyMiddleware} from 'redux';

import {
  taskMiddleware,
  withTask,
  makeTaskType,
  drainTasksForTesting
} from '../tasks';

// tasks
const XHR_TASK = payload => ({type: XHR_TASK, payload});
const xhrHandlerSpy = spy();
makeTaskType(XHR_TASK, xhrHandlerSpy);

// sync set task
const SET_TASK_SYNC = payload => ({type: SET_TASK_SYNC, payload});
makeTaskType(SET_TASK_SYNC, (tasks, dispatch) => {
  tasks.forEach(task => {
    dispatch(SET_SUCCESS(task.payload));
  });
});

// async set task
const SET_TASK_ASYNC = payload => ({type: SET_TASK_ASYNC, payload});
makeTaskType(SET_TASK_ASYNC, (tasks, dispatch) => {
  return Promise.all(
    tasks.map(task =>
      new Promise(resolve => {
        setTimeout(() => {
          dispatch(SET_SUCCESS(task.payload));
          resolve();
        }, 1E3);
      })
    )
  );
});

// action creators
const ADD = payload => ({type: ADD, payload});
const SET_SYNC = payload => ({type: SET_SYNC, payload});
const SET_ASYNC = payload => ({type: SET_ASYNC, payload});
const SET_SUCCESS = payload => ({type: SET_SUCCESS, payload});
const BAD = () => ({type: BAD, payload: {}});

const reducer = (state = 0, action) => {
  const {payload} = action;

  switch (action.type) {
  case ADD:
    const newAmount = state + payload;
    return withTask(newAmount, [XHR_TASK(newAmount)]);
  case SET_SYNC:
    return withTask(state, [SET_TASK_SYNC(payload)]);
  case SET_ASYNC:
    return withTask(state, [SET_TASK_ASYNC(payload)]);
  case SET_SUCCESS:
    return payload;
  case BAD:
    return withTask(state, BAD());
  default:
    return state;
  }
};

const withHelpers = testFn => {
  const store = createStore(reducer, applyMiddleware(taskMiddleware));
  return t => testFn({t, store});
}

test('Task middleware runs handlers', withHelpers(({t, store}) => {
  store.dispatch(ADD(3));
  t.deepEqual(xhrHandlerSpy.args[0][0], [XHR_TASK(3)]);
  t.is(store.getState(), 3);

  // the middleware should consume all of the tasks
  const tasks = drainTasksForTesting();
  t.deepEqual(tasks, []);
}));

test('Task middleware throws when task not created properly', withHelpers(({t, store}) => {
  t.throws(() => store.dispatch(BAD()),
    `Task of type "Function(BAD)" does not have a handler. Make sure that you created it with "makeTaskType".`);
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

test.cb('Task middleware works with sync task handler', withHelpers(({t, store }) => {

  t.plan(3);

  t.is(store.getState(), 0);
  store.dispatch(SET_SYNC(42));

  // Fake tick to wait for the dispatchAsync to be finished
  setTimeout(() => {
    t.is(store.getState(), 42);
    t.end();
  });

  const tasks = drainTasksForTesting();
  t.deepEqual(tasks, []);

}));

test.cb('Task middleware works with async task handler', withHelpers(({t, store}) => {

  t.plan(4);

  t.is(store.getState(), 0);
  store.dispatch(SET_ASYNC(43));

  setTimeout(() => {
    t.is(store.getState(), 0);
  }, 500);

  // After a ~1E3 delay, the promise should have been resolved and have updated our state
  setTimeout(() => {
    t.is(store.getState(), 43);
    t.end();
  }, 1E3 + 1);

  const tasks = drainTasksForTesting();
  t.deepEqual(tasks, []);

}));
