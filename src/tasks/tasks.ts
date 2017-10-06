/*
 * Interfaces
 */

export type TaskType = any;

type ActionCreator = (...args: any[]) => Action;

export interface Task<P, T> {
  type : TaskType;
  payload? : P;

  bimap: <R>(successTransform: Transformer<T, R>, errorTransform: Function) => Task<P, R>;

  map: <R>(successTransform: Transformer<T, R>) => Task<P, R>;

  chain: <P2, R>(chainTransform: (from: T) => Task<P2, R>) => Task<P, R>;
}

type AnyTask = Task<any, any>;

type Transformer<T, R> = (from: T) => R;

type TaskPayload = any;

export interface Action {
  type : any;
  payload? : any;
}

// Dispatch is the dispatch provided by the redux store API
type Dispatch = (action: Action) => void;

type TaskRun<P, T> = (
  payload: P,
  success?: (arg: T) => void,
  error?: (reason) => void
) => (Promise<any> | any);

type TaskCreator<P, T> = (payload: P) => Task<P, T>;

declare var module:any;

/*
 * Implementation
 */
const TASK_RUN = Symbol('TASK_RUN');
const ANCESTOR_SUCCESS = Symbol('ANCESTOR_SUCCESS');
const ANCESTOR_ERROR = Symbol('ANCESTOR_ERROR');
function IDENTITY<T>(value: T) : T {
  return value;
}

let tasks : Task<any, any>[] = [];

// used for debugging
let enableStackCapture = true;
let lastWithTaskCall : Error = null;
const IMPROPER_TASK_USAGE = `Tasks should not be added outside of reducers.`;

/*
 * Use this to create a new task
 */
export function taskCreator<P, T>(
  run: TaskRun<P, T>,
  type: string
) : TaskCreator<P, T> {
  return (payload: P) => _task(payload, run, IDENTITY, IDENTITY, type)
}

function _task<P, T>(
  payload: P,
  run: TaskRun<P, T>,
  mockSuccess,
  mockError,
  type
): Task<P, T> {
  const newTask = {
    type,
    payload,
    [TASK_RUN]: (payload: P, success, error) => {
      reportEffects('start', newTask, newTask.payload);
      return run(payload, (result) => {
        reportEffects('success', newTask, result);
        return success(result);
      }, reason => {
        reportEffects('error', newTask, reason);
        return error(reason);
      });
    },
    [ANCESTOR_SUCCESS]: mockSuccess,
    [ANCESTOR_ERROR]: mockError,
    map<R>(transform: Transformer<T, R>): Task<P, R> {
      return this.bimap(transform);
    },
    bimap<R>(successTransform: Transformer<T, R>, errorTransform) {
      return _task<P, R>(
        payload,
        (payload, success, error) =>
          run(
            payload,
            (result) =>
              success(successTransform(result)),
            reason =>
              error(errorTransform(reason))
          ),
        (value) => successTransform(mockSuccess(value)),
        (reason) => errorTransform(mockError(reason)),
        type
      );
    },

    chain<P2, T2>(chainTransform: (result: T) => Task<P2, T2>): Task<P, T2> {
      return _task(
        payload,
        (payload, success, error) =>
          run(
            payload,
            (result: T) => {
              const chainTask = chainTransform(result);
              return chainTask[TASK_RUN](chainTask.payload, success, error);
            }
          ),
        (value) => chainTransform(mockSuccess(value)),
        mockError,
        `Chain(${type})`
      )
    }
  };

  return newTask;
}

const CACHED_PROMISE = Promise.resolve();
const makeDispatchAsync = dispatch => action => CACHED_PROMISE.then(() => dispatch(action));

/*
 * You need to install this middleware for tasks to have their handlers run.
 *
 * You probably do not want to use this middleware within your test environment.
 * Instead, use `drainTasksForTesting` to retrieve and make assertions about them.
 */
export const taskMiddleware = store => next => action => {
  if (!module.hot && enableStackCapture && tasks.length > 0) {
    const err = lastWithTaskCall;
    lastWithTaskCall = null;
    throw err;
  }

  next(action);
  const dispatch = makeDispatchAsync(store.dispatch);

  if (tasks.length > 0) {
    const taskResolutions = tasks.map(task => {
      assertTaskIsRunnable(task);
      return task[TASK_RUN](task.payload, dispatch, dispatch);
    });

    tasks = [];
    lastWithTaskCall = null;
    return Promise.all(taskResolutions);
  }

  return CACHED_PROMISE;
};

/*
 * Use this function in your reducer to add tasks to an action handler.
 */
