"use strict";

// 배너 높이는 최초 표시 시 한 번만 고정합니다.
// 주소창·스크롤·resize 이벤트에서는 이 값을 갱신하지 않습니다.
// 새로고침하면 그때의 화면 높이로 다시 설정됩니다.
const initialViewportHeight = document.documentElement.clientHeight || window.innerHeight;
if (initialViewportHeight > 0) {
  document.documentElement.style.setProperty('--viewport-height', `${initialViewportHeight}px`);
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
