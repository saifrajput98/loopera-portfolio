'use strict';
// ---- Motion: reveals, hero parallax, off-screen pausing (no animation library) ----
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = [...document.querySelectorAll('[data-reveal]')];
  const heroCopy = [...document.querySelectorAll('.hero-copy [data-reveal]')];
  const heroArt = document.querySelector('.hero-art');
  const show = el => el.classList.add('is-in');
  const canAnimate = !reduce && typeof Element.prototype.animate === 'function';
  const play = (el, from, duration, easing, delay = 0) => {
    show(el);
    if (canAnimate) el.animate([from, { opacity: 1, transform: 'none' }], { duration, easing, delay, fill: 'backwards' });
  };
  const POWER2 = 'cubic-bezier(.215,.61,.355,1)', POWER3 = 'cubic-bezier(.165,.84,.44,1)';

  if (!canAnimate) {
    revealEls.forEach(show);
    if (heroArt) show(heroArt);
  } else {
    heroCopy.forEach((el, i) => play(el, { opacity: 0, transform: 'translateY(25px)' }, 900, POWER3, 120 + i * 140));
    if (heroArt) play(heroArt, { opacity: 0, transform: 'translateY(35px) rotate(1deg)' }, 1150, POWER3, 200);

    const rest = revealEls.filter(el => !heroCopy.includes(el));
    const fire = el => play(el, { opacity: 0, transform: 'translateY(26px)' }, 800, POWER2);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(e => {
        // reveal when entering view, or if it was scrolled past (e.g. anchor jump)
        if (e.isIntersecting || e.boundingClientRect.top < 0) { io.unobserve(e.target); fire(e.target); }
      }), { rootMargin: '0px 0px -12% 0px' });
      rest.forEach(el => io.observe(el));
    } else rest.forEach(show);
  }

  // Hero parallax: cheap rAF-throttled scroll, only while the hero is on screen.
  const hero = document.querySelector('.hero');
  if (hero && heroArt && !reduce) {
    let ticking = false, active = true;
    const update = () => {
      ticking = false;
      const p = Math.min(1, Math.max(0, scrollY / hero.offsetHeight));
      heroArt.style.translate = `0 ${(p * 0.06 * heroArt.offsetHeight).toFixed(1)}px`;
    };
    addEventListener('scroll', () => { if (active && !ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { active = e.isIntersecting; }).observe(hero);
  }

  // Pause infinite animations while their section is off-screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('is-offscreen', !e.isIntersecting)), { rootMargin: '120px' });
    document.querySelectorAll('.hero, .ticker, .gallery-viewport').forEach(el => io.observe(el));
  }
})();

