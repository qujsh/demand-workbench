import '@testing-library/dom';

// Ant Design 的响应式控件在 JSDOM 中需要观察器接口。
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

// JSDOM 不实现伪元素布局；组件库测量滚动条时使用普通元素的计算样式。
const computedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element) => computedStyle(element);