export function withTask<S>(state : S, task: AnyTask | AnyTask[]): S {
  if (!module.hot && enableStackCapture && !lastWithTaskCall) {
    lastWithTaskCall = trace(IMPROPER_TASK_USAGE);
  }
  if (task instanceof Array) {
    tasks.forEach(assertTaskIsRunnable);
    tasks = tasks.concat(task);
  } else {
    assertTaskIsRunnable(task);
    tasks.push(task);
  }
  return state;
}

function assertTaskIsRunnable(task: AnyTask): void {
  if (typeof task[TASK_RUN] !== 'function') {
    const taskName = typeof task.type === 'function' ?
      `Function(${toString(task.type)})` : toString(task.type);
    throw new Error(`Task of type "${taskName}" does not have a handler. ` +
                    `Make sure that you created it with "taskCreator".`);
  }
}

/*
 * This function should only be used in test environments to make assertions about
 * tasks as part of the test. Application code should not be mucking around with
 * the list of tasks. If you want to display information about tasks in your component,
 * add that information to your state tree when you create the task.
 */
export function drainTasksForTesting(): AnyTask[] {
  const drained = tasks;
  tasks = [];
  lastWithTaskCall = null;
  return drained;
}

/*
 * This function will call `success` from the base task so that any
 * calls to `map` will be called before returning.
 */
export function succeedTaskInTest<P, T>(someTask: Task<P, T>, value: P = null): T {
  return someTask[ANCESTOR_SUCCESS](value);
}

export function errorTaskInTest(someTask, reason = '') {
  return someTask[ANCESTOR_ERROR](reason);
}

/*
 * In order to make it easy to track down incorrect uses for `withTask`, we capture exception
 * objects for every call to withTask. This has some performance overhead, so you'll
 * probably want to disable it in production.
 */
export function disableStackCapturing() {
  enableStackCapture = false;
}

/*
 * Record the inputs/outputs of all tasks, possibly for
 * generating tests.
 */
let reportEffects = (event: string, task: AnyTask, payload: any) => {};
export function reportTasksForTesting(fn) {
  reportEffects = fn;
}

/*
 * Operators (map, bimap, all)
 */

// This abomination is because TypeScript does not have
// higher kinded types.

interface TaskExportAll {
  <TAll>(tasks: TAll[]): Task<any, TAll[]>;

  <P1, T1>(tasks: [Task<P1, T1>]): Task<any, [T1]>;

  <P1, T1, P2, T2>(
    tasks: [Task<P1, T1>, Task<P2, T2>]
  ): Task<any, [T1, T2]>;

  <P1, T1, P2, T2, P3, T3>(
    tasks: [Task<P1, T1>, Task<P2, T2>, Task<P3, T3>]
  ): Task<any, [T1, T2, T3]>;
}

interface TaskExport {
  all: TaskExportAll;

  map<P, T, R>(t: Task<P, T>, f: Transformer<T, R>): Task<P, R>;
  bimap<P, T, R>(t: Task<P, T>, f: Transformer<T, R>, f2: Function): Task<P, R>;

  chain<P, T, P2, T2>(t: Task<P, T>, chainTransform: (result: T) => Task<P2, T2>): Task<P, T2>;
}

const all = (tasks) => {
  return _task(null, (_, success, error) => {
    if (tasks.length === 0) {
      return success([]);
    }
    const results = tasks.map(_ => null);
    let remaining = tasks.length;
    let failed = false;
    return Promise.all(tasks.map((taskI, index) =>
      taskI[TASK_RUN](
        taskI.payload,
        result => {
        if (failed) {
          return;
        }
        remaining -= 1;
        results[index] = result;
        if (remaining === 0) {
          success(results);
        }
      }, reason => {
        if (failed) {
          return;
        }
        failed = true;
        error(reason);
      })));
    },

    (values) =>
      tasks.map((taskI, index) =>
        succeedTaskInTest(taskI, values[index])),

    (reasons) =>
      tasks.map((taskI, index) =>
        errorTaskInTest(taskI, reasons[index])),

    'Task.all(' + tasks.map(({type}) =>
      toString(type)).join(', ') + ')'
  );
};

export const Task : TaskExport = {
  all: (all as any as TaskExportAll),
  map: <P, T, R>(t: Task<P, T>, f: Transformer<T, R>) =>
    t.map(f),
  bimap: <P, T, R>(t: Task<P, T>, f: Transformer<T, R>, f2: Function) =>
    t.bimap(f, f2),
  chain: <P, T, P2, T2>(t: Task<P, T>, chainTransform: (result: T) => Task<P2, T2>): Task<P, T2> => t.chain(chainTransform)
};

/*
 * Helpers
 */
function trace(message : string) : Error {
  try {
    throw new Error(message);
  }
  catch(e) {
    return e;
  }
}

// Converts a function or toString-able to a human-readable string
// for debugging.
function toString(maybeString: any) {
  if (typeof maybeString === 'function' && maybeString.name) {
     return maybeString.name;
  }
  return maybeString.toString();
}
