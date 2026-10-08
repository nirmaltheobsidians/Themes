(() => {
  const collectionRevealObservers = new WeakMap();
  const productTabControllers = new WeakMap();

  const initializeAnnouncementSliders = (scope = document) => {
    const selector = '.custom-announcement-bar.swiper';
    const sliders = [];
    if (scope.matches?.(selector)) sliders.push(scope);
    scope.querySelectorAll?.(selector).forEach((slider) => sliders.push(slider));

    sliders.forEach((slider) => {
      if (slider.swiper) return;

      const slides = slider.querySelectorAll('.swiper-slide');
      if (slides.length < 2) return;

      new window.Swiper(slider, {
        a11y: true,
        autoplay: {
          delay: Number(slider.dataset.speed) * 1000,
          disableOnInteraction: false,
          pauseOnMouseEnter: false,
        },
        direction: 'horizontal',
        effect: 'slide',
        loop: true,
        slidesPerView: 1,
        speed: 750,
      });
    });
  };

  const destroyAnnouncementSliders = (scope) => {
    const selector = '.custom-announcement-bar.swiper';
    const sliders = [];
    if (scope.matches?.(selector)) sliders.push(scope);
    scope.querySelectorAll?.(selector).forEach((slider) => sliders.push(slider));
    sliders.forEach((slider) => slider.swiper?.destroy(true, true));
  };

  const initializeBannerSliders = (scope = document) => {
    const selector = '.custom-banner-slider[data-custom-banner-slider]';
    const sliders = [];
    if (scope.matches?.(selector)) sliders.push(scope);
    scope.querySelectorAll?.(selector).forEach((slider) => sliders.push(slider));

    sliders.forEach((slider) => {
      if (slider.swiper) return;

      const slides = slider.querySelectorAll('.swiper-slide');
      if (slides.length < 2) return;

      const pagination = slider.querySelector('[data-banner-pagination]');
      const previousButton = slider.querySelector('[data-banner-previous]');
      const nextButton = slider.querySelector('[data-banner-next]');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const autoplayEnabled = slider.dataset.autoplay === 'true' && !reducedMotion;

      new window.Swiper(slider, {
        a11y: true,
        autoplay: autoplayEnabled
          ? {
              delay: Number(slider.dataset.speed) * 1000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
        loop: slider.dataset.loop === 'true',
        navigation: previousButton && nextButton
          ? {
              nextEl: nextButton,
              prevEl: previousButton,
            }
          : false,
        pagination: pagination
          ? {
              el: pagination,
              clickable: true,
              bulletClass: 'custom-banner-slider__dot',
              bulletActiveClass: 'is-active',
              renderBullet(index, className) {
                return `<button class="${className}" type="button" aria-label="Go to slide ${index + 1}"></button>`;
              },
            }
          : false,
        slidesPerView: 1,
        speed: Number(slider.dataset.transition) || 700,
        watchOverflow: true,
      });
    });
  };

  const destroyBannerSliders = (scope) => {
    const selector = '.custom-banner-slider[data-custom-banner-slider]';
    const sliders = [];
    if (scope.matches?.(selector)) sliders.push(scope);
    scope.querySelectorAll?.(selector).forEach((slider) => sliders.push(slider));
    sliders.forEach((slider) => slider.swiper?.destroy(true, true));
  };

  const initializeCollectionCircles = (scope = document) => {
    const sectionSelector = '[data-custom-collection-circles]';
    const sections = [];
    if (scope.matches?.(sectionSelector)) sections.push(scope);
    scope.querySelectorAll?.(sectionSelector).forEach((section) => sections.push(section));

    sections.forEach((section) => {
      if (section.dataset.revealReady === 'true') return;
      section.dataset.revealReady = 'true';

      const cards = [...section.querySelectorAll('.custom-collection-circles__slide')];
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
        cards.forEach((card) => card.classList.add('is-visible'));
      } else {
        cards.forEach((card) => card.classList.add('is-reveal-pending'));
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            });
          },
          { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
        );

        collectionRevealObservers.set(section, observer);
        cards.forEach((card) => observer.observe(card));
      }

      const slider = section.querySelector('[data-collection-circles-slider]');
      if (!slider || slider.swiper || cards.length < 2) return;

      const previousButton = slider.querySelector('[data-collection-previous]');
      const nextButton = slider.querySelector('[data-collection-next]');
      const autoplayEnabled =
        slider.dataset.autoplay === 'true' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      new window.Swiper(slider, {
        a11y: true,
        autoplay: autoplayEnabled
          ? {
              delay: Number(slider.dataset.speed) * 1000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
        freeMode: {
          enabled: true,
          sticky: false,
        },
        grabCursor: true,
        navigation: previousButton && nextButton
          ? {
              nextEl: nextButton,
              prevEl: previousButton,
            }
          : false,
        slidesPerView: 'auto',
        spaceBetween: Number(slider.dataset.gap) || 20,
        watchOverflow: true,
      });
    });
  };

  const destroyCollectionCircles = (scope) => {
    const sectionSelector = '[data-custom-collection-circles]';
    const sections = [];
    if (scope.matches?.(sectionSelector)) sections.push(scope);
    scope.querySelectorAll?.(sectionSelector).forEach((section) => sections.push(section));
    sections.forEach((section) => collectionRevealObservers.get(section)?.disconnect());

    const selector = '[data-collection-circles-slider]';
    const sliders = [];
    if (scope.matches?.(selector)) sliders.push(scope);
    scope.querySelectorAll?.(selector).forEach((slider) => sliders.push(slider));
    sliders.forEach((slider) => slider.swiper?.destroy(true, true));
  };

  const initializeProductTabs = (scope = document) => {
    const selector = '[data-product-tabs]';
    const sections = [];
    if (scope.matches?.(selector)) sections.push(scope);
    scope.querySelectorAll?.(selector).forEach((section) => sections.push(section));

    sections.forEach((section) => {
      if (productTabControllers.has(section)) return;
      const controller = new AbortController();
      productTabControllers.set(section, controller);
      const tabs = [...section.querySelectorAll('[data-product-tab]')];

      const activateTab = (tab, animate = true) => {
        const panelId = tab.dataset.panelId;
        const panel = panelId ? section.querySelector(`#${CSS.escape(panelId)}`) : null;
        if (!panel) return;

        tabs.forEach((item) => {
          const active = item === tab;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-selected', String(active));
          item.tabIndex = active ? 0 : -1;
        });

        section.querySelectorAll('[data-product-panel]').forEach((item) => {
          const active = item === panel;
          item.hidden = !active;
          item.classList.toggle('is-active', active);
        });

        if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        panel.querySelectorAll('[data-product-card-item]').forEach((card, index) => {
          if (typeof card.animate !== 'function') return;
          card.animate(
            [
              { opacity: 0, transform: 'translate3d(18px, 0, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            ],
            {
              delay: Math.min(index * 65, 390),
              duration: 520,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }
          );
        });
      };

      section.addEventListener(
        'click',
        (event) => {
          const tab = event.target.closest('[data-product-tab]');
          if (tab && section.contains(tab)) activateTab(tab);
        },
        { signal: controller.signal }
      );

      section.addEventListener(
        'keydown',
        (event) => {
          const currentTab = event.target.closest('[data-product-tab]');
          if (!currentTab || !section.contains(currentTab) || tabs.length < 2) return;

          const currentIndex = tabs.indexOf(currentTab);
          let nextIndex;
          if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = tabs.length - 1;
          else return;

          event.preventDefault();
          tabs[nextIndex].focus();
          activateTab(tabs[nextIndex]);
        },
        { signal: controller.signal }
      );
    });
  };

  const destroyProductTabs = (scope) => {
    const selector = '[data-product-tabs]';
    const sections = [];
    if (scope.matches?.(selector)) sections.push(scope);
    scope.querySelectorAll?.(selector).forEach((section) => sections.push(section));
    sections.forEach((section) => {
      productTabControllers.get(section)?.abort();
      productTabControllers.delete(section);
    });
  };

  const animateMegaMenuContent = (menu) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const categories = [...menu.querySelectorAll('.ob-mega-menu__category')];
    const activePanel = menu.querySelector('.ob-mega-menu__panel:not([hidden])');
    const links = activePanel
      ? [...activePanel.querySelectorAll('.ob-mega-menu__link-list > li, .ob-mega-menu__standalone-link')]
      : [];
    const images = [...menu.querySelectorAll('.ob-mega-menu__image-card')];
    const duration = 620;
    const stagger = 65;
    const linksStart = categories.length ? (categories.length - 1) * stagger + 160 : 0;
    const imagesStart = linksStart + (links.length ? (links.length - 1) * stagger + 240 : 120);

    const animateGroup = (elements, startDelay) => {
      elements.forEach((element, index) => {
        element.getAnimations().forEach((animation) => animation.cancel());
        element.animate(
          [
            { opacity: 0, transform: 'translate3d(-18px, 0, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          ],
          {
            duration,
            delay: startDelay + index * stagger,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'both',
          }
        );
      });
    };

    animateGroup(categories, 0);
    animateGroup(links, linksStart);
    animateGroup(images, imagesStart);
  };

  const initializeMegaMenus = (scope = document) => {
    const selector = '.section-header .mega-menu';
    const menus = [];
    if (scope.matches?.(selector)) menus.push(scope);
    scope.querySelectorAll?.(selector).forEach((menu) => menus.push(menu));

    menus.forEach((menu) => {
      if (menu.dataset.obHoverReady === 'true') return;
      menu.dataset.obHoverReady = 'true';
      const summary = menu.querySelector(':scope > summary');
      const hoverRegion = menu.closest('header-menu') || menu;
      let closeTimer;

      const openMenu = () => {
        window.clearTimeout(closeTimer);
        if (menu.open) return;
        menu.open = true;
        summary?.setAttribute('aria-expanded', 'true');
        animateMegaMenuContent(menu);
      };

      const closeMenu = () => {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          menu.classList.remove('ob-mega-menu--entering', 'ob-mega-menu--entered');
          menu.open = false;
          summary?.setAttribute('aria-expanded', 'false');
        }, 180);
      };

      hoverRegion.addEventListener('pointerover', (event) => {
        if (event.pointerType === 'touch' || !window.matchMedia('(min-width: 990px)').matches) return;
        openMenu();
      });

      hoverRegion.addEventListener('pointerout', (event) => {
        if (!window.matchMedia('(min-width: 990px)').matches || hoverRegion.contains(event.relatedTarget)) return;
        closeMenu();
      });

      hoverRegion.addEventListener('focusin', openMenu);
      hoverRegion.addEventListener('focusout', (event) => {
        if (!hoverRegion.contains(event.relatedTarget)) closeMenu();
      });

      summary?.addEventListener('click', (event) => {
        if (!window.matchMedia('(min-width: 990px)').matches || event.detail === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      });

      const tabs = [...menu.querySelectorAll('[data-ob-mega-tab]')];
      const panels = [...menu.querySelectorAll('[data-ob-mega-panel]')];
      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
          tabs.forEach((item, itemIndex) => {
            const active = itemIndex === index;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-selected', String(active));
            const icon = item.querySelector('.ob-mega-menu__category-icon');
            if (icon) icon.textContent = active ? '−' : '+';
          });

          panels.forEach((panel, panelIndex) => {
            const active = panelIndex === index;
            panel.classList.toggle('is-active', active);
            panel.hidden = !active;
          });

          if (menu.open) animateMegaMenuContent(menu);
        });
      });
    });
  };

  const initializeCustomOb = (scope = document) => {
    initializeAnnouncementSliders(scope);
    initializeBannerSliders(scope);
    initializeCollectionCircles(scope);
    initializeProductTabs(scope);
    initializeMegaMenus(scope);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeCustomOb(), { once: true });
  } else {
    initializeCustomOb();
  }

  document.addEventListener('shopify:section:load', (event) => initializeCustomOb(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    destroyAnnouncementSliders(event.target);
    destroyBannerSliders(event.target);
    destroyCollectionCircles(event.target);
    destroyProductTabs(event.target);
  });
})();
