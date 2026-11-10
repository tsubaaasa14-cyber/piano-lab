import './style.css';
import { mount } from './app';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) {
  throw new Error('Missing #app');
}

mount(root);

function block(event: Event): void {
  event.preventDefault();
}

document.addEventListener('gesturestart', block, { passive: false });
document.addEventListener('gesturechange', block, { passive: false });
document.addEventListener('contextmenu', block);

document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
      return;
    }
    const scroller = document.querySelector('.score-scroll');
    const target = event.target;
    if (scroller && target instanceof Node && scroller.contains(target)) return;
    event.preventDefault();
  },
  { passive: false },
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.error(error);
    });
  });
}