(() => {
const projectDialog = document.querySelector('#project-dialog');
    const projectForm = document.querySelector('#project-form');
    const formStatus = document.querySelector('#form-status');
    const formClose = projectDialog.querySelector('.dialog-close');
    let lastFormTrigger = null;
    document.querySelectorAll('[data-open-project-form]').forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        lastFormTrigger = trigger;
        projectForm.reset();
        projectForm.hidden = false;
        formStatus.hidden = true;
        formStatus.textContent = '';
        openedAt = Date.now();
        fieldNames.forEach(k => { projectForm.elements[k].removeAttribute('aria-invalid'); document.getElementById(`err-${k}`).hidden = true; });
        if (!projectDialog.open) projectDialog.showModal();
        requestAnimationFrame(() => projectForm.querySelector('input[name="name"]').focus());
      });
    });
    formClose.addEventListener('click', () => projectDialog.close());
    projectDialog.addEventListener('click', event => {
      if (event.target === projectDialog) projectDialog.close();
    });
    projectDialog.addEventListener('close', () => {
      if (lastFormTrigger?.isConnected) lastFormTrigger.focus();
    });
        const FORM_ENDPOINT = '/contact.php';
    const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
    const TAG_RE = /<\s*\/?\s*[a-z!][^>]*>/i;
    const CTRL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
    const SERVICES = [...projectForm.elements.service.options].filter(o => !o.disabled).map(o => o.value);
    let openedAt = Date.now();
    const fieldNames = ['name', 'email', 'service', 'message'];
    fieldNames.forEach(key => {
      const el = projectForm.elements[key];
      const msg = document.createElement('p');
      msg.className = 'field-error'; msg.id = `err-${key}`; msg.hidden = true;
      el.closest('.form-field').append(msg);
      el.setAttribute('aria-describedby', msg.id);
      el.addEventListener('input', () => { el.removeAttribute('aria-invalid'); msg.hidden = true; });
    });
    const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
    function validate() {
      const v = { name: clean(projectForm.elements.name.value), email: clean(projectForm.elements.email.value), service: projectForm.elements.service.value, message: String(projectForm.elements.message.value || '').replace(/\r\n?/g, '\n').trim() };
      const e = {};
      if (v.name.length < 2) e.name = 'Please enter your name (at least 2 characters).';
      else if (v.name.length > 80) e.name = 'Please keep your name under 80 characters.';
      else if (/[<>]/.test(v.name) || CTRL_RE.test(v.name)) e.name = 'Please remove special characters such as < or >.';
      if (!v.email || v.email.length > 254 || !EMAIL_RE.test(v.email) || v.email.includes('..')) e.email = 'Please enter a valid email address.';
      if (!SERVICES.includes(v.service)) e.service = 'Please choose a service.';
      if (v.message.length < 10) e.message = 'Please share a few more details (at least 10 characters).';
      else if (v.message.length > 2000) e.message = 'Please keep your message under 2000 characters.';
      else if (TAG_RE.test(v.message) || CTRL_RE.test(v.message)) e.message = 'Please remove HTML tags or special characters.';
      else if ((v.message.match(/https?:\/\//gi) || []).length > 2) e.message = 'Please include no more than 2 links.';
      return { v, e };
    }
    function showErrors(errors) {
      let first = null;
      fieldNames.forEach(key => {
        const el = projectForm.elements[key], msg = document.getElementById(`err-${key}`);
        if (errors[key]) { el.setAttribute('aria-invalid', 'true'); msg.textContent = errors[key]; msg.hidden = false; first = first || el; }
        else { el.removeAttribute('aria-invalid'); msg.hidden = true; }
      });
      if (first) first.focus();
    }
    function cooldownMessage() {
      try {
        const now = Date.now();
        const log = JSON.parse(localStorage.getItem('lp_sub') || '[]').filter(t => now - t < 3600000);
        if (log.length && now - log[log.length - 1] < 30000) return 'Please wait a few seconds before sending another message.';
        if (log.length >= 3) return 'You have sent several messages recently. Please try again later or email directly.';
      } catch (_) {}
      return '';
    }
    function recordSubmission() {
      try { const now = Date.now(); const log = JSON.parse(localStorage.getItem('lp_sub') || '[]').filter(t => now - t < 3600000); log.push(now); localStorage.setItem('lp_sub', JSON.stringify(log)); } catch (_) {}
    }
    function showDone(name) {
      projectForm.reset(); projectForm.hidden = true; formStatus.hidden = false;
      formStatus.textContent = `Thanks${name ? `, ${name}` : ''} — your note is on its way. Saif will get back to you by email soon.`;
    }
    projectForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (projectForm.elements.website.value) { showDone(''); return; }
      const { v, e } = validate();
      showErrors(e);
      if (Object.keys(e).length) return;
      const limited = cooldownMessage();
      formStatus.hidden = false;
      if (limited) { formStatus.textContent = limited; return; }
      const submitButton = projectForm.querySelector('.form-submit');
      const submitLabel = submitButton.firstChild;
      submitButton.disabled = true;
      submitLabel.textContent = 'Sending… ';
      formStatus.textContent = 'Sending your note…';
      try {
        const response = await fetch(FORM_ENDPOINT, {
          method: 'POST', credentials: 'same-origin', referrerPolicy: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ name: v.name, email: v.email, service: v.service, message: v.message, website: '', ts: openedAt })
        });
        let result = {};
        try { result = await response.json(); } catch (_) {}
        if (response.status === 429) throw new Error('rate-limited');
        if (!response.ok || result.ok !== true) throw new Error('rejected');
        recordSubmission();
        showDone(v.name);
      } catch (error) {
        formStatus.textContent = error.message === 'rate-limited' ? 'Too many messages in a short time. Please try again later or email Saif directly at ' : 'Your message could not be sent just now. Please email Saif directly at ';
        const emailFallback = document.createElement('a');
        emailFallback.href = 'mailto:info@looperatech.com';
        emailFallback.textContent = 'info@looperatech.com';
        formStatus.append(emailFallback);
      } finally {
        submitButton.disabled = false;
        submitLabel.textContent = 'Send Project Enquiry ';
      }
    });
    const menuButton = document.querySelector('.menu-toggle');
    const navigation = document.querySelector('.nav-links');
    menuButton.addEventListener('click', () => {
      const open = navigation.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      menuButton.textContent = open ? '×' : '☰';
    });
    navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      navigation.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
      menuButton.textContent = '☰';
    }));

    (() => {
      const shots = document.querySelectorAll('.project-screenshot');
      const PX_PER_SEC = 70;
      const measure = img => {
        const win = img.parentElement;
        const dist = Math.max(0, img.offsetHeight - win.clientHeight);
        img.style.setProperty('--dist', dist + 'px');
        img.style.setProperty('--dur', Math.max(12, dist / PX_PER_SEC).toFixed(1) + 's');
      };
      shots.forEach(img => {
        if (img.complete) measure(img); else img.addEventListener('load', () => measure(img));
      });
      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(() => shots.forEach(measure));
        shots.forEach(img => ro.observe(img.parentElement));
      } else addEventListener('resize', () => shots.forEach(measure));
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('in-view', e.isIntersecting)), { threshold: .35 });
        document.querySelectorAll('.project').forEach(p => io.observe(p));
      } else document.querySelectorAll('.project').forEach(p => p.classList.add('in-view'));
    })();
})();

