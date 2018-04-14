// @flow

// A task that either returns, or errors
export opaque type Task<
  +Arg,
  +Inbound,
  +InboundError = mixed,
  +Result = Inbound,
  +Error = InboundError
>: $ReadOnly<{
  // This declaration is the public API

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
  // This declaration is the private API.

  kind: 'regular',
  type: string,
  payload: Arg,

  /*
   * This is a little tricky. This `run` takes a lambda and calls either
   * the success or error handlers based on the result. We need this so
   * we can substitute applying effectful functions for mocking results
   * in test.
   */
  run(
    BiApplicative<Inbound, InboundError>,
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

// A function that does some side-effect when run.
export type Effector<Inbound, InboundError> = (
  (Inbound) => mixed,
  (InboundError) => mixed
) => mixed;

// A function that runs an effector for some environment.
// In test, we provide one that doesn't call the effectful
// function, instead providing a mock response.
export type BiApplicative<S, E> = (
  Effector<S, E>,
  (S) => mixed,
  (E) => mixed
) => mixed;

// Private API for running a task. Do not use this directly.
// We need this because Task is an opaque type, and we
// hide `.run` outside this file.
export function _run<Inbound, InboundError, Result, ErrorT>(
  task: Task<*, Inbound, InboundError, Result, ErrorT>,
  fnApplication: BiApplicative<Inbound, InboundError>,
  success: Result => mixed,
  error: ErrorT => mixed
): mixed {
  if (typeof task.run !== 'function') {
    throw new Error('Attempted to run something that is not a task.');
  }
  return task.run(fnApplication, success, error);
}

/*
 * A function that takes some Arg and returns a new task.
 */
export type TaskCreator<
  Arg,
  Inbound,
  InboundError = mixed,
  Result = Inbound,
  Error = InboundError
> = Arg => Task<Arg, Inbound, InboundError>;

/**
 * A group of tasks, all of different types
 */
export type AnyTask = Task<any, any, any>;
export type AnyTasks = $ReadOnlyArray<AnyTask>;

/**
 * Tasks whose type must be disambiguated from their use
 * (because they were dynamically hoisted using `withTask`, for instance).
 */
export type MixedTask = Task<mixed, mixed>;
export type MixedTasks = $ReadOnlyArray<MixedTask>;

type Callback<Error, Result> = (err?: Error, res: Result) => mixed;

/**
 * ## `Task.fromCallback`
 * Returns a task-creator from a function that returns a promise.
 *
 * `arg => Promise<string[]>` -> `arg => Task<string[]>`.
 *
 * Uses the second arg as a label for debugging.
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

export type EffectReport = 'start' | 'success' | 'error';

/*
 * This is the private constructor for creating a Task object. End users
 * probably want to use `Task.fromCallback` or `task.fromPromise`.
 * It adds instrumentation to the effector, and also attaches some info
 * useful for making assertions in test.
 */
export function taskCreator_<Arg, Inbound, InboundError>(
  effector: ((Inbound) => mixed, (InboundError) => mixed) => mixed,
  payload: Arg,
  label: string
): Task<Arg, Inbound, InboundError, Inbound, InboundError> {
  // Instrument the task with reporting
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
// It should not be introspected outside of test
function _task<Arg, Inbound, InboundError, Result, Error>(
  payload: Arg,
  next: (
    runEffect: BiApplicative<Inbound, InboundError>,
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
     * Public Task Methods
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

/*
 * Record the inputs/outputs of all tasks, for debugging or inspecting.
 * This feature should not be used to implement runtime behavior.
 */
let reportEffects: (
  event: EffectReport,
  task: AnyTask,
  payload: mixed
) => void = (event: EffectReport, task: AnyTask, payload: mixed) => {};

/**
 * ## `reportTasksForTesting`
 *
 * Takes a function that is called whenever a task is dispatched,
 * returns, or errors.
 *
 * Note that only one function can be registered with this hook.
 * The last provided function is the one that takes effect.
 */
export function reportTasksForTesting(
  fn: (event: EffectReport, task: AnyTask, payload: mixed) => void
): void {
  reportEffects = fn;
}

// type level utils functions needed for Task.all
type ExtractArg = <O>(Task<O, *>) => O;
type ExtractResult = <R>(Task<*, *, *, R>) => R;
type ExtractError = <E>(Task<*, *, *, *, E>) => E;

/*
 * ## `Task.all`
 *
 * Given an array of Tasks, returns a new task that runs all the effects
 * of the original in parallel, with an array result where each element
 * corresponds to a task.
 *
 * Acts like `Promise.all`.
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
