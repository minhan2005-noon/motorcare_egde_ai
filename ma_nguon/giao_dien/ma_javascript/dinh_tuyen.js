(function createRouter() {
  const pageAssets = {
    dashboard: {
      scripts: ['/js/tien_ich/dinh_dang.js', '/js/giao_tiep_api/dong_co.api.js', '/js/thanh_phan/canh_dong_co_3d.mjs', '/js/chuc_nang/bang_dieu_khien.js'],
      styles: ['/css/trang_bang_dieu_khien.css'],
    },
    motors: {
      scripts: ['/js/tien_ich/dinh_dang.js', '/js/giao_tiep_api/dong_co.api.js', '/js/giao_tiep_api/cam_bien.api.js', '/js/chuc_nang/dong_co.js'],
      styles: ['/css/trang_bang_dieu_khien.css'],
    },
    alerts: {
      scripts: ['/js/tien_ich/dinh_dang.js', '/js/giao_tiep_api/dong_co.api.js', '/js/chuc_nang/canh_bao.js'],
    },
    dataset: {
      scripts: ['/js/tien_ich/dinh_dang.js', '/js/giao_tiep_api/dong_co.api.js', '/js/giao_tiep_api/cam_bien.api.js', '/js/chuc_nang/du_lieu.js'],
    },
    calibration: {
      scripts: ['/js/tien_ich/dinh_dang.js', '/js/giao_tiep_api/dong_co.api.js', '/js/giao_tiep_api/hieu_chuan.api.js', '/js/chuc_nang/hieu_chuan.js'],
    },
    profile: {
      scripts: ['/js/giao_tiep_api/nguoi_dung.api.js', '/js/chuc_nang/ho_so.js'],
      styles: ['/css/bo_le.css'],
    },
    settings: {
      scripts: ['/js/giao_tiep_api/nguoi_dung.api.js', '/js/chuc_nang/cai_dat.js'],
    },
  };
  const cache = new Map();
  let navigationController;

  function isAppRoute(url) {
    return [
      '/dashboard',
      '/motors',
      '/alerts',
      '/dataset',
      '/calibration',
      '/profile',
      '/settings',
    ].some((route) => url.pathname === route || url.pathname.startsWith(`${route}/`));
  }

  function loadStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
  }

  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      if (src.endsWith('.mjs')) script.type = 'module';
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Không thể tải ${src}`));
      document.body.append(script);
    });
  }

  async function loadAssets(page) {
    const assets = pageAssets[page] || {};
    (assets.styles || []).forEach(loadStyle);
    for (const script of assets.scripts || []) {
      await loadScript(script);
    }
  }

  async function fetchPage(url, signal, force = false) {
    const key = `${url.pathname}${url.search}`;
    if (!force && cache.has(key)) {
      return cache.get(key);
    }

    const response = await fetch(key, {
      credentials: 'same-origin',
      headers: { 'X-MotorCare-Navigation': 'partial' },
      signal,
    });

    if (response.redirected && new URL(response.url).pathname === '/login') {
      location.assign(response.url);
      return null;
    }
    if (!response.ok) {
      throw new Error('Không thể mở trang này');
    }

    const html = await response.text();
    cache.set(key, html);
    return html;
  }

  async function navigate(target, options = {}) {
    const url = target instanceof URL ? target : new URL(target, location.origin);
    if (url.origin !== location.origin || !isAppRoute(url)) {
      location.assign(url.href);
      return;
    }

    navigationController?.abort();
    navigationController = new AbortController();
    document.body.classList.add('is-navigating');

    try {
      const html = await fetchPage(url, navigationController.signal, options.force);
      if (!html) return;

      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const nextMain = parsed.querySelector('.main-panel');
      if (!nextMain) {
        location.assign(url.href);
        return;
      }

      const nextPage = parsed.body.dataset.page;
      const nextView = parsed.body.dataset.view || '';
      await loadAssets(nextPage);

      document.querySelector('.main-panel').replaceWith(nextMain);
      document.querySelectorAll('body > .modal').forEach((modal) => modal.remove());
      parsed.querySelectorAll('body > .modal').forEach((modal) => {
        document.body.append(modal);
      });
      document.body.dataset.page = nextPage;
      if (nextView) document.body.dataset.view = nextView;
      else delete document.body.dataset.view;
      document.title = parsed.title;

      if (!options.popstate) {
        const method = options.replace ? 'replaceState' : 'pushState';
        history[method]({}, '', `${url.pathname}${url.search}${url.hash}`);
      }

      window.scrollTo({ top: 0, behavior: 'instant' });
      await window.MotorCareApp.activatePage();
    } catch (error) {
      if (error.name !== 'AbortError') {
        window.MotorCareToast?.show(error.message, 'error');
      }
    } finally {
      document.body.classList.remove('is-navigating');
    }
  }

  function prefetch(target) {
    const url = new URL(target, location.origin);
    if (url.origin !== location.origin || !isAppRoute(url)) return;
    fetchPage(url, undefined).catch(() => {});
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (
      !link
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || link.target
      || link.hasAttribute('download')
    ) {
      return;
    }

    const url = new URL(link.href, location.origin);
    if (url.origin === location.origin && isAppRoute(url)) {
      event.preventDefault();
      navigate(url);
    }
  });

  document.addEventListener('pointerenter', (event) => {
    const link = event.target.closest?.('a[href]');
    if (link) prefetch(link.href);
  }, true);

  document.addEventListener('focusin', (event) => {
    const link = event.target.closest?.('a[href]');
    if (link) prefetch(link.href);
  });

  window.addEventListener('popstate', () => {
    navigate(new URL(location.href), { popstate: true });
  });

  window.MotorCareRouter = {
    navigate,
    clearCache: () => cache.clear(),
  };
}());
