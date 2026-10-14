"use strict";

// 배너 높이는 최초 표시 시 한 번만 고정합니다.
// 주소창·스크롤·resize 이벤트에서는 이 값을 갱신하지 않습니다.
// 새로고침하면 그때의 화면 높이로 다시 설정됩니다.
const initialViewportHeight = document.documentElement.clientHeight || window.innerHeight;
if (initialViewportHeight > 0) {
  document.documentElement.style.setProperty('--viewport-height', `${initialViewportHeight}px`);
}


// 로딩 화면: 첫 배너 이미지·로컬 폰트를 기다리고, 최대 5초 후에는 열립니다.
{
  const loader = document.querySelector('.page-loader');
  const root = document.documentElement;
  if (loader) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const started = performance.now();
    const background = [...document.querySelectorAll('.site-header, #main, .language-switch, .skip-link')];
    const previousInert = background.map(element => element.inert);
    loader.hidden = false;
    root.classList.add('is-loading');
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
      // 캐시가 빠를 때도 짧고 차분하게 전환합니다. 동작 줄이기에서는 대기하지 않습니다.
      const remaining = reducedMotion.matches ? 0 : Math.max(0, 700 - (performance.now() - started));
      setTimeout(() => {
        root.classList.remove('is-loading');
        root.classList.add('page-ready');
        background.forEach((element, index) => { element.inert = previousInert[index]; });
        loader.classList.add('is-finished');
        setTimeout(() => { loader.hidden = true; }, reducedMotion.matches ? 0 : 500);
      }, remaining);
    });
  } else {
    root.classList.add('page-ready');
  }
}

// 화면 상단에서 35% 지점에 있는 섹션을 현재 위치로 표시합니다.
// 섹션 높이·교차 알림 순서에 의존하지 않으므로 짧은 INFO도 감지합니다.
const links = document.querySelector('#navigation-links');
if (links) {
  const items = [...links.querySelectorAll('a')].map(anchor => ({
    anchor,
    section: document.querySelector(anchor.getAttribute('href'))
  })).filter(item => item.section);

  let current;
  let scheduled = false;

  function updateCurrentSection() {
    scheduled = false;
    if (!items.length) return;

    const referenceY = window.innerHeight * 0.35;
    let active = items[0];
    for (const item of items) {
      if (item.section.getBoundingClientRect().top <= referenceY) active = item;
    }

    // 마지막 섹션이 짧아 기준선까지 올라오지 않아도 페이지 끝에서는 표시합니다.
    const page = document.scrollingElement;
    if (page && page.scrollHeight > page.clientHeight + 2 &&
        page.scrollTop + page.clientHeight >= page.scrollHeight - 2) {
      active = items[items.length - 1];
    }

    if (active === current) return;
    current = active;
    for (const item of items) {
      if (item === active) item.anchor.setAttribute('aria-current', 'location');
      else item.anchor.removeAttribute('aria-current');
    }
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateCurrentSection);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate, { once: true });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleUpdate);
    items.forEach(item => observer.observe(item.section));
  }
  updateCurrentSection();
}

