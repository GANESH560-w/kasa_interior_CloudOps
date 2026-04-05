const KASA_SOUND_KEY = "kasaSound";
const PORTFOLIO_VIDEO_SOURCES = [
    "assets/hero.mp4",
    "assets/video1.mp4",
    "assets/video2.mp4",
    "assets/video3.mp4"
];

document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;

    if (!localStorage.getItem(KASA_SOUND_KEY)) {
        localStorage.setItem(KASA_SOUND_KEY, "on");
    }

    window.addEventListener("load", () => {
        body.classList.add("page-loaded");
    });

    setupNav();
    setupNavbarScroll();
    setupPageTransitions();
    setupReveal();
    setupTestimonials();
    setupPortfolioFilter();
    setupPortfolioVideos();
    setupBackToTop();
    setupHeroFallback();
    setupVideoSound();
    setupContactForm();

    if (window.lucide) {
        lucide.createIcons();
    }
});

function setupNav() {
    const toggle = document.querySelector(".nav-toggle");
    const mobilePanel = document.querySelector(".nav-mobile-panel");
    if (!toggle || !mobilePanel) return;

    let overlay = document.querySelector(".nav-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "nav-overlay";
        document.body.appendChild(overlay);
    }

    const openMenu = () => {
        mobilePanel.classList.add("open");
        overlay.classList.add("visible");
        toggle.classList.add("open");
        document.body.style.overflow = "hidden";
    };

    const closeMenu = () => {
        mobilePanel.classList.remove("open");
        overlay.classList.remove("visible");
        toggle.classList.remove("open");
        document.body.style.overflow = "";
    };

    toggle.addEventListener("click", () => {
        if (mobilePanel.classList.contains("open")) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    overlay.addEventListener("click", closeMenu);
    mobilePanel.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
}

function setupNavbarScroll() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const syncHeader = () => {
        header.classList.toggle("scrolled", window.scrollY > 30);
    };

    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
}

function setupPageTransitions() {
    const body = document.body;
    const internalLinks = Array.from(document.querySelectorAll("a[data-nav]")).filter(link => {
        const href = link.getAttribute("href") || "";
        return href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:");
    });

    internalLinks.forEach(link => {
        link.addEventListener("click", event => {
            const href = link.getAttribute("href");
            if (!href) return;
            event.preventDefault();
            body.classList.add("page-exit");
            setTimeout(() => {
                window.location.href = href;
            }, 300);
        });
    });
}

function setupReveal() {
    const revealElements = document.querySelectorAll(".reveal");
    if (!revealElements.length) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const element = entry.target;
            element.classList.add("visible");

            const staggerItems = element.querySelectorAll(".reveal-stagger");
            staggerItems.forEach((item, index) => {
                item.style.transitionDelay = `${index * 90}ms`;
                item.classList.add("visible");
            });

            observer.unobserve(element);
        });
    }, { threshold: 0.16 });

    revealElements.forEach(element => observer.observe(element));
}

function setupTestimonials() {
    const slider = document.querySelector(".testimonial-slider");
    const testimonials = slider ? Array.from(slider.querySelectorAll(".testimonial")) : [];
    const dots = Array.from(document.querySelectorAll(".testimonial-dots .dot"));
    if (!slider || testimonials.length === 0 || dots.length === 0) return;

    let current = 0;
    let autoRotate;
    let touchStartX = 0;

    const setActive = nextIndex => {
        testimonials[current].classList.remove("is-active");
        dots[current].classList.remove("is-active");
        current = nextIndex;
        testimonials[current].classList.add("is-active");
        dots[current].classList.add("is-active");
    };

    const goNext = () => setActive((current + 1) % testimonials.length);
    const goPrev = () => setActive((current - 1 + testimonials.length) % testimonials.length);

    const startAuto = () => {
        stopAuto();
        autoRotate = window.setInterval(goNext, 5000);
    };

    const stopAuto = () => {
        if (autoRotate) {
            window.clearInterval(autoRotate);
        }
    };

    dots.forEach(dot => {
        dot.addEventListener("click", () => {
            const index = Number(dot.dataset.index);
            if (Number.isNaN(index)) return;
            setActive(index);
            startAuto();
        });
    });

    slider.addEventListener("mouseenter", stopAuto);
    slider.addEventListener("mouseleave", startAuto);
    slider.addEventListener("touchstart", event => {
        touchStartX = event.changedTouches[0].screenX;
    }, { passive: true });
    slider.addEventListener("touchend", event => {
        const touchEndX = event.changedTouches[0].screenX;
        const delta = touchEndX - touchStartX;
        if (Math.abs(delta) < 40) return;
        if (delta < 0) {
            goNext();
        } else {
            goPrev();
        }
        startAuto();
    }, { passive: true });

    startAuto();
}

