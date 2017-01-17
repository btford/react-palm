import test from 'ava';
import {spy} from 'sinon';
import {createStore, applyMiddleware} from 'redux';

import {
  taskMiddleware,
  withTask,
  makeTaskType,
  drainTasksForTesting,
  resolveCompositeTaskForTesting,
  Task,
} from '../src/tasks';

// tasks
const XHR_TASK = payload => ({type: XHR_TASK, payload});
const xhrHandlerSpy = spy();
makeTaskType(XHR_TASK, xhrHandlerSpy);

const ECHO_TASK = payload => ({type: ECHO_TASK, payload});
makeTaskType(ECHO_TASK, (task) => {task.success(task.payload)});

// sync set task
const SET_TASK_SYNC = payload => ({type: SET_TASK_SYNC, payload, success: SET_SUCCESS});
makeTaskType(SET_TASK_SYNC, (task) => {task.success(task.payload)});

// async set task
const SET_TASK_ASYNC = payload => ({type: SET_TASK_ASYNC, payload, success: SET_SUCCESS});
makeTaskType(SET_TASK_ASYNC, (task) =>
  new Promise(resolve => {
    setTimeout(() => {
      task.success(task.payload);
      resolve();
    }, 0);
  })
);

// action creators
const ADD = payload => ({type: ADD, payload});
const ADD_MANY = payload => ({type: ADD_MANY, payload});
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
  const firstCallFirstArg = xhrHandlerSpy.args[0][0];
  t.is(firstCallFirstArg.payload, 3);
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

test.cb('Task.all creates a new task which runs its delegates', t => {
  const MULTI_TASK = Task.all([
    ECHO_TASK('1'),
    ECHO_TASK('2'),
    ECHO_TASK('3')
  ], {
    success: SET_SYNC,
    error: e => e
  });

  const reducer = (state = [], action) => {
    return action.type === ADD ?
        withTask(state, MULTI_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = createStore(reducer, applyMiddleware(taskMiddleware));

  t.is(MULTI_TASK.type.name, 'Task.all(ECHO_TASK, ECHO_TASK, ECHO_TASK)');

  // TODO: lol double cast
  (store.dispatch(ADD(1)) as any as Promise<any>).then((_) => {
    t.deepEqual(store.getState(), ['1', '2', '3']);
    t.end();
  });
});

test.cb('Task.all works with an empty array', t => {
  const MULTI_TASK = Task.all([], {
    success: SET_SYNC,
    error: e => e
  });

  const reducer = (state = ['1', '2', '3'], action) => {
    return action.type === ADD ?
        withTask(state, MULTI_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = createStore(reducer, applyMiddleware(taskMiddleware));

  t.is(MULTI_TASK.type.name, 'Task.all()');

  // TODO: lol double cast
  (store.dispatch(ADD(1)) as any as Promise<any>).then((_) => {
    t.deepEqual(store.getState(), []);
    t.end();
  });
});

test.cb('Task.map works', t => {
  const MAP_TASK =
    Task.map(Task.map(ECHO_TASK(5), (x) => x + 1), SET_SYNC);

  const reducer = (state = 0, action) => {
    return action.type === ADD ?
        withTask(state, MAP_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = createStore(reducer, applyMiddleware(taskMiddleware));

  // TODO: lol double cast
  (store.dispatch(ADD(1)) as any as Promise<any>).then((_) => {
    t.deepEqual(store.getState(), 6);
    t.end();
  });
});

test('Task.all + resolveCompositeTaskForTesting works to mock individual responses', t => {
  const MULTI_TASK = Task.all([
    ECHO_TASK('1'),
    ECHO_TASK('2'),
    ECHO_TASK('3')
  ], {
    success: SET_SYNC,
    error: e => e
  });

  const reducer = (state = [], action) => {
    return action.type === ADD ?
        withTask(state, MULTI_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = createStore(reducer);

  store.dispatch(ADD(1));

  const [task] = drainTasksForTesting();

  t.is(MULTI_TASK.type.name, 'Task.all(ECHO_TASK, ECHO_TASK, ECHO_TASK)');

  const action = resolveCompositeTaskForTesting(task, (tasks) =>
    tasks.forEach((t, i) => t.success(`response(${i}): ${t.payload}`)));

  store.dispatch(action);

  t.deepEqual(store.getState(), ['response(0): 1', 'response(1): 2', 'response(2): 3']);
});

test('Task.all + resolveCompositeTaskForTesting works with mapped tasks', t => {
  const MULTI_TASK = Task.all([
    Task.map(ECHO_TASK('1'), (value) => `${value} mapped!`),
    ECHO_TASK('2'),
    ECHO_TASK('3')
  ], {
    success: SET_SYNC,
    error: e => e
  });

  const reducer = (state = [], action) => {
    return action.type === ADD ?
        withTask(state, MULTI_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = createStore(reducer);

  store.dispatch(ADD(1));

  const [task] = drainTasksForTesting();

  t.is(MULTI_TASK.type.name, 'Task.all(ECHO_TASK, ECHO_TASK, ECHO_TASK)');

  const action = resolveCompositeTaskForTesting(task, (tasks) =>
    tasks.forEach((t, i) => t.success(`response(${i}): ${t.payload}`)));

  store.dispatch(action);

  t.deepEqual(store.getState(), ['response(0): 1 mapped!', 'response(1): 2', 'response(2): 3']);
});
