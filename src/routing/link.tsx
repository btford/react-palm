import * as React from 'react';

import {HISTORY_PUSH} from '.';

type LinkProps = {
  to: string,
  push: Function,
  children?: any,
  target?: string,
  onClick?: Function
}

const isMod = e => !!(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey);
const isLeft = e => e.button === 0;

const Link: React.StatelessComponent<LinkProps> = ({
  children,
  to,
  target,
  onClick = f => f,
    ...props
}, {dispatch}) => {

  const click = e => {
    onClick(e);

    if (e.defaultPrevented || target || !isLeft(e) || isMod(e)) { return; }

    e.preventDefault();
    dispatch(HISTORY_PUSH(to));
  };

  return (
    <a {...props}
    href={to}
    onClick={click}>
    {children}
    </a>
  );

};

Link.contextTypes = {dispatch: React.PropTypes.func};

export default Link;
