(function () {
    const root = document.documentElement;

    function setAppHeight() {
        root.style.setProperty("--app-height", `${window.innerHeight}px`);
    }

    function markRuntime() {
        const ua = navigator.userAgent || "";
        if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
            root.classList.add("is-ios");
        }
        if (/Android/i.test(ua)) {
            root.classList.add("is-android");
        }
        if (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone) {
            root.classList.add("is-standalone");
        }
        if (!window.CSS?.supports?.("height", "100dvh")) {
            root.classList.add("no-dvh");
        }
    }

    function registerPwa() {
        if (!("serviceWorker" in navigator)) return;
        if (!["http:", "https:"].includes(window.location.protocol)) return;
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js").catch(() => {});
        });
    }

    setAppHeight();
    markRuntime();
    registerPwa();

    window.addEventListener("resize", setAppHeight, { passive: true });
    window.addEventListener("orientationchange", () => window.setTimeout(setAppHeight, 250), { passive: true });
})();
