import {Task, Action, makeTaskType} from '../../src/tasks';

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

makeTaskType(XHR_TASK, (task: XhrTask) => {
  setTimeout(() => {
    Math.random() > .3 ? task.success({}, 0) : task.error('Opps', 404);
  }, 500)
});
