import React, {render, mapDispatch} from './react';

function PARENT_ACTION(action) {
  return {type: PARENT_ACTION, payload: action};
}

function GRAND_PARENT_ACTION(action) {
  return {type: GRAND_PARENT_ACTION, payload: action};
}

render(
  <div>
    hi <a href="#" onClick={() => ({type: 'a', payload: 'b'})}>yo</a>

    {mapDispatch(GRAND_PARENT_ACTION, (<div>
      yo {mapDispatch(PARENT_ACTION,
        (<a href="#" onClick={() => ({type: 'a', payload: 'b'})}>yo</a>))}
    </div>))}
  </div>,
  window.document.getElementById('app-container'),
  (args) => console.log('test', args)
);
