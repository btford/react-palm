// @flow
import {type AnyTask, type AnyTasks, _run} from './core';
import {
  getGlobalTaskQueue,
  updateGlobalTaskQueue,
  clearLastWithTaskCall,
  setLastWithTaskCall,
  getLastWithTaskCall
} from './global';

const CACHED_PROMISE: Promise<void> = Promise.resolve();
const makeDispatchAsync = (dispatch: Function) => (action: Object) =>
  CACHED_PROMISE.then(() => dispatch(action));

// The way webpack does hot-reloading seems to break the checks we
// do against the stack trace.
const WEBPACK_HOT_RELOAD_ENABLED: boolean = Boolean((module: any).hot);
let enableStackCapture = !WEBPACK_HOT_RELOAD_ENABLED;
const IMPROPER_TASK_USAGE = `Tasks should not be added outside of reducers.`;

/**
 * You need to install this middleware for tasks to have their handlers run.
 *
 * You probably do not want to use this middleware within your test environment.
 * Instead, use `drainTasksForTesting` to retrieve and make assertions about them.
 *
 * This middleware changes the behavior of `store.dispatch` to return a promise.
 * That promise will resolve when all pending tasks for that call to `dispatch`
 * have finished (including calls transitively enqueued by tasks that dispatch actions).
 */
export const taskMiddleware = (store: {dispatch: Object => any}) => (
  next: Object => void
) => (action: Object) => {
  // If we begin a call to dispatch with tasks still in the queue,
  // we have a problem.
  if (enableStackCapture && getGlobalTaskQueue().length > 0) {
    const err = getLastWithTaskCall();
    clearLastWithTaskCall();
    throw err;
  }

  next(action);
  const dispatch = makeDispatchAsync(store.dispatch);

  if (getGlobalTaskQueue().length > 0) {
    const taskResolutions = getGlobalTaskQueue().map(runTaskActual(dispatch));

    updateGlobalTaskQueue([]);
    clearLastWithTaskCall();
    return Promise.all(taskResolutions);
  }

  return CACHED_PROMISE;
};

// Given a function that accepts two continuations (one for success, one for error),
// call the function supplying the provided continuations.
const biApply = (f, s, e, c) => f(s, e, c);

// Run the task with the proper effect
function runTaskActual(dispatch) {
  return function(task: AnyTask) {
    // unsafe coerce this because it doesn't matter
    return _run(
      task,
      biApply,
      dispatch,
      dispatch,
      ({onProgress: dispatch}: any)
    );
  };
}

/**
 * Use this function in your reducer to add tasks to an action handler.
 * The task will be lifted up to the top of your app. Returns the same
 * state object passed into it.
 */
export function withTasks<State>(state: State, tasks: AnyTasks): State {
  if (enableStackCapture && !getLastWithTaskCall()) {
    setLastWithTaskCall(trace(IMPROPER_TASK_USAGE));
  }
  updateGlobalTaskQueue(
    getGlobalTaskQueue().concat(tasks instanceof Array ? tasks : [tasks])
  );
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

/**
 * In order to make it easy to track down incorrect uses for `withTask`, we capture exception
 * objects for every call to withTask. This has some performance overhead, so you'll
 * probably want to disable it in production.
 *
 * Note that if you're using Webpack's hot reload, we disable this functionality by default.
 */
export function disableStackCapturing(): void {
  enableStackCapture = false;
}

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
