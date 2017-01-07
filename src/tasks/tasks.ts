/*
 * Interfaces
 */

export type TaskType = any;

type ActionCreator = (...args: any[]) => Action;

export interface Task {
  type : TaskType;
  payload? : any;
  success? : ActionCreator;
  error? : ActionCreator;
}

export interface Action {
  type : any;
  payload? : any;
}

// Dispatch is the dispatch provided by the redux store API
type Dispatch = (action: Action) => void;

// A task handler takes a task of a specific type and does something with it
// Most tasks will require you to write a handler, and then use `makeTaskScheduler`
// to turn your handler into a scheduler.
type TaskHandler = (task: Task) => void | Promise<any>;

/*
 * Implementation
 */
const TASK_TYPE_TO_HANDLER = Symbol('TASK_TYPE_TO_HANDLER');
const CACHED_PROMISE = Promise.resolve();
const makeDispatchAsync = dispatch => action => CACHED_PROMISE.then(() => dispatch(action));

let tasks : Task[] = [];

// used for debugging
let enableStackCapture = true;
let lastWithTaskCall : Error = null;
const IMPROPER_TASK_USAGE = `Tasks should not be added outside of reducers.`;

/*
 * Use this to create a new task type.
 */
export function makeTaskType(type: TaskType, handler: TaskHandler): TaskType {
  type[TASK_TYPE_TO_HANDLER] = handler;
  return type;
}

/*
 * You need to install this middleware for tasks to have their handlers run.
 *
 * You probably do not want to use this middleware within your test environment.
 * Instead, use `drainTasksForTesting` to retrieve and make assertions about them.
 */
export const taskMiddleware = store => next => action => {
  if (enableStackCapture && tasks.length > 0) {
    const err = lastWithTaskCall;
    lastWithTaskCall = null;
    throw err;
  }

  next(action);
  const dispatch = makeDispatchAsync(store.dispatch);

  if (tasks.length > 0) {
    const taskResolutions = tasks.map(task => {
      const handler = task.type[TASK_TYPE_TO_HANDLER];
      if (typeof handler !== 'function') {
        const taskName = task.type.name ? `Function(${task.type.name})` : task.type;
        throw new Error(`Task of type "${taskName}" does not have a handler. ` +
                        `Make sure that you created it with "makeTaskType".`);
      }
      return handler({
        ...task,
        error: (...args) => dispatch(task.error(...args)),
        success: (...args) => dispatch(task.success(...args))
      });
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
export function withTask<T>(state : T, task: Task | Task[]): T {
  if (enableStackCapture && !lastWithTaskCall) {
    lastWithTaskCall = trace(IMPROPER_TASK_USAGE);
  }
  if (task instanceof Array) {
    tasks = tasks.concat(task);
  } else {
    tasks.push(task);
  }
  return state;
}

/*
 * This function should only be used in test environments to make assertions about
 * tasks as part of the test. Application code should not be mucking around with
 * the list of tasks. If you want to display information about tasks in your component,
 * add that information to your state tree when you create the task.
 */
export function drainTasksForTesting(): Task[] {
  const drained = tasks;
  tasks = [];
  lastWithTaskCall = null;
  return drained;
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
 * map
 */
export function map({type, payload, success, error}: Task, transform: Function): Task {
  return {
    type,
    payload,
    success: (...args) => success(transform(...args)),
    error
  };
}

export function bimap(
  {type, payload, success, error}: Task,
  successTransform: Function,
  errorTransform: Function
) {
  return {
    type,
    payload,
    success: (...args) => success(successTransform(...args)),
    error: (...args) => error(errorTransform(...args))
  };
}

// This is kind of weird; handlers require that the task itself is
// fed back in to the
const compositeHandler = tasks => ({success, error}) => {
  if (tasks.length === 0) {
    return success([]);
  }
  let unsettled = tasks.length;
  let failed = false;
  const results = tasks.map(_ => null);
  return Promise.all(tasks.map((task, index) => {
    const handler = task.type[TASK_TYPE_TO_HANDLER];
    return handler({
      ...task,
      success: (value) => {
        if (failed) {
          return;
        }
        results[index] = value;
        unsettled -= 1;
        if (unsettled === 0) {
          success(results);
        }
      },
      error: (reason) => {
        if (!failed) {
          failed = true;
          error(reason);
        }
      }
    });
  }));
};

export function all(tasks: Task[], {success, error}): Task {
  const type = {
    get name() {
      return 'Task.all(' + tasks.map(({type}) => toString(type)).join(', ') + ')';
    },
    [TASK_TYPE_TO_HANDLER]: compositeHandler(tasks)
  };
  return {
    type,
    success,
    error,
  };
}

export const Task = {
  map,
  bimap,
  all
};

function trace(message : string) : Error {
  try {
    throw new Error(message);
  }
  catch(e) {
    return e;
  }
}

function toString(maybeString: any) {
  if (typeof maybeString === 'function' && maybeString.name) {
     return maybeString.name;
  }
  return maybeString.toString();
}
