import {createAction} from '../actions';
import {withTask} from '../tasks';
import {HISTORY_PUSH_TASK} from '../history';

type ComponentType = any;

type RouteDefinition = {
  [route: string]: ComponentType | [ComponentType, RouteDefinition]
}

/*
 * Example usage:
 *
 * createRouter({
 *   '/': Index,
 *   '/users': [User, {
 *     '/'
 *   }]
 * })
 */
export function createRouter(routes: RouteDefinition, onChange = (state) => state) {
  const LOCATION_CHANGE = createAction('LOCATION_CHANGE');
  const HISTORY_PUSH = createAction('HISTORY_PUSH');

  const DEFAULT_CHILD = routes['/'];
  const DEFUALT_ROUTES = [{component: DEFAULT_CHILD, params: {}}];

  const INITIAL_STATE = {
    pathname: '',
    routes: DEFUALT_ROUTES
  };

  const handlers = {
    [HISTORY_PUSH as any as string]: (state, pathname) =>
      withTask(updateRoute(state, pathname), HISTORY_PUSH_TASK(pathname)),
    [LOCATION_CHANGE as any as string]: (state, {pathname}) => updateRoute(state, pathname)
  };

  function updateRoute(state, pathname) {
    const maybeMatch = deepMatchRoutes(routes, pathname);
    const nextState = Object.assign({}, state, {
      routing: {pathname, routes: maybeMatch || DEFUALT_ROUTES}
    });
    return onChange(nextState);
  }

  return {handlers, INITIAL_STATE, HISTORY_PUSH, LOCATION_CHANGE};
}

// returns an array of pairs of {component, params}
function deepMatchRoutes(routes, pathname) {
  const routePatterns = Object.keys(routes);
  let index = 0;
  for (const pattern of routePatterns) {
    const maybeMatch = matchPattern(pattern, pathname);
    if (maybeMatch) {
      const {params, remainingPathname} = maybeMatch;
      const childComponent = routes[pattern];

      // An array represents that we have nested children
      if (Array.isArray(childComponent)) {
        const [component, childRoutes] = childComponent;
        const childMaybeMatch = deepMatchRoutes(childRoutes, remainingPathname);
        if (childMaybeMatch) {
          return [{params, component, index}, ...childMaybeMatch];
        }
      } else if (remainingPathname.length === 0) {
        return [{params, component: childComponent, index}];
      }
    }
    index += 1;
  }

  // Else, no match
  return null;
}

/*
 * These functions are adapted from react-router
 */
function compilePattern(pattern: string) {
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

function matchPattern(pattern: string, pathname: string) {
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

  const params = paramNames.reduce((reduced, paramName, index) => {
    reduced[paramName] = paramValues[index];
    return reduced;
  }, {});

  return {params, remainingPathname};
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
