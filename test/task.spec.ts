import test from 'ava';
import {spy} from 'sinon';
import {createStore, applyMiddleware} from 'redux';

import {taskMiddleware, withTask, makeTaskType, drainTasksForTesting} from '../tasks';

function XHR_TASK(payload) {
  return {type: XHR_TASK, payload};
}
const xhrHandlerSpy = spy();
makeTaskType(XHR_TASK, xhrHandlerSpy);

function ADD(amount) {
  return {type: ADD, payload: {amount}};
}

function BAD() {
  return {type: BAD, payload: {}};
}

const reducer = (state = 0, action) => {
  switch (action.type) {
  case ADD:
    const newAmount = state + action.payload.amount;
    return withTask(newAmount, [XHR_TASK({value: newAmount})]);
  case BAD:
    return withTask(state, BAD());
  default:
    return state;
  }
};

function withHelpers(testFn) {
  const store = createStore(reducer, applyMiddleware(taskMiddleware));

  return function testDelegate(t) {
    return testFn({t, store});
  };
}

test('Task middleware runs handlers', withHelpers(({t, store}) => {
  store.dispatch(ADD(3));
  t.deepEqual(xhrHandlerSpy.args[0][0], [XHR_TASK({value: 3})]);
  t.deepEqual(store.getState(), 3);

  // the middleware should consume all of the tasks
  let tasks = drainTasksForTesting();
  t.deepEqual(tasks, []);
}));

test('Task middleware throws when task not created properly', withHelpers(({t, store}) => {
  t.throws(() => store.dispatch(BAD()),
    `Task of type "Function(BAD)" does not have a handler. Make sure that you created it with "makeTaskType".`);
}));

test('Task middleware throws when tasks were added incorrectly', withHelpers(({t, store}) => {
  function incorrectTaskAdd() {
    withTask(null, XHR_TASK('test123'));
  }
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
}));
