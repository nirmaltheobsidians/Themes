// =========================================================
// Wishlist — localStorage
// =========================================================
var TD_Wishlist = (function () {
  var KEY = 'TD_wishlist_v1';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }

  function saveAll(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { }
  }

  function has(id) {
    return getAll().some(function (p) { return String(p.id) === String(id); });
  }

  function add(data) {
    if (!has(data.id)) { var list = getAll(); list.push(data); saveAll(list); }
  }

  function remove(id) {
    saveAll(getAll().filter(function (p) { return String(p.id) !== String(id); }));
  }

  function toggle(data) {
    if (has(data.id)) { remove(data.id); return false; }
    add(data); return true;
  }

  function count() { return getAll().length; }

  return { getAll: getAll, has: has, add: add, remove: remove, toggle: toggle, count: count };
}());

function TD_updateWishlistBadge() {
  var cnt = TD_Wishlist.count();
  document.querySelectorAll('[data-td-wishlist-count]').forEach(function (el) {
    el.textContent = cnt;
    el.hidden = cnt === 0;
  });
}

function TD_syncWishlistButtons() {
  document.querySelectorAll('[data-td-wishlist-toggle]').forEach(function (btn) {
    var active = TD_Wishlist.has(btn.getAttribute('data-product-id'));
    btn.classList.toggle('TD_wishlist--active', active);
    btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
  });
  TD_updateWishlistBadge();
}

document.addEventListener('DOMContentLoaded', function () {
  TD_syncWishlistButtons();

  // ---- Wishlist page ----
  var wishlistPage = document.querySelector('[data-td-wishlist-page]');
  if (!wishlistPage) return;

  var wishlistGrid = wishlistPage.querySelector('[data-td-wishlist-grid]');
  var wishlistEmpty = wishlistPage.querySelector('[data-td-wishlist-empty]');

  function renderWishlistPage() {
    var items = TD_Wishlist.getAll();

    if (wishlistEmpty) {
      wishlistEmpty.style.display = items.length > 0 ? 'none' : '';
    }
    if (!wishlistGrid) return;

    wishlistGrid.innerHTML = '';
    if (items.length === 0) return;

    var pool = document.getElementById('TD_wl-pool');
    items.forEach(function (p) {
      if (!p.handle || !pool) return;
      var poolItem = pool.querySelector('[data-wl-handle="' + p.handle + '"]');
      if (!poolItem) return;
      // Clone the inner card HTML (skip the wrapper div)
      var fragment = document.createDocumentFragment();
      Array.prototype.forEach.call(poolItem.childNodes, function (node) {
        fragment.appendChild(node.cloneNode(true));
      });
      wishlistGrid.appendChild(fragment);
    });

    TD_syncWishlistButtons();
  }

  // Expose so the toggle handler can trigger re-render on item removal
  window.TD_rerenderWishlist = renderWishlistPage;

  renderWishlistPage();
});

