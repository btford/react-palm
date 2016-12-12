import {withTask} from '../tasks';
import {createAction} from '../actions';
import {HISTORY_PUSH_TASK} from '../history';

type ComponentType = Object | Function;

type RouteDefinition = {
  [routeName: string]: {url: any, component: ComponentType, childRoutes?: RouteDefinition }
}

type RouteParams = {
  [paramName: string]: string
}

type RouteState = {
  component: ComponentType,
  params: RouteParams
}

type RouterState = {
  pathname: string,
  routes: RouteState[]
}

type RouterReducer = (state: RouterState) => RouterState

/**
 * Create the router that gets passed the routes object definition
 * and an optional onChange callback.
 * Return the handlers, serialized routes and useful actions to interact
 * with the history and location.
 *
 * createRouter({ home: '/' })
 * --> { handlers, routes, INITIAL_STATE, HISTORY_PUSH, LOCATION_CHANGE }
 */
export function createRouter<T>(routes: T, onChange: RouterReducer = (state) => state) {

  const LOCATION_CHANGE = createAction('LOCATION_CHANGE');
  const HISTORY_PUSH = createAction('HISTORY_PUSH');

  const INITIAL_STATE = {
    pathname: '',
    routes: []
  };

  const handlers = {
    [HISTORY_PUSH as any as string]: (state, pathname) =>
      withTask(updateRoute(state, pathname), HISTORY_PUSH_TASK(pathname)),
    [LOCATION_CHANGE as any as string]: (state, pathname) => updateRoute(state, pathname)
  };

  const updateRoute = (state, pathname) => {
    const newRoutes = deepMatchRoutes(routes, pathname) || [];
    const nextState = {...state, pathname, routes: newRoutes};
    return onChange(nextState);
  };

  const serialize = (route, parentUrl = '') => (...params) => {
    const serializedRoute = `${parentUrl}${route.url.serialize(...params)}`;
    if (!route.childRoutes) { return serializedRoute; }

    return Object.assign(
      serializedRoute,
      mapKeys(route.childRoutes, route => serialize(route, serializedRoute))
    );
  }

  const serializedRoutes = mapKeys<T, Function>(routes, serialize);

  return {handlers, routes: serializedRoutes, INITIAL_STATE, HISTORY_PUSH, LOCATION_CHANGE};
}

/**
 * Takes the route object and a function, and create a new object where the keys
 * are identical, but assign each value to the return value of the function that
 * get passed the original value.
 *
 * mapKeys({ home: 1, user: 2 }, v => v + 1)
 * --> { home: 2, user: 3 }
 */
const mapKeys = <T, R>(obj: T, fn: Function): {[P in keyof T]: R} =>
  Object.keys(obj).reduce((out, key) =>
    (out[key] = fn(obj[key]), out),
    {}
  ) as {[P in keyof T]: R};

/**
 * Transform the route template string tag into its parametized equivalent.
 *
 * uHelper`/users/${{uid: Number}}`
 * --> '/users/:uid'
 */
export const uHelper = (strings, ...params): string => strings
  .reduce((out, cur, index) => {
    const param = params[index] ? `:${Object.keys(params[index])[0]}` : '';
    return `${out}${cur}${param}`;
  }, '')

/**
 * Transform the route template string tag into an object with serialize and
 * deserialize methods.
 *
 * u`/users/${{uid: Number}}`
 * --> { serialize: Function, deserialize: Function }
 */
export const u = (strings, ...params) => ({
  serialize: (parameters: RouteParams) =>
    strings.reduce((out, cur, index) => {
      const param = params[index] ? parameters[Object.keys(params[index])[0]] : '';
      return `${out}${cur}${param}`;
    }, ''),
  deserialize: (url: string) =>
    matchPattern(uHelper(strings, ...params), url)
});

// The following functions are adapted from react-router.