function setupPortfolioFilter() {
    const grid = document.getElementById("portfolio-grid");
    const buttons = Array.from(document.querySelectorAll(".filter-btn"));
    if (!grid || buttons.length === 0) return;

    const items = Array.from(grid.querySelectorAll(".masonry-item"));

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const filter = button.dataset.filter || "all";
            buttons.forEach(item => item.classList.remove("is-active"));
            button.classList.add("is-active");

            items.forEach(item => {
                const match = filter === "all" || item.dataset.category === filter;
                if (match) {
                    item.style.display = "block";
                    requestAnimationFrame(() => item.classList.remove("hidden"));
                } else {
                    item.classList.add("hidden");
                    window.setTimeout(() => {
                        if (item.classList.contains("hidden")) {
                            item.style.display = "none";
                        }
                    }, 300);
                }
            });
        });
    });
}

function setupPortfolioVideos() {
    const grid = document.getElementById("portfolioVideoGrid");
    if (!grid) return;

    const soundPreference = localStorage.getItem(KASA_SOUND_KEY) !== "off";
    const videoMarkup = PORTFOLIO_VIDEO_SOURCES.map((source, index) => `
        <article class="video-item reveal">
            <div class="video-card">
                <video class="kasa-video portfolio-video" data-video-id="portfolio-${index}" data-source="${source}" controls loop playsinline preload="metadata">
                    <source src="${source}" type="video/mp4">
                </video>
                <button class="sound-toggle sound-toggle-card" data-target-video="portfolio-${index}" aria-label="Toggle sound">🔊</button>
                <p class="video-label">Project Walkthrough — Kasa Interiors</p>
            </div>
        </article>
    `).join("");

    grid.innerHTML = videoMarkup;

    grid.querySelectorAll(".portfolio-video").forEach(video => {
        video.muted = !soundPreference;
        video.volume = 1;
        video.addEventListener("error", () => {
            const card = video.closest(".video-item");
            if (card) {
                card.remove();
            }
        });
    });
}

function setupBackToTop() {
    let button = document.querySelector(".back-to-top");
    if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "back-to-top";
        button.setAttribute("aria-label", "Back to top");
        button.textContent = "↑";
        document.body.appendChild(button);
    }

    const syncVisibility = () => {
        button.classList.toggle("visible", window.scrollY > 400);
    };

    syncVisibility();
    window.addEventListener("scroll", syncVisibility, { passive: true });
    button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function setupHeroFallback() {
    const section = document.querySelector(".hero-video-section");
    const video = section?.querySelector(".hero-video");
    if (!section || !video) return;

    video.setAttribute("poster", "assets/img1.png");
    video.addEventListener("error", () => {
        section.classList.add("hero-fallback");
    });
}

