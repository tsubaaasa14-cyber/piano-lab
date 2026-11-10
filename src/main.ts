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
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    const register = () =>
      navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' }).catch(() => navigator.serviceWorker.register(swUrl));
    register()
      .then((registration) => {
        if (!hadController || !registration) return;
        // A home-screen iPad keeps running the previous script until reload.
        const watch = (worker: ServiceWorker | null) => {
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'activated') window.location.reload();
          });
        };
        watch(registration.installing);
        registration.addEventListener('updatefound', () => watch(registration.installing));
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update();
        });
        void registration.update();
      })
      .catch((error) => {
        console.error(error);
      });
  });
}