/**
 * Recursively iteratoe over routes and their children in order to return
 * matched components and associated params by deserializing them with the
 * current pathname.
 *
 * deepMatchRoutes({user: {url: u`/users/${{uid: Number}}`, component: User}}, '/users/1')
 * --> [{component: User, params: {uid: 1}}]
 */
const deepMatchRoutes = (routes, pathname) =>
  Object.keys(routes).reduce((out, key) => {

    if (out) { return out; }

    const route = routes[key];
    const {component, childRoutes, url} = route;

    const maybeMatch = url.deserialize(pathname);
    if (!maybeMatch) { return; }

    const {params, remainingPathname} = maybeMatch;

    if (childRoutes) {
      const childMaybeMatch = deepMatchRoutes(childRoutes, remainingPathname);
      if (childMaybeMatch) {
        return [{params, component}, ...childMaybeMatch];
      }
    } else if (remainingPathname.length === 0) {
      return [{component, params}];
    }

  }, null);

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Match every component of the route pattern and extract its tokens.
 */
const compilePattern = (pattern: string) => {
  let regexpSource = '';
  const paramNames = [];
  const tokens = [];

  let match;
  let lastIndex = 0;
  const matcher = /:([a-zA-Z_$][a-zA-Z0-9_$]*)|\*\*|\*|\(|\)/g;

  while ((match = matcher.exec(pattern))) {
    if (match.index !== lastIndex) {
      tokens.push(pattern.slice(lastIndex, match.index));
      regexpSource += escapeRegExp(pattern.slice(lastIndex, match.index));
    }

    if (match[1]) {
      regexpSource += '([^/]+)';
      paramNames.push(match[1]);
    } else if (match[0] === '**') {
      regexpSource += '(.*)';
      paramNames.push('splat');
    } else if (match[0] === '*') {
      regexpSource += '(.*?)';
      paramNames.push('splat');
    } else if (match[0] === '(') {
      regexpSource += '(?:';
    } else if (match[0] === ')') {
      regexpSource += ')?';
    }

    tokens.push(match[0]);

    lastIndex = matcher.lastIndex;
  }

  if (lastIndex !== pattern.length) {
    tokens.push(pattern.slice(lastIndex, pattern.length));
    regexpSource += escapeRegExp(pattern.slice(lastIndex, pattern.length));
  }

  return {
    pattern,
    regexpSource,
    paramNames,
    tokens
  };
}

/**
 * Match the pattern with a pathname
 */
const matchPattern = (pattern: string, pathname: string) => {

  // Ensure pattern starts with leading slash for consistency with pathname.
  if (pattern.charAt(0) !== '/') {
    pattern = `/${pattern}`;
  }
  if (pathname.charAt(0) !== '/') {
    pathname = `/${pathname}`;
  }

  const compiled = compilePattern(pattern);
  const {paramNames, tokens} = compiled;
  let {regexpSource} = compiled;

  // Allow optional path separator at end.
  if (pattern.charAt(pattern.length - 1) !== '/') {
    regexpSource += '/?';
  }

  // Special-case patterns like '*' for catch-all routes.
  if (tokens[tokens.length - 1] === '*') {
    regexpSource += '$';
  }

  const match = pathname.match(new RegExp(`^${regexpSource}`, 'i'));
  if (match === null) {
    return null;
  }

  const matchedPath = match[0];
  let remainingPathname = pathname.substr(matchedPath.length);

  if (remainingPathname) {
    // Require that the match ends at a path separator, if we didn't match
    // the full path, so any remaining pathname is a new path segment.
    if (matchedPath.charAt(matchedPath.length - 1) !== '/') {
      return null;
    }

    // If there is a remaining pathname, treat the path separator as part of
    // the remaining pathname for properly continuing the match.
    remainingPathname = `/${remainingPathname}`;
  }

  const paramValues = match.slice(1).map(v => v && decodeURIComponent(v));

  const params: RouteParams = paramNames.reduce((reduced, paramName, index) => {
    reduced[paramName] = paramValues[index];
    return reduced;
  }, {});

  return {params, remainingPathname};
}
