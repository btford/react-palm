// @flow
import Task, {
  taskCreator,
  succeedTaskInTest,
  simulateTask,
  withTask
} from '../src/tasks';
import {SET_SYNC, ADD, taskStore} from './fixtures';

const ECHO_TASK = taskCreator(
  (payload: string | number, success, _) => success(payload),
  'ECHO_TASK'
);

const appendB = x => `${x}b`;
const appendC = x => `${x}c`;

// This tests that Tasks obey the Functor Laws
// - https://en.wikipedia.org/wiki/Functor_category
test('t.map(f).map(g) === t.map(x => g(f(x)))', () => {
  const T1 = ECHO_TASK('out')
    .map(appendB)
    .map(appendC);
  const T2 = ECHO_TASK('out').map(x => appendC(appendB(x)));

  const r1 = succeedTaskInTest(T1, 'a');
  const r2 = succeedTaskInTest(T2, 'a');

  expect(r1).toBe(r2);
});

test('Task.all([t.map(f)]) === Task.all([t]).map([r] => f(r))', () => {
  const T1 = Task.all([ECHO_TASK('out').map(appendB)]).map(first);
  const T2 = Task.all([ECHO_TASK('out')]).map(([r]) => appendB(r));

  const r1 = succeedTaskInTest(T1, 'a');
  const r2 = succeedTaskInTest(T2, 'a');

  expect(r1).toBe(r2);
});

test('Tasks can be used in polymorphic functions', () => {
  type TT1 = {|config: {|+name: string|}, type: 'one'|};
  const T1 = Task.fromCallback(
    (v: {|+name: string|}, cb) => cb(undefined, v),
    'T1'
  );

  type TT2 = {|config: {|+age: number|}, type: 'two'|};
  const T2 = Task.fromCallback(
    (v: {|+age: number|}, cb) => cb(undefined, v),
    'T2'
  );

  const foo = (a: TT1 | TT2) => {
    switch (a.type) {
      case 'one':
        return T1(a.config);
      case 'two':
        return T2(a.config);
    }
  };

  const aa = {config: {name: 'foo'}, type: 'one'};
  foo(aa);

  T1(aa.config);
});

test('Task.all creates a new task which runs its delegates', () => {
  const MULTI_TASK = Task.all([
    ECHO_TASK('1'),
    ECHO_TASK('2'),
    ECHO_TASK('3')
  ]).map(SET_SYNC);

  const reducer = (state = [], action) => {
    return action.type === ADD
      ? withTask(state, MULTI_TASK)
      : action.type === SET_SYNC ? action.payload : state;
  };

  const store = taskStore(reducer);

  expect(MULTI_TASK.type).toBe('Task.all(ECHO_TASK, ECHO_TASK, ECHO_TASK)');

  store.dispatch(ADD(1)).then(_ => {
    expect(store.getState()).toEqual(['1', '2', '3']);
  });
});

test('Task.all resolves with an empty array', done => {
  const MULTI_TASK = Task.all([]).map(SET_SYNC);

  const reducer = (state = ['1', '2', '3'], action) => {
    return action.type === ADD
      ? withTask(state, MULTI_TASK)
      : action.type === SET_SYNC ? action.payload : state;
  };

  const store = taskStore(reducer);

  expect(MULTI_TASK.type).toBe('Task.all()');

  store.dispatch(ADD(1)).then(_ => {
    expect(store.getState()).toEqual([]);
    done();
  });
});

test('Task.map works in a real store', done => {
  const MAP_TASK = ECHO_TASK('5')
    .map(x => x + 1)
    .map(SET_SYNC);

  const reducer = (state = 0, action) => {
    return action.type === ADD
      ? withTask(state, MAP_TASK)
      : action.type === SET_SYNC ? action.payload : state;
  };

  const store = taskStore(reducer);

  store.dispatch(ADD(1)).then(_ => {
    expect(store.getState()).toEqual('51');
    done();
  });
});

test('Task.chain works with a real store', done => {
  const CHAIN_TASK = ECHO_TASK('Balthazar')
    .chain(result => ECHO_TASK(`Hello ${result}`))
    .map(SET_SYNC);

  const reducer = (state = 0, action) => {
    return action.type === ADD
      ? withTask(state, CHAIN_TASK)
      : action.type === SET_SYNC ? action.payload : state;
  };

  const store = taskStore(reducer);

  store.dispatch(ADD(1)).then(_ => {
    expect(store.getState()).toEqual('Hello Balthazar');
    done();
  });
});

test('Task.chain works with succeedTaskInTest', () => {
  const task = ECHO_TASK('');
  const chainTask = task.chain(who => ECHO_TASK(`Hello ${who}`));

  expect(chainTask.type).toBe('Chain(ECHO_TASK)');

  const expectations = [
    (effect, s, e) => {
      expect(effect.type).toBe('ECHO_TASK');
      expect(effect.payload).toBe('');
      return s('Balthazar');
    },
    (effect, s, e) => {
      expect(effect.type).toBe('ECHO_TASK');
      expect(effect.payload).toBe('Hello Balthazar');
      return s('Result');
    }
  ];

  const result = simulateTask(chainTask, (effect, s: string => mixed, e) =>
    expectations.shift()(effect, s, e)
  );

  expect(result).toBe('Result');
});

function first<T>(list: T[]): T {
  return list[0];
}
