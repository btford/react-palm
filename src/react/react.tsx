import * as RealReact from 'react';
import {
  Component, ReactElement, PropTypes, Children, createElement as realCreateElement
} from 'react';

import {render as realRender} from 'react-dom';
// import {isAction} from '../actions';

function isAction (maybeAction): boolean {
  return Boolean(maybeAction.type);
}

/*
 * We wrap React's create element to give us an event bus.
 * This lets us eliminate the need for `mapDispatchToProps` or
 * calling `connect` anywhere but at the application root.
 *
 * This has exactly the same function signature as `React.createElement`.
 * See: https://facebook.github.io/react/docs/react-api.html#createelement
 */
const createElement = (type, props, ...children) => {
  if (!props || typeof props !== 'object') {
    return realCreateElement(type, props, ...children);
  }

  const child = (unwrapped, {dispatch}) => {
    const props = wrapProps(unwrapped, dispatch);
    return realCreateElement(type, props, ...unwrapped.children);
  };

  (child as any).contextTypes = {
    dispatch: RealReact.PropTypes.func
  };

  return realCreateElement(child, props, ...children);
};

/*
 * Given a map of props:
 * `{ onClick: () => 'hi', label: 'bar' }`
 * And a `dispatch` function, wrap all functions that might be event handlers:
 * `{ onClick: () => (dispatch('hi'), 'hi'), label: 'bar' }`
 */
function wrapProps(props, dispatch) {
  return Object.keys(props).reduce((newProps, name) => {
    const prop = props[name];
    newProps[name] = (typeof prop === 'function') ?
      wrapEventHandler(prop, dispatch) :
      prop;
    return newProps;
  }, {});
}

function wrapEventHandler(fn, dispatch) {
  return (...args) => {
    const result = fn(...args);
    if (isAction(result)) {
      dispatch(result);
    }
    return result;
  };
}

export const React = {...RealReact, createElement};
export default React;

/*
 *
 */

const CONTEXT_WITH_DISPATCH = {
  dispatch: PropTypes.func
};

type DispatchFn = (...args: any[]) => void;

export function withDispatch(dispatch, childElement) {
  class Dispatch extends Component<{children: ReactElement<any>}, any> {
    static childContextTypes = CONTEXT_WITH_DISPATCH;

    getChildContext() {
      return {dispatch};
    }

    render() {
      const {children} = this.props;
      return (children as any).length > 1 ? (<div>{children}</div>) : children;
    }
  }

  return realCreateElement(Dispatch, null, childElement);
}

/*
 * Takes a fn and a react element, returns a wrapped react element that
 * composes over `fn` before calling dispatch
 */
export function mapDispatch(fn: Function, childElement: ReactElement<any>) {
  class MapDispatch extends Component<any, any> {
    static childContextTypes = CONTEXT_WITH_DISPATCH
    static contextTypes = CONTEXT_WITH_DISPATCH;

    getChildContext() {
      const {dispatch} = this.context as any;
      return {
        dispatch: (action) => dispatch(fn(action))
      };
    }

    render() {
      const {children} = this.props;
      return (children as any).length > 1 ? (<div>{children}</div>) : children;
    }
  }

  return (<MapDispatch>{childElement}</MapDispatch>);
}

/*
 * Just like React's render, except that it also takes a `dispatch` function.
 * Whenever an event handler returns an action, dispatch is called with that action.
 */
export function render(component, container, dispatch) {
  return realRender(withDispatch(dispatch, component), container);
}
