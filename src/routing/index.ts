import {withTask} from '../tasks';
import {createAction} from '../actions';
import {HISTORY_PUSH_TASK, REPLACE_TASK} from '../history';

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
  path: string,
  routes: RouteState[],
  query: RouteParams,
  hash: string
}

type RouterReducer = (state: RouterState) => RouterState

const INITIAL_STATE = {
  path: '',
  query: {},
  hash: '',
  routes: []
};

const isString = s => typeof(s) === 'string' || s instanceof String;

const deserializeQuery = query => {
  if (!query) { return {}; }
  return query.split('&').reduce((out, cur) => {
    const [key, v] = cur.split('=');
    const value = v ? decodeURIComponent(v.replace(/\+/g, ' ')) : '';
    return {...out, [key]: value};
  }, {});
};

const serializeQuery = query => {
  const keys = Object.keys(query);
  if (!keys.length) { return ''; }

  const queryString = keys
    .map(key => `${encodeURIComponent(key)}${query[key] ? `=${encodeURIComponent(query[key])}` : ''}`)
    .join('&');

  return `?${queryString}`;
}

export const LOCATION_CHANGE = createAction('LOCATION_CHANGE');
export const HISTORY_PUSH = createAction('HISTORY_PUSH');
export const REPLACE = createAction('REPLACE');

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

  const historyHandler = task => (state, path) => {
    const newState = updateRoute(state, path);
    const newPath = `${newState.path}${serializeQuery(newState.query)}`;
    return withTask(newState, task(newPath));
  };

  const handlers = {
    [HISTORY_PUSH as any as string]: historyHandler(HISTORY_PUSH_TASK),
    [REPLACE as any as string]: historyHandler(REPLACE_TASK),
    [LOCATION_CHANGE as any as string]: (state, path) => updateRoute(state, path)
  };

  const serialize = (route, parentUrl = '') => (...params) => {
    const serializedRoute = `${parentUrl}${route.url.serialize(...params)}`;
    if (!route.childRoutes) { return serializedRoute; }

    return Object.assign(
      () => serializedRoute,
      mapKeys(route.childRoutes, route => serialize(route, serializedRoute))
    );
  }

  const serializedRoutes = mapKeys<T, Function>(routes, serialize);

  const updateRoute = (state, fullPath) => {
    const [withoutHash, hash = ''] = fullPath.split('#');
    const [path, queryString] = withoutHash.split('?');
    const query = deserializeQuery(queryString);

    const matched = deepMatchRoutes(routes, path);

    // If it's a redirect string, pass matched route part and rebuild full url
    // with potential querystring and hash.
    if (isString(matched)) {
      return updateRoute(state, `${matched}${queryString ? `?${queryString}` : ''}${hash ? `#${hash}` : ''}`);
    }

    const nextState = {
      path,
      hash,
      query,
      routes: matched || []
    };

    return onChange(nextState);
  };

  /**
   * Recursively iterate over routes and their children in order to return
   * matched components and associated params by deserializing them with the
   * current path.
   *
   * deepMatchRoutes({user: {url: u`/users/${{uid: Number}}`, component: User}}, '/users/1', params)
   * --> [{component: User, params: {uid: 1}}]
   */
  const deepMatchRoutes = (curRoutes, path, dadParams = {}) =>
    Object.keys(curRoutes).reduce((out, key) => {

      if (out) { return out; }

      const route = curRoutes[key];
      const {component, redirectTo, childRoutes, url} = route;

      const maybeMatch = url.deserialize(path);
      if (!maybeMatch) { return; }

      const {params, remainingPath} = maybeMatch;

      const fullParams = {...params, ...dadParams};
      if (redirectTo) {
        return isString(redirectTo) ? redirectTo : redirectTo(serializedRoutes, fullParams);
      }

      // If the remaining path is empty, we can short-circuit
      if (remainingPath.length === 0) {
        return [{component, params}];
      } else if (childRoutes) {

        const childMaybeMatch = deepMatchRoutes(childRoutes, remainingPath, fullParams);

        // Check redirect string
        if (isString(childMaybeMatch)) {
          return childMaybeMatch;
        } else if (childMaybeMatch) {
          return [{params, component}, ...childMaybeMatch];
        }

      }

    }, null);

  return {
    handlers,
    routes: serializedRoutes,
    INITIAL_STATE,
    HISTORY_PUSH,
    LOCATION_CHANGE,
    REPLACE
  };
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
 * Match the pattern with a path
 */
const matchPattern = (pattern: string, path: string) => {

  // Ensure pattern starts with leading slash for consistency with path.
  if (pattern.charAt(0) !== '/') {
    pattern = `/${pattern}`;
  }
  if (path.charAt(0) !== '/') {
    path= `/${path}`;
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

  const match = path.match(new RegExp(`^${regexpSource}`, 'i'));
  if (match === null) {
    return null;
  }

  const matchedPath = match[0];
  let remainingPath = path.substr(matchedPath.length);

  if (remainingPath) {
    // Require that the match ends at a path separator, if we didn't match
    // the full path, so any remaining path is a new segment.
    if (matchedPath.charAt(matchedPath.length - 1) !== '/') {
      return null;
    }

    // If there is a remaining path, treat the path separator as part of
    // the remaining path for properly continuing the match.
    remainingPath = `/${remainingPath}`;
  }

  const paramValues = match.slice(1).map(v => v && decodeURIComponent(v));

  const params: RouteParams = paramNames.reduce((reduced, paramName, index) => {
    reduced[paramName] = paramValues[index];
    return reduced;
  }, {});

  return {params, remainingPath};
}
