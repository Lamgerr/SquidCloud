/* ============================================================
   SquidCloud landing — vanilla JS
   1. Stat count-up (IntersectionObserver, once, easeOutCubic)
   2. Mobile menu (burger / overlay / Escape / link / resize)
   ============================================================ */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* Safety net: force every entrance to its finished state a moment
     after load, even if its CSS animation never ran. When everything
     works this changes nothing (states are identical). */
  window.setTimeout(function () {
    Array.prototype.forEach.call(
      document.querySelectorAll(".anim, .headline span, .header"),
      function (el) {
        el.classList.add("done");
      }
    );
  }, 3000);

  /* ----------------------------------------------------------
     1. Count-up stats
     ---------------------------------------------------------- */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function formatValue(value, decimals, suffix) {
    return value.toFixed(decimals) + suffix;
  }

  function statIndexOf(el) {
    var stats = document.querySelectorAll(".stat");
    var host = el.closest ? el.closest(".stat") : null;
    return host ? Array.prototype.indexOf.call(stats, host) : 0;
  }

  function runCount(el) {
    var index = statIndexOf(el);
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var suffix = el.getAttribute("data-suffix") || "";

    if (isNaN(target)) return;

    // Reduced motion: show the final value, no animation.
    if (reducedMotion) {
      el.textContent = formatValue(target, decimals, suffix);
      return;
    }

    var duration = 1500 + index * 80;
    var startOffset = 480 + index * 90;

    window.setTimeout(function () {
      var startTime = null;
      function step(now) {
        if (startTime === null) startTime = now;
        var progress = Math.min((now - startTime) / duration, 1);
        el.textContent = formatValue(
          target * easeOutCubic(progress),
          decimals,
          suffix
        );
        if (progress < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }, startOffset);
  }

  var countEls = document.querySelectorAll(".stat-value[data-count]");

  if (countEls.length) {
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            obs.unobserve(entry.target);
            runCount(entry.target);
          });
        },
        { threshold: 0.25 }
      );
      Array.prototype.forEach.call(countEls, function (el) {
        observer.observe(el);
      });
    } else {
      Array.prototype.forEach.call(countEls, runCount);
    }
  }

  /* ----------------------------------------------------------
     2. Mobile menu
     ---------------------------------------------------------- */
  var burger = document.querySelector(".burger");
  var overlay = document.querySelector(".overlay");
  var menu = document.querySelector(".mobile-menu");

  if (burger && overlay && menu) {
    function isOpen() {
      return burger.getAttribute("aria-expanded") === "true";
    }

    function setMenu(open) {
      if (open) {
        menu.hidden = false;
        overlay.hidden = false;
        burger.classList.add("is-open");
        burger.setAttribute("aria-expanded", "true");
        burger.setAttribute("aria-label", "Close menu");
        document.body.classList.add("menu-open");
      } else {
        menu.hidden = true;
        overlay.hidden = true;
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
        document.body.classList.remove("menu-open");
      }
    }

    burger.addEventListener("click", function () {
      setMenu(!isOpen());
    });

    overlay.addEventListener("click", function () {
      setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" || event.key === "Esc") setMenu(false);
    });

    Array.prototype.forEach.call(menu.querySelectorAll("a"), function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 720 && isOpen()) setMenu(false);
    });
  }
})();
