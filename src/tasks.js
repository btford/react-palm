// @flow

/*
 * Interfaces
 */

// A task that either returns, or errors
opaque type Task<
  +Arg,
  +Inbound,
  +InboundError = mixed,
  +Result = Inbound,
  +Error = InboundError
>: $ReadOnly<{
  // This declaration is the public API
  kind: 'regular',
  type: string,
  payload: Arg,

  map<ResultPrime>(
    successTransform: (Result) => ResultPrime
  ): Task<Arg, Inbound, InboundError, ResultPrime, Error>,

  bimap<ResultPrime, ErrorPrime>(
    successTransform: (Result) => ResultPrime,
    errorTransform: (Error) => ErrorPrime
  ): Task<Arg, Inbound, InboundError, ResultPrime, ErrorPrime>,

  chain<ResultPrime, ErrorPrime>(
    chainTransform: (Result) => Task<*, *, *, ResultPrime, ErrorPrime>
  ): Task<Arg, Inbound, InboundError, ResultPrime, Error | ErrorPrime>
}> = $ReadOnly<{
  // `kind` is private
  kind: 'regular',
  type: string,
  payload: Arg,

  /*
   * This is a little tricky. This `run` takes a lambda and calls either
   * the success or error handlers based on the result. We need this so
   * we can substitute applying effectful functions for mocking results
   * in test.
   */
  run<S, E>(
    (
      ((S) => mixed, (E) => mixed) => mixed,
      (S) => mixed,
      (E) => mixed
    ) => mixed,
    (Result) => mixed,
    (Error) => mixed
  ): mixed,

  map<ResultPrime>(
    successTransform: (Result) => ResultPrime
  ): Task<Arg, Inbound, InboundError, ResultPrime, Error>,

  bimap<ResultPrime, ErrorPrime>(
    successTransform: (Result) => ResultPrime,
    errorTransform: (Error) => ErrorPrime
  ): Task<Arg, Inbound, InboundError, ResultPrime, ErrorPrime>,

  chain<ResultPrime, ErrorPrime>(
    chainTransform: (Result) => Task<*, *, *, ResultPrime, ErrorPrime>
  ): Task<Arg, Inbound, InboundError, ResultPrime, Error | ErrorPrime>
}>;

export type TaskCreator<
  Arg,
  Inbound,
  InboundError = mixed,
  Result = Inbound,
  Error = InboundError
> = Arg => Task<Arg, Inbound, InboundError>;

export type AnyTask = Task<any, any, any>;

/**
 * A group of tasks, all of different types
 */
export type AnyTasks = $ReadOnlyArray<AnyTask>;

// For tasks whose type must be disambiguated from their use
// (because they were dynamically hoisted using `withTask`, for instance).
export type MixedTask = Task<mixed, mixed>;
export type MixedTasks = $ReadOnlyArray<MixedTask>;

type Callback<Error, Result> = (err?: Error, res: Result) => mixed;

/**
 * Returns a task-creator from a function that returns a promise.
 */
export function fromPromise<Arg, +Inbound>(
  fn: Arg => Promise<Inbound>,
  label: string
): Arg => Task<Arg, Inbound, mixed, Inbound, mixed> {
  return outbound =>
    taskCreator_(
      (success, error) => fn(outbound).then(success, error),
      outbound,
      label
    );
}

/**
 * `Task.fromCallback`
 *
 * Turn a node-style callback function:
 *     `(arg, cb: (err, res) => void) => void`)
 * into a task creator of the same type.
 *
 * Uses the second arg as a label for debugging.
 */
export function fromCallback<Arg, +Inbound, +ErrorT>(
  fn: (Arg, Callback<ErrorT, Inbound>) => mixed,
  label: string
): Arg => Task<Arg, Inbound, ErrorT> {
  return (outbound: Arg) =>
    taskCreator_(
      (success, error) =>
        fn(outbound, (err, result) => (err ? error(err) : success(result))),
      outbound,
      label
    );
}

// legacy API
// You probably want to use `Task.fromCallback` or
// `Task.fromPromise` instead.
export function taskCreator<Arg, +Inbound, +ErrorT>(
  fn: (Arg, (Inbound) => mixed, (ErrorT) => mixed) => mixed,
  label: string
): Arg => Task<Arg, Inbound, ErrorT> {
  return (outbound: Arg) =>
    taskCreator_(
      (success, error) => fn(outbound, success, error),
      outbound,
      label
    );
}

/*
 * Implementation
 */

// although this is global, we drain it
// between dispatches to the store.
// you can think of this queue as "thread local."
let globalTaskQueue: Task<mixed, mixed>[] = [];

// used for debugging
let enableStackCapture = true;
let lastWithTaskCall: Error | null = null;
const IMPROPER_TASK_USAGE = `Tasks should not be added outside of reducers.`;

/*
 * Use this to create a new task
 */