document.addEventListener('DOMContentLoaded', function () {
  var routes = window.TD_routes || {};
  var cartDrawer = document.querySelector('[data-td-cart-drawer]');

  function TD_getHeaderCartCount() {
    return document.querySelector('[data-td-cart-count]');
  }

  function TD_updateHeaderCount(count) {
    var badge = TD_getHeaderCartCount();
    if (!badge) return;
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  function TD_openCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.classList.add('TD_cart-drawer--open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('TD_scroll-lock');
  }

  function TD_closeCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('TD_cart-drawer--open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('TD_scroll-lock');
  }

  function TD_initCartTimer() {
    var timerEl = cartDrawer && cartDrawer.querySelector('[data-td-cart-timer]');
    if (!timerEl) return;

    if (window._TD_cartTimerInterval) {
      clearInterval(window._TD_cartTimerInterval);
      window._TD_cartTimerInterval = null;
    }

    var minutes = parseInt(timerEl.dataset.minutes) || 10;
    var message = timerEl.dataset.message || '';
    var textEl = timerEl.querySelector('.TD_cart-timer__text');
    var storageKey = 'TD_cart_timer_end';
    var endTime = parseInt(sessionStorage.getItem(storageKey)) || 0;

    if (!endTime || endTime < Date.now()) {
      endTime = Date.now() + minutes * 60 * 1000;
      sessionStorage.setItem(storageKey, String(endTime));
    }

    function formatTime(ms) {
      if (ms <= 0) return '00:00';
      var totalSec = Math.floor(ms / 1000);
      var m = Math.floor(totalSec / 60);
      var s = totalSec % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function tick() {
      var remaining = endTime - Date.now();
      if (textEl) textEl.innerHTML = message.replace('[time]', '<strong>' + formatTime(remaining) + '</strong>');
      if (remaining <= 0) {
        clearInterval(window._TD_cartTimerInterval);
        window._TD_cartTimerInterval = null;
        sessionStorage.removeItem(storageKey);
      }
    }

    tick();
    window._TD_cartTimerInterval = setInterval(tick, 1000);
  }

  function TD_refreshCartDrawer(thenOpen) {
    if (!routes.cartUrl || !routes.sectionId) return Promise.resolve();

    return fetch(routes.cartUrl + '?section_id=' + routes.sectionId)
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var newDrawer = doc.querySelector('[data-td-cart-drawer]');
        if (!newDrawer || !cartDrawer) return;

        var wasOpen = cartDrawer.classList.contains('TD_cart-drawer--open');
        cartDrawer.innerHTML = newDrawer.innerHTML;
        cartDrawer.dataset.cartCount = newDrawer.dataset.cartCount;
        TD_applyStoredDiscountToCheckoutLink();
        TD_initCartTimer();

        if (wasOpen) {
          TD_openCartDrawer();
        } else if (thenOpen) {
          void cartDrawer.offsetHeight;
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              TD_openCartDrawer();
            });
          });
        }

        var newCount = parseInt(cartDrawer.dataset.cartCount, 10) || 0;
        TD_updateHeaderCount(newCount);
        if (newCount === 0 && wasOpen) {
          setTimeout(function () { TD_closeCartDrawer(); }, 300);
        }
      });
  }
  window.TD_refreshCartDrawer = TD_refreshCartDrawer;

  function TD_setItemLoading(key, isLoading) {
    if (!cartDrawer) return;
    var item = cartDrawer.querySelector('[data-td-cart-item][data-key="' + key + '"]');
    if (!item) return;
    item.classList.toggle('TD_cart-drawer__item--loading', isLoading);
  }

  function TD_changeLineQuantity(key, quantity) {
    TD_setItemLoading(key, true);

    fetch(routes.cartChangeUrl + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    })
      .then(function () {
        return TD_refreshCartDrawer();
      })
      .catch(function (error) {
        console.error('TD cart change failed', error);
        TD_setItemLoading(key, false);
      });
  }

  function TD_refreshCartPage(sectionId) {
    var root = document.getElementById('TD_cart-' + sectionId);
    if (!root) return Promise.resolve();

    return fetch(routes.cartUrl + '?section_id=' + sectionId)
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var newRoot = doc.getElementById('TD_cart-' + sectionId);
        if (!newRoot) return;

        root.innerHTML = newRoot.innerHTML;
        TD_applyStoredDiscountToCheckoutLink();
        return TD_refreshCartDrawer();
      });
  }

  function TD_setPageItemLoading(sectionId, key, isLoading) {
    var root = document.getElementById('TD_cart-' + sectionId);
    if (!root) return;
    var item = root.querySelector('[data-td-cart-page-item][data-key="' + key + '"]');
    if (!item) return;
    item.classList.toggle('TD_cart-page__item--loading', isLoading);
  }

  function TD_changePageLineQuantity(sectionId, key, quantity) {
    TD_setPageItemLoading(sectionId, key, true);

    fetch(routes.cartChangeUrl + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    })
      .then(function () {
        return TD_refreshCartPage(sectionId);
      })
      .catch(function (error) {
        console.error('TD cart page change failed', error);
        TD_setPageItemLoading(sectionId, key, false);
      });
  }

  function TD_populateProvinces(countrySelect) {
    var provinceSelect = document.querySelector('[data-td-shipping-province]');
    if (!provinceSelect) return;

    var selectedOption = countrySelect.options[countrySelect.selectedIndex];
    var provinces = [];
    try {
      provinces = JSON.parse(selectedOption.getAttribute('data-provinces') || '[]');
    } catch (error) {
      provinces = [];
    }

    provinceSelect.innerHTML = '';
    provinceSelect.hidden = provinces.length === 0;
    provinces.forEach(function (province) {
      var option = document.createElement('option');
      option.value = province[0];
      option.textContent = province[1];
      provinceSelect.appendChild(option);
    });
  }

  function TD_estimateShipping(button) {
    var wrap = button.closest('[data-td-shipping-form]');
    if (!wrap) return;

    var country = wrap.querySelector('[data-td-shipping-country]');
    var province = wrap.querySelector('[data-td-shipping-province]');
    var zip = wrap.querySelector('[data-td-shipping-zip]');
    var results = wrap.querySelector('[data-td-shipping-results]');
    if (!results) return;

    var params = new URLSearchParams();
    if (country && country.value) params.set('shipping_address[country]', country.value);
    if (province && province.value) params.set('shipping_address[province]', province.value);
    if (zip && zip.value) params.set('shipping_address[zip]', zip.value);

    button.disabled = true;
    results.hidden = true;

    fetch('/cart/shipping_rates.json?' + params.toString())
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        results.innerHTML = '';
        var rates = (data && data.shipping_rates) || [];
        if (rates.length === 0) {
          results.textContent = results.getAttribute('data-no-rates-text') || '';
        } else {
          rates.forEach(function (rate) {
            var row = document.createElement('p');
            row.className = 'TD_cart-page__shipping-rate';
            row.textContent = rate.presentment_name + ': ' + TD_formatMoney(rate.price * 100);
            results.appendChild(row);
          });
        }
        results.hidden = false;
      })
      .catch(function (error) {
        console.error('TD shipping estimate failed', error);
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  function TD_initCountdown(el) {
    var remaining = parseInt(el.getAttribute('data-seconds'), 10) || 0;
    var label = el.querySelector('[data-td-countdown-label]');
    if (!label) return;

    function tick() {
      var minutes = Math.floor(remaining / 60);
      var seconds = remaining % 60;
      label.textContent = minutes + 'm ' + (seconds < 10 ? '0' : '') + seconds + 's';
      if (remaining <= 0) return;
      remaining -= 1;
      setTimeout(tick, 1000);
    }

    tick();
  }

  function TD_applyStoredDiscountToCheckoutLink() {
    var code = sessionStorage.getItem('TD_discount_code');

    document.querySelectorAll('[data-td-checkout-link]').forEach(function (checkoutLink) {
      var baseHref = checkoutLink.href.split('?')[0];
      checkoutLink.href = code ? baseHref + '?discount=' + encodeURIComponent(code) : baseHref;
    });

    if (code) {
      document.querySelectorAll('[data-td-cart-discount-input]').forEach(function (input) {
        input.value = code;
      });
    }

    document.querySelectorAll('[data-td-cart-discount-form]').forEach(function (form) {
      var status = form.parentElement.querySelector('[data-td-cart-discount-status]');
      if (!status) return;
      status.textContent = code ? form.getAttribute('data-applied-text') || '' : '';
      status.hidden = !code;
    });
  }

  function TD_updateCartNote(note) {
    if (!routes.cartUpdateUrl) return;
    fetch(routes.cartUpdateUrl + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note })
    }).catch(function (error) {
      console.error('TD cart note update failed', error);
    });
  }

  function TD_applyDiscount(code, appliedText) {
    if (code) {
      sessionStorage.setItem('TD_discount_code', code);
    } else {
      sessionStorage.removeItem('TD_discount_code');
    }
    TD_applyStoredDiscountToCheckoutLink();
  }

  function TD_loadMoreArticles(link) {
    if (link.classList.contains('TD_blog__load-more--loading')) return;
    link.classList.add('TD_blog__load-more--loading');

    var sectionId = link.getAttribute('data-section-id');
    var separator = link.href.indexOf('?') > -1 ? '&' : '?';
    var url = link.href + separator + 'section_id=' + sectionId;

    fetch(url)
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var newGrid = doc.querySelector('[data-td-blog-grid]');
        var currentGrid = document.querySelector('#TD_blog-' + sectionId + ' [data-td-blog-grid]');

        if (newGrid && currentGrid) {
          while (newGrid.firstChild) {
            currentGrid.appendChild(newGrid.firstChild);
          }
        }

        var newLoadMore = doc.querySelector('[data-td-blog-load-more]');
        if (newLoadMore) {
          link.href = newLoadMore.getAttribute('href');
        } else {
          var wrap = link.closest('.TD_blog__load-more-wrap');
          if (wrap) wrap.remove();
        }
      })
      .catch(function (error) {
        console.error('TD load more articles failed', error);
      })
      .finally(function () {
        link.classList.remove('TD_blog__load-more--loading');
      });
  }

  function TD_loadMoreSearchResults(link) {
    if (link.classList.contains('TD_search-page__load-more-btn--loading')) return;
    link.classList.add('TD_search-page__load-more-btn--loading');

    var sectionId = link.getAttribute('data-section-id');
    var separator = link.href.indexOf('?') > -1 ? '&' : '?';
    var url = link.href + separator + 'section_id=' + sectionId;

    fetch(url)
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var newGrid = doc.querySelector('[data-td-search-grid]');
        var currentGrid = document.querySelector('#TD_search-' + sectionId + ' [data-td-search-grid]');

        if (newGrid && currentGrid) {
          while (newGrid.firstChild) {
            currentGrid.appendChild(newGrid.firstChild);
          }
        }

        var newWrap = doc.querySelector('[data-td-search-load-more-wrap]');
        var currentWrap = document.querySelector('#TD_search-' + sectionId + ' [data-td-search-load-more-wrap]');
        if (currentWrap) {
          if (newWrap) {
            currentWrap.replaceWith(newWrap);
          } else {
            currentWrap.remove();
          }
        }
      })
      .catch(function (error) {
        console.error('TD load more search results failed', error);
        link.classList.remove('TD_search-page__load-more-btn--loading');
      });
  }

  function TD_addToCart(form) {
    var formData = new FormData(form);
    var submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.classList.add('TD_product-card__action--loading', 'TD_quick-view__add-to-cart--loading');
    }

    fetch(routes.cartAddUrl + '.js', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result.status) {
          console.error('TD add to cart failed', result);
          return;
        }
        var dialog = form.closest('dialog[data-td-quick-view]');
        if (dialog) dialog.close();

        if (routes.isCartPage) {
          var cartPageRoot = document.querySelector('[data-td-cart-page-root]');
          if (cartPageRoot) {
            return TD_refreshCartPage(cartPageRoot.id.replace('TD_cart-', ''));
          }
          return TD_refreshCartDrawer();
        }

        if (routes.cartType === 'page') {
          window.location.href = routes.cartUrl;
          return;
        }

        return TD_refreshCartDrawer(routes.cartAutoOpenDrawer !== false);
      })
      .catch(function (error) {
        console.error('TD add to cart failed', error);
      })
      .finally(function () {
        if (submitButton) {
          submitButton.classList.remove('TD_product-card__action--loading', 'TD_quick-view__add-to-cart--loading');
        }
      });
  }

  function TD_formatMoney(cents, showCurrency) {
    var amount = (cents / 100).toFixed(2);
    var format = (showCurrency ? routes.moneyFormat : routes.moneyFormatNoCurrency) || '${{amount}}';
    return format.replace(/\{\{\s*amount\s*\}\}/, amount);
  }

  function TD_updateQuickViewVariant(dialog) {
    var variantsScript = document.querySelector('[data-td-quick-view-variants="' + dialog.id.replace('TD_quick-view-', '') + '"]');
    if (!variantsScript) return;

    var variants;
    try {
      variants = JSON.parse(variantsScript.textContent);
    } catch (error) {
      return;
    }

    var selections = {};
    dialog.querySelectorAll('[data-td-option-select].TD_quick-view__option-value--active').forEach(function (button) {
      selections[button.getAttribute('data-option-position')] = button.getAttribute('data-value');
    });

    var matchedVariant = variants.filter(function (variant) {
      return Object.keys(selections).every(function (position) {
        return variant['option' + position] === selections[position];
      });
    })[0];

    if (!matchedVariant) return;

    var variantInput = dialog.querySelector('[data-td-variant-id]');
    if (variantInput) variantInput.value = matchedVariant.id;

    var priceCurrent = dialog.querySelector('[data-td-price-current]');
    var priceCompare = dialog.querySelector('[data-td-price-compare]');
    if (priceCurrent) priceCurrent.innerHTML = TD_formatMoney(matchedVariant.price, routes.priceCurrencyProductCards);
    if (priceCompare) {
      if (matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price) {
        priceCompare.innerHTML = TD_formatMoney(matchedVariant.compare_at_price, routes.priceCurrencyProductCards);
        priceCompare.hidden = false;
      } else {
        priceCompare.hidden = true;
      }
    }

    var image = dialog.querySelector('.TD_quick-view__image');
    if (image && matchedVariant.featured_image && matchedVariant.featured_image.src) {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = matchedVariant.featured_image.src;
    }

    var submitButton = dialog.querySelector('[data-td-quick-view-submit]');
    var label = dialog.querySelector('.TD_quick-view__add-to-cart-label');
    if (submitButton && label) {
      submitButton.disabled = !matchedVariant.available;
      label.textContent = matchedVariant.available
        ? submitButton.getAttribute('data-add-label')
        : submitButton.getAttribute('data-sold-out-label');
    }

    TD_updateQuickViewOptionAvailability(dialog, variants);
  }

  function TD_updateQuickViewOptionAvailability(dialog, variants) {
    var groups = dialog.querySelectorAll('.TD_quick-view__option');

    var positionsInOrder = [];
    groups.forEach(function (group) {
      var firstButton = group.querySelector('[data-td-option-select]');
      if (!firstButton) return;
      positionsInOrder.push(parseInt(firstButton.getAttribute('data-option-position'), 10));
    });
    positionsInOrder.sort(function (a, b) {
      return a - b;
    });

    groups.forEach(function (group) {
      var buttons = group.querySelectorAll('[data-td-option-select]');
      if (!buttons.length) return;
      var position = parseInt(buttons[0].getAttribute('data-option-position'), 10);

      var earlierSelections = {};
      positionsInOrder.forEach(function (pos) {
        if (pos >= position) return;
        var activeButton = dialog.querySelector('[data-option-position="' + pos + '"].TD_quick-view__option-value--active');
        if (activeButton) earlierSelections[pos] = activeButton.getAttribute('data-value');
      });

      buttons.forEach(function (button) {
        var value = button.getAttribute('data-value');

        var hasAvailableVariant = variants.some(function (variant) {
          if (variant['option' + position] !== value) return false;
          var matchesEarlier = Object.keys(earlierSelections).every(function (pos) {
            return variant['option' + pos] === earlierSelections[pos];
          });
          return matchesEarlier && variant.available;
        });

        button.classList.toggle('TD_quick-view__option-value--unavailable', !hasAvailableVariant);
      });
    });
  }

  function TD_updateProductFormVariant(root) {
    if (!root) return;
    var variantsScript = root.querySelector('[data-td-product-variants="' + root.getAttribute('data-section-id') + '"]');
    if (!variantsScript) return;

    var variants;
    try {
      variants = JSON.parse(variantsScript.textContent);
    } catch (error) {
      return;
    }

    var selections = {};
    root.querySelectorAll('[data-td-product-option-select].TD_product__swatch--active, [data-td-product-option-select].TD_product__pill--active').forEach(function (button) {
      selections[button.getAttribute('data-option-position')] = button.getAttribute('data-value');
    });
    root.querySelectorAll('[data-td-product-option-dropdown]').forEach(function (select) {
      selections[select.getAttribute('data-option-position')] = select.value;
    });

    var totalGroups = root.querySelectorAll('[data-td-product-option-group]').length;
    var totalSelections = Object.keys(selections).length;
    if (totalGroups > 0 && totalSelections < totalGroups) {
      var submitBtn0 = root.querySelector('[data-td-product-submit]');
      var addLbl0 = root.querySelector('[data-td-add-label]');
      if (submitBtn0) {
        submitBtn0.disabled = true;
        if (addLbl0) addLbl0.textContent = submitBtn0.getAttribute('data-select-label') || 'Select options';
      }
      var variantInp0 = root.querySelector('[data-td-variant-id]');
      if (variantInp0) variantInp0.value = '';
      return;
    }

    var matchedVariant = variants.filter(function (variant) {
      return Object.keys(selections).every(function (position) {
        return variant['option' + position] === selections[position];
      });
    })[0];

    if (!matchedVariant) return;

    var variantInput = root.querySelector('[data-td-variant-id]');
    if (variantInput) variantInput.value = matchedVariant.id;

    var priceEl = root.querySelector('[data-td-product-price]');
    var compareEl = root.querySelector('[data-td-product-price-compare]');
    if (priceEl) priceEl.innerHTML = TD_formatMoney(matchedVariant.price, true);
    if (compareEl) {
      if (matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price) {
        compareEl.innerHTML = TD_formatMoney(matchedVariant.compare_at_price, true);
        compareEl.hidden = false;
      } else {
        compareEl.hidden = true;
      }
    }

    var submitButton = root.querySelector('[data-td-product-submit]');
    var addLabel = root.querySelector('[data-td-add-label]');
    if (submitButton && addLabel) {
      submitButton.disabled = !matchedVariant.available;
      addLabel.textContent = matchedVariant.available
        ? submitButton.getAttribute('data-add-label')
        : submitButton.getAttribute('data-sold-out-label');
    }

    if (matchedVariant.featured_image && root._TD_gallerySwiper) {
      var slides = root._TD_gallerySwiper.slides;
      for (var i = 0; i < slides.length; i++) {
        if (Number(slides[i].getAttribute('data-image-id')) === matchedVariant.featured_image.id) {
          root._TD_gallerySwiper.slideTo(i);
          break;
        }
      }
    }

    TD_updateProductOptionAvailability(root, variants);
  }

  function TD_updateProductOptionAvailability(root, variants) {
    var groups = root.querySelectorAll('[data-td-product-option-group]');

    function getGroupPosition(group) {
      var button = group.querySelector('[data-td-product-option-select]');
      if (button) return parseInt(button.getAttribute('data-option-position'), 10);
      var dropdown = group.querySelector('[data-td-product-option-dropdown]');
      if (dropdown) return parseInt(dropdown.getAttribute('data-option-position'), 10);
      return null;
    }

    function getEarlierValue(pos) {
      var activeButton = root.querySelector(
        '[data-option-position="' + pos + '"].TD_product__swatch--active, [data-option-position="' + pos + '"].TD_product__pill--active'
      );
      if (activeButton) return activeButton.getAttribute('data-value');
      var dropdown = root.querySelector('[data-td-product-option-dropdown][data-option-position="' + pos + '"]');
      return dropdown ? dropdown.value : null;
    }

    var positionsInOrder = [];
    groups.forEach(function (group) {
      var position = getGroupPosition(group);
      if (position !== null) positionsInOrder.push(position);
    });
    positionsInOrder.sort(function (a, b) {
      return a - b;
    });

    groups.forEach(function (group) {
      var position = getGroupPosition(group);
      if (position === null) return;

      var earlierSelections = {};
      positionsInOrder.forEach(function (pos) {
        if (pos >= position) return;
        var value = getEarlierValue(pos);
        if (value) earlierSelections[pos] = value;
      });

      function isValueAvailable(value) {
        return variants.some(function (variant) {
          if (variant['option' + position] !== value) return false;
          var matchesEarlier = Object.keys(earlierSelections).every(function (pos) {
            return variant['option' + pos] === earlierSelections[pos];
          });
          return matchesEarlier && variant.available;
        });
      }

      group.querySelectorAll('[data-td-product-option-select]').forEach(function (button) {
        var hasAvailableVariant = isValueAvailable(button.getAttribute('data-value'));
        button.classList.toggle('TD_product__pill--unavailable', !hasAvailableVariant);
        button.classList.toggle('TD_product__swatch--unavailable', !hasAvailableVariant);
      });

      group.querySelectorAll('[data-td-product-option-dropdown] option').forEach(function (option) {
        option.disabled = !isValueAvailable(option.value);
      });
    });
  }

  function TD_loadComplementaryProducts(details) {
    var root = details.closest('[data-td-product-root]');
    var list = details.querySelector('[data-td-accessories-list]');
    if (!root || !list || !routes.productRecommendationsUrl) return;

    var sectionId = root.getAttribute('data-section-id');
    var productId = root.getAttribute('data-product-id');
    var url = routes.productRecommendationsUrl + '?section_id=' + sectionId + '&product_id=' + productId + '&intent=complementary&limit=4';

    fetch(url)
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var newList = doc.querySelector('[data-td-accessories-list]');
        list.innerHTML = newList ? newList.innerHTML : '';
      })
      .catch(function (error) {
        console.error('TD load complementary products failed', error);
      });
  }

  document.addEventListener(
    'toggle',
    function (event) {
      var details = event.target;
      if (!details.matches || !details.matches('[data-td-accessories]') || !details.open) return;
      if (details.dataset.tdLoaded) return;
      details.dataset.tdLoaded = 'true';
      TD_loadComplementaryProducts(details);
    },
    true
  );

  function TD_openQuickView(dialogId) {
    var dialog = document.getElementById(dialogId);
    if (!dialog || typeof dialog.showModal !== 'function') return;
    dialog.showModal();
    document.body.classList.add('TD_scroll-lock');
    TD_syncWishlistButtons();
  }

  function TD_closeQuickView(dialog) {
    if (dialog && typeof dialog.close === 'function') dialog.close();
  }

  function TD_openSearchPopup() {
    var popup = document.querySelector('[data-td-search-popup]');
    if (!popup) return;
    popup.classList.add('TD_search-popup--open');
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('TD_scroll-lock');
    var input = popup.querySelector('[data-td-search-input]');
    if (input) {
      window.setTimeout(function () {
        input.focus();
      }, 300);
    }
  }

  function TD_closeSearchPopup() {
    var popup = document.querySelector('[data-td-search-popup]');
    if (!popup) return;
    popup.classList.remove('TD_search-popup--open');
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('TD_scroll-lock');
  }

  var TD_searchResultsDefaultHTML = null;

  function TD_initSearchPopup() {
    var resultsContainer = document.querySelector('[data-td-search-results]');
    if (resultsContainer) TD_searchResultsDefaultHTML = resultsContainer.innerHTML;
  }

  function TD_renderSearchResults(query) {
    var resultsContainer = document.querySelector('[data-td-search-results]');
    if (!resultsContainer) return;

    if (!query) {
      if (TD_searchResultsDefaultHTML !== null) resultsContainer.innerHTML = TD_searchResultsDefaultHTML;
      return;
    }

    if (!routes.predictiveSearchUrl) return;

    var params = new URLSearchParams();
    params.set('q', query);
    params.set('section_id', 'search-popup');
    params.set('resources[type]', 'product,query');
    params.set('resources[limit]', '5');
    params.set('resources[options][unavailable_products]', 'last');

    fetch(routes.predictiveSearchUrl + '?' + params.toString())
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var newResults = doc.querySelector('[data-td-search-results]');
        if (newResults) resultsContainer.innerHTML = newResults.innerHTML;
      })
      .catch(function (error) {
        console.error('TD predictive search failed', error);
      });
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.hasAttribute('data-td-cart-discount-form')) {
      event.preventDefault();
      var discountInput = form.querySelector('[data-td-cart-discount-input]');
      TD_applyDiscount(discountInput ? discountInput.value.trim() : '', form.getAttribute('data-applied-text'));
      return;
    }

    if (form.getAttribute('action') !== '/cart/add' && form.action.indexOf('/cart/add') === -1) return;

    event.preventDefault();
    TD_addToCart(form);
  });

  function TD_navigateWithParam(name, value) {
    var url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(name, value);
    } else {
      url.searchParams.delete(name);
    }
    url.searchParams.delete('page');
    window.location.href = url.toString();
  }

  function TD_toggleFilterParam(name, value, checked) {
    var url = new URL(window.location.href);
    var values = url.searchParams.getAll(name).filter(function (v) {
      return v !== value;
    });
    if (checked) values.push(value);
    url.searchParams.delete(name);
    values.forEach(function (v) {
      url.searchParams.append(name, v);
    });
    url.searchParams.delete('page');
    window.location.href = url.toString();
  }

  document.addEventListener('change', function (event) {
    var note = event.target.closest('[data-td-cart-note]');
    if (note) {
      TD_updateCartNote(note.value);
      return;
    }

    var filterCheckbox = event.target.closest('[data-td-filter-checkbox]');
    if (filterCheckbox) {
      TD_toggleFilterParam(filterCheckbox.name, filterCheckbox.value, filterCheckbox.checked);
      return;
    }

    var sortSelect = event.target.closest('[data-td-sort-select]');
    if (sortSelect) {
      TD_navigateWithParam('sort_by', sortSelect.value);
      return;
    }

    var productOptionDropdown = event.target.closest('[data-td-product-option-dropdown]');
    if (productOptionDropdown) {
      var dropdownGroup = productOptionDropdown.closest('[data-td-product-option-group]');
      var dropdownCurrent = dropdownGroup ? dropdownGroup.querySelector('[data-td-option-current]') : null;
      if (dropdownCurrent) dropdownCurrent.textContent = productOptionDropdown.value;

      TD_updateProductFormVariant(productOptionDropdown.closest('[data-td-product-root]'));
      return;
    }
  });

  document.addEventListener('click', function (event) {
    var accBtn = event.target.closest('[data-td-acc-btn]');
    if (accBtn) {
      var acc = accBtn.closest('.td-acc');
      var body = acc && acc.querySelector('.td-acc__body');
      if (!acc || !body) return;
      var isOpen = acc.classList.contains('td-acc--open');
      acc.classList.toggle('td-acc--open', !isOpen);
      body.classList.toggle('td-acc__body--open', !isOpen);
      accBtn.setAttribute('aria-expanded', String(!isOpen));
      return;
    }

    var loadMoreTrigger = event.target.closest('[data-td-blog-load-more]');
    if (loadMoreTrigger) {
      event.preventDefault();
      TD_loadMoreArticles(loadMoreTrigger);
      return;
    }

    var searchLoadMoreTrigger = event.target.closest('[data-td-search-load-more]');
    if (searchLoadMoreTrigger) {
      event.preventDefault();
      TD_loadMoreSearchResults(searchLoadMoreTrigger);
      return;
    }

    var openTrigger = event.target.closest('[data-td-cart-open]');
    if (openTrigger) {
      if (routes.cartType === 'page') {
        return;
      }
      event.preventDefault();
      TD_refreshCartDrawer(true);
      return;
    }

    var closeTrigger = event.target.closest('[data-td-cart-close]');
    if (closeTrigger) {
      event.preventDefault();
      TD_closeCartDrawer();
      return;
    }

    var increaseTrigger = event.target.closest('[data-td-cart-qty-increase]');
    if (increaseTrigger) {
      var increaseKey = increaseTrigger.getAttribute('data-key');
      var increaseQty = parseInt(increaseTrigger.getAttribute('data-quantity'), 10) + 1;
      TD_changeLineQuantity(increaseKey, increaseQty);
      return;
    }

    var decreaseTrigger = event.target.closest('[data-td-cart-qty-decrease]');
    if (decreaseTrigger) {
      var decreaseKey = decreaseTrigger.getAttribute('data-key');
      var decreaseQty = parseInt(decreaseTrigger.getAttribute('data-quantity'), 10) - 1;
      TD_changeLineQuantity(decreaseKey, Math.max(decreaseQty, 0));
      return;
    }

    var removeTrigger = event.target.closest('[data-td-cart-remove]');
    if (removeTrigger) {
      event.preventDefault();
      TD_changeLineQuantity(removeTrigger.getAttribute('data-key'), 0);
      return;
    }

    var quickViewOpenTrigger = event.target.closest('[data-td-quick-view-open]');
    if (quickViewOpenTrigger) {
      event.preventDefault();
      TD_openQuickView(quickViewOpenTrigger.getAttribute('data-dialog-id'));
      return;
    }

    var quickViewCloseTrigger = event.target.closest('[data-td-quick-view-close]');
    if (quickViewCloseTrigger) {
      event.preventDefault();
      TD_closeQuickView(quickViewCloseTrigger.closest('dialog[data-td-quick-view]'));
      return;
    }

    if (event.target.matches('dialog[data-td-quick-view]')) {
      TD_closeQuickView(event.target);
      return;
    }

    var searchOpenTrigger = event.target.closest('[data-td-search-open]');
    if (searchOpenTrigger) {
      event.preventDefault();
      TD_openSearchPopup();
      return;
    }

    var searchCloseTrigger = event.target.closest('[data-td-search-close]');
    if (searchCloseTrigger) {
      event.preventDefault();
      TD_closeSearchPopup();
      return;
    }

    var optionTrigger = event.target.closest('[data-td-option-select]');
    if (optionTrigger) {
      if (optionTrigger.classList.contains('TD_quick-view__option-value--unavailable')) {
        return;
      }

      var optionGroup = optionTrigger.closest('.TD_quick-view__option-values');
      optionGroup.querySelectorAll('[data-td-option-select]').forEach(function (button) {
        button.classList.remove('TD_quick-view__option-value--active');
      });
      optionTrigger.classList.add('TD_quick-view__option-value--active');

      var optionCurrent = optionTrigger.closest('.TD_quick-view__option').querySelector('[data-td-option-current]');
      if (optionCurrent) optionCurrent.textContent = optionTrigger.getAttribute('data-value');

      TD_updateQuickViewVariant(optionTrigger.closest('dialog[data-td-quick-view]'));
      return;
    }

    var productOptionTrigger = event.target.closest('[data-td-product-option-select]');
    if (productOptionTrigger) {
      if (
        productOptionTrigger.classList.contains('TD_product__pill--unavailable') ||
        productOptionTrigger.classList.contains('TD_product__swatch--unavailable')
      ) {
        return;
      }

      var productOptionGroup = productOptionTrigger.closest('[data-td-product-option-group]');
      productOptionGroup.querySelectorAll('[data-td-product-option-select]').forEach(function (button) {
        button.classList.remove('TD_product__swatch--active', 'TD_product__pill--active');
      });
      productOptionTrigger.classList.add(
        productOptionTrigger.classList.contains('TD_product__swatch') ? 'TD_product__swatch--active' : 'TD_product__pill--active'
      );

      var productOptionCurrent = productOptionGroup.querySelector('[data-td-option-current]');
      if (productOptionCurrent) productOptionCurrent.textContent = productOptionTrigger.getAttribute('data-value');

      TD_updateProductFormVariant(productOptionTrigger.closest('[data-td-product-root]'));
      return;
    }

    var qtyIncreaseTrigger = event.target.closest('[data-td-qty-increase]');
    if (qtyIncreaseTrigger) {
      var qtyIncreaseInput = qtyIncreaseTrigger.parentElement.querySelector('[data-td-qty-input]');
      if (qtyIncreaseInput) qtyIncreaseInput.value = (parseInt(qtyIncreaseInput.value, 10) || 1) + 1;
      return;
    }

    var qtyDecreaseTrigger = event.target.closest('[data-td-qty-decrease]');
    if (qtyDecreaseTrigger) {
      var qtyDecreaseInput = qtyDecreaseTrigger.parentElement.querySelector('[data-td-qty-input]');
      if (qtyDecreaseInput) qtyDecreaseInput.value = Math.max((parseInt(qtyDecreaseInput.value, 10) || 1) - 1, 1);
      return;
    }

    var filterApplyTrigger = event.target.closest('[data-td-filter-apply]');
    if (filterApplyTrigger) {
      var priceInputs = filterApplyTrigger.closest('.TD_collection__price-filter').querySelectorAll('[data-td-price-input]');
      var url = new URL(window.location.href);
      priceInputs.forEach(function (input) {
        if (input.value) {
          url.searchParams.set(input.name, input.value);
        } else {
          url.searchParams.delete(input.name);
        }
      });
      url.searchParams.delete('page');
      window.location.href = url.toString();
      return;
    }

    var newsletterSubmit = event.target.closest('[data-td-newsletter-submit]');
    if (newsletterSubmit) {
      newsletterSubmit.classList.add('TD_loading');
      return;
    }

    // Wishlist toggle
    var wishlistBtn = event.target.closest('[data-td-wishlist-toggle]');
    if (wishlistBtn) {
      var d = wishlistBtn.dataset;
      var added = TD_Wishlist.toggle({
        id: d.productId,
        handle: d.productHandle,
        title: d.productTitle,
        vendor: d.productVendor,
        price: d.productPrice,
        comparePrice: d.productComparePrice,
        image: d.productImage,
        url: d.productUrl,
        variantId: d.productVariantId,
        defaultVariant: d.productDefaultVariant
      });
      if (!added && typeof window.TD_rerenderWishlist === 'function') {
        window.TD_rerenderWishlist();
      }
      wishlistBtn.classList.toggle('TD_wishlist--active', added);
      wishlistBtn.setAttribute('aria-label', added ? 'Remove from wishlist' : 'Add to wishlist');
      TD_updateWishlistBadge();
      return;
    }

    // Remove from wishlist page (X button)
    var wlRemoveBtn = event.target.closest('[data-td-wl-remove]');
    if (wlRemoveBtn) {
      TD_Wishlist.remove(wlRemoveBtn.getAttribute('data-td-wl-remove'));
      TD_updateWishlistBadge();
      TD_syncWishlistButtons();
      if (typeof window.TD_rerenderWishlist === 'function') window.TD_rerenderWishlist();
      return;
    }

    // Add to cart from wishlist page
    var wlAtcBtn = event.target.closest('[data-td-wl-atc]');
    if (wlAtcBtn) {
      var variantId = wlAtcBtn.getAttribute('data-td-wl-atc');
      var origHTML = wlAtcBtn.innerHTML;
      wlAtcBtn.disabled = true;
      wlAtcBtn.innerHTML = '<span class="TD_wl-card__atc-loader"></span>';
      fetch(routes.cartAddUrl || '/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: 1 })
      })
        .then(function (res) { return res.json(); })
        .then(function () {
          return TD_refreshCartDrawer(true);
        })
        .then(function () {
          wlAtcBtn.innerHTML = origHTML;
          wlAtcBtn.disabled = false;
        })
        .catch(function () {
          wlAtcBtn.innerHTML = origHTML;
          wlAtcBtn.disabled = false;
        });
      return;
    }

    // Upsell add to cart
    var upsellAddBtn = event.target.closest('[data-td-upsell-add]');
    if (upsellAddBtn) {
      var upsellCard = upsellAddBtn.closest('.TD_cart-upsell__card');
      var upsellVariantSelect = upsellCard && upsellCard.querySelector('[data-td-upsell-variant]');
      var upsellVariantId = upsellVariantSelect ? parseInt(upsellVariantSelect.value) : parseInt(upsellAddBtn.dataset.variantId);
      if (!upsellVariantId) return;

      var origUpsellHTML = upsellAddBtn.innerHTML;
      upsellAddBtn.disabled = true;
      upsellAddBtn.innerHTML = '<span class="TD_wl-card__atc-loader"></span>';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: upsellVariantId, quantity: 1 })
      })
        .then(function (r) { return r.json(); })
        .then(function () { return TD_refreshCartDrawer(false); })
        .catch(function () {
          upsellAddBtn.disabled = false;
          upsellAddBtn.innerHTML = origUpsellHTML;
        });
      return;
    }

    var colToggleTrigger = event.target.closest('[data-td-col-toggle]');
    if (colToggleTrigger) {
      var cols = parseInt(colToggleTrigger.getAttribute('data-td-col-toggle'), 10);
      var colCollection = colToggleTrigger.closest('[id^="TD_collection-"]');
      if (colCollection) colCollection.style.setProperty('--col-columns', cols);
      var colGrid = document.querySelector('[data-td-collection-grid]');
      if (colGrid) colGrid.classList.remove('TD_collection__grid--list');
      colToggleTrigger.closest('.TD_collection__view-toggle').querySelectorAll('[data-td-col-toggle],[data-td-view-toggle]').forEach(function (btn) {
        btn.classList.toggle('TD_collection__view-btn--active', btn === colToggleTrigger);
      });
      return;
    }

    var viewToggleTrigger = event.target.closest('[data-td-view-toggle]');
    if (viewToggleTrigger) {
      var grid = document.querySelector('[data-td-collection-grid]');
      var mode = viewToggleTrigger.getAttribute('data-td-view-toggle');
      if (grid) grid.classList.toggle('TD_collection__grid--list', mode === 'list');
      viewToggleTrigger.closest('.TD_collection__view-toggle').querySelectorAll('[data-td-col-toggle],[data-td-view-toggle]').forEach(function (button) {
        button.classList.toggle('TD_collection__view-btn--active', button === viewToggleTrigger);
      });
      return;
    }

    var pageQtyIncrease = event.target.closest('[data-td-cart-page-qty-increase]');
    if (pageQtyIncrease) {
      var pageIncreaseSection = pageQtyIncrease.getAttribute('data-section-id');
      var pageIncreaseKey = pageQtyIncrease.getAttribute('data-key');
      var pageIncreaseQty = parseInt(pageQtyIncrease.getAttribute('data-quantity'), 10) + 1;
      TD_changePageLineQuantity(pageIncreaseSection, pageIncreaseKey, pageIncreaseQty);
      return;
    }

    var pageQtyDecrease = event.target.closest('[data-td-cart-page-qty-decrease]');
    if (pageQtyDecrease) {
      var pageDecreaseSection = pageQtyDecrease.getAttribute('data-section-id');
      var pageDecreaseKey = pageQtyDecrease.getAttribute('data-key');
      var pageDecreaseQty = parseInt(pageQtyDecrease.getAttribute('data-quantity'), 10) - 1;
      TD_changePageLineQuantity(pageDecreaseSection, pageDecreaseKey, Math.max(pageDecreaseQty, 0));
      return;
    }

    var pageRemoveTrigger = event.target.closest('[data-td-cart-page-remove]');
    if (pageRemoveTrigger) {
      event.preventDefault();
      TD_changePageLineQuantity(
        pageRemoveTrigger.getAttribute('data-section-id'),
        pageRemoveTrigger.getAttribute('data-key'),
        0
      );
      return;
    }

    var estimateTrigger = event.target.closest('[data-td-estimate-shipping]');
    if (estimateTrigger) {
      event.preventDefault();
      TD_estimateShipping(estimateTrigger);
      return;
    }

    var carouselDotTrigger = event.target.closest('[data-td-carousel-dot]');
    if (carouselDotTrigger) {
      var dotTrack = document.querySelector(
        '[data-td-carousel-track="' + carouselDotTrigger.getAttribute('data-track') + '"]'
      );
      if (dotTrack) {
        var slideIndex = parseInt(carouselDotTrigger.getAttribute('data-index'), 10);
        var targetSlide = dotTrack.children[slideIndex];
        if (targetSlide) {
          dotTrack.scrollTo({ left: targetSlide.offsetLeft, behavior: 'smooth' });
        }
      }
      carouselDotTrigger.parentElement.querySelectorAll('[data-td-carousel-dot]').forEach(function (dot) {
        dot.classList.toggle('TD_cart-page__dot--active', dot === carouselDotTrigger);
      });
      return;
    }
  });

  document.addEventListener('change', function (event) {
    var shippingCountry = event.target.closest('[data-td-shipping-country]');
    if (shippingCountry) {
      TD_populateProvinces(shippingCountry);
    }

    var upsellVariantSel = event.target.closest('[data-td-upsell-variant]');
    if (upsellVariantSel) {
      var selOpt = upsellVariantSel.options[upsellVariantSel.selectedIndex];
      var upsellCardEl = upsellVariantSel.closest('.TD_cart-upsell__card');
      if (upsellCardEl) {
        var upsellPriceEl = upsellCardEl.querySelector('.TD_cart-upsell__price');
        if (upsellPriceEl && selOpt && selOpt.dataset.price) {
          upsellPriceEl.textContent = selOpt.dataset.price;
        }
        var upsellBtn = upsellCardEl.querySelector('[data-td-upsell-add]');
        if (upsellBtn) upsellBtn.dataset.variantId = upsellVariantSel.value;
      }
    }

    var protectionToggle = event.target.closest('[data-td-protection-toggle]');
    if (protectionToggle) {
      var protectionEl = protectionToggle.closest('[data-td-cart-protection]');
      if (!protectionEl) return;
      var protVariantId = parseInt(protectionEl.dataset.variantId);
      var isChecked = protectionToggle.checked;
      protectionToggle.disabled = true;

      if (isChecked) {
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: protVariantId, quantity: 1 })
        })
          .then(function (r) { return r.json(); })
          .then(function () { return TD_refreshCartDrawer(false); })
          .catch(function () {
            protectionToggle.checked = false;
            protectionToggle.disabled = false;
          });
      } else {
        fetch('/cart.js')
          .then(function (r) { return r.json(); })
          .then(function (cartData) {
            var protItem = cartData.items.find(function (i) { return i.variant_id === protVariantId; });
            if (!protItem) return TD_refreshCartDrawer(false);
            return fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: protItem.key, quantity: 0 })
            }).then(function () { return TD_refreshCartDrawer(false); });
          })
          .catch(function () {
            protectionToggle.checked = true;
            protectionToggle.disabled = false;
          });
      }
    }
  });

  var TD_searchDebounceTimer;
  document.addEventListener('input', function (event) {
    var searchInput = event.target.closest('[data-td-search-input]');
    if (!searchInput) return;

    clearTimeout(TD_searchDebounceTimer);
    var query = searchInput.value.trim();
    TD_searchDebounceTimer = setTimeout(function () {
      TD_renderSearchResults(query);
    }, 300);
  });

  document.querySelectorAll('[data-td-countdown]').forEach(function (el) {
    TD_initCountdown(el);
  });

  document.querySelectorAll('[data-td-shipping-country]').forEach(function (select) {
    TD_populateProvinces(select);
  });

  TD_initSearchPopup();
  TD_initCartTimer();

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    if (cartDrawer && cartDrawer.classList.contains('TD_cart-drawer--open')) {
      TD_closeCartDrawer();
      return;
    }

    var searchPopup = document.querySelector('[data-td-search-popup].TD_search-popup--open');
    if (searchPopup) {
      TD_closeSearchPopup();
    }
  });

  document.addEventListener(
    'close',
    function (event) {
      if (event.target.matches && event.target.matches('dialog[data-td-quick-view]')) {
        document.body.classList.remove('TD_scroll-lock');
      }
    },
    true
  );

  function TD_setStyle2ActiveIndex(media, index) {
    if (media._TD_activeIndex === index) return;
    media._TD_activeIndex = index;

    var images = media.querySelectorAll('[data-td-style2-image]');
    var dots = media.parentElement.querySelectorAll('[data-td-style2-dot]');
    images.forEach(function (img, i) {
      img.style.transform = 'translateX(' + (i - index) * 100 + '%)';
    });
    dots.forEach(function (dot, i) {
      dot.classList.toggle('TD_product-grid-card__dot--active', i === index);
    });
  }

  var TD_style2MoveQueued = false;
  var TD_style2PendingEvent = null;

  document.addEventListener('mousemove', function (event) {
    var media = event.target.closest('[data-td-style2-media]');
    if (!media) return;

    TD_style2PendingEvent = { media: media, clientX: event.clientX };

    if (TD_style2MoveQueued) return;
    TD_style2MoveQueued = true;

    requestAnimationFrame(function () {
      TD_style2MoveQueued = false;
      if (!TD_style2PendingEvent) return;

      var pendingMedia = TD_style2PendingEvent.media;
      var images = pendingMedia.querySelectorAll('[data-td-style2-image]');
      if (images.length <= 1) return;

      var rect = pendingMedia.getBoundingClientRect();
      var ratio = (TD_style2PendingEvent.clientX - rect.left) / rect.width;
      var index = Math.floor(ratio * images.length);
      index = Math.max(0, Math.min(images.length - 1, index));

      TD_setStyle2ActiveIndex(pendingMedia, index);
    });
  });

  document.addEventListener('mouseout', function (event) {
    var media = event.target.closest('[data-td-style2-media]');
    if (!media || media.contains(event.relatedTarget)) return;
    TD_setStyle2ActiveIndex(media, 0);
  });

  if (window.IntersectionObserver) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('TD_reveal--visible');
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.2 }
    );

    document.querySelectorAll('[data-td-reveal]').forEach(function (el) {
      el.classList.add('TD_reveal--pending');
      revealObserver.observe(el);
    });
  }

  document.querySelectorAll('[data-td-product-root]').forEach(function (root) {
    TD_updateProductFormVariant(root);
  });

  TD_applyStoredDiscountToCheckoutLink();
});



