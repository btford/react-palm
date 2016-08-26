# react-palm

[![Build Status](https://travis-ci.org/btford/react-palm.svg?branch=master)](https://travis-ci.org/btford/react-palm)

** This is very work in progress, please don't bother me about it, thanks. **

A cohesive strategy for managing state, handling side effects, and testing React Apps.

## Strategy? Framework? Library?

It's very unlikely that you'll create a cohesive architecture if you piecemeal add requirements to
an existing design.

`react-palm` takes a "subtractive" approach; we start with a full set of concerns and make sure
that they work well together before breaking them up.
This means that as your app grows, you won't have to rethink everything.

## Should I use this?

Ideally, you should use Elm. This architecture is the closest thing to Elm I've managed to
make within the constraints of JavaScript and React.

[Choo](https://github.com/yoshuawuyts/choo) looks good too.

## license
MIT
