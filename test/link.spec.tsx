import * as React from 'react';
import test from 'ava';
import {mount} from 'enzyme';
import {spy} from 'sinon';

import Link from '../src/routing/link'

declare var global: any;

const doWrap = (props = {}, context = {}) => mount(<Link {...props} />, {context});

test('Should mount the Link component', t => {

  const wrap = doWrap()
  t.is(wrap.length, 1, 'The component should be mounted');
  t.is(wrap.find('a').prop('href'), '#', 'The default href should be #');
  t.is(wrap.find('a').prop('target'), '_self', 'The default target should be self');

});

test('Should pass the href and other extra link props', t => {

  const to = '/yolo';
  const target = '_blank';
  const wrap = doWrap({to, target});

  t.is(wrap.find('a').prop('href'), to, 'The to should have been passed as the href');
  t.is(wrap.find('a').prop('target'), target, 'The target should have been passed as the href');
  t.is(wrap.find('a').prop('rel'), 'noopener noreferrer', 'It should have added security rels');

});

test('Should test the click behavior', t => {

  const onClick = spy();
  const dispatch = spy();
  const wrap = doWrap({onClick, to: '/home'}, { dispatch });

  wrap.simulate('click', { button: 0 });

  t.truthy(onClick.calledOnce, 'The onClick handler should have been callled');

  const event = onClick.args[0][0];
  t.truthy(event, 'The event should be there');
  t.is(event.type, 'click', 'And be a click type');
  t.truthy(event.defaultPrevented, 'The default event should have been prevented');
  t.truthy(dispatch.calledOnce, 'The dispatch should have been called');
  t.is(dispatch.args[0][0].type.toString().toString(), 'Symbol(HISTORY_PUSH)', 'With a push action');

});

test('Default link behavior for external urls', t => {

  const urls = [
    'http://google.com',
    'https://google.com',
    'ftp://google.com',
    'mailto:bgronon@gmail.com',
    '//yolo',
  ]

  urls.forEach(url => {

    const onClick = spy();
    const wrap = doWrap({onClick, to: url}, {dispatch: f => f});

    wrap.simulate('click', { button: 0 });

    const event = onClick.args[0][0];
    t.falsy(event.defaultPrevented, `The link should open ${url} with the default link behavior`);

  });

});
