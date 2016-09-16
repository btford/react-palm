/*
 * Interfaces
 */

type TaskType = any;

export interface Task {
  type : TaskType;
  payload? : any;
  success? : (...args: any[]) => Action;
  error? : (...args: any[]) => Action;
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
type TaskHandler = (tasks: Task[], dispatch: Dispatch) => void;

/*
 * Implementation
 */
const TASK_TYPE_TO_HANDLER = Symbol('TASK_TYPE_TO_HANDLER');

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
  if (tasks.length > 0) {
    throw lastWithTaskCall;
  }
  const returnValue = next(action);
  const dispatch = store.dispatch;

  if (tasks.length > 0) {

    const taskHandlers = new Map() as Map<TaskHandler, Task[]>;

    tasks.forEach(task => {
      const handler = task.type[TASK_TYPE_TO_HANDLER];
      if (typeof handler !== 'function') {
        const taskName = task.type.name ? `Function(${task.type.name})` : task.type;
        throw new Error(`Task of type "${taskName}" does not have a handler. ` +
                        `Make sure that you created it with "makeTaskType".`);
      }
      if (!taskHandlers.get(handler)) {
        taskHandlers.set(handler, [task]);
      } else {
        taskHandlers.get(handler).push(task);
      }
    });

    taskHandlers.forEach((tasks, handler) => handler(tasks, dispatch));

    tasks = [];
    lastWithTaskCall = null;
  }

  return returnValue;
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

function trace(message : string) : Error {
  try {
    throw new Error(message);
  }
  catch(e) {
    return e;
  }
}