document.querySelectorAll('.TD_quick-view-swiper').forEach(function (el) {
  var slideCount = el.querySelectorAll('.swiper-slide').length;
  if (slideCount === 0) return;

  var hasDots = !!el.querySelector('.swiper-pagination');
  var hasArrows = !!el.querySelector('.swiper-button-next');

  new Swiper(el, {
    slidesPerView: 1,
    spaceBetween: 10,
    loop: slideCount > 1,
    speed: 400,
    pagination: (hasDots && slideCount > 1) ? {
      el: el.querySelector('.swiper-pagination'),
      clickable: true
    } : false,
    navigation: (hasArrows && slideCount > 1) ? {
      nextEl: el.querySelector('.swiper-button-next'),
      prevEl: el.querySelector('.swiper-button-prev')
    } : false
  });
});

document.querySelectorAll('[data-td-explore-swiper]').forEach(function (el) {
  var wrap = el.closest('.TD_explore__carousel');

  new Swiper(el, {
    slidesPerView: 1.15,
    spaceBetween: 20,
    grabCursor: true,
    navigation: {
      nextEl: wrap ? wrap.querySelector('.TD_explore__nav--next') : null,
      prevEl: wrap ? wrap.querySelector('.TD_explore__nav--prev') : null,
    },
    breakpoints: {
      600: {
        slidesPerView: 2.15
      },
      990: {
        slidesPerView: 2.5
      }
    },
    observer: true,
    observeParents: true
  });
});