function setupVideoSound() {
    const videos = Array.from(document.querySelectorAll(".kasa-video"));
    if (videos.length === 0) return;

    const soundEnabled = localStorage.getItem(KASA_SOUND_KEY) !== "off";
    const soundBanner = document.getElementById("soundEnableBanner");
    const heroVideo = document.querySelector(".hero-video");
    let gestureBound = false;

    const updateButtons = () => {
        document.querySelectorAll(".sound-toggle").forEach(button => {
            const targetId = button.getAttribute("data-target-video");
            const targetVideo = document.querySelector(`[data-video-id="${targetId}"]`);
            if (!targetVideo) return;
            button.textContent = targetVideo.muted ? "🔇" : "🔊";
        });
    };

    const attachGestureToEnableSound = () => {
        if (gestureBound || !heroVideo) return;
        gestureBound = true;

        const enableSound = () => {
            heroVideo.muted = false;
            heroVideo.volume = 1;
            heroVideo.play().catch(() => {});
            localStorage.setItem(KASA_SOUND_KEY, "on");
            soundBanner?.classList.add("hidden");
            updateButtons();
            window.removeEventListener("click", enableSound);
            window.removeEventListener("touchstart", enableSound);
            gestureBound = false;
        };

        window.addEventListener("click", enableSound, { once: true });
        window.addEventListener("touchstart", enableSound, { once: true, passive: true });
    };

    videos.forEach(video => {
        video.muted = !soundEnabled;
        video.defaultMuted = !soundEnabled;
        video.volume = 1;
    });

    document.querySelectorAll(".sound-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-target-video");
            const targetVideo = document.querySelector(`[data-video-id="${targetId}"]`);
            if (!targetVideo) return;

            targetVideo.muted = !targetVideo.muted;
            if (!targetVideo.muted) {
                targetVideo.volume = 1;
                targetVideo.play().catch(() => {});
                localStorage.setItem(KASA_SOUND_KEY, "on");
                soundBanner?.classList.add("hidden");
            } else {
                const allMuted = Array.from(document.querySelectorAll(".kasa-video")).every(video => video.muted);
                localStorage.setItem(KASA_SOUND_KEY, allMuted ? "off" : "on");
            }

            updateButtons();
        });
    });

    if (heroVideo && !heroVideo.muted) {
        heroVideo.play().catch(() => {
            heroVideo.muted = true;
            soundBanner?.classList.remove("hidden");
            attachGestureToEnableSound();
            updateButtons();
        });
    }

    updateButtons();
}

function setupContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const submitButton = form.querySelector("button[type='submit']");
    const submitLabel = submitButton?.querySelector(".btn-label");
    const fields = Array.from(form.querySelectorAll(".field"));

    const validateField = field => {
        const input = field.querySelector("input, select, textarea");
        if (!input) return true;

        const value = typeof input.value === "string" ? input.value.trim() : input.value;
        const valid = input.checkValidity() && value;
        field.classList.toggle("field-error", !valid);
        return Boolean(valid);
    };

    fields.forEach(field => {
        const input = field.querySelector("input, select, textarea");
        input?.addEventListener("input", () => validateField(field));
        input?.addEventListener("change", () => validateField(field));
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const valid = fields.every(validateField);
        if (!valid) return;

        try {
            submitButton.disabled = true;
            if (submitLabel) submitLabel.textContent = "Sending...";

            const response = await fetch("/api/public/enquiries", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fullName: form.fullName.value.trim(),
                    phone: form.phone.value.trim(),
                    email: form.email.value.trim(),
                    service: form.service.value.trim(),
                    message: form.message.value.trim()
                })
            });

            if (!response.ok) {
                throw new Error("Unable to submit enquiry.");
            }

            submitButton?.classList.add("success");
            window.setTimeout(() => {
                submitButton?.classList.remove("success");
            }, 2600);

            form.reset();
            fields.forEach(field => field.classList.remove("field-error"));
        } catch (error) {
            window.alert(error.message || "Something went wrong while submitting the form.");
        } finally {
            submitButton.disabled = false;
            if (submitLabel) submitLabel.textContent = "Send Message";
        }
    });
}
