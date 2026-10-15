"use strict";

(() => {
  const pageRoot = document.documentElement;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ==================== 01. 화면 높이 기준 ====================
  // 모바일은 진입 순간 보이는 높이를 유지하며, 회전·너비 변경 때만 새 화면을 기준으로 갱신합니다.
  const touchViewport = window.matchMedia('(hover: none) and (pointer: coarse)');
  const usesMobileViewport = () => navigator.userAgentData?.mobile ?? touchViewport.matches;
  function readViewportHeight() {
    if (!usesMobileViewport()) return pageRoot.clientHeight || window.innerHeight;
    const heights = [window.visualViewport?.height, window.innerHeight]
      .filter(height => Number.isFinite(height) && height > 0);
    return heights.length ? Math.floor(Math.min(...heights)) : pageRoot.clientHeight;
  }

  let viewportWidth = pageRoot.clientWidth;
  let viewportHeight = readViewportHeight();
  let ornamentStickyLayout = viewportHeight >= viewportWidth * .75;
  let viewportTimeout;
  let orientationChanged = false;
  pageRoot.style.setProperty('--viewport-height', `${viewportHeight}px`);
  pageRoot.classList.toggle('has-sticky-ornament', ornamentStickyLayout);
  pageRoot.classList.toggle('is-mobile-viewport', usesMobileViewport());

  function updateViewport(force = false) {
    const nextWidth = pageRoot.clientWidth;
    const nextHeight = readViewportHeight();
    const widthChanged = Math.abs(nextWidth - viewportWidth) > 1;
    const heightChanged = Math.abs(nextHeight - viewportHeight) > 1;
    if (!force && !orientationChanged && !widthChanged && (usesMobileViewport() || !heightChanged)) return;
    viewportWidth = nextWidth;
    viewportHeight = nextHeight;
    orientationChanged = false;
    ornamentStickyLayout = viewportHeight >= viewportWidth * .75;
    pageRoot.style.setProperty('--viewport-height', `${viewportHeight}px`);
    pageRoot.classList.toggle('has-sticky-ornament', ornamentStickyLayout);
    pageRoot.classList.toggle('is-mobile-viewport', usesMobileViewport());
    scheduleSectionUpdate();
    window.dispatchEvent(new Event('layoutresize'));
  }

  function scheduleViewportUpdate() {
    clearTimeout(viewportTimeout);
    viewportTimeout = setTimeout(updateViewport, 200);
  }

  window.addEventListener('resize', scheduleViewportUpdate);
  window.addEventListener('orientationchange', () => {
    orientationChanged = true;
    scheduleViewportUpdate();
  });
  touchViewport.addEventListener('change', scheduleViewportUpdate);

  // ==================== 02. 로딩 화면 ====================
  {
    const loader = document.querySelector('.page-loader');
    if (loader) {
      const started = performance.now();
      const background = [...document.querySelectorAll('.site-header, #main, .language-switch, .petal-toggle, .skip-link')];
      const previousInert = background.map(element => element.inert);
      loader.hidden = false;
      pageRoot.classList.add('is-loading');
      background.forEach(element => { element.inert = true; });
      const images = [...document.querySelectorAll('.banner-art, #banner img')];
      const assets = Promise.allSettled([
        document.fonts.ready,
        ...images.map(image => image.decode())
      ]);
      let deadline;
      Promise.race([
        assets,
        new Promise(resolve => { deadline = setTimeout(resolve, 5000); })
      ]).then(() => {
        clearTimeout(deadline);
        const remaining = motionPreference.matches ? 0 : Math.max(0, 700 - (performance.now() - started));
        setTimeout(() => {
          pageRoot.classList.remove('is-loading');
          // 스크롤 잠금 해제에 따른 주소창 변화를 기다린 뒤 최초 배치를 확정합니다.
          setTimeout(() => {
            updateViewport(true);
            pageRoot.classList.add('page-ready');
            background.forEach((element, index) => { element.inert = previousInert[index]; });
            loader.classList.add('is-finished');
            setTimeout(() => { loader.hidden = true; }, motionPreference.matches ? 0 : 500);
          }, 200);
        }, remaining);
      });
    } else {
      pageRoot.classList.add('page-ready');
    }
  }

  // ==================== 03. 현재 섹션 표시 ====================
  let scheduleSectionUpdate = () => {};
  const navigationLinks = document.querySelector('#navigation-links');
  if (navigationLinks) {
    const sectionLinks = [...navigationLinks.querySelectorAll('a')].map(anchor => ({
      anchor,
      section: document.querySelector(anchor.getAttribute('href'))
    })).filter(item => item.section);

    const hoverPreference = window.matchMedia('(hover: hover) and (pointer: fine)');
    let hoveredAnchor;
    let hoverTimeout;

    function clearNavigationHover() {
      clearTimeout(hoverTimeout);
      hoveredAnchor?.classList.remove('is-hovered');
      hoveredAnchor = undefined;
    }

    function showNavigationHover(anchor) {
      clearNavigationHover();
      hoveredAnchor = anchor;
      anchor.classList.add('is-hovered');
    }

    function releaseNavigationHover(anchor, delay = 200) {
      if (hoveredAnchor !== anchor) return;
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(clearNavigationHover, delay);
    }

    for (const { anchor } of sectionLinks) {
      anchor.addEventListener('pointerenter', event => {
        if (!hoverPreference.matches || event.pointerType === 'touch') return;
        showNavigationHover(anchor);
      });
      anchor.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch') return;
        showNavigationHover(anchor);
      });
      anchor.addEventListener('pointerup', event => {
        if (event.pointerType === 'touch') releaseNavigationHover(anchor, 1000);
      });
      anchor.addEventListener('pointerleave', event => {
        releaseNavigationHover(anchor, event.pointerType === 'touch' ? 1000 : 200);
      });
      anchor.addEventListener('pointercancel', clearNavigationHover);
    }
    hoverPreference.addEventListener('change', clearNavigationHover);

    let currentSection;
    let sectionUpdatePending = false;

    function updateCurrentSection() {
      sectionUpdatePending = false;
      if (!sectionLinks.length) return;

      const referenceY = viewportHeight * 0.35;
      let activeSection = sectionLinks[0];
      for (const item of sectionLinks) {
        if (item.section.getBoundingClientRect().top <= referenceY) activeSection = item;
      }

      // 마지막 섹션이 짧아 기준선까지 올라오지 않아도 페이지 끝에서는 표시합니다.
      const scrollContainer = document.scrollingElement;
      if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 2 &&
          scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 2) {
        activeSection = sectionLinks[sectionLinks.length - 1];
      }

      if (activeSection === currentSection) return;
      currentSection = activeSection;
      for (const item of sectionLinks) {
        if (item === activeSection) item.anchor.setAttribute('aria-current', 'location');
        else item.anchor.removeAttribute('aria-current');
      }
    }

    scheduleSectionUpdate = () => {
      if (sectionUpdatePending) return;
      sectionUpdatePending = true;
      window.requestAnimationFrame(updateCurrentSection);
    };

    window.addEventListener('scroll', scheduleSectionUpdate, { passive: true });
    window.addEventListener('resize', scheduleSectionUpdate);
    window.addEventListener('hashchange', scheduleSectionUpdate);
    window.addEventListener('load', scheduleSectionUpdate, { once: true });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(scheduleSectionUpdate);
      sectionLinks.forEach(item => observer.observe(item.section));
    }
    updateCurrentSection();
  }

  // ==================== 04. 언어 선택 ====================
  const languageCopy = {
    "ja": {
      "title": "真紅に染み込む残酷な旋律",
      "description": [
        "ゴシックの荘厳と",
        "エレクトロニックの狂気が",
        "交わる黄昏。[br]",
        "ジャンルもBPMも問わず、",
        "「ゴシック」の美学のもとに",
        "集ったアーティストたちが、",
        "それぞれの闇を",
        "紅く染め上げる。"
      ],
      "note": [
        "*BONUS TRACKは",
        "ディスクには収録されておらず、",
        "ブックレット記載の",
        "QRコードより",
        "ダウンロードいただけます。"
      ],
      "label": "言語選択",
      "petals": "花びらアニメーション",
      "albumArt": "Crepusculum Mortisのアルバムアートをダウンロード（新しいタブで開く）",
      "albumArtAlt": "Crepusculum Mortisのアルバムアート、イラスト：shru",
      "navigation": "メインナビゲーション",
      "loading": "Crepusculum Mortisを読み込み中",
      "credits": "milkyway TRAXXのクレジットへ移動",
      "official": "milkyway TRAXX公式X"
    },
    "ko": {
      "title": "진홍빛으로 스며드는 잔혹한 멜로디",
      "description": "고딕의 장엄함과 일렉트로닉의 광기가 맞닿는 황혼.[br]장르도 BPM도 묻지 않고, 오직 '고딕'의 미학 아래 모인 아티스트들이 저마다의 어둠을 붉게 물들입니다.",
      "note": "*BONUS TRACK은 디스크에 수록되어 있지 않으며, 북클릿에 기재된 QR코드로 다운로드하실 수 있습니다.",
      "label": "언어 선택",
      "petals": "꽃잎 애니메이션",
      "albumArt": "Crepusculum Mortis 앨범아트 다운로드 (새 탭에서 열기)",
      "albumArtAlt": "Crepusculum Mortis 앨범아트, 일러스트: shru",
      "navigation": "주요 탐색",
      "loading": "Crepusculum Mortis 불러오는 중",
      "credits": "milkyway TRAXX 크레딧으로 이동",
      "official": "milkyway TRAXX 공식 X"
    }
  };
  const languageSwitch = document.querySelector('.language-switch');
  if (languageSwitch) {
    const title = document.querySelector('#about-title');
    const description = document.querySelector('.about-description');
    const note = document.querySelector('.bonus-note');
    const buttons = [...languageSwitch.querySelectorAll('button[data-language]')];
    const storageKey = 'crepusculum-mortis-language';

    // 문구의 [br]을 실제 줄바꿈으로 변환합니다. HTML로 해석하지 않아 안전합니다.
    function setCopy(element, value) {
      function nodesWithBreaks(text, phrase = false) {
        return text.split('[br]').flatMap((part, index) => {
          const nodes = index ? [document.createElement('br')] : [];
          if (!part) return nodes;
          const node = phrase ? document.createElement('span') : document.createTextNode(part);
          if (phrase) {
            node.className = 'jp-phrase';
            node.textContent = part;
          }
          return [...nodes, node];
        });
      }
      const nodes = typeof value === 'string'
        ? nodesWithBreaks(value)
        : value.flatMap(text => nodesWithBreaks(text, true));
      element.replaceChildren(...nodes);
    }

    function selectLanguage(language, persist = false) {
      if (!Object.hasOwn(languageCopy, language)) return;
      const text = languageCopy[language];
      pageRoot.lang = language;
      title.textContent = text.title;
      setCopy(description, text.description);
      setCopy(note, text.note);
      languageSwitch.lang = language;
      languageSwitch.setAttribute('aria-label', text.label);
      for (const [selector, label] of [
        ['.petal-toggle', text.petals],
        ['.album-jacket', text.albumArt],
        ['#nav', text.navigation],
        ['.page-loader', text.loading],
        ['.label-symbol', text.credits],
        ['.production-credit a', text.official]
      ]) {
        const element = document.querySelector(selector);
        if (!element) continue;
        element.lang = language;
        element.setAttribute('aria-label', label);
      }
      document.querySelector('.album-jacket img')?.setAttribute('alt', text.albumArtAlt);
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
      if (persist) {
        try { localStorage.setItem(storageKey, language); } catch { /* 저장 차단 시에도 전환 가능 */ }
      }
    }

    const deviceLanguage = (navigator.languages?.[0] || navigator.language || 'ja').toLowerCase().split('-')[0];
    const defaultLanguage = Object.hasOwn(languageCopy, deviceLanguage) ? deviceLanguage : 'ja';
    let savedLanguage;
    try { savedLanguage = localStorage.getItem(storageKey); } catch { /* 저장 차단 시 기기 언어 사용 */ }
    selectLanguage(Object.hasOwn(languageCopy, savedLanguage) ? savedLanguage : defaultLanguage);
    buttons.forEach(button => button.addEventListener('click', () => selectLanguage(button.dataset.language, true)));
    languageSwitch.hidden = false;
  }

  // ==================== 05. 스크롤 연출 ====================
  {
    const desktopMotion = window.matchMedia('(min-width: 50.00rem)');
    const revealTargets = [...document.querySelectorAll(
      '.about-content > h2, .tagline-english, .about-description, .crossfade-preview, ' +
      '.section-title, .track-summary, .album-track, .bonus-note, .album-jacket, ' +
      '.album-information, .store, .production-credit, .credit-team > div, ' +
      '.artist-credit, #footer > p, .ornament'
    )];
    const ornament = document.querySelector('.ornament-window');
    const region = document.querySelector('.ornament-region');
    let revealObserver;
    let ornamentFrameId = 0;
    let rootFontSize = parseFloat(getComputedStyle(pageRoot).fontSize);

    function updateOrnament() {
      ornamentFrameId = 0;
      if (!ornament || !region) return;
      if (motionPreference.matches) {
        ornament.style.removeProperty('--ornament-shift');
        return;
      }
      const bounds = region.getBoundingClientRect();
      if (ornamentStickyLayout) {
        const height = ornament.getBoundingClientRect().height;
        const gap = rootFontSize * 2;
        const title = region.querySelector('.section-title');
        const start = Math.max(0, (title?.getBoundingClientRect().top ?? bounds.top) - bounds.top);
        // 장식의 상단은 트랙리스트 제목에서 시작하고 하단은 INFO 끝에서 멈춥니다.
        const inset = Math.min(Math.max(0, height - gap), Math.max(0, bounds.height - start));
        const anchorTop = Math.max(gap, (viewportHeight - height) / 2);
        region.style.setProperty('--ornament-start-offset', `${start}px`);
        region.style.setProperty('--ornament-stop-inset', `${inset}px`);
        region.style.setProperty('--ornament-anchor-top', `${anchorTop}px`);
        ornament.style.removeProperty('--ornament-shift');
        return;
      }
      if (!desktopMotion.matches) {
        ornament.style.removeProperty('--ornament-shift');
        return;
      }
      if (bounds.bottom < 0 || bounds.top > viewportHeight) return;
      // 움직이지 않는 부모를 기준으로 계산하여 오차 누적을 방지합니다.
      const progress = (viewportHeight - bounds.top) / (viewportHeight + bounds.height);
      ornament.style.setProperty('--ornament-shift', `${(progress - .5) * rootFontSize * 4}px`);
    }

    function scheduleOrnament(event) {
      if (event?.type === 'scroll' &&
          (motionPreference.matches || ornamentStickyLayout || !desktopMotion.matches)) return;
      if (!ornamentFrameId) ornamentFrameId = requestAnimationFrame(updateOrnament);
    }

    function setMotion() {
      revealObserver?.disconnect();
      pageRoot.classList.remove('motion-enabled');
      revealTargets.forEach(element => {
        element.removeAttribute('data-reveal');
        element.removeAttribute('data-ornament-reveal');
        element.classList.remove('is-visible');
      });
      if (!motionPreference.matches && 'IntersectionObserver' in window) {
        revealObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          });
        }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });
        const columns = getComputedStyle(document.querySelector('.album-tracks'))
          .gridTemplateColumns.split(' ').length;
        // 위치를 먼저 읽은 뒤 속성을 변경해 반복 레이아웃 계산을 피합니다.
        const pendingTargets = revealTargets.filter(element => element.getBoundingClientRect().bottom > 0);
        pendingTargets.forEach(element => {
          element.setAttribute(element.classList.contains('ornament') ? 'data-ornament-reveal' : 'data-reveal', '');
          if (element.classList.contains('album-track')) {
            const index = [...element.parentElement.children].indexOf(element);
            element.style.setProperty('--reveal-order', index % columns);
          }
          revealObserver.observe(element);
        });
        pageRoot.classList.add('motion-enabled');
      }
      scheduleOrnament();
    }

    window.addEventListener('scroll', scheduleOrnament, { passive: true });
    window.addEventListener('layoutresize', () => {
      rootFontSize = parseFloat(getComputedStyle(pageRoot).fontSize);
      scheduleOrnament();
    });
    motionPreference.addEventListener('change', setMotion);
    desktopMotion.addEventListener('change', scheduleOrnament);
    window.addEventListener('load', scheduleOrnament, { once: true });
    if ('ResizeObserver' in window && region) {
      const ornamentObserver = new ResizeObserver(scheduleOrnament);
      ornamentObserver.observe(region);
    }
    setMotion();
  }

  // ==================== 06. 장미 꽃잎 ====================
  (() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.className = 'petal-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    let canvasWidth = 0;
    let canvasHeight = 0;
    let petals = [];
    let animationFrameId = 0;
    let previousFrameTime = 0;
    let elapsedSeconds = 0;
    let petalBlur = 4;
    let pixelRatio = 0;
    let petalsPaused = false;
    const petalToggle = document.querySelector('.petal-toggle');
    const saveData = navigator.connection?.saveData === true;
    const frameIntervalMs = 1000 / (saveData ? 20 : 30);
    let resizeFrameId = 0;
    const videoExclusions = [...document.querySelectorAll('.crossfade-preview, #main video, #main iframe')]
      .filter(player => player.matches('.crossfade-preview') || !player.closest('.crossfade-preview'));
    const activeVideoExclusions = new Set(videoExclusions);
    if (videoExclusions.length && 'IntersectionObserver' in window) {
      const videoObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeVideoExclusions.add(entry.target);
          else activeVideoExclusions.delete(entry.target);
        }
      }, { rootMargin: '64px' });
      videoExclusions.forEach(player => videoObserver.observe(player));
    }
    const random = (min, max) => min + Math.random() * (max - min);

    function createPetal(initial = false, previousPetal = null) {
      const mobile = canvasWidth < 576;
      const petal = {
        x: random(-40, canvasWidth),
        y: initial ? random(0, canvasHeight) : -45,
        size: previousPetal?.size ?? (mobile ? random(14, 26) : random(20, 40)),
        fall: random(18, 36) * (Math.random() < .12 ? 1.18 : 1),
        drift: random(5, 16),
        sway: random(8, 22),
        phase: random(0, Math.PI * 2),
        angle: random(0, Math.PI * 2),
        spin: random(-.35, .35),
        opacity: random(.35, .65),
        folded: previousPetal?.folded ?? Math.random() > .5
      };
      petal.sprite = previousPetal?.sprite ?? createPetalSprite(petal);
      return petal;
    }

    function resize() {
      resizeFrameId = 0;
      const nextWidth = window.innerWidth;
      const nextHeight = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextBlur = parseFloat(getComputedStyle(canvas).getPropertyValue('--petal-blur')) || 0;
      if (nextWidth === canvasWidth && nextHeight === canvasHeight && ratio === pixelRatio && nextBlur === petalBlur) return;
      const rebuildSprites = ratio !== pixelRatio || nextBlur !== petalBlur;
      const oldWidth = canvasWidth;
      const oldHeight = canvasHeight;
      canvasWidth = nextWidth;
      canvasHeight = nextHeight;
      pixelRatio = ratio;
      petalBlur = nextBlur;
      canvas.width = Math.round(canvasWidth * ratio);
      canvas.height = Math.round(canvasHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (rebuildSprites) petals.forEach(petal => { petal.sprite = createPetalSprite(petal); });
      const count = saveData ? (canvasWidth < 576 ? 6 : 10) : (canvasWidth < 576 ? 11 : 21);
      if (oldWidth && oldHeight) {
        petals.forEach(petal => {
          petal.x *= canvasWidth / oldWidth;
          petal.y *= canvasHeight / oldHeight;
        });
      }
      petals = petals.slice(0, count);
      while (petals.length < count) petals.push(createPetal(true));
    }

    // 곡선·그라데이션·블러는 꽃잎 생성 시 한 번만 그려 재사용합니다.
    function createPetalSprite(petal) {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const padding = petalBlur * 3 + 2;
      const extent = Math.ceil(petal.size * 2 + padding * 2);
      const sprite = document.createElement('canvas');
      sprite.width = sprite.height = Math.ceil(extent * ratio);
      const spriteContext = sprite.getContext('2d');
      spriteContext.setTransform(ratio, 0, 0, ratio, sprite.width / 2, sprite.height / 2);
      spriteContext.filter = `blur(${petalBlur}px)`;
      spriteContext.scale(petal.size, petal.size);
      const shade = spriteContext.createLinearGradient(-.6, -.5, .5, .6);
      shade.addColorStop(0, '#a31b32');
      shade.addColorStop(.45, '#741022');
      shade.addColorStop(1, '#39040e');
      spriteContext.fillStyle = shade;
      spriteContext.beginPath();
      spriteContext.moveTo(0, .68);
      spriteContext.bezierCurveTo(-.12, .36, -.64, .04, -.5, -.4);
      spriteContext.bezierCurveTo(-.42, -.7, -.08, -.68, .05, -.5);
      spriteContext.bezierCurveTo(.4, -.7, .65, -.28, .47, .12);
      spriteContext.bezierCurveTo(.35, .43, .09, .48, 0, .68);
      spriteContext.fill();
      if (petal.folded) {
        spriteContext.fillStyle = '#b52a3c';
        spriteContext.globalAlpha *= .3;
        spriteContext.beginPath();
        spriteContext.moveTo(-.5, -.4);
        spriteContext.bezierCurveTo(-.38, -.12, .1, -.16, 0, .68);
        spriteContext.bezierCurveTo(-.1, .15, -.43, .03, -.5, -.4);
        spriteContext.fill();
      }
      return { image: sprite, extent: sprite.width / ratio };
    }

    function drawPetal(petal) {
      const wave = elapsedSeconds * .65 + petal.phase;
      const edgeFade = Math.min(1, Math.max(0, (canvasHeight - petal.y + 20) / 60));
      context.save();
      context.translate(petal.x + Math.sin(wave) * petal.sway, petal.y);
      context.rotate(petal.angle);
      context.scale(.55 + Math.sin(wave * .8) * .3, 1);
      context.globalAlpha = petal.opacity * edgeFade;
      const { image, extent } = petal.sprite;
      context.drawImage(image, -extent / 2, -extent / 2, extent, extent);
      context.restore();
    }

    function animate(time) {
      animationFrameId = requestAnimationFrame(animate);
      if (!pageRoot.classList.contains('page-ready')) {
        previousFrameTime = time;
        return;
      }
      // 최대 30fps. 탭 복귀 시 큰 시간 차이로 꽃잎이 튀지 않게 합니다.
      const delta = time - previousFrameTime;
      if (delta < frameIntervalMs - .5) return;
      const deltaSeconds = Math.min(delta / 1000, .05);
      previousFrameTime = time;
      elapsedSeconds += deltaSeconds;
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      // 영상이 화면에 접근할 때만 좌표를 읽고, 등장 효과 중에도 가림을 방지합니다.
      const clipVideos = activeVideoExclusions.size > 0;
      if (clipVideos) {
        context.save();
        context.beginPath();
        context.rect(0, 0, canvasWidth, canvasHeight);
        activeVideoExclusions.forEach(player => {
          const bounds = player.getBoundingClientRect();
          if (bounds.bottom > 0 && bounds.top < canvasHeight && bounds.width && bounds.height) {
            context.rect(bounds.left - 2, bounds.top - 2, bounds.width + 4, bounds.height + 4);
          }
        });
        context.clip('evenodd');
      }
      petals.forEach((petal, index) => {
        petal.x += petal.drift * deltaSeconds;
        petal.y += petal.fall * deltaSeconds;
        petal.angle += petal.spin * deltaSeconds;
        if (petal.y > canvasHeight + 45 || petal.x > canvasWidth + 60) {
          petals[index] = createPetal(false, petal);
        } else {
          drawPetal(petal);
        }
      });
      if (clipVideos) context.restore();
    }

    function syncMotion() {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
      previousFrameTime = 0;
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      if (petalToggle) {
        petalToggle.hidden = motionPreference.matches;
        petalToggle.setAttribute('aria-checked', String(!petalsPaused));
      }
      if (!motionPreference.matches && !petalsPaused && !document.hidden) animationFrameId = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
      if (!resizeFrameId) resizeFrameId = requestAnimationFrame(resize);
    });
    petalToggle?.addEventListener('click', () => {
      petalsPaused = !petalsPaused;
      syncMotion();
    });
    document.addEventListener('visibilitychange', syncMotion);
    motionPreference.addEventListener('change', syncMotion);
    resize();
    syncMotion();
  })();

  // ==================== 07. 온라인 스토어 ====================
  document.querySelectorAll('.store-buttons a').forEach((link, index) => {
    let label = link.querySelector('.store-button-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'store-button-label';
      label.textContent = link.textContent.trim();
      link.replaceChildren(label);
    }
    const unavailable = link.getAttribute('href')?.trim() === '#';
    if (unavailable) {
      link.setAttribute('href', '#');
      label.textContent = 'TBA';
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('aria-label', `TBA — online store ${index + 1}`);
      link.setAttribute('tabindex', '-1');
      link.setAttribute('draggable', 'false');
    } else {
      link.removeAttribute('aria-disabled');
      link.removeAttribute('aria-label');
      link.removeAttribute('tabindex');
      link.removeAttribute('draggable');
    }
    // 키보드나 스크립트에서 발생한 클릭·드래그도 막습니다.
    for (const eventType of ['click', 'dragstart']) {
      link.addEventListener(eventType, event => {
        if (link.getAttribute('href')?.trim() === '#') event.preventDefault();
      });
    }
  });

})();