// product page slider
document.addEventListener("DOMContentLoaded", function () {
  var galleryEl = document.querySelector(".gallery-main");
  if (!galleryEl) return;

  var thumbs = new Swiper(".gallery-thumbs", {
    direction: "vertical",
    slidesPerView: 4,
    spaceBetween: 20,
    watchSlidesProgress: true,
    slideToClickedSlide: true,
  });

  var gallery = new Swiper(".gallery-main", {
    speed: 600,
    spaceBetween: 10,
    navigation: {
      nextEl: ".thumb-next",
      prevEl: ".thumb-prev",
    },
    thumbs: {
      swiper: thumbs,
    },
  });

  // expose for variant image switcher
  var productRoot = document.querySelector('[data-td-product-root]');
  if (productRoot) productRoot._TD_gallerySwiper = gallery;

  var progressFill = document.querySelector(".progress-fill");

  function updateProgress() {
    if (!progressFill) return;
    var totalSlides = gallery.slides.length;
    var percent = ((gallery.activeIndex + 1) / totalSlides) * 100;
    progressFill.style.height = percent + "%";
    thumbs.slideTo(gallery.activeIndex);
  }

  updateProgress();
  gallery.on("slideChange", updateProgress);
});



// Product Highlight box
jQuery(document).ready(function ($) {
    $('.td-product-highlight-dot').on('click', function () {
        let currentBox = $(this).closest('.td-product-hightlight-box');
        $('.td-product-hightlight-box').not(currentBox).removeClass('active');
        currentBox.toggleClass('active');
    });

});


