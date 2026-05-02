(function () {
  const WATCHLIST_KEY = 'smartfinance_watchlist';
  const THEME_KEY = 'smartfinance_theme';
  const assets = {
    sp500: { name: 'S&P 500', symbol: 'SPX', section: 'Indices', price: 'USD 5,847.42', change: '+2.34%' },
    nasdaq: { name: 'NASDAQ', symbol: 'IXIC', section: 'Indices', price: 'USD 18,423.95', change: '+1.87%' },
    dax: { name: 'DAX', symbol: 'DAX', section: 'Indices', price: 'EUR 18,534.22', change: '+1.56%' },
    ftse100: { name: 'FTSE 100', symbol: 'UKX', section: 'Indices', price: 'GBP 8,234.56', change: '-0.92%' },
    nikkei225: { name: 'Nikkei 225', symbol: 'N225', section: 'Indices', price: 'JPY 33,567.89', change: '+0.45%' },
    hsi: { name: 'Hang Seng Index', symbol: 'HSI', section: 'Indices', price: 'HKD 17,234.25', change: '-1.23%' },
    bitcoin: { name: 'Bitcoin', symbol: 'BTC', section: 'Cryptocurrency', price: 'USD 67,234.89', change: '+5.42%' },
    ethereum: { name: 'Ethereum', symbol: 'ETH', section: 'Cryptocurrency', price: 'USD 3,542.67', change: '+3.89%' },
    ripple: { name: 'Ripple', symbol: 'XRP', section: 'Cryptocurrency', price: 'USD 2.89', change: '+12.56%' },
    litecoin: { name: 'Litecoin', symbol: 'LTC', section: 'Cryptocurrency', price: 'USD 187.42', change: '-2.13%' },
    cardano: { name: 'Cardano', symbol: 'ADA', section: 'Cryptocurrency', price: 'USD 0.98', change: '+8.34%' },
    solana: { name: 'Solana', symbol: 'SOL', section: 'Cryptocurrency', price: 'USD 198.56', change: '+15.67%' },
    eurusd: { name: 'EUR/USD', symbol: 'EURUSD', section: 'Currencies', price: '1.0856', change: '+0.42%' },
    gbpusd: { name: 'GBP/USD', symbol: 'GBPUSD', section: 'Currencies', price: '1.2743', change: '+1.23%' },
    usdjpy: { name: 'USD/JPY', symbol: 'USDJPY', section: 'Currencies', price: '149.23', change: '-0.56%' },
    audusd: { name: 'AUD/USD', symbol: 'AUDUSD', section: 'Currencies', price: '0.6745', change: '+0.89%' },
    usdchf: { name: 'USD/CHF', symbol: 'USDCHF', section: 'Currencies', price: '0.8934', change: '-0.34%' },
    usdcad: { name: 'USD/CAD', symbol: 'USDCAD', section: 'Currencies', price: '1.3567', change: '+0.67%' }
  };

  const navLinks = [
    ['Home', '/'],
    ['About Us', '/about.html'],
    ['Portfolio', '/Portfolio.html'],
    ['News', '/News.html'],
    ['Contact', '/Contacts.html'],
    ['My Watchlist', '/watchlist.html']
  ];

  function readWatchlist() {
    try {
      return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [];
    } catch (error) {
      return [];
    }
  }

  function writeWatchlist(list) {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...new Set(list)]));
    window.dispatchEvent(new CustomEvent('smartfinance:watchlist-change'));
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.body.classList.toggle('sf-light-theme', theme === 'light');
    localStorage.setItem(THEME_KEY, theme);
    const themeButton = document.querySelector('.sf-theme-toggle');
    if (themeButton) {
      themeButton.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
      themeButton.setAttribute('aria-pressed', String(theme === 'light'));
    }
  }

  function isPositive(change) {
    return !String(change).startsWith('-');
  }

  function addAsset(assetKey) {
    if (!assets[assetKey]) return;
    const list = readWatchlist();
    if (!list.includes(assetKey)) {
      writeWatchlist([...list, assetKey]);
    }
    showToast(`${assets[assetKey].name} added to My Watchlist`);
  }

  function removeAsset(assetKey) {
    writeWatchlist(readWatchlist().filter((key) => key !== assetKey));
  }

  function showToast(message) {
    let toast = document.querySelector('.sf-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'sf-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function assetRow(assetKey, options = {}) {
    const asset = assets[assetKey];
    if (!asset) return '';
    const action = options.remove
      ? `<button type="button" class="sf-mini-action" data-watchlist-remove="${assetKey}">Remove</button>`
      : `<button type="button" class="sf-mini-action" data-watchlist-add="${assetKey}">Add</button>`;

    return `
      <article class="sf-asset-row">
        <a href="/market-detail.html?id=${assetKey}">
          <span>${asset.section}</span>
          <strong>${asset.name}</strong>
          <small>${asset.symbol} - ${asset.price}</small>
        </a>
        <em class="${isPositive(asset.change) ? 'up' : 'down'}">${asset.change}</em>
        ${action}
      </article>
    `;
  }

  function renderSearchResults(query = '') {
    const results = document.querySelector('.sf-search-results');
    if (!results) return;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      results.innerHTML = '<p class="sf-empty-note">Start typing to search indices, crypto, or forex quotes.</p>';
      return;
    }

    const matches = Object.entries(assets)
      .filter(([, asset]) => {
        const haystack = `${asset.name} ${asset.symbol} ${asset.section}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 8)
      .map(([assetKey]) => assetRow(assetKey))
      .join('');

    results.innerHTML = matches || '<p class="sf-empty-note">No matching markets found.</p>';
  }

  function createMenu() {
    if (document.querySelector('.sf-floating-menu')) return;
    document.body.classList.add('sf-has-market-menu');

    const shell = document.createElement('aside');
    shell.className = 'sf-floating-menu';
    shell.innerHTML = `
      <button type="button" class="sf-menu-toggle" aria-expanded="false">
        <span>Markets</span>
      </button>
      <div class="sf-menu-panel" aria-label="SmartFinance quick menu">
        <div class="sf-menu-head">
          <div>
            <strong>SmartFinance</strong>
            <small>Quick navigation</small>
          </div>
          <a href="/watchlist.html">My Watchlist</a>
        </div>
        <button type="button" class="sf-theme-toggle" aria-pressed="false">Light Mode</button>
        <label class="sf-search-box">
          <span>Search markets</span>
          <input type="search" placeholder="Search indices, crypto, forex..." autocomplete="off">
        </label>
        <div class="sf-search-results"></div>
        <nav class="sf-menu-links">
          ${navLinks.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
        </nav>
      </div>
    `;
    document.body.appendChild(shell);

    const toggle = shell.querySelector('.sf-menu-toggle');
    const input = shell.querySelector('input');
    const themeButton = shell.querySelector('.sf-theme-toggle');
    toggle.addEventListener('click', () => {
      const isOpen = shell.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        renderSearchResults(input.value);
        input.focus();
      }
    });
    input.addEventListener('input', () => renderSearchResults(input.value));
    themeButton.addEventListener('click', () => {
      applyTheme(getTheme() === 'light' ? 'dark' : 'light');
    });
    applyTheme(getTheme());
    renderSearchResults('');
  }

  function renderWatchlistPage() {
    const root = document.getElementById('watchlistRoot');
    if (!root) return;
    const list = readWatchlist();
    if (!list.length) {
      root.innerHTML = `
        <div class="watchlist-empty">
          <strong>Your watchlist is empty</strong>
          <p>Use the Markets search or any asset detail page to add quotes here.</p>
          <a href="/Portfolio.html">Browse Portfolio</a>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="watchlist-grid">
        ${list.map((assetKey) => assetRow(assetKey, { remove: true })).join('')}
      </div>
    `;
  }

  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-watchlist-add]');
    const removeButton = event.target.closest('[data-watchlist-remove]');
    if (addButton) {
      event.preventDefault();
      addAsset(addButton.dataset.watchlistAdd);
    }
    if (removeButton) {
      event.preventDefault();
      removeAsset(removeButton.dataset.watchlistRemove);
      renderWatchlistPage();
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const shell = document.querySelector('.sf-floating-menu');
      const toggle = document.querySelector('.sf-menu-toggle');
      if (shell && toggle && !shell.classList.contains('is-open')) toggle.click();
      document.querySelector('.sf-search-box input')?.focus();
    }
  });

  window.addEventListener('smartfinance:watchlist-change', renderWatchlistPage);
  window.SmartFinanceMarkets = { assets, addAsset, removeAsset, readWatchlist };
  applyTheme(getTheme());
  createMenu();
  renderWatchlistPage();
})();