// JP / KR: 표기는 아래에서 수정하고, 선택값은 브라우저에 저장합니다.
const languageCopy = {
  "ja": {
    "title": "真紅に染み込む残酷な旋律",
    "description": [
      "ゴシックの荘厳と",
      "エレクトロニックの狂気が",
      "交わる黄昏。 ",
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
    "label": "言語選択"
  },
  "ko": {
    "title": "진홍빛으로 스며드는 잔혹한 멜로디",
    "description": "고딕의 장엄함과 일렉트로닉의 광기가 맞닿는 황혼. 장르도 BPM도 묻지 않고, 오직 '고딕'의 미학 아래 모인 아티스트들이 저마다의 어둠을 붉게 물들입니다.",
    "note": "*BONUS TRACK은 디스크에 수록되어 있지 않으며, 북클릿에 기재된 QR코드로 다운로드하실 수 있습니다.",
    "label": "언어 선택"
  }
};
const languageSwitch = document.querySelector('.language-switch');
if (languageSwitch) {
  const title = document.querySelector('#about-title');
  const description = document.querySelector('.about-description');
  const note = document.querySelector('.bonus-note');
  const buttons = [...languageSwitch.querySelectorAll('button[data-language]')];
  const storageKey = 'crepusculum-mortis-language';

  function setCopy(element, value) {
    if (typeof value === 'string') {
      element.textContent = value;
      return;
    }
    const phrases = value.map(text => {
      const span = document.createElement('span');
      span.className = 'jp-phrase';
      span.textContent = text;
      return span;
    });
    element.replaceChildren(...phrases);
  }

  function selectLanguage(language) {
    const text = languageCopy[language];
    if (!text) return;
    document.documentElement.lang = language;
    title.textContent = text.title;
    setCopy(description, text.description);
    setCopy(note, text.note);
    languageSwitch.setAttribute('aria-label', text.label);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    try { localStorage.setItem(storageKey, language); } catch { /* 저장 차단 시에도 전환 가능 */ }
  }

  let savedLanguage = 'ja';
  try { savedLanguage = localStorage.getItem(storageKey) || 'ja'; } catch { /* 일본어 기본값 유지 */ }
  selectLanguage(Object.hasOwn(languageCopy, savedLanguage) ? savedLanguage : 'ja');
  buttons.forEach(button => button.addEventListener('click', () => selectLanguage(button.dataset.language)));
  languageSwitch.hidden = false;
}

// 스크롤 연출: 네이티브 API만 사용하며, 위치·스크롤 속도는 바꾸지 않습니다.
{
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopMotion = window.matchMedia('(min-width: 50rem)');
  const root = document.documentElement;
  const targets = [...document.querySelectorAll(
    '.about-content > h2, .tagline-english, .about-description, .preview-placeholder, ' +
    '.section-title, .track-summary, .album-track, .bonus-note, .album-jacket, ' +
    '.album-information, .store, .production-credit, .credit-team > div, ' +
    '.artist-credit, #footer > p, .ornament'
  )];
  const ornament = document.querySelector('.ornament-window');
  const region = document.querySelector('.ornament-region');
  let revealObserver;
  let motionFrame = 0;

  function updateOrnament() {
    motionFrame = 0;
    if (!ornament || !region) return;
    if (motionPreference.matches || !desktopMotion.matches) {
      ornament.style.removeProperty('--ornament-shift');
      return;
    }
    const bounds = region.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
    // 움직이지 않는 부모를 기준으로 계산하여 오차 누적을 방지합니다.
    const progress = (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height);
    const rem = parseFloat(getComputedStyle(root).fontSize);
    ornament.style.setProperty('--ornament-shift', `${(progress - .5) * rem * 4}px`);
  }

  function scheduleOrnament() {
    if (!motionFrame) motionFrame = requestAnimationFrame(updateOrnament);
  }

  function setMotion() {
    revealObserver?.disconnect();
    root.classList.remove('motion-enabled');
    targets.forEach(element => {
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
      targets.forEach(element => {
        // 이미 지나간 영역은 다시 숨기지 않습니다.
        if (element.getBoundingClientRect().bottom <= 0) return;
        element.setAttribute(element.classList.contains('ornament') ? 'data-ornament-reveal' : 'data-reveal', '');
        if (element.classList.contains('album-track')) {
          const index = [...element.parentElement.children].indexOf(element);
          element.style.setProperty('--reveal-order', index % columns);
        }
        revealObserver.observe(element);
      });
      root.classList.add('motion-enabled');
    }
    scheduleOrnament();
  }

  window.addEventListener('scroll', scheduleOrnament, { passive: true });
  window.addEventListener('resize', scheduleOrnament);
  motionPreference.addEventListener('change', setMotion);
  desktopMotion.addEventListener('change', scheduleOrnament);
  setMotion();
}

// 장미 꽃잎: 직접 그린 곡선과 음영. 외부 이미지·라이브러리는 사용하지 않습니다.
(() => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.className = 'petal-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let petals = [];
  let frame = 0;
  let previousTime = 0;
  let elapsed = 0;
  const random = (min, max) => min + Math.random() * (max - min);

  function newPetal(initial = false) {
    const mobile = width < 576;
    return {
      x: random(-40, width),
      y: initial ? random(0, height) : -45,
      size: mobile ? random(14, 26) : random(20, 40),
      fall: random(18, 36),
      drift: random(5, 16),
      sway: random(8, 22),
      phase: random(0, Math.PI * 2),
      angle: random(0, Math.PI * 2),
      spin: random(-.35, .35),
      opacity: random(.35, .65),
      folded: Math.random() > .5
    };
  }

  function resize() {
    const oldWidth = width;
    const oldHeight = height;
    width = window.innerWidth;
    height = window.innerHeight;
    // 고밀도 화면에서도 그리기 부담을 제한합니다.
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.filter = `blur(${getComputedStyle(canvas).getPropertyValue('--petal-blur').trim()})`;
    const count = width < 576 ? 8 : 16;
    if (oldWidth && oldHeight) {
      petals.forEach(petal => {
        petal.x *= width / oldWidth;
        petal.y *= height / oldHeight;
      });
    }
    petals = petals.slice(0, count);
    while (petals.length < count) petals.push(newPetal(true));
  }

  function drawPetal(petal) {
    const wave = elapsed * .65 + petal.phase;
    const edgeFade = Math.min(1, Math.max(0, (height - petal.y + 20) / 60));
    context.save();
    context.translate(petal.x + Math.sin(wave) * petal.sway, petal.y);
    context.rotate(petal.angle);
    // 앞뒷면이 보이듯 가로 폭을 천천히 바꿉니다.
    context.scale(petal.size * (.55 + Math.sin(wave * .8) * .3), petal.size);
    context.globalAlpha = petal.opacity * edgeFade;
    const shade = context.createLinearGradient(-.6, -.5, .5, .6);
    shade.addColorStop(0, '#a31b32');
    shade.addColorStop(.45, '#741022');
    shade.addColorStop(1, '#39040e');
    context.fillStyle = shade;
    context.beginPath();
    context.moveTo(0, .68);
    context.bezierCurveTo(-.12, .36, -.64, .04, -.5, -.4);
    context.bezierCurveTo(-.42, -.7, -.08, -.68, .05, -.5);
    context.bezierCurveTo(.4, -.7, .65, -.28, .47, .12);
    context.bezierCurveTo(.35, .43, .09, .48, 0, .68);
    context.fill();
    if (petal.folded) {
      context.fillStyle = '#b52a3c';
      context.globalAlpha *= .3;
      context.beginPath();
      context.moveTo(-.5, -.4);
      context.bezierCurveTo(-.38, -.12, .1, -.16, 0, .68);
      context.bezierCurveTo(-.1, .15, -.43, .03, -.5, -.4);
      context.fill();
    }
    context.restore();
  }

  function animate(time) {
    frame = requestAnimationFrame(animate);
    if (!document.documentElement.classList.contains('page-ready')) {
      previousTime = time;
      return;
    }
    // 최대 30fps. 탭 복귀 시 큰 시간 차이로 꽃잎이 튀지 않게 합니다.
    const delta = time - previousTime;
    if (delta < 1000 / 30) return;
    const seconds = Math.min(delta / 1000, .05);
    previousTime = time;
    elapsed += seconds;
    context.clearRect(0, 0, width, height);
    // X-FADE와 영상 플레이어 영역을 그리기에서 제외합니다.
    // 스크롤·등장 효과에 따라 달라지는 화면 좌표를 매 프레임 반영합니다.
    context.save();
    context.beginPath();
    context.rect(0, 0, width, height);
    document.querySelectorAll('.preview-placeholder, #main video, #main iframe').forEach(player => {
      if (!player.matches('.preview-placeholder') && player.closest('.preview-placeholder')) return;
      const bounds = player.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < height && bounds.width && bounds.height) {
        context.rect(bounds.left - 2, bounds.top - 2, bounds.width + 4, bounds.height + 4);
      }
    });
    context.clip('evenodd');
    petals.forEach((petal, index) => {
      petal.x += petal.drift * seconds;
      petal.y += petal.fall * seconds;
      petal.angle += petal.spin * seconds;
      if (petal.y > height + 45 || petal.x > width + 60) {
        petals[index] = newPetal();
      } else {
        drawPetal(petal);
      }
    });
    context.restore();
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    context.clearRect(0, 0, width, height);
    if (!preference.matches && !document.hidden) frame = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', syncMotion);
  preference.addEventListener('change', syncMotion);
  resize();
  syncMotion();
})();