// Banner Slider

$('.td-banner-slider').slick({
  dots: true,
  infinite: true,
  arrows: false,
  speed: 800,
  fade: true,
  cssEase: 'linear',
  slidesToShow: 1,
  slidesToScroll: 1,
  adaptiveHeight: true,
});


// Category Slider
const _catgEl = document.querySelector('.td-shop-catg-slider');

if (_catgEl && !_catgEl.swiper) {

    const progressFill = _catgEl.parentElement.querySelector('.td-catg-slider-progress-fill');

    const swiper = new Swiper(_catgEl, {
        slidesPerView: 5,
        spaceBetween: 12,
       centeredSlides: false,
        loop: false,
        speed:1000,
        watchOverflow: true,

        navigation: {
            nextEl: _catgEl.parentElement.querySelector('.swiper-button-next'),
            prevEl: _catgEl.parentElement.querySelector('.swiper-button-prev'),
        },

        breakpoints: {
            320: {
                slidesPerView: 1.2,
            },
            576: {
                slidesPerView: 2.2,
            },
            768: {
                slidesPerView: 5,
            }
        },

        on: {
            init(swiper) {
                updateProgress(swiper);
            },

            progress(swiper) {
                updateProgress(swiper);
            },

            resize(swiper) {
                updateProgress(swiper);
            }
        }
    });

    function updateProgress(swiper) {

        if (!progressFill) return;

        // Swiper progress value is between 0 and 1
        const progress = Math.max(0, Math.min(swiper.progress, 1));

        progressFill.style.width = `${progress * 100}%`;
    }
}




