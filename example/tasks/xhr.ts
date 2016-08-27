import {Task, Action, makeTaskType} from '../../tasks';

/**
 * These type defs aren't needed, but they help provide documentation
 * and improve readability.
 */
type Json = {[key: string]: any};

export type XhrTaskPayload = {
  url: string;
  json: Json;
};

export interface XhrTask {
  type: 'XHR_TASK';
  payload: XhrTaskPayload;
  success: (response : Json, code : number) => Action;
  error: (response : string, code : number) => Action;
}

export interface XhrTaskOptions {
  payload: XhrTaskPayload;
  success: (response : Json, code : number) => Action;
  error: (response : string, code : number) => Action;
}

export const XHR_TASK = ({payload, error, success}: XhrTaskOptions) =>
  ({type: XHR_TASK, payload, error, success});

makeTaskType(XHR_TASK, (tasks: XhrTask[], dispatch) => {
  tasks.forEach(task => setTimeout(() => {
    const action = Math.random() > .3 ? task.success({}, 0) : task.error('Opps', 404);
    dispatch(action);
  }, 500));
});