function taskCreator_<Arg, Inbound, InboundError>(
  effector: ((Inbound) => mixed, (InboundError) => mixed) => mixed,
  payload: Arg,
  label: string
): Task<Arg, Inbound, InboundError, Inbound, InboundError> {
  // Instrument the task with reporting!
  const effectorPrime = (success, error) => {
    reportEffects('start', newTask, payload);
    return effector(
      result => {
        reportEffects('success', newTask, result);
        return success(result);
      },
      reason => {
        reportEffects('error', newTask, reason);
        return error(reason);
      }
    );
  };

  effectorPrime.payload = payload;
  effectorPrime.type = label;

  const newTask = _task(
    payload,
    (runEffect, success, error) => runEffect(effectorPrime, success, error),
    label
  );

  return newTask;
}

// Internal task constructor.
// Note that payload is only kept around for testing/debugging purposes
function _task<Arg, Inbound, InboundError, Result, Error>(
  payload: Arg,
  next: (
    runEffect: <S, E>(
      ((S) => mixed, (E) => mixed) => mixed,
      (S) => mixed,
      (E) => mixed
    ) => mixed,
    (Result) => mixed,
    (Error) => mixed
  ) => mixed,
  label: string
): Task<Arg, Inbound, InboundError, Result, Error> {
  return {
    label,
    type: label,
    payload,

    /*
     * Given the effector (or a mock), kicks off the task.
     * You (the end user) probably don't need to call this
     * directly. The middleware should handle it.
     */
    run: next,

    /*
     * Task Methods
     */

    chain,
    map,
    bimap
  };

  function map<ResultPrime>(
    successTransform: Result => ResultPrime
  ): Task<Arg, Inbound, InboundError, ResultPrime, Error> {
    return _task(
      payload,
      (runEffect, success, error) =>
        next(
          runEffect,
          (result: Result) => success(successTransform(result)),
          error
        ),
      label
    );
  }

  function bimap<ResultPrime, ErrorPrime>(
    successTransform: Result => ResultPrime,
    errorTransform: Error => ErrorPrime
  ): Task<Arg, Inbound, InboundError, ResultPrime, ErrorPrime> {
    return _task(
      payload,
      (runEffect, success, error) =>
        next(
          runEffect,
          (result: Result) => success(successTransform(result)),
          (reason: Error) => error(errorTransform(reason))
        ),
      label
    );
  }

  function chain<ResultPrime, ErrorPrime>(
    chainTransform: Result => Task<*, *, *, ResultPrime, ErrorPrime>
  ): Task<Arg, Inbound, InboundError, ResultPrime, Error | ErrorPrime> {
    return _task(
      payload,
      (runEffect, success, error) =>
        next(
          runEffect,
          (result: Result) => {
            const chainTask = chainTransform(result);
            return chainTask.run(runEffect, success, error);
          },
          error
        ),
      `Chain(${label})`
    );
  }
}

const CACHED_PROMISE: Promise<void> = Promise.resolve();
const makeDispatchAsync = (dispatch: Function) => (action: Object) =>
  CACHED_PROMISE.then(() => dispatch(action));

/*
 * You need to install this middleware for tasks to have their handlers run.
 *
 * You probably do not want to use this middleware within your test environment.
 * Instead, use `drainTasksForTesting` to retrieve and make assertions about them.
 */
export const taskMiddleware = (store: {dispatch: Function}) => (
  next: Function
) => (action: Object) => {
  if (!(module: any).hot && enableStackCapture && globalTaskQueue.length > 0) {
    const err = lastWithTaskCall;
    lastWithTaskCall = null;
    throw err;
  }

  next(action);
  const dispatch = makeDispatchAsync(store.dispatch);

  if (globalTaskQueue.length > 0) {
    const taskResolutions = globalTaskQueue.map(task =>
      runTaskActual(task, dispatch, dispatch)
    );

    globalTaskQueue = [];
    lastWithTaskCall = null;
    return Promise.all(taskResolutions);
  }

  return CACHED_PROMISE;
};

type MixedToMixed = mixed => mixed;

// Run the task with the proper effect
function runTaskActual(task, success, error) {
  if (typeof task.run !== 'function') {
    throw new Error('Attempted to run something that is not a task.');
  }
  return task.run(
    (f, s, e) => f(s, e),
    // unsafe coerce this because it doesn't matter
    ((success: any): MixedToMixed),
    ((error: any): MixedToMixed)
  );
}

/**
 * Use this function in your reducer to add tasks to an action handler.
 * The task will be lifted up to the top of your app.
 */
export function withTasks<State>(state: State, tasks: AnyTasks): State {
  if (!(module: any).hot && enableStackCapture && !lastWithTaskCall) {
    lastWithTaskCall = trace(IMPROPER_TASK_USAGE);
  }
  if (tasks instanceof Array) {
    globalTaskQueue = globalTaskQueue.concat(tasks);
  } else {
    globalTaskQueue.push(tasks);
  }
  return state;
}

/**
 * A helpful alias for providing just one task.
 * `withTask(state, task1)` is the same as `withTasks(state, [task1])`.
 */
export const withTask: <State>(
  state: State,
  task: AnyTask
) => State = (withTasks: any);