/* ── Product Image Lightbox ── */
(function () {
  var lb = document.getElementById('tdLightbox');
  if (!lb) return;

  var img = lb.querySelector('.td-lb__img');
  var counter = { cur: lb.querySelector('[data-td-lb-current]'), tot: lb.querySelector('[data-td-lb-total]') };
  var images = [];
  var current = 0;

  function buildImages() {
    images = Array.from(document.querySelectorAll('.gallery-main .td-lb-trigger[data-td-lb-src], .td-pg .td-lb-trigger[data-td-lb-src]')).map(function (el) {
      return { src: el.getAttribute('data-td-lb-src'), alt: el.getAttribute('data-td-lb-alt') || '' };
    });
    if (counter.tot) counter.tot.textContent = images.length;
  }

  function updateNav() {
    var prev = lb.querySelector('[data-td-lb-prev]');
    var next = lb.querySelector('[data-td-lb-next]');
    if (prev) prev.disabled = images.length <= 1;
    if (next) next.disabled = images.length <= 1;
    if (counter.cur) counter.cur.textContent = current + 1;
    lb.querySelector('.td-lb__nav--prev').disabled = images.length <= 1;
    lb.querySelector('.td-lb__nav--next').disabled = images.length <= 1;
  }

  function loadImage(idx) {
    if (!images[idx]) return;
    lb.classList.add('td-lb--loading');
    img.classList.add('td-lb__img--fade');
    var newImg = new Image();
    newImg.onload = function () {
      img.src = images[idx].src;
      img.alt = images[idx].alt;
      lb.classList.remove('td-lb--loading');
      requestAnimationFrame(function () {
        img.classList.remove('td-lb__img--fade');
      });
    };
    newImg.src = images[idx].src;
    current = idx;
    updateNav();
  }

  function open(idx) {
    buildImages();
    if (!images.length) return;
    lb.classList.add('td-lb--open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('TD_scroll-lock');
    loadImage(idx);
  }

  function close() {
    lb.classList.remove('td-lb--open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('TD_scroll-lock');
    setTimeout(function () {
      img.src = '';
      img.classList.remove('td-lb__img--fade');
    }, 300);
  }

  function prev() { loadImage((current - 1 + images.length) % images.length); }
  function next() { loadImage((current + 1) % images.length); }

  document.addEventListener('click', function (e) {
    /* open */
    var trigger = e.target.closest('.gallery-main .td-lb-trigger, .td-pg .td-lb-trigger');
    if (trigger) {
      var slides = Array.from(document.querySelectorAll('.gallery-main .td-lb-trigger[data-td-lb-src], .td-pg .td-lb-trigger[data-td-lb-src]'));
      open(slides.indexOf(trigger));
      return;
    }
    /* close */
    if (e.target.closest('[data-td-lb-close]')) { close(); return; }
    /* nav */
    if (e.target.closest('[data-td-lb-prev]')) { prev(); return; }
    if (e.target.closest('[data-td-lb-next]')) { next(); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('td-lb--open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  /* swipe support */
  var touchStartX = 0;
  lb.addEventListener('touchstart', function (e) { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    var diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 50) { diff < 0 ? next() : prev(); }
  });
})();

/* ── Product Grid "More images" toggle ── */
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-td-pg-more]');
    if (!btn) return;
    var grid = btn.previousElementSibling;
    if (!grid) return;
    var isOpen = btn.classList.contains('td-pg__more--open');
    grid.querySelectorAll('.td-pg__item--hidden').forEach(function (item) {
      item.style.display = isOpen ? '' : 'block';
    });
    btn.classList.toggle('td-pg__more--open', !isOpen);
    var textEl = btn.querySelector('.td-pg__more-text');
    if (textEl) textEl.textContent = isOpen ? 'More images' : 'Less images';
    if (isOpen) {
      /* scroll back to grid top when collapsing */
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();

/* ── Complete the Look — + Add button ── */
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-td-ctl-add]');
    if (!btn) return;
    var variantId = btn.getAttribute('data-td-ctl-add');
    if (!variantId) return;

    var lbl = btn.querySelector('.td-ctl__add-label');
    btn.classList.add('td-ctl__add--loading');

    var fd = new FormData();
    fd.append('id', variantId);
    fd.append('quantity', '1');

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: fd
    })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        btn.classList.remove('td-ctl__add--loading');
        if (result.status) { console.error('CTL add failed', result); return; }
        btn.classList.add('td-ctl__add--done');
        if (lbl) lbl.textContent = '✓ Added';
        if (typeof window.TD_refreshCartDrawer === 'function') {
          window.TD_refreshCartDrawer(true);
        }
        setTimeout(function () {
          btn.classList.remove('td-ctl__add--done');
          if (lbl) lbl.textContent = '+ Add';
        }, 2500);
      })
      .catch(function () {
        btn.classList.remove('td-ctl__add--loading');
      });
  });
})();

/* ── Scroll animations ── */
(function () {
  if (!window.IntersectionObserver) return;
  if (!window.TD_routes || !window.TD_routes.scrollAnimationsEnabled) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var delay = el.dataset.tdSaDelay || 0;
      setTimeout(function () { el.classList.add('td-sa--in'); }, Number(delay));
      observer.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });

  function initScrollAnims() {
    var main = document.getElementById('MainContent');
    if (!main) return;

    main.querySelectorAll(':scope > .shopify-section').forEach(function (sec) {
      var children = Array.from(sec.children);

      /* if the section has a single wrapper div, go one level deeper */
      var targets = children;
      if (children.length === 1 && children[0].children.length > 1) {
        targets = Array.from(children[0].children);
      }

      targets.forEach(function (el, i) {
        if (el.classList.contains('td-satc')) return;

        var rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('td-sa', 'td-sa--in');
          return;
        }

        el.classList.add('td-sa');
        el.dataset.tdSaDelay = i * 80;
        observer.observe(el);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnims);
  } else {
    initScrollAnims();
  }
})();




const swiper_feat = new Swiper(".td-feature-slider", {
  slidesPerView: 4,
  spaceBetween: 32,
  speed:800,
  loop: false,

  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },

  watchOverflow: true,

  breakpoints: {
    320: {
      slidesPerView: 1.2,
    },
    576: {
      slidesPerView: 2.2,
    },
    768: {
      slidesPerView: 4,
    },
  },
});


const nextBtn = document.querySelector(".td-collection-nav-arrow.swiper-button-next");

const swiper_collect = new Swiper(".td-collection-slider", {
  slidesPerView: 4,
  spaceBetween: 32,
    speed:800,
  loop: false,

  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },

  watchOverflow: true,

  on: {
    slideChangeTransitionStart() {
      nextBtn.classList.add("sliding");
    },

    slideChangeTransitionEnd() {
      nextBtn.classList.remove("sliding");
    },
  },

  breakpoints: {
    320: {
      slidesPerView: 1.2,
    },
    576: {
      slidesPerView: 2.2,
    },
    768: {
      slidesPerView: 4,
    },
  },
});


