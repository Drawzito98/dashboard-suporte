/* Classic-script module loader: shared requests, dependency order and retry after failure. */
(function (root) {
  'use strict';
  function create(manifest, { loadScript, loadStyle = async () => {}, resolveExport = () => true, baseURL = 'https://local.test/' }) {
    const features = new Map(), assets = new Map();
    function config(name) {
      if (!Object.prototype.hasOwnProperty.call(manifest, name)) throw new Error('Área desconhecida.');
      return manifest[name];
    }
    function checkGraph(name, path = []) {
      if (path.includes(name)) throw new Error('Dependência circular: ' + [...path, name].join(' → '));
      for (const dependency of config(name).depends || []) checkGraph(dependency, [...path, name]);
    }
    function checkedURL(value) {
      const url = new URL(value, baseURL), base = new URL(baseURL);
      if (url.origin !== base.origin || !url.pathname.startsWith('/static/') || /[\\]/.test(value)) throw new Error('Caminho de módulo não permitido.');
      return url.pathname + url.search;
    }
    function asset(url, kind) {
      const path = checkedURL(url), key = kind + ':' + path;
      if (!assets.has(key)) {
        const promise = Promise.resolve().then(() => kind === 'style' ? loadStyle(path) : loadScript(path));
        assets.set(key, promise);
        promise.catch(() => { if (assets.get(key) === promise) assets.delete(key); });
      }
      return assets.get(key);
    }
    function ensure(name) {
      try { checkGraph(name); } catch (error) { return Promise.reject(error); }
      if (features.has(name)) return features.get(name);
      const promise = (async () => {
        const item = config(name);
        for (const dependency of item.depends || []) await ensure(dependency);
        await Promise.all((item.styles || []).map(url => asset(url, 'style')));
        for (const url of item.scripts || []) await asset(url, 'script');
        for (const symbol of item.exports || []) if (!resolveExport(symbol)) throw new Error('Módulo incompleto: ' + name);
        return true;
      })();
      features.set(name, promise);
      promise.catch(() => { if (features.get(name) === promise) features.delete(name); });
      return promise;
    }
    return { ensure };
  }
  root.FeatureModules = { create };
  if (typeof module !== 'undefined') module.exports = { create };
  if (typeof document === 'undefined') return;
  function append(url, kind) {
    return new Promise((resolve, reject) => {
      const element = document.createElement(kind === 'script' ? 'script' : 'link');
      element.dataset.moduleAsset = url;
      if (kind === 'script') { element.src = url; element.async = false; }
      else { element.rel = 'stylesheet'; element.href = url; }
      element.onload = () => resolve();
      element.onerror = () => { element.remove(); reject(new Error('Não foi possível carregar esta área. Verifique a conexão e tente novamente.')); };
      document.head.appendChild(element);
    });
  }
  root.FeatureLoader = create(root.APP_MODULES, {
    baseURL: document.baseURI,
    loadScript: url => append(url, 'script'), loadStyle: url => append(url, 'style'),
    resolveExport: symbol => { const value = symbol.split('.').reduce((value, key) => value?.[key], root); return value && !value.__featureStub; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
