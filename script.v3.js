/* ==========================================================================
   Behaviour layer.
   Rules kept throughout: passive listeners, single rAF per frame, no layout
   thrash, and every enhancement degrades gracefully when JS is unavailable.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------ *
   * Theme: auto (system) -> light -> dark -> auto
   * ------------------------------------------------------------------ */
  var themeButton = document.getElementById("themeToggle");
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var STORE_KEY = "theme";
  var MODES = ["auto", "light", "dark"];
  var mode = "auto";

  try {
    var saved = localStorage.getItem(STORE_KEY);
    if (MODES.indexOf(saved) !== -1) mode = saved;
  } catch (e) {}

  function resolve(m) {
    return m === "auto" ? (media.matches ? "dark" : "light") : m;
  }

  function applyTheme() {
    var resolved = resolve(mode);
    root.classList.toggle("theme-dark", resolved === "dark");
    root.dataset.theme = mode;

    if (themeButton) {
      var label = { auto: "Auto", light: "Light", dark: "Dark" }[mode];
      themeButton.setAttribute("aria-pressed", resolved === "dark" ? "true" : "false");
      themeButton.setAttribute("aria-label", "Color theme: " + label + ". Activate to change.");
      themeButton.setAttribute("title", "Theme: " + label);
    }
  }

  applyTheme();

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      try { localStorage.setItem(STORE_KEY, mode); } catch (e) {}
      applyTheme();
    });
  }

  // Follow the system while in "auto" (addEventListener where supported).
  if (media.addEventListener) {
    media.addEventListener("change", function () { if (mode === "auto") applyTheme(); });
  } else if (media.addListener) {
    media.addListener(function () { if (mode === "auto") applyTheme(); });
  }

  /* ------------------------------------------------------------------ *
   * Nav: condensed state on scroll
   * ------------------------------------------------------------------ */
  var nav = document.getElementById("nav");

  /* ------------------------------------------------------------------ *
   * Mobile menu
   * ------------------------------------------------------------------ */
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");
  var navScrim = document.getElementById("navScrim");

  function setMenu(open) {
    if (!navToggle || !navLinks) return;
    navLinks.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (navScrim) {
      if (open) {
        navScrim.hidden = false;
        requestAnimationFrame(function () { navScrim.classList.add("show"); });
      } else {
        navScrim.classList.remove("show");
      }
    }
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (navToggle) {
    navToggle.addEventListener("click", function () {
      setMenu(navToggle.getAttribute("aria-expanded") !== "true");
    });
  }
  if (navScrim) {
    navScrim.addEventListener("click", function () { setMenu(false); });
    // Re-hide only after the fade finishes so the transition is visible.
    navScrim.addEventListener("transitionend", function () {
      if (!navScrim.classList.contains("show")) navScrim.hidden = true;
    });
  }
  if (navLinks) {
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });
  // Leaving mobile width should never strand the menu open.
  window.addEventListener("resize", function () {
    if (window.innerWidth > 734) setMenu(false);
  });

  /* ------------------------------------------------------------------ *
   * Scroll reveals (staggered via the --d custom property)
   * ------------------------------------------------------------------ */
  var revealables = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ------------------------------------------------------------------ *
   * Scroll spy — pick the section whose top is nearest the nav baseline
   * ------------------------------------------------------------------ */
  var sections = Array.prototype.slice.call(document.querySelectorAll("main .section"));
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));

  function currentId() {
    var line = 140; // roughly below the fixed nav
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < sections.length; i++) {
      var top = sections[i].getBoundingClientRect().top - line;
      var dist = Math.abs(top);
      if (top <= line && dist < bestDist) { bestDist = dist; best = sections[i]; }
    }
    if (!best && sections.length) best = sections[0];
    return best ? best.id : null;
  }

  /* ------------------------------------------------------------------ *
   * Hero fade-out (deliberately subtle)
   * ------------------------------------------------------------------ */
  var heroInner = document.querySelector(".hero-inner");
  var heroCue = document.querySelector(".scroll-cue");

  /* ------------------------------------------------------------------ *
   * Back-to-top button (injected, so every page gets it)
   * ------------------------------------------------------------------ */
  var toTop = document.createElement("button");
  toTop.id = "toTop";
  toTop.type = "button";
  toTop.setAttribute("aria-label", "Back to top");
  toTop.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 19V5\"/><path d=\"M5 12l7-7 7 7\"/></svg>";
  document.body.appendChild(toTop);

  toTop.addEventListener("click", function () {
    if (reduceMotion.matches) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  /* ------------------------------------------------------------------ *
   * One rAF-throttled scroll loop for everything above
   * ------------------------------------------------------------------ */
  var ticking = false;

  function onFrame() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;

    if (nav) nav.classList.toggle("scrolled", y > 8);

    toTop.classList.toggle("show", y > 600);

    var id = currentId();
    links.forEach(function (l) {
      var on = l.getAttribute("href") === "#" + id;
      if (on) l.classList.add("active"); else l.classList.remove("active");
      if (on) l.setAttribute("aria-current", "true"); else l.removeAttribute("aria-current");
    });

    if (heroInner && !reduceMotion.matches) {
      var vh = window.innerHeight || 1;
      var p = Math.min(1, Math.max(0, y / (vh * 0.75)));
      heroInner.style.opacity = String(1 - p);
      heroInner.style.transform = "translate3d(0," + (-28 * p).toFixed(2) + "px,0)";
      if (heroCue) heroCue.style.opacity = String((1 - Math.min(1, y / (vh * 0.25))) * 0.7);
    }
  }

  function requestFrame() {
    if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
  }

  // Reading layout values inside rAF keeps this off the input thread.
  window.addEventListener("scroll", requestFrame, { passive: true });
  window.addEventListener("resize", requestFrame);
  onFrame();

  /* ------------------------------------------------------------------ *
   * Placeholder links: don't jump to the top of the page
   * ------------------------------------------------------------------ */
  document.querySelectorAll("a[data-placeholder]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); });
  });

  /* ------------------------------------------------------------------ *
   * Footer year
   * ------------------------------------------------------------------ */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------------ *
   * Hash-free section navigation: the address bar stays clean.
   * Section clicks smooth-scroll without adding #hash to the URL.
   * Deep links (site.com/#about) still land on the section, then the
   * hash is quietly removed.
   * ------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute("href").slice(1);
    if (!id || !document.getElementById(id)) return;
    a.addEventListener("click", function (e) {
      // Let modified clicks (new tab etc.) behave natively.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      document.getElementById(id).scrollIntoView(
        reduceMotion.matches ? { block: "start" } : { behavior: "smooth", block: "start" }
      );
    });
  });

  // A hash arrived via deep link: let the native jump land, then clean it.
  if (window.location.hash) {
    var deepEl = document.getElementById(window.location.hash.slice(1));
    if (deepEl) {
      window.addEventListener("load", function () {
        setTimeout(function () {
          try {
            history.replaceState(null, "", window.location.pathname + window.location.search);
          } catch (err) {}
        }, 80);
      });
    }
  }
})();