document.addEventListener("DOMContentLoaded", function () {

  // 62 days from page load
  const endDate = new Date(Date.now() + 62 * 24 * 60 * 60 * 1000);

  function format(num) {
    return num < 10 ? "0" + num : num;
  }

  function updateCountdown() {

    const now = new Date();
    const distance = endDate - now;

    const countdowns = document.querySelectorAll(".td-deal-countdown");

    countdowns.forEach(function (countdown) {

      const nums = countdown.querySelectorAll(".td-num");

      if (distance <= 0) {
        nums[0].textContent = "00";
        nums[1].textContent = "00";
        nums[2].textContent = "00";
        nums[3].textContent = "00";
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      nums[0].textContent = format(days);
      nums[1].textContent = format(hours);
      nums[2].textContent = format(minutes);
      nums[3].textContent = format(seconds);

    });
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

});


const faqItems = document.querySelectorAll(".td-faq-item");

faqItems.forEach((item) => {
  const answer = item.querySelector(".td-faq-answer");

  // First item open
  if (item.classList.contains("active")) {
    answer.style.height = answer.scrollHeight + "px";
  } else {
    answer.style.height = "0px";
  }

  item.addEventListener("click", () => {
    const isOpen = item.classList.contains("active");

    faqItems.forEach((faq) => {
      faq.classList.remove("active");

      const faqAnswer = faq.querySelector(".td-faq-answer");
      faqAnswer.style.height = "0px";
    });

    if (!isOpen) {
      item.classList.add("active");
      answer.style.height = answer.scrollHeight + "px";
    }
  });
});

// Testimonial Slider 

// document.addEventListener("DOMContentLoaded", function () {
//   new Swiper(".td-testimonial-slider", {
//     slidesPerView: 3,
//     spaceBetween: 32,
//     navigation: {
//       nextEl: ".swiper-button-next",
//       prevEl: ".swiper-button-prev",
//     },

//     watchOverflow: true,

//     on: {
//       slideChangeTransitionStart() {
//         nextBtn.classList.add("sliding");
//       },

//       slideChangeTransitionEnd() {
//         nextBtn.classList.remove("sliding");
//       },
//     },
//     breakpoints: {
//       320: {
//         slidesPerView: 1.2,
//       },
//       576: {
//         slidesPerView: 2.2,
//       },
//       768: {
//         slidesPerView: 3,
//       },
//     },
//   });
// });




// Single Product Slider
document.addEventListener("DOMContentLoaded", function () {
  const thumbs = new Swiper(".td-single-product-slider-thumbs", {
    direction: "vertical",
    slidesPerView: 4,
    spaceBetween: 0,
    watchSlidesProgress: true,
    freeMode: true,
    mousewheel: false
  });

  const main = new Swiper(".td-single-product-slider-main", {
    spaceBetween: 10,
    navigation: {
      nextEl: ".td-single-product-nav-thumb-next",
      prevEl: ".td-single-product-nav-thumb-prev",
    },
    thumbs: {
      swiper: thumbs
    }
  });


  // Single Product Nav Progress Track Fill
  var productRoot = document.querySelector('[data-td-product-root]');
  if (productRoot) productRoot._TD_gallerySwiper = main;

  var progressFill = document.querySelector(".td-single-product-nav-progress-track-fill");

  function updateProgress() {
    if (!progressFill) return;
    var totalSlides = main.slides.length;
    var percent = ((main.activeIndex + 1) / totalSlides) * 100;
    progressFill.style.height = percent + "%";
    thumbs.slideTo(main.activeIndex);
  }

  updateProgress();
  main.on("slideChange", updateProgress);
});

// Timeline Slider 

const years = document.querySelectorAll(".td-timeline-year");

const swiper = new Swiper(".td-timeline-slider", {

  slidesPerView: 1.2,
  spaceBetween: 25,
  speed: 1200,
  grabCursor: true,

  breakpoints: {

    768: {
      slidesPerView: 1.2
    },

    1200: {
      slidesPerView: 1.2
    }

  }

});

years.forEach((year, index) => {

  year.addEventListener("click", () => {

    swiper.slideTo(index);

  });

});

swiper.on("slideChange", () => {

  years.forEach(btn => btn.classList.remove("td-active"));

  years[swiper.activeIndex].classList.add("td-active");

});


// New HeroSlider

document.addEventListener("DOMContentLoaded", function () {

    const slider = document.querySelector(".td-new-hero-slider");

    const swiper = new Swiper(".td-new-hero-slider", {
        speed: 1400,
        loop: true,
        effect: "slide",

        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        }
    });

    // Count only original slides
    const totalSlides = document.querySelectorAll(
        ".td-new-hero-slider .swiper-slide:not(.swiper-slide-duplicate)"
    ).length;

  function updateActiveClass() {

    swiper.slides.forEach(slide => {
        slide.classList.remove("td-slide-active");
    });

    swiper.slides[swiper.activeIndex].classList.add("td-slide-active");

    document
        .querySelector(".td-new-hero-slider")
        .classList.add("td-slider-active");
}


    function updateProgress() {
        const progressFill = document.querySelector(".td-new-hero-slider-progress-fill");

        if (!progressFill) return;

        const progress = ((swiper.realIndex + 1) / totalSlides) * 100;
        progressFill.style.width = progress + "%";
    }

    // Initial state
    updateActiveClass();
    updateProgress();

    // Add class when sliding starts
    swiper.on("slideChangeTransitionStart", function () {
        slider.classList.add("td-slider-sliding");
    });

    // Remove class when sliding ends
    swiper.on("slideChangeTransitionEnd", function () {
        slider.classList.remove("td-slider-sliding");

        updateActiveClass();
        updateProgress();
    });

});


// Testimonial Slider
document.addEventListener("DOMContentLoaded", function () {

    const testimonialSection = document.querySelector(".td-testimonial");
    const slider = testimonialSection?.querySelector(".td-testimonial-slider");

    if (!slider) return;

    const nextButton = testimonialSection.querySelector(".swiper-button-next");
    const prevButton = testimonialSection.querySelector(".swiper-button-prev");

    const progressFill = testimonialSection.querySelector(
        ".td-new-hero-slider-progress-fill"
    );

    const swiper = new Swiper(slider, {
        slidesPerView: 3,
        spaceBetween: 10,
        speed: 1200,
        loop: false,
        watchOverflow: true,

        navigation: {
            nextEl: nextButton,
            prevEl: prevButton,
        },

        breakpoints: {
            320: {
                slidesPerView: 1.2,
                spaceBetween: 16,
            },

            576: {
                slidesPerView: 2.2,
                spaceBetween: 20,
            },

            768: {
                slidesPerView: 3,
                spaceBetween: 20,
            }
        }
    });


    // --------------------------------
    // TOTAL SLIDES
    // --------------------------------

    const totalSlides = slider.querySelectorAll(
        ".swiper-slide:not(.swiper-slide-duplicate)"
    ).length;


    // --------------------------------
    // ACTIVE SLIDE
    // --------------------------------

    function updateActiveClass() {

        swiper.slides.forEach((slide) => {
            slide.classList.remove("td-slide-active");
        });

        const activeSlide = swiper.slides[swiper.activeIndex];

        if (activeSlide) {
            activeSlide.classList.add("td-slide-active");
        }

        slider.classList.add("td-slider-active");
    }


    // --------------------------------
    // PROGRESS BAR
    // --------------------------------

    function updateProgress() {

        if (!progressFill || !totalSlides) return;

        const slidesPerView = swiper.params.slidesPerView;
        const currentIndex = swiper.activeIndex;

        // Number of slides currently covered
        let visibleSlides = currentIndex + slidesPerView;

        // Don't exceed total slides
        visibleSlides = Math.min(visibleSlides, totalSlides);

        // Calculate percentage
        const progress = (visibleSlides / totalSlides) * 100;

        progressFill.style.width = `${progress}%`;
    }


    // --------------------------------
    // INITIAL STATE
    // --------------------------------

    updateActiveClass();
    updateProgress();


    // --------------------------------
    // SLIDE START
    // --------------------------------

    swiper.on("slideChangeTransitionStart", function () {

        slider.classList.add("td-slider-sliding");

    });


    // --------------------------------
    // UPDATE PROGRESS DURING SLIDE
    // --------------------------------

    swiper.on("setTranslate", function () {

        if (!progressFill || !totalSlides) return;

        const slidesPerView = swiper.params.slidesPerView;

        /*
         * swiper.progress goes from 0 → 1
         * as the slider moves from beginning → end.
         */
        let sliderProgress = swiper.progress;

        // Keep within 0–1
        sliderProgress = Math.max(0, Math.min(1, sliderProgress));

        /*
         * Initial progress is based on visible slides.
         *
         * Example:
         * 5 slides / 3 visible
         *
         * Start = 3 / 5 = 60%
         * Middle = 4 / 5 = 80%
         * End = 5 / 5 = 100%
         */
        const initialVisibleProgress =
            slidesPerView / totalSlides;

        /*
         * Calculate progress from initial visible
         * amount to 100%.
         */
        let progress =
            initialVisibleProgress +
            ((1 - initialVisibleProgress) * sliderProgress);

        progress = Math.min(progress, 1);

        progressFill.style.width = `${progress * 100}%`;
    });


    // --------------------------------
    // SLIDE END
    // --------------------------------

    swiper.on("slideChangeTransitionEnd", function () {

        slider.classList.remove("td-slider-sliding");

        updateActiveClass();
        updateProgress();

    });

});





// Trending Category Slider


document.addEventListener("DOMContentLoaded", () => {

    gsap.registerPlugin(ScrollTrigger);

    // Tabs
 

    const buttons = document.querySelectorAll(".td-trend-tab-btn");
    const panels = document.querySelectorAll(".td-trend-tab-panel");

    buttons.forEach(button => {

        button.addEventListener("click", () => {

            if (button.classList.contains("active")) return;

            buttons.forEach(btn => btn.classList.remove("active"));
            panels.forEach(panel => panel.classList.remove("active"));

            button.classList.add("active");

            const targetPanel = document.getElementById(button.dataset.tab);

            if (targetPanel) {

                targetPanel.classList.add("active");

                const slider = targetPanel.querySelector(".td-trend-product-slider");

                if (slider && slider.swiper) {

                    slider.swiper.update();

                    updateProgress(
                        slider.swiper,
                        targetPanel.querySelector(".td-new-hero-slider-progress-fill")
                    );

                    animateSlides(slider);

                }

            }

        });

    });


    // Swiper


    document.querySelectorAll(".td-trend-product-slider").forEach(slider => {

        if (slider.swiper) return;

        const container = slider.parentElement;

        const progressFill = container.querySelector(".td-new-hero-slider-progress-fill");

        const swiper = new Swiper(slider, {

            slidesPerView: 5,
            spaceBetween: 20,
            speed: 1200,
            loop: false,
            watchOverflow: true,

            navigation: {
                nextEl: container.querySelector(".swiper-button-next"),
                prevEl: container.querySelector(".swiper-button-prev"),
            },

            breakpoints: {
                320: {
                    slidesPerView: 1.2,
                    spaceBetween: 16,
                },
                576: {
                    slidesPerView: 2.2,
                    spaceBetween: 20,
                },
                768: {
                    slidesPerView: 4,
                    spaceBetween: 20,
                },
                1499: {
                    slidesPerView: 5,
                    spaceBetween: 20,
                }
            },

            on: {

    init() {
        updateProgress(this, progressFill);
    },

    slideChange() {
        updateProgress(this, progressFill);
    },

    progress() {
        updateProgress(this, progressFill);
    },

    resize() {
        updateProgress(this, progressFill);
    }

}

        });

        // Animate once when section comes into view
        ScrollTrigger.create({
            trigger: slider,
            start: "top 80%",
            once: true,
            onEnter: () => animateSlides(slider)
        });

    });


    // ==========================
// Progress Bar
// ==========================

function updateProgress(swiper, progressFill) {

    if (!progressFill) return;

    const totalSlides = swiper.slides.length;

    // Slides visible at current breakpoint
    const visibleSlides = Math.ceil(swiper.params.slidesPerView);

    // Number of possible positions
    const totalSteps = Math.max(totalSlides - visibleSlides, 1);

    // Current position
    const currentStep = Math.min(swiper.activeIndex, totalSteps);

    // Progress (0 → 100)
    const progress = ((currentStep + 1) / (totalSteps + 1)) * 100;

    progressFill.style.width = `${progress}%`;

}


    // ==========================
    // Wave Animation
    // ==========================

    function animateSlides(slider) {

        const slides = slider.querySelectorAll(".td-trend-product-slider .td-trend-product-slide");

        gsap.killTweensOf(slides);

        gsap.set(slides, {
            opacity: 0,
            y: 60
        });

        gsap.to(slides, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.15
        });
    }
});



