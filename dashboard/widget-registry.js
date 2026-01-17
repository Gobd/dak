// Widget registry - separate file to avoid circular imports with script.js
// Widgets import registerWidget from here, script.js imports the registry

const widgets = {};

export function registerWidget(type, renderFn) {
  widgets[type] = renderFn;
}

export function getWidgetTypes() {
  return Object.keys(widgets);
}

export function getWidgetRenderer(type) {
  return widgets[type];
}