/*
 * This function should only be used in test environments to make assertions about
 * tasks as part of the test. Application code should not be mucking around with
 * the list of tasks. If you want to display information about tasks in your component,
 * add that information to your state tree when you create the task.
 */
export function drainTasksForTesting(): $ReadOnlyArray<MixedTask> {
  const drained = globalTaskQueue;
  globalTaskQueue = [];
  lastWithTaskCall = null;
  return drained;
}

/*
 * Run a task, using `simulator` for bi-application.
 * Simulator recieves:
 * 1. a function that kicks off a side effect, with success and error handers.
 * 2. a success handler to call with a mocked response.
 * 3. an error handler to call with a mocked out response.
 */
export function simulateTask<Inbound, InboundError, Result, Error, S, E>(
  someTask: Task<*, Inbound, InboundError, Result, Error>,
  simulator: (
    ((S) => mixed, (E) => mixed) => mixed,
    (S) => mixed,
    (E) => mixed
  ) => mixed
): Result | Error {
  let returned = null;
  const setReturned = val => {
    returned = val;
  };
  someTask.run(simulator, setReturned, setReturned);
  return returned;
}

export function succeedTaskWithValues<Result>(
  someTask: Task<*, *, *, Result>,
  values: $ReadOnlyArray<any>
): Result | null {
  let index: number = 0;
  let returned = null;
  const setReturned = val => {
    returned = val;
  };
  someTask.run(
    (_, s) => {
      if (index >= values.length) {
        throw new Error('Not enough values were provided!');
      }
      const returned = s(values[index]);
      index += 1;
      return returned;
    },
    setReturned,
    setReturned
  );
  return returned;
}

/*
 * Get the value of a task, always providing the given value as the inbound result.
 * If your task uses `.chain` or `Task.all`, you probbaly
 */
export function succeedTaskInTest<Inbound, Result>(
  someTask: Task<*, Inbound, *, Result, *>,
  value: Inbound
): Result {
  let returned;
  const setReturned = (val: Result) => {
    returned = val;
  };
  someTask.run((_, s, e) => s(value), setReturned, setReturned);
  if (typeof returned === 'undefined') {
    throw new Error('Success handler was never called!');
  }
  return returned;
}

export function errorTaskInTest<InboundError, ErrorT>(
  someTask: Task<*, *, InboundError, *, ErrorT>,
  value: InboundError
): ErrorT {
  let returned;
  const setReturned = (val: ErrorT) => {
    returned = val;
  };
  someTask.run((_1, _2, e) => e(value), setReturned, setReturned);
  if (typeof returned === 'undefined') {
    throw new Error('Success handler was never called!');
  }
  return returned;
}

/*
 * In order to make it easy to track down incorrect uses for `withTask`, we capture exception
 * objects for every call to withTask. This has some performance overhead, so you'll
 * probably want to disable it in production.
 */
export function disableStackCapturing(): void {
  enableStackCapture = false;
}

/*
 * Record the inputs/outputs of all tasks, for debugging or inspecting.
 * This feature should not be used to implement runtime behavior.
 */
let reportEffects: (event: string, task: any, payload: mixed) => void = (
  event: string,
  task: any,
  payload: mixed
) => {};

export function reportTasksForTesting(
  fn: (event: string, task: MixedTask, payload: mixed) => void
): void {
  reportEffects = fn;
}

// type level utils functions needed for Task.all
type ExtractArg = <O>(Task<O, *>) => O;
type ExtractResult = <R>(Task<*, *, *, R>) => R;
type ExtractError = <E>(Task<*, *, *, *, E>) => E;

/*
 * Task.all combinator. Acts just like `Promise.all`.
 */
export function all<AllTasks: $ReadOnlyArray<Task<mixed, mixed>>>(
  tasks: AllTasks
): Task<
  $TupleMap<AllTasks, ExtractArg>,
  *,
  *,
  $TupleMap<AllTasks, ExtractResult>,
  mixed
> {
  return _task(
    tasks.map(task => task.payload),
    (
      runEffect,
      success: ($TupleMap<AllTasks, ExtractResult>) => mixed,
      error
    ) => {
      if (tasks.length === 0) {
        return success([]);
      }
      const accumulated = Array(tasks.length);
      let complete = 0;
      let errorValue = null;

      function allSuccess(index) {
        return value => {
          if (errorValue) {
            return;
          }
          accumulated[index] = value;
          complete += 1;
          if (complete === tasks.length) {
            return success(accumulated);
          }
        };
      }

      function anyError(err) {
        if (err) {
          return;
        }
        errorValue = err;
        return error(errorValue);
      }

      return Promise.all(
        tasks.map((task, index) =>
          task.run(runEffect, allSuccess(index), anyError)
        )
      );
    },

    'Task.all(' + tasks.map(({type}) => type).join(', ') + ')'
  );
}

// Nice aliases:
// `import Task from 'react-palm/tasks';`
export default {
  all,
  fromCallback,
  fromPromise
};

/*
 * Helpers
 */
function trace(message: string): Error {
  try {
    throw new Error(message);
  } catch (e) {
    return e;
  }
}