// Trend Product Box Slider


// document.querySelectorAll(".td-trend-product-box-slider").forEach(slider => {

//     if (slider.swiper) return;

//     const container = slider.parentElement;

//     const swiper = new Swiper(slider, {
//         slidesPerView: 1,
//         spaceBetween: 0,
//         speed: 1200,
//         loop: false,
//         watchOverflow: true,

//     pagination: {
//         el: slider.querySelector(".swiper-pagination"),
//         clickable: true
//     },
//         breakpoints: {
//             320: {
//               slidesPerView: 1,
//                 spaceBetween: 0,
//             },
//             576: {
//               slidesPerView: 1,
//                 spaceBetween: 0,
//             },
//             768: {
//                 slidesPerView: 1,
//                 spaceBetween: 0,
//             }
//         },
//     });
// });



document.querySelectorAll(".td-trend-product-box-slider").forEach(slider => {

    if (slider.swiper) return;

    const swiper = new Swiper(slider, {
        direction: "vertical",
        slidesPerView: 1,
        spaceBetween: 0,
        speed: 1200,
        loop: false,
        watchOverflow: true,
        mousewheel: true,

        pagination: {
            el: slider.querySelector(".swiper-pagination"),
            clickable: true
        },

        breakpoints: {
            320: {
                slidesPerView: 1,
                spaceBetween: 0,
            },
            576: {
                slidesPerView: 1,
                spaceBetween: 0,
            },
            768: {
                slidesPerView: 1,
                spaceBetween: 0,
            }
        }
    });

});




// Collection Showcase
const tdItems = document.querySelectorAll(".td-collection-item");
const tdImages = document.querySelectorAll(".td-collection-image");

// Default first item active
tdItems[0].classList.add("active");
tdImages[0].classList.add("active");

function tdChangeCollection(index) {

    tdItems.forEach(item => item.classList.remove("active"));
    tdImages.forEach(image => image.classList.remove("active"));

    tdItems[index].classList.add("active");
    tdImages[index].classList.add("active");
}

tdItems.forEach((item, index) => {

    item.addEventListener("mouseenter", () => {
        tdChangeCollection(index);
    });

});


// Countdown timer 

const countdownDate = "September 30, 2026";

const targetDate = new Date(countdownDate).getTime();

const daysElement = document.getElementById("days");
const hoursElement = document.getElementById("hours");
const minutesElement = document.getElementById("minutes");
const secondsTensElement = document.getElementById("seconds-tens");
const secondsOnesElement = document.getElementById("seconds-ones");

let timer;


function pad(value) {
    return String(value).padStart(2, "0");
}


function updateCountdown() {
    const now = Date.now();
    const difference = targetDate - now;

    // Countdown finished
    if (difference <= 0) {
        daysElement.textContent = "00";
        hoursElement.textContent = "00";
        minutesElement.textContent = "00";
        secondsTensElement.textContent = "0";
        secondsOnesElement.textContent = "0";

        clearInterval(timer);
        return;
    }

    // Calculate time
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));

    const hours = Math.floor(
        (difference / (1000 * 60 * 60)) % 24
    );

    const minutes = Math.floor(
        (difference / (1000 * 60)) % 60
    );

    const seconds = Math.floor(
        (difference / 1000) % 60
    );

    // Update days, hours & minutes
    daysElement.textContent = pad(days);
    hoursElement.textContent = pad(hours);
    minutesElement.textContent = pad(minutes);

    // Split seconds into two digits
    const tens = Math.floor(seconds / 10);
    const ones = seconds % 10;

    secondsTensElement.textContent = tens;
    secondsOnesElement.textContent = ones;

    // Seconds animation
    secondsOnesElement.classList.remove("animate");

    // Force browser reflow
    void secondsOnesElement.offsetWidth;

    secondsOnesElement.classList.add("animate");
}


// Start countdown immediately
updateCountdown();

// Update every second
timer = setInterval(updateCountdown, 1000);



// Single Product Showcase New Slider

document.addEventListener("DOMContentLoaded", function () {

    const thumbs = new Swiper(
        ".td-single-product-showcase-slider-thumbs",
        {
            slidesPerView:4,
            spaceBetween: 16,
            speed:1200,

            watchSlidesProgress: true,
            freeMode: false,
            slideToClickedSlide: true,
        }
    );


    const main = new Swiper(
        ".td-product-showcase-slider",
        {
            spaceBetween: 10,
            loop: true,
            speed:1200,

            thumbs: {
                swiper: thumbs
            },

            on: {

                slideChange: function () {

                    const index = this.realIndex;

                    thumbs.slideTo(index);
                }

            }
        }
    );


    const prevButton = document.querySelector(
        ".td-single-product-showcase-nav-thumb-prev"
    );

    const nextButton = document.querySelector(
        ".td-single-product-showcase-nav-thumb-next"
    );

    const prevImage = prevButton.querySelector("img");
    const nextImage = nextButton.querySelector("img");


    function updatePreviewImages() {

        const totalSlides = thumbs.slides.length;

        if (!totalSlides) return;


        const currentIndex = main.realIndex;


        const previousIndex =
            (currentIndex - 1 + totalSlides) % totalSlides;


        const nextIndex =
            (currentIndex + 1) % totalSlides;


        const previousSlide =
            thumbs.slides[previousIndex];

        const nextSlide =
            thumbs.slides[nextIndex];


        const previousImg =
            previousSlide.querySelector("img");

        const nextImg =
            nextSlide.querySelector("img");


        if (previousImg) {
            prevImage.src = previousImg.src;
        }

        if (nextImg) {
            nextImage.src = nextImg.src;
        }
    }



    prevButton.addEventListener("click", function () {

        main.slidePrev();

    });


    nextButton.addEventListener("click", function () {

        main.slideNext();

    });


    main.on("slideChange", function () {

        updatePreviewImages();

        // Make active thumbnail visible
        thumbs.slideTo(this.realIndex);

    });



    updatePreviewImages();

});





// Shop Look


document.addEventListener('DOMContentLoaded', function () {

  const hotspotItems = document.querySelectorAll(
    '.td-shop-look-dot-with-box-wrapper'
  );

  const productItems = document.querySelectorAll(
    '.td-shop-the-look-option-box'
  );


  function openProduct(id) {

    hotspotItems.forEach(function (item) {
      item.classList.remove('active');
    });


  
    productItems.forEach(function (item) {
      item.classList.remove('active');
    });



    const activeHotspot = document.querySelector(
      '.td-shop-look-dot-with-box-wrapper[data-id="' + id + '"]'
    );


  
    const activeProduct = document.querySelector(
      '.td-shop-the-look-option-box[data-id="' + id + '"]'
    );


    if (activeHotspot) {
      activeHotspot.classList.add('active');
    }


    if (activeProduct) {
      activeProduct.classList.add('active');
    }

  }

  hotspotItems.forEach(function (hotspot) {

    const dot = hotspot.querySelector(
      '.td-product-highlight-dot'
    );


    if (!dot) return;


    dot.addEventListener('click', function (event) {

      event.preventDefault();
      event.stopPropagation();


      const id = hotspot.getAttribute('data-id');

      openProduct(id);

    });

  });

  productItems.forEach(function (product) {

    product.addEventListener('click', function (event) {

      event.preventDefault();


      const id = product.getAttribute('data-id');

      openProduct(id);

    });

  });


});

// New FAQ
   document.addEventListener("DOMContentLoaded", function () {
    const faqItems = document.querySelectorAll(".td-new-faq-item");

    faqItems.forEach((item) => {
        const question = item.querySelector(".td-new-faq-question");
        const answer = item.querySelector(".td-new-faq-answer");
        const icon = item.querySelector(".td-new-faq-icon");

        question.addEventListener("click", function () {
            const isOpen = item.classList.contains("active");

            // Close all FAQs
            faqItems.forEach((otherItem) => {
                const otherQuestion = otherItem.querySelector(".td-new-faq-question");
                const otherIcon = otherItem.querySelector(".td-new-faq-icon");

                otherItem.classList.remove("active");
                // otherQuestion.setAttribute("aria-expanded", "false");
                // otherIcon.textContent = "+";
            });

            // Open clicked FAQ if it was closed
            if (!isOpen) {
                item.classList.add("active");
                // question.setAttribute("aria-expanded", "true");
                // icon.textContent = "−";
            }
        });
    });
});




// banner js 

