import test from 'ava';
import {
  Task, taskCreator, succeedTaskInTest, withTask
} from '../../src/tasks';
import {
  SET_SYNC,
  ADD,
  taskStore
} from './fixtures';

type Payload = string;

function spy(
  payload: Payload,
  success: (p: Payload) => void
) {
  return Promise.resolve(success(payload));
};

const ECHO_TASK = taskCreator(spy, 'ECHO_TASK');

const appendB = x => `${x}b`;
const appendC = x => `${x}c`;

test('t.map(f).map(g) === t.map(x => g(f(x)))', t => {
  const T1 = ECHO_TASK('out').map(appendB).map(appendC);
  const T2 = ECHO_TASK('out').map((x) => appendC(appendB(x)));

  const r1 = succeedTaskInTest(T1, 'a');
  const r2 = succeedTaskInTest(T2, 'a');

  t.is(r1, r2);
});

test('Task.all([t.map(f)]) === Task.all([t]).map([r] => f(r))', t => {
  function first<T>(list: T[]): T {
    return list[0];
  }
  const T1 = Task.all([ECHO_TASK('out').map(appendB)]).map(first);
  const T2 = Task.all([ECHO_TASK('out')]).map(([r]) => appendB(r));

  const r1 = succeedTaskInTest(T1, 'a');
  const r2 = succeedTaskInTest(T2, 'a');

  t.is(r1 as any as string, r2);
});

test.cb('Task.all creates a new task which runs its delegates', t => {
  const MULTI_TASK = Task.all([
    ECHO_TASK('1'),
    ECHO_TASK('2'),
    ECHO_TASK('3')
  ]).map(SET_SYNC);

  const reducer = (state = [], action) => {
    return action.type === ADD ?
        withTask(state, MULTI_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = taskStore(reducer);

  t.is(MULTI_TASK.type, 'Task.all(ECHO_TASK, ECHO_TASK, ECHO_TASK)');

  // TODO: lol double cast
  (store.dispatch(ADD(1)) as any as Promise<any>).then((_) => {
    t.deepEqual(store.getState(), ['1', '2', '3']);
    t.end();
  });
});

test.cb('Task.all resolves with an empty array', t => {
  const MULTI_TASK = Task.all([]).map(SET_SYNC);

  const reducer = (state = ['1', '2', '3'], action) => {
    return action.type === ADD ?
        withTask(state, MULTI_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = taskStore(reducer);

  t.is(MULTI_TASK.type, 'Task.all()');

  // TODO: lol double cast
  (store.dispatch(ADD(1)) as any as Promise<any>).then((_) => {
    t.deepEqual(store.getState(), []);
    t.end();
  });
});

test.cb('Task.map works in a real store', t => {
  const MAP_TASK = ECHO_TASK('5').map(x => x + 1).map(SET_SYNC);

  const reducer = (state = 0, action) => {
    return action.type === ADD ?
        withTask(state, MAP_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = taskStore(reducer);

  // TODO: lol double cast
  (store.dispatch(ADD(1)) as any as Promise<any>).then((_) => {
    t.deepEqual(store.getState(), '51');
    t.end();
  });
});

test.cb('Task.chain works with a real store', t => {
  const CHAIN_TASK = ECHO_TASK('Balthazar')
    .chain(result => ECHO_TASK(`Hello ${result}`))
    .map(SET_SYNC);

  const reducer = (state = 0, action) => {
    return action.type === ADD ?
        withTask(state, CHAIN_TASK) :
      action.type === SET_SYNC ?
        action.payload :
      state;
  };

  const store = taskStore(reducer);

  // TODO: lol double cast
  (store.dispatch(ADD(1)) as any as Promise<any>).then((_) => {
    t.deepEqual(store.getState(), 'Hello Balthazar');
    t.end();
  });
});

test('Task.chain works with succeedTaskInTest', t => {
  const task = ECHO_TASK('');
  const chainTask = task.chain(who => ECHO_TASK(`Hello ${who}`));

  t.is(chainTask.type, 'Chain(ECHO_TASK)');

  const unchainedTask = succeedTaskInTest(chainTask, 'Balthazar') as any as Task<string, string>;

  t.is(unchainedTask.type, 'ECHO_TASK');
  t.is(unchainedTask.payload, 'Hello Balthazar');

  t.is(succeedTaskInTest(unchainedTask, 'Result'), 'Result');
});
