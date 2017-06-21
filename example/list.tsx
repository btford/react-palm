import React from '../src/react';
import {withTask} from '../src/tasks';

import {XHR_TASK} from './tasks/xhr';

export const CHANGE_INPUT = (value : string) => ({type: CHANGE_INPUT, payload: {value}});

export const ADD_ITEM = () => ({type: ADD_ITEM});
export const ADD_ITEM_SUCCESS = () => ({type: ADD_ITEM_SUCCESS});
export const ADD_ITEM_ERROR = (error) => ({type: ADD_ITEM_ERROR, payload: {error}});

export const ADD_ITEM_EAGER = () => ({type: ADD_ITEM_EAGER});
export const ROLLBACK = ({error, previousState}) =>
  ({type: ROLLBACK, payload: {error, previousState}});
export const ADD_ITEM_EAGER_SUCCESS = () => ({type: ADD_ITEM_EAGER_SUCCESS});

interface ListState {
  items: string[];
  error: string;
  inputValue: string;
  isLoading: boolean;
}

const INITIAL_STATE : ListState = {
  items: ['hi'],
  error: '',
  inputValue: '',
  isLoading: false
};

export const listReducer = (state : ListState = INITIAL_STATE, action): ListState => {
  const item = state.inputValue;
  switch(action.type) {

  case CHANGE_INPUT:
    return {...state, inputValue: action.payload.value};

  case ADD_ITEM:
    return withTask({
      ...state,
      isLoading: true
    }, XHR_TASK({
        url: '/api/add-item',
        json: {item}
      }).bimap(ADD_ITEM_SUCCESS, ADD_ITEM_ERROR)
    );
  case ADD_ITEM_SUCCESS:
    return {
      ...state,
      items: state.items.concat([item]),
      error: '',
      isLoading: false
    };

  case ADD_ITEM_ERROR:
    return {
      ...state,
      error: action.payload.error,
      isLoading: false
    };

  // Here's the same example with eager updates and rollback
  case ADD_ITEM_EAGER:
    return withTask({
      ...state,
      items: state.items.concat([item]),
      isLoading: true
    }, XHR_TASK({
        url: '/api/add-item',
        json: {item}
      }).bimap(
        ADD_ITEM_EAGER_SUCCESS,
        (error) => ROLLBACK({previousState: state, error})
      )
    );
  case ADD_ITEM_EAGER_SUCCESS:
    return {
      ...state,
      error: '',
      isLoading: false
    };
  case ROLLBACK:
    return {
      ...action.payload.previousState,
      error: action.payload.error
    };

  default:
    return state;
  }
};

export const ListComponent = ({items, error, inputValue, isLoading}) => (
  <div>
    <h1>List</h1>
    <p>error message: {error}</p>
    <ul>{items.map((item, index) =>
      <li key={index}>{item}</li>)}
    </ul>
    <input
      onChange={(event: any) => CHANGE_INPUT(event.target.value)}
      value={inputValue} />
    <button
      id="add-item"
      onClick={ADD_ITEM}
      disabled={isLoading}>
      Add item</button>
    <button
      id="add-item-eager"
      onClick={ADD_ITEM_EAGER}
      disabled={isLoading}>
      Add eager item</button>
  </div>
);
