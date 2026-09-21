(() => {
  "use strict";

  const initialize = () => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const revealElements = document.querySelectorAll(".reveal");
    let revealObserver;

    const revealAll = () => {
      revealObserver?.disconnect();
      revealElements.forEach((element) => element.classList.add("active"));
      document.documentElement.classList.remove("reveal-ready");
    };

    if (!motionPreference.matches && "IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("active");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
      );

      document.documentElement.classList.add("reveal-ready");
      revealElements.forEach((element) => revealObserver.observe(element));
    } else {
      revealAll();
    }

    motionPreference.addEventListener?.("change", (event) => {
      if (event.matches) revealAll();
    });

    const navbar = document.getElementById("navbar");
    const scrollProgress = document.getElementById("scrollProgress");
    const backToTop = document.getElementById("backToTop");
    let scrollFramePending = false;

    const updateScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollRange =
        document.documentElement.scrollHeight - window.innerHeight;
      navbar?.classList.toggle("scrolled", scrollTop > 20);
      if (scrollProgress) {
        const progress =
          scrollRange > 0
            ? Math.min(1, Math.max(0, scrollTop / scrollRange))
            : 0;
        scrollProgress.style.transform = `scaleX(${progress})`;
      }
      if (backToTop) {
        backToTop.hidden = scrollTop < window.innerHeight;
      }
      scrollFramePending = false;
    };

    const scheduleScrollUpdate = () => {
      if (scrollFramePending) return;
      scrollFramePending = true;
      window.requestAnimationFrame(updateScroll);
    };

    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate);
    window.addEventListener("load", scheduleScrollUpdate, { once: true });
    updateScroll();

    if ("ResizeObserver" in window && scrollProgress) {
      new ResizeObserver(scheduleScrollUpdate).observe(document.body);
    }

    const anchorTarget = (href) => {
      if (!href || href === "#" || !href.startsWith("#")) return null;
      try {
        return document.getElementById(decodeURIComponent(href.slice(1)));
      } catch {
        return null;
      }
    };

    let cancelPendingNavigation;
    const navigateToSection = (target, href) => {
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener(
          "blur",
          () => target.removeAttribute("tabindex"),
          { once: true },
        );
      }
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: motionPreference.matches ? "auto" : "smooth",
        block: "start",
      });
      if (window.location.hash !== href) {
        window.history.pushState(null, "", href);
      }
    };

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        if (
          anchor.dataset.bsToggle ||
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const href = anchor.getAttribute("href");
        const target = anchorTarget(href);
        if (!target) return;

        event.preventDefault();
        cancelPendingNavigation?.();
        const mobileMenu = document.getElementById("navbarNav");
        const menuIsOpen = mobileMenu?.classList.contains("show");
        const menuIsTransitioning =
          mobileMenu?.classList.contains("collapsing");
        if ((menuIsOpen || menuIsTransitioning) && window.bootstrap?.Collapse) {
          const collapse = window.bootstrap.Collapse.getOrCreateInstance(
            mobileMenu,
            { toggle: false },
          );
          const closeMenu = () => collapse.hide();
          const finishNavigation = () => {
            cancelPendingNavigation?.();
            navigateToSection(target, href);
          };
          cancelPendingNavigation = () => {
            mobileMenu.removeEventListener(
              "hidden.bs.collapse",
              finishNavigation,
            );
            mobileMenu.removeEventListener("shown.bs.collapse", closeMenu);
            cancelPendingNavigation = undefined;
          };
          mobileMenu.addEventListener("hidden.bs.collapse", finishNavigation, {
            once: true,
          });
          // A tap during the opening transition must wait for it before hiding.
          mobileMenu.addEventListener("shown.bs.collapse", closeMenu, {
            once: true,
          });
          if (!menuIsTransitioning) closeMenu();
          return;
        }
        navigateToSection(target, href);
      });
    });

    const sectionLinks = Array.from(
      document.querySelectorAll("[data-section-link]"),
    );
    if ("IntersectionObserver" in window && sectionLinks.length) {
      const sectionLinkMap = new Map();
      sectionLinks.forEach((link) => {
        const section = anchorTarget(link.getAttribute("href"));
        if (!section) return;
        const links = sectionLinkMap.get(section) || [];
        links.push(link);
        sectionLinkMap.set(section, links);
      });

      const visibleSections = new Set();
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) visibleSections.add(entry.target);
            else visibleSections.delete(entry.target);
          });
          const currentSection = Array.from(visibleSections).sort(
            (a, b) =>
              Math.abs(a.getBoundingClientRect().top) -
              Math.abs(b.getBoundingClientRect().top),
          )[0];
          if (!currentSection) return;
          sectionLinks.forEach((link) => {
            const active =
              sectionLinkMap.get(currentSection)?.includes(link) || false;
            link.classList.toggle("active", active);
            if (active) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
        },
        { rootMargin: "-12% 0px -45% 0px", threshold: [0, 0.15, 0.4] },
      );

      sectionLinkMap.forEach((links, section) =>
        sectionObserver.observe(section),
      );
    }

    const form = document.getElementById("checkoutForm");
    if (!form) return;

    // This is an in-page order preview. No data is transmitted or persisted.
    form.noValidate = true;
    const fieldNames = [
      "fullName",
      "email",
      "phone",
      "address",
      "postalCode",
      "city",
      "country",
      "privacy",
    ];
    const fields = new Map(
      fieldNames.map((name) => [
        name,
        form.elements.namedItem(name) || document.getElementById(name),
      ]),
    );
    const checkoutModal = document.getElementById("checkoutModal");
    const entry = document.getElementById("checkoutEntry");
    const review = document.getElementById("checkoutReview");
    const touched = new Set();
    let submitted = false;

    const valueOf = (name) => fields.get(name)?.value.trim() || "";
    const isSpain = () =>
      /^(españa|espana|spain|es)$/i.test(valueOf("country"));
    const requiredMessages = {
      fullName: "Escribe tu nombre y apellidos.",
      email: "Escribe tu correo electrónico.",
      address: "Escribe tu dirección de entrega.",
      postalCode: "Escribe tu código postal.",
      city: "Escribe tu ciudad.",
      country: "Escribe tu país.",
      privacy: "Debes aceptar la política de privacidad para continuar.",
    };

    const fieldError = (name) => {
      const field = fields.get(name);
      if (!field) return "";
      if (name === "privacy")
        return field.checked ? "" : requiredMessages.privacy;

      const value = valueOf(name);
      if (!value) return requiredMessages[name] || "";
      if (name === "email" && field.validity.typeMismatch) {
        return "Escribe un correo electrónico válido, por ejemplo, nombre@dominio.es.";
      }
      if (name === "postalCode") {
        if (isSpain() && !/^\d{5}$/.test(value))
          return "El código postal de España debe tener 5 cifras.";
        if (!isSpain() && !/^[a-z\d -]{3,12}$/i.test(value)) {
          return "Usa entre 3 y 12 caracteres: letras, números, espacios o guiones.";
        }
      }
      if (field.validity.tooLong)
        return `Usa un máximo de ${field.maxLength} caracteres.`;
      if (field.validity.tooShort)
        return `Usa al menos ${field.minLength} caracteres.`;
      if (!field.validity.valid) return "Revisa este dato antes de continuar.";
      return "";
    };

    const showFieldError = (name, message) => {
      const field = fields.get(name);
      if (!field) return;
      const error = document.getElementById(`${name}-error`);
      field.classList.toggle("is-invalid", Boolean(message));
      field
        .closest(".form-field, .consent-field")
        ?.classList.toggle("has-error", Boolean(message));
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");

      if (error) {
        error.textContent = message;
        error.hidden = !message;
        const descriptions = new Set(
          (field.getAttribute("aria-describedby") || "")
            .split(/\s+/)
            .filter(Boolean),
        );
        if (message) descriptions.add(error.id);
        else descriptions.delete(error.id);
        if (descriptions.size)
          field.setAttribute(
            "aria-describedby",
            Array.from(descriptions).join(" "),
          );
        else field.removeAttribute("aria-describedby");
      }
    };

    const validateField = (name) => {
      const message = fieldError(name);
      showFieldError(name, message);
      return !message;
    };

    fields.forEach((field, name) => {
      if (!field) return;
      field.addEventListener("blur", () => {
        if (name !== "privacy") field.value = field.value.trim();
        touched.add(name);
        validateField(name);
      });
      const updateValidation = () => {
        if (submitted || touched.has(name)) validateField(name);
        if (name === "country" && (submitted || touched.has("postalCode")))
          validateField("postalCode");
      };
      field.addEventListener("input", updateValidation);
      field.addEventListener("change", updateValidation);
    });

    // Links remain independent controls, including when nested inside a consent label.
    form.querySelectorAll(".consent-field a").forEach((link) => {
      link.addEventListener("click", (event) => event.stopPropagation());
    });

    const showEntry = () => {
      if (entry) entry.hidden = false;
      if (review) review.hidden = true;
      checkoutModal?.setAttribute("aria-labelledby", "checkoutTitle");
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
      submitted = true;
      let firstInvalid;
      fields.forEach((field, name) => {
        if (!field) return;
        if (name !== "privacy") field.value = field.value.trim();
        if (!validateField(name) && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      if (!entry || !review) return;

      review.querySelectorAll("[data-review]").forEach((element) => {
        const name = element.dataset.review;
        element.textContent =
          valueOf(name) || (name === "phone" ? "No indicado" : "");
      });
      entry.hidden = true;
      review.hidden = false;
      checkoutModal?.setAttribute("aria-labelledby", "reviewTitle");
      document.getElementById("reviewTitle")?.focus();
      checkoutModal
        ?.querySelector(".modal-body")
        ?.scrollTo({ top: 0, behavior: "instant" });
    });

    document.getElementById("editOrder")?.addEventListener("click", (event) => {
      event.preventDefault();
      showEntry();
      fields.get("fullName")?.focus();
    });

    checkoutModal?.addEventListener("shown.bs.modal", () => {
      fields.get("fullName")?.focus();
    });
    checkoutModal?.addEventListener("hidden.bs.modal", showEntry);
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
