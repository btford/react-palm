/*
 * The following functions are based on `redux-actions` but attempts to be more strict.
 * In many cases, this means we can give developers feedback sooner about incorrect usage.
 */
interface Action {
  type: any;
  payload: any;
}

type ActionCreator = (payload?: any) => Action;
type Handler<S> = (state: S, payload: any, ...extra: any[]) => S;
type Handlers<S> = {[action: string]: Handler<S>};

const ACTION_CREATOR = Symbol('ACTION_CREATOR');
const DEFAULT_ACTION_NAME = 'ACTION';

/*
 * Creates an action creator with the identity of the action creator as the type.
 * Params passed to the action creator are mapped to the payload property.
 *
 * ```
 * const MY_ACTION = createAction('MY_ACTION');
 * const action = MY_ACTION({user: 123});
 * > {type: MY_ACTION, payload: {user: 123}};
 * ```
 */
export function createAction(name = DEFAULT_ACTION_NAME): ActionCreator {
  const action = (payload = {}) => ({type: action, payload});

  const uniqueSymbol = Symbol(name);

  if (name !== DEFAULT_ACTION_NAME) {
    Object.defineProperty(action, 'name', {value: name});
  }

  (<any>action).toString = () => uniqueSymbol;
  action[ACTION_CREATOR] = true;

  return action;
}

/*
 * Takes a map from action to handlers, and returns a reducer:
 *
 * ```
 * const reduer = handleActions({
 *   [MY_ACTION]: (state, payload) => ({ users: payload.users })
 * })
 * ```
 *
 * The handler is called with the given state passed to the reduer as a first argument,
 * and the payload of the action as the second argument.
 *
 * Inspired by a function of the same name from the `redux-actions` library,
 * but differs in that the returned reducer throws if called with an action type
 * not provided as a key in handleActions. It also allows function identity as a
 * handler key, and enforces the "flux standard action" spec.
 */
export function strictHandleActions<S>(handlersMap: Handlers<S>, initialState: S): Handler<S> {
  return function actionHandler(state: S, action: Action) {
    if (state === undefined) {
      return initialState;
    }
    if (action[ACTION_CREATOR]) {
      const actionName = (<any>action).name || action.toString();
      throw new Error(
        'Reducer should be called with an action, not an action creator. ' +
        `Try "dispatch(${actionName}())" instead of "dispatch(${actionName})"`
      );
    }
    const handler = handlersMap[action.type];
    if (handler) {
      if (!action.payload) {
        throw new Error(`Action of type "${action.type}" does not have a "payload" property.`);
      }
      const result = handler(state, action.payload, ...extra);
      if (result === void 0) {
        throw new Error(`Action of type "${action.type}" returned "undefined".`);
      }
      return result;
    }

    throw new Error(`Unknown action type "${action.type}".`);
  };
}

/*
 * Same as `handleActions`, but does not throw for unknown actions, and allows non-standard
 * actions.
 */
export function laxHandleActions<S>(handlersMap: Handlers<S>, initialState: S): Handler<S> {
  return function actionHandler(state, action, ...extra) {
    if (state === undefined) {
      return initialState;
    }
    const handler = handlersMap[action.type];
    if (handler) {
      // if it's a "flux standard action" just call with the payload to reduce boilerplate
      if (!action.payload) {
        return handler(state, action);
      }
      return handler(state, action.payload);
    }
    return state;
  };
}

export const handleActions = strictHandleActions;
