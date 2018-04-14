// @flow
import {_run, type Task, type MixedTask, type BiApplicative} from './core';
import {
  getGlobalTaskQueue,
  updateGlobalTaskQueue,
  clearLastWithTaskCall
} from './global';

/**
 * # Test Utils
 *
 * These SHOULD NOT be used in production.
 *
 * If you want to display information about tasks in your component,
 * add that information to your state tree when you create the task.
 *
 * If you want to get access to the current tasks, do so by returning the
 * tasks from helpers, and inspecting them before passing them to `withTask`.
 */

// A dual to "BiApplicative," but using dummy objects
export type Simulator<Arg, Inbound, InboundError> = (
  DummyEffector<Arg>,
  (Inbound) => mixed,
  (InboundError) => mixed
) => mixed;

// Although we pass the actual Effector to the Simulator,
// we only expose the type and payload fields.
type DummyEffector<Arg> = $ReadOnly<{
  type: string,
  payload: Arg
}>;

/**
 * Get the resulting value of a task, providing the given value as the inbound result.
 * If your task uses `.chain` or `Task.all`, you probably want to use `simulateTask`
 * or `succeedTaskWithValues` instead.
 */
export function succeedTaskInTest<Inbound, Result>(
  someTask: Task<*, Inbound, *, Result>,
  value: Inbound
): Result {
  return _runAndCaptureResult(someTask, (_, s, _e) => s(value));
}

/**
 * Get the failure value of a task, providing the given value as the inbound error.
 *
 * If your task uses `.chain` or `Task.all`, you probably want to use `simulateTask`
 * instead.
 */
export function errorTaskInTest<InboundError, ErrorT>(
  someTask: Task<*, *, InboundError, *, ErrorT>,
  value: InboundError
): ErrorT {
  return _runAndCaptureResult(someTask, (_, _s, e) => e(value));
}

/**
 * Run a task, using `simulator` for bi-application. `simulator` recieves:
 *
 * 1. an object representing a side-effect with `payload` and `type`.
 * 2. a success handler to call with a mocked response.
 * 3. an error handler to call with a mocked out response.
 *
 * A simulator might be called more than once in the case of `Task.all`
 * or `task.chain`.
 */
export function simulateTask<Arg, Inbound, InboundError, Result, ErrorT>(
  someTask: Task<Arg, Inbound, InboundError, Result, ErrorT>,
  simulator: Simulator<Arg, Inbound, InboundError>
): Result | ErrorT {
  return _runAndCaptureResult(someTask, simulator);
}

/**
 * Given some task, and array of values,
 */
export function succeedTaskWithValues<Result>(
  someTask: Task<*, *, *, Result>,
  values: $ReadOnlyArray<any>
): Result | null {
  let index: number = 0;
  return _runAndCaptureResult(someTask, (_, s) => {
    if (index >= values.length) {
      throw new Error('Not enough values were provided!');
    }
    const returned = s(values[index]);
    index += 1;
    return returned;
  });
}

/**
 * This function should only be used in test environments to make assertions about
 * tasks as part of the test. Application code should not be mucking around with
 * the list of tasks.
 *
 * If you want to display information about tasks in your component,
 * add that information to your state tree when you create the task.
 *
 * If you want to get access to the current tasks, do so by returning the
 * tasks from helpers, and inspecting them before passing them to `withTask`.
 */
export function drainTasksForTesting(): $ReadOnlyArray<MixedTask> {
  const drained = getGlobalTaskQueue();
  updateGlobalTaskQueue([]);
  clearLastWithTaskCall();
  return drained;
}

function _runAndCaptureResult<Inbound, InboundError, Result, ErrorT>(
  someTask: Task<*, Inbound, InboundError, Result, ErrorT>,
  simulator
): Result | ErrorT {
  let returned;
  const setReturned = val => {
    returned = val;
  };
  _run(
    someTask,
    ((simulator: any): BiApplicative<*, *>),
    setReturned,
    setReturned
  );
  if (typeof returned === 'undefined') {
    throw new Error('A success or error handler was never called!');
  }
  return returned;
}
