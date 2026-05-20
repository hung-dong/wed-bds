/* ==============================================
   GLOBAL ESTATE — Map First Architecture (Rich & Suggested)
   ============================================== */

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80";
const LIST_PAGE_SIZE = 40;
const VIEWED_LISTINGS_KEY = "ndvViewedListingIds";
const DATA_CACHE_PREFIX = "ndvDataCache:";
const DATA_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_ROAD_PRICE_TABLE = [
    { keys: ["le duan"], price: 30 },
    { keys: ["truong chinh"], price: 28 },
    { keys: ["ly thai to"], price: 25 },
    { keys: ["vo nguyen giap"], price: 26 },
    { keys: ["pham van dong"], price: 24 },
    { keys: ["hung vuong"], price: 23 },
    { keys: ["nguyen tat thanh"], price: 22 },
    { keys: ["ton duc thang"], price: 20 },
    { keys: ["bui du"], price: 18 },
    { keys: ["bien ho"], price: 15 },
    { keys: ["ia grai"], price: 9 },
    { keys: ["dak doa"], price: 8 },
    { keys: ["an khe"], price: 10 },
    { keys: ["quy nhon"], price: 38 },
    { keys: ["phu cat"], price: 16 }
];
const BLOCKED_COMMENT_WORDS = ["chui", "lua dao", "mat day", "khon nan", "do lua"];

const state = {
    listings: [],
    site: null,
    currentListingId: null,
    exactMatches: [],
    suggestedMatches: [],
    filteredListings: [],
    adminUnits: [],
    selectedAdminUnit: null,
    selectedAreaCenter: null,
    searchScores: new Map(),
    roadPriceTable: DEFAULT_ROAD_PRICE_TABLE,
    map: null,
    markers: [],
    adminUnitLayer: null,
    isZoningActive: false,
    showFavoritesOnly: false,
    zoningLayers: [],
    visibleListCount: LIST_PAGE_SIZE,
    compareIds: [],
    viewedListingIds: [],
    mapRenderToken: 0
};

let currentListingPrice = 0; // State cho Modal 2026
let deferredInstallPrompt = null;

// DUMMY DATA FOR DEMONSTRATION WITH ENHANCED RICH MEDIA
const DUMMY_LISTINGS = [
    {
        id: "1",
        title: "Biệt thự view sông Thảo Điền",
        location: "Quận 2, TP.HCM",
        type: "Biệt thự",
        price: 45.5,
        area: 320,
        beds: 4,
        baths: 5,
        coordinates: [10.8040, 106.7408],
        images: [
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"
        ],
        video: "https://www.youtube.com/embed/Scxs7L0vhZ4",
        legal: "Sổ hồng riêng",
        description: "Ngôi biệt thự nghỉ dưỡng đẳng cấp tọa lạc ngay bờ sông mặt tiền Thảo Điền. Nội thất nhập khẩu tiêu chuẩn 5 sao, sân vườn rộng, có hồ bơi vô cực và bến du thuyền cá nhân."
    },
    {
        id: "2",
        title: "Penthouse The Landmark",
        location: "Bình Thạnh, TP.HCM",
        type: "Căn hộ",
        price: 18.2,
        area: 155,
        beds: 3,
        baths: 3,
        coordinates: [10.7952, 106.7216],
        images: [
            "https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=800&q=80"
        ],
        video: "",
        legal: "Sổ hồng",
        description: "Căn góc đẹp nhất tòa tháp Landmark, ngắm toàn cảnh trung tâm thành phố và sông Sài Gòn. Layout cực kì hợp lý, tận dụng ánh sáng tự nhiên."
    },
    {
        id: "3",
        title: "Nhà phố thương mại Sala",
        location: "KĐT Thủ Thiêm, Quận 2",
        type: "Nhà phố",
        price: 32.0,
        area: 210,
        beds: 5,
        baths: 6,
        coordinates: [10.7709, 106.7206],
        images: [
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1600607687931-cebf10c73284?auto=format&fit=crop&w=800&q=80"
        ],
        video: "https://www.youtube.com/embed/Scxs7L0vhZ4",
        legal: "Sổ hổng",
        description: "Shophouse hai mặt tiền trục đường chính khu đô thị cao cấp Sala. Vị trí kinh doanh đắc địa, dân cư đông đúc. Đang có hợp đồng thuê."
    },
    {
        id: "4",
        title: "Căn hộ Vinhomes Central Park",
        location: "Bình Thạnh, TP.HCM",
        type: "Căn hộ",
        price: 5.5,
        area: 75,
        beds: 2,
        baths: 2,
        coordinates: [10.7966, 106.7206],
        images: [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502672260266-1c1c24240f38?auto=format&fit=crop&w=800&q=80"
        ],
        video: "",
        legal: "Hợp đồng mua bán",
        description: "Căn hộ tiêu chuẩn Vinhomes Central Park, hưởng trọn công viên ven sông 14ha. Bàn giao đầy đủ nội thất cao cấp."
    },
    {
        id: "5",
        title: "Dinh thự Riviera",
        location: "Quận 2, TP.HCM",
        type: "Biệt thự",
        price: 85.0,
        area: 500,
        beds: 6,
        baths: 7,
        coordinates: [10.8115, 106.7450],
        images: [
            "https://images.unsplash.com/photo-1600607687931-cebf10c73284?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1628108139589-9a700da9890a?auto=format&fit=crop&w=800&q=80"
        ],
        video: "https://www.youtube.com/embed/Scxs7L0vhZ4",
        legal: "Sổ hồng riêng",
        description: "Siêu dinh thự rộng 500 mét vuông khu compound khép kín biệt lập hoàn toàn. Sống tận hưởng sự đẳng cấp với hồ bơi hoàng gia trong nhà."
    }
];

const el = {
    mapContainer: document.getElementById("results-map"),
    emptyState: document.getElementById("empty-state"),
    keywordInput: document.getElementById("filter-keyword"),
    searchButton: document.getElementById("run-search-button"),
    mobileKeywordInput: document.getElementById("filter-keyword-mobile"),
    mobileSearchButton: document.getElementById("run-search-mobile-button"),
    manualPlaceInput: document.getElementById("manual-place-input"),
    manualPlaceButton: document.getElementById("manual-place-button"),
    filterType: document.getElementById("filter-type"),
    filterPrice: document.getElementById("filter-price"),
    filterArea: document.getElementById("filter-area"),
    filterDirection: document.getElementById("filter-direction"),
    filterBeds: document.getElementById("filter-beds"),
    filterBaths: document.getElementById("filter-baths"),
    toggleZoning: document.getElementById("toggle-zoning"),
    mapResultsStatus: document.getElementById("map-results-status"),
    mapResultsCount: document.getElementById("map-results-count"),
    fitResultsButton: document.getElementById("fit-results-button")
};

el.filterLegal = document.getElementById("filter-legal");
el.filterAdminUnit = document.getElementById("filter-admin-unit");
el.sortBy = document.getElementById("sort-by");
el.showFavorites = document.getElementById("show-favorites");
el.installAppButton = document.getElementById("install-app-button");
el.leadForm = document.getElementById("lead-form");
el.leadMessage = document.getElementById("lead-message");
el.quickAreaButtons = document.querySelectorAll(".quick-area-bar button");
el.smartSearchHint = document.getElementById("smart-search-hint");
el.toggleFilters = document.getElementById("toggle-filters");
el.openAdvancedPanel = document.getElementById("open-advanced-panel");
el.marketDarkMode = document.getElementById("market-dark-mode");
el.filterPanel = document.getElementById("advanced-filters");
el.toolbar = document.querySelector(".floating-ui-wrap");
el.clearFiltersButton = document.getElementById("clear-filters-button");
el.mobileListingPreview = document.getElementById("mobile-listing-preview");

async function init() {
    initTheme();
    initMap();
    await loadData();
    bindEvents();
    updateCompareFab();
}

function initTheme() {
    const enabled = localStorage.getItem("ndv_dark_mode") === "1";
    document.body.classList.toggle("dark-mode", enabled);
    updateThemeButtons();
}

function updateThemeButtons() {
    const enabled = document.body.classList.contains("dark-mode");
    if (el.marketDarkMode) {
        el.marketDarkMode.textContent = enabled ? "Sáng" : "Tối";
        el.marketDarkMode.classList.toggle("active", enabled);
    }
    const headerButton = document.getElementById("toggle-dark-mode");
    if (headerButton) headerButton.textContent = enabled ? "☀ Giao diện" : "🌙 Giao diện";
}

window.toggleDarkMode = function() {
    const enabled = !document.body.classList.contains("dark-mode");
    document.body.classList.toggle("dark-mode", enabled);
    localStorage.setItem("ndv_dark_mode", enabled ? "1" : "0");
    updateThemeButtons();
};

async function loadData() {
    try {
        if (window.NDV_SUPABASE && await window.NDV_SUPABASE.init()) {
            state.listings = await window.NDV_SUPABASE.getListings();
            state.site = await window.NDV_SUPABASE.getSite();
            return await finishLoadData();
        }
        const res = await fetch("/api/listings", {credentials: "same-origin"});
        if (res.ok) {
            const data = await res.json();
            state.listings = data.listings || [];
            state.site = data.site || null;
            setCachedJSON("/api/listings", data);
        } else {
            throw new Error();
        }
    } catch {
        try {
            const listings = await fetchJSONWithCache("/data/listings.json?v=49", []);
            state.listings = Array.isArray(listings) ? listings : [];
        } catch {
            state.listings = DUMMY_LISTINGS;
        }

        try {
            state.site = await fetchJSONWithCache("/data/site.json?v=49", null);
        } catch {
            state.site = null;
        }
    }

    await finishLoadData();
}

async function finishLoadData() {
    await loadAdminUnits();
    await loadRoadPriceTable();
    
    state.exactMatches = [...state.listings];
    state.suggestedMatches = [];
    state.filteredListings = [...state.listings];
    state.visibleListCount = LIST_PAGE_SIZE;
    
    applySiteSettings();
    updateStructuredData();
    populateFilters();
    populateSearchSuggestions();
    renderMapMarkers({ fitBounds: true, animate: false });
    openListingFromHash();
    setTimeout(() => state.map && state.map.invalidateSize(), 250);
}

async function fetchJSONWithCache(url, fallback = null, ttl = DATA_CACHE_TTL) {
    const cached = getCachedJSON(url, ttl);
    try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCachedJSON(url, data);
        return data;
    } catch (error) {
        if (cached !== null) return cached;
        return fallback;
    }
}

function getCachedJSON(key, ttl = DATA_CACHE_TTL) {
    try {
        const raw = localStorage.getItem(DATA_CACHE_PREFIX + key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || Date.now() - Number(cached.time || 0) > ttl) return null;
        return cached.data;
    } catch {
        return null;
    }
}

function setCachedJSON(key, data) {
    try {
        localStorage.setItem(DATA_CACHE_PREFIX + key, JSON.stringify({ time: Date.now(), data }));
    } catch (error) {}
}

async function loadAdminUnits() {
    try {
        const data = await fetchJSONWithCache("/data/gia-lai-units.json?v=3", { units: [] });
        state.adminUnits = Array.isArray(data.units) ? data.units : [];
    } catch {
        state.adminUnits = [];
    }
}

async function loadRoadPriceTable() {
    try {
        const data = await fetchJSONWithCache("/data/road-prices.json?v=1", { roads: DEFAULT_ROAD_PRICE_TABLE });
        const roads = Array.isArray(data?.roads) ? data.roads : [];
        state.roadPriceTable = roads
            .map((road) => ({
                name: String(road.name || road.road || "").trim(),
                area: String(road.area || "").trim(),
                price: Number(road.priceMillionPerM2 || road.price || 0),
                keys: Array.isArray(road.keys)
                    ? road.keys.map(normalizeSearchText).filter(Boolean)
                    : [road.name, road.road, ...(road.aliases || [])].map(normalizeSearchText).filter(Boolean)
            }))
            .filter((road) => road.price > 0 && road.keys.length > 0);
        if (!state.roadPriceTable.length) state.roadPriceTable = DEFAULT_ROAD_PRICE_TABLE;
    } catch {
        state.roadPriceTable = DEFAULT_ROAD_PRICE_TABLE;
    }
}

function applySiteSettings() {
    if (!state.site) return;
    const logoText = document.querySelector(".logo-text");
    if (logoText) logoText.textContent = state.site.brandName || "Nhà Đất Việt";
    document.title = `${state.site.brandName || "Nhà Đất Việt"} | Bản đồ bất động sản`;
}

function listingUrl(id) {
    return `${window.location.origin}${window.location.pathname}#${encodeURIComponent(id)}`;
}

function openListingFromHash() {
    const id = decodeURIComponent(window.location.hash.replace("#", ""));
    if (!id) return;
    const exists = state.listings.some((listing) => String(listing.id) === id);
    if (exists) {
        setTimeout(() => window.openFullscreenModal(id), 250);
    }
}

function updateStructuredData() {
    const oldScript = document.getElementById("listings-jsonld");
    if (oldScript) oldScript.remove();

    const graph = state.listings.slice(0, 20).map((listing) => ({
        "@type": "RealEstateListing",
        "@id": listingUrl(listing.id),
        "url": listingUrl(listing.id),
        "name": listing.title,
        "description": listing.description,
        "image": listing.images?.length ? listing.images : [listing.image || FALLBACK_IMAGE],
        "datePosted": listing.updatedAt || listing.createdAt || new Date().toISOString(),
        "offers": {
            "@type": "Offer",
            "priceCurrency": "VND",
            "price": Number(listing.price || 0) * 1000000000,
            "availability": "https://schema.org/InStock"
        },
        "floorSize": {
            "@type": "QuantitativeValue",
            "value": Number(listing.area || 0),
            "unitCode": "MTK"
        }
    }));

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "listings-jsonld";
    script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": graph
    });
    document.head.appendChild(script);
}

function populateFilters() {
    const selected = el.filterType.value || "all";
    el.filterType.innerHTML = '<option value="all">Loại nhà đất</option>';
    const types = [...new Set(state.listings.map(l => l.type))].filter(Boolean);
    types.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        el.filterType.appendChild(opt);
    });
    el.filterType.value = types.includes(selected) ? selected : "all";
    populateAdminUnits();
    syncPrimaryFilterState();
}

function populateSearchSuggestions() {
    const datalist = document.getElementById("search-suggestions");
    if (!datalist) return;

    const commonRoads = [
        "Trường Chinh", "Võ Nguyên Giáp", "Lê Duẩn", "Phạm Văn Đồng", "Nguyễn Tất Thành",
        "Hùng Vương", "Cách Mạng Tháng Tám", "Nguyễn Văn Cừ", "Tôn Đức Thắng",
        "Bùi Dự", "Biển Hồ", "Ia Grai", "Đak Đoa", "Chư Sê", "Quy Nhơn", "An Khê"
    ];
    const fromListings = state.listings.flatMap((listing) => [
        listing.location,
        listing.address,
        listing.title,
        listing.type
    ]);
    const fromUnits = state.adminUnits.flatMap((unit) => [unit.label, unit.name]);
    const suggestions = [...new Set([...commonRoads, ...fromUnits, ...fromListings]
        .map((item) => String(item || "").trim())
        .filter((item) => item.length >= 3))]
        .sort((a, b) => a.localeCompare(b, "vi"))
        .slice(0, 160);

    datalist.innerHTML = suggestions.map((item) => `<option value="${escapeAttr(item)}"></option>`).join("");
}

function populateAdminUnits() {
    if (!el.filterAdminUnit) return;

    const selected = el.filterAdminUnit.value || "all";
    el.filterAdminUnit.innerHTML = '<option value="all">Toàn tỉnh Gia Lai mới</option>';
    const sortedUnits = [...state.adminUnits].sort((a, b) => a.label.localeCompare(b.label, "vi"));
    sortedUnits.forEach((unit) => {
        const opt = document.createElement("option");
        opt.value = unit.name;
        opt.textContent = unit.label;
        el.filterAdminUnit.appendChild(opt);
    });
    el.filterAdminUnit.value = state.adminUnits.some((unit) => unit.name === selected) ? selected : "all";
    syncPrimaryFilterState();
}

function getSelectText(select) {
    return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function getPriceFilterText() {
    const value = el.filterPrice?.value || "all";
    return value === "all" ? "" : getSelectText(el.filterPrice);
}

function getTypeFilterText() {
    const value = el.filterType?.value || "all";
    return value === "all" ? "" : getSelectText(el.filterType);
}

function getActiveFilterSummary() {
    const parts = [];
    if (state.selectedAdminUnit?.label) parts.push(state.selectedAdminUnit.label);
    [el.filterType, el.filterPrice, el.filterArea, el.filterDirection, el.filterBeds, el.filterBaths, el.filterLegal]
        .filter(Boolean)
        .forEach((select) => {
            if (select.value !== "all") parts.push(getSelectText(select));
        });
    if (state.showFavoritesOnly) parts.push("Tin đã lưu");
    return parts.join(" • ");
}

function getKeywordValue() {
    const mobileValue = el.mobileKeywordInput?.value || "";
    const desktopValue = el.keywordInput?.value || "";
    const manualValue = el.manualPlaceInput?.value || "";
    return (manualValue || mobileValue || desktopValue).trim();
}

function setKeywordValue(value) {
    const next = String(value || "");
    if (el.keywordInput && el.keywordInput.value !== next) el.keywordInput.value = next;
    if (el.mobileKeywordInput && el.mobileKeywordInput.value !== next) el.mobileKeywordInput.value = next;
    if (el.manualPlaceInput && el.manualPlaceInput.value !== next) el.manualPlaceInput.value = next;
}

function clearQuickAreaSelection() {
    state.selectedAreaCenter = null;
    el.quickAreaButtons.forEach((item) => item.classList.remove("active"));
}

function syncPrimaryFilterState() {
    const primaryFilters = [el.filterAdminUnit, el.filterType, el.filterPrice].filter(Boolean);
    const advancedFilters = [el.filterArea, el.filterDirection, el.filterBeds, el.filterBaths, el.filterLegal, el.sortBy].filter(Boolean);
    primaryFilters.forEach((select) => {
        select.classList.toggle("active-filter", select.value !== "all");
    });
    advancedFilters.forEach((select) => {
        const isSort = select === el.sortBy;
        select.classList.toggle("active-filter", isSort ? select.value !== "recommended" : select.value !== "all");
    });
    const hasActiveFilter = primaryFilters.some((select) => select.value !== "all")
        || advancedFilters.some((select) => select === el.sortBy ? select.value !== "recommended" : select.value !== "all")
        || state.showFavoritesOnly
        || Boolean(getKeywordValue());
    el.clearFiltersButton?.classList.toggle("hidden", !hasActiveFilter);
}

function bindEvents() {
    [el.filterType, el.filterPrice, el.filterArea, el.filterDirection, el.filterBeds, el.filterBaths, el.filterLegal, el.filterAdminUnit, el.sortBy]
        .filter(Boolean)
        .forEach(f => f.addEventListener("change", () => {
            if (f === el.filterAdminUnit) state.selectedAreaCenter = null;
            applyFilters();
        }));
    let timer;
    const bindKeywordInput = (input, mirror) => {
        if (!input) return;
        input.addEventListener("input", () => {
            clearQuickAreaSelection();
            if (mirror) setKeywordValue(input.value);
            clearTimeout(timer);
            timer = setTimeout(applyFilters, 300);
        });
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                clearTimeout(timer);
                if (mirror) setKeywordValue(input.value);
                applyFilters();
            }
        });
    };
    bindKeywordInput(el.keywordInput, true);
    bindKeywordInput(el.mobileKeywordInput, true);
    bindKeywordInput(el.manualPlaceInput, true);
    if (el.searchButton) {
        el.searchButton.addEventListener("click", () => {
            clearQuickAreaSelection();
            setKeywordValue(el.keywordInput?.value || "");
            applyFilters();
        });
    }
    if (el.mobileSearchButton) {
        el.mobileSearchButton.addEventListener("click", () => {
            clearQuickAreaSelection();
            setKeywordValue(el.mobileKeywordInput?.value || "");
            applyFilters();
        });
    }
    if (el.manualPlaceButton) {
        el.manualPlaceButton.addEventListener("click", () => {
            clearQuickAreaSelection();
            setKeywordValue(el.manualPlaceInput?.value || "");
            applyFilters();
        });
    }
    if (el.toggleFilters && el.filterPanel) {
        el.toggleFilters.addEventListener("click", () => {
            const shouldOpen = el.filterPanel.classList.contains("hidden");
            el.filterPanel.classList.toggle("hidden", !shouldOpen);
            document.body.classList.toggle("advanced-filter-open", shouldOpen);
            el.toolbar?.classList.toggle("filters-open", shouldOpen);
            document.body.classList.toggle("filters-open", shouldOpen);
            el.toggleFilters.classList.toggle("active-filter", shouldOpen);
            el.toggleFilters.setAttribute("aria-expanded", String(shouldOpen));
            el.toggleFilters.textContent = shouldOpen ? "✕ Bộ lọc" : "⚙ Bộ lọc";
            setTimeout(() => state.map && state.map.invalidateSize(), 160);
        });
    }
    if (el.openAdvancedPanel) {
        el.openAdvancedPanel.addEventListener("click", () => {
            const shouldOpen = !document.body.classList.contains("advanced-filter-open");
            document.body.classList.toggle("advanced-filter-open", shouldOpen);
            document.body.classList.toggle("filters-open", shouldOpen);
            el.toolbar?.classList.toggle("filters-open", shouldOpen);
            el.openAdvancedPanel.classList.toggle("active", shouldOpen);
            el.openAdvancedPanel.textContent = shouldOpen ? "Gọn lại" : "Lọc thêm";
            if (el.filterPanel) el.filterPanel.classList.remove("hidden");
            setTimeout(() => state.map && state.map.invalidateSize(), 160);
        });
    }
    if (el.marketDarkMode) {
        el.marketDarkMode.addEventListener("click", () => window.toggleDarkMode());
    }
    el.quickAreaButtons.forEach((button) => {
        button.addEventListener("click", () => {
            el.quickAreaButtons.forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            setKeywordValue(button.dataset.areaKeyword || "");
            const lat = Number(button.dataset.lat);
            const lng = Number(button.dataset.lng);
            state.selectedAreaCenter = !Number.isNaN(lat) && !Number.isNaN(lng)
                ? {
                    label: button.dataset.areaLabel || button.textContent.trim(),
                    description: button.dataset.areaDescription || "",
                    center: [lat, lng]
                }
                : null;
            if (el.filterAdminUnit) {
                const adminUnit = button.dataset.adminUnit || "all";
                el.filterAdminUnit.value = state.adminUnits.some((unit) => unit.name === adminUnit) ? adminUnit : "all";
            }
            applyFilters();
            if (state.map && !Number.isNaN(lat) && !Number.isNaN(lng) && state.filteredListings.length === 0) {
                fitCoordinatesOnMap([[lat, lng]], { animate: true });
            }
        });
    });
    if (el.fitResultsButton) {
        el.fitResultsButton.addEventListener("click", () => fitMapToFilteredResults({ animate: true }));
    }

    if (el.clearFiltersButton) {
        el.clearFiltersButton.addEventListener("click", () => {
            if (el.filterAdminUnit) el.filterAdminUnit.value = "all";
            if (el.filterType) el.filterType.value = "all";
            if (el.filterPrice) el.filterPrice.value = "all";
            if (el.filterArea) el.filterArea.value = "all";
            if (el.filterDirection) el.filterDirection.value = "all";
            if (el.filterBeds) el.filterBeds.value = "all";
            if (el.filterBaths) el.filterBaths.value = "all";
            if (el.filterLegal) el.filterLegal.value = "all";
            if (el.sortBy) el.sortBy.value = "recommended";
            state.showFavoritesOnly = false;
            state.selectedAreaCenter = null;
            setKeywordValue("");
            el.quickAreaButtons.forEach((item) => item.classList.remove("active"));
            el.showFavorites?.classList.remove("active-filter");
            applyFilters();
        });
    }

    if (el.showFavorites) {
        el.showFavorites.addEventListener("click", () => {
            state.showFavoritesOnly = !state.showFavoritesOnly;
            el.showFavorites.classList.toggle("active-filter", state.showFavoritesOnly);
            applyFilters();
        });
    }

    if (el.leadForm) {
        el.leadForm.addEventListener("submit", handleLeadSubmit);
    }

    window.addEventListener("hashchange", openListingFromHash);
    setupInstallPrompt();
    registerServiceWorker();
    
    if (el.toggleZoning) {
        el.toggleZoning.addEventListener("click", () => {
            state.isZoningActive = !state.isZoningActive;
            if (state.isZoningActive) {
                el.toggleZoning.classList.add("active");
                renderZoning();
            } else {
                el.toggleZoning.classList.remove("active");
                clearZoning();
            }
        });
    }
    
    // 2026 Upgrades Events - 3 Gallery Tabs
    const tabPhotos = document.getElementById("tab-photos");
    const tabStreetview = document.getElementById("tab-streetview");
    const tab3d = document.getElementById("tab-3d");
    const modalGallery = document.getElementById("modal-gallery");
    const modalStreetview = document.getElementById("modal-streetview");
    const modal3d = document.getElementById("modal-3d");
    const iframe3d = document.getElementById("iframe-3d");
    const iframeStreetview = document.getElementById("iframe-streetview");
    const allTabs = [tabPhotos, tabStreetview, tab3d].filter(Boolean);
    const allPanels = [modalGallery, modalStreetview, modal3d].filter(Boolean);
    
    function activateGalleryTab(activeTab, activePanel) {
        allTabs.forEach(t => t.classList.remove("active"));
        allPanels.forEach(p => p.classList.add("hidden"));
        if (activeTab) activeTab.classList.add("active");
        if (activePanel) activePanel.classList.remove("hidden");
        
        const btnPrev = document.getElementById("gallery-prev");
        const btnNext = document.getElementById("gallery-next");
        const isPhotos = activeTab === tabPhotos;
        if (btnPrev) btnPrev.style.display = isPhotos ? "flex" : "none";
        if (btnNext) btnNext.style.display = isPhotos ? "flex" : "none";
    }
    
    if (tabPhotos) {
        tabPhotos.addEventListener("click", () => activateGalleryTab(tabPhotos, modalGallery));
    }
    
    if (tabStreetview) {
        tabStreetview.addEventListener("click", () => {
            const listing = state.listings.find(l => l.id === state.currentListingId);
            if (!listing || !hasStreetViewCandidate(listing)) {
                activateGalleryTab(tabPhotos, modalGallery);
                showSmartHint("Khu vực này chưa có dữ liệu 360° ổn định, đã chuyển về ảnh thường.");
                return;
            }
            activateGalleryTab(tabStreetview, modalStreetview);
            loadStreetView(listing);
        });
    }
    
    if (tab3d) {
        tab3d.addEventListener("click", () => {
            activateGalleryTab(tab3d, modal3d);
            if (iframe3d && !iframe3d.getAttribute("src")) {
                const dataSrc = iframe3d.getAttribute("data-src");
                if (dataSrc) iframe3d.setAttribute("src", dataSrc);
            }
        });
    }

    const btnPrev = document.getElementById("gallery-prev");
    const btnNext = document.getElementById("gallery-next");
    if (btnPrev && btnNext) {
        btnPrev.addEventListener("click", () => {
            if (modalGallery) modalGallery.scrollBy({ left: -modalGallery.offsetWidth, behavior: 'smooth' });
        });
        btnNext.addEventListener("click", () => {
            if (modalGallery) modalGallery.scrollBy({ left: modalGallery.offsetWidth, behavior: 'smooth' });
        });
    }

    const dpSlider = document.getElementById("dp-slider");
    const dpLabel = document.getElementById("dp-label");
    const irSlider = document.getElementById("ir-slider");
    const irLabel = document.getElementById("ir-label");
    const bankSelector = document.getElementById("bank-selector");
    
    function updateMortgage() {
        if (dpSlider && irSlider) {
            dpLabel.textContent = dpSlider.value + "%";
            irLabel.textContent = parseFloat(irSlider.value).toFixed(1) + "%/năm";
            
            if (bankSelector) {
                let match = Array.from(bankSelector.options).find(opt => Number(opt.value) === Number(irSlider.value));
                if (match) bankSelector.value = match.value;
                else bankSelector.value = "9"; // Custom
            }
            
            calculateMortgage(dpSlider.value, irSlider.value);
        }
    }
    
    if (dpSlider) dpSlider.addEventListener("input", updateMortgage);
    if (irSlider) irSlider.addEventListener("input", updateMortgage);
    
    if (bankSelector && irSlider) {
        bankSelector.addEventListener("change", (e) => {
            irSlider.value = e.target.value;
            updateMortgage();
        });
    }
    
    // Popup events to highlight related markers (RED)
    if (state.map) {
        state.map.on('popupopen', function(e) {
            const layer = e.popup._source;
            const activeMarkerData = state.markers.find(m => m.layer === layer);
            if (!activeMarkerData) return;
            
            const activeListing = state.listings.find(l => l.id === activeMarkerData.id);
            if (!activeListing) return;
            
            // Recommend related properties while viewing details
            const relatedIds = state.listings.filter(l => 
                l.id !== activeListing.id && 
                (l.type === activeListing.type || Math.abs(l.price - activeListing.price) / activeListing.price <= 0.3)
            ).map(l => l.id);
            
            state.markers.forEach(m => {
                const dom = document.getElementById(`marker-${m.id}`);
                if (!dom) return;
                // Only pulsate red if it's related and not currently selected
                if (relatedIds.includes(m.id) && m.id !== activeMarkerData.id) {
                    dom.classList.add('suggested-marker');
                } else {
                    dom.classList.remove('suggested-marker');
                }
            });
        });

        state.map.on('popupclose', function(e) {
            // Remove red highlights (unless they were from search suggestions)
            state.markers.forEach(m => {
                const dom = document.getElementById(`marker-${m.id}`);
                if (dom) {
                    // Only remove if it wasn't natively a suggested match from the search filter
                    const isSuggestedSearch = state.suggestedMatches.find(sm => sm.id === m.id);
                    if (!isSuggestedSearch) {
                        dom.classList.remove('suggested-marker');
                    }
                }
            });
            
            // Stop video
            const popupEl = e.popup.getElement();
            if(popupEl) {
                const iframes = popupEl.querySelectorAll('iframe');
                iframes.forEach(ifr => ifr.src = '');
            }
        });
    }
}

function setupInstallPrompt() {
    if (!el.installAppButton) return;
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        el.installAppButton.classList.remove("hidden");
    });
    el.installAppButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
        el.installAppButton.classList.add("hidden");
    });
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    });
}

async function handleLeadSubmit(event) {
    event.preventDefault();
    const listing = state.listings.find((item) => item.id === state.currentListingId);
    const formData = new FormData(el.leadForm);
    const payload = {
        listingId: listing?.id || "",
        listingTitle: listing?.title || "",
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        need: String(formData.get("need") || "").trim(),
        source: "property-detail"
    };

    el.leadMessage.className = "lead-message";
    el.leadMessage.textContent = "Đang gửi...";

    try {
        const response = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Không gửi được yêu cầu.");
        el.leadForm.reset();
        el.leadMessage.classList.add("ok");
        el.leadMessage.textContent = "Đã lưu khách. Admin có thể xem trong trang quản trị.";
    } catch (error) {
        el.leadMessage.classList.add("error");
        el.leadMessage.textContent = error.message;
    }
}

function normalizeSearchText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function getSelectedAdminUnit() {
    const selected = el.filterAdminUnit?.value || "all";
    if (selected === "all") return null;
    return state.adminUnits.find((unit) => unit.name === selected) || null;
}

function getAdminUnitTokens(unit) {
    if (!unit) return [];
    return [unit.name, unit.label, unit.oldText, ...(unit.aliases || [])]
        .map(normalizeSearchText)
        .filter((token) => token.length >= 2);
}

function getListingSearchBlob(listing) {
    return normalizeSearchText([
        listing.title,
        listing.location,
        listing.type,
        listing.legal,
        listing.description,
        listing.direction,
        listing.landUse,
        listing.planningStatus,
        listing.bankLoan,
        listing.adminUnit,
        listing.ward,
        listing.commune,
        listing.district,
        listing.province
    ].join(" "));
}

function listingMatchesAdminUnit(listing, unit) {
    if (!unit) return true;
    const blob = getListingSearchBlob(listing);
    return getAdminUnitTokens(unit).some((token) => blob.includes(token));
}

function listingMatchesKeyword(listing, normalizedKeyword) {
    if (!normalizedKeyword) return true;
    const blob = getListingSearchBlob(listing);
    if (blob.includes(normalizedKeyword)) return true;
    const tokens = normalizedKeyword.split(" ").filter((token) => token.length > 1);
    return tokens.length > 0 && tokens.every((token) => blob.includes(token));
}

function scoreListingForSearch(listing, normalizedKeyword, adminUnit) {
    const title = normalizeSearchText(listing.title);
    const location = normalizeSearchText(listing.location);
    const blob = getListingSearchBlob(listing);
    let score = 0;

    if (adminUnit && listingMatchesAdminUnit(listing, adminUnit)) score += 90;
    if (normalizedKeyword) {
        if (title.includes(normalizedKeyword)) score += 45;
        if (location.includes(normalizedKeyword)) score += 38;
        if (blob.includes(normalizedKeyword)) score += 25;
        const keywordTokens = normalizedKeyword.split(" ").filter((token) => token.length > 1);
        const matchedTokenCount = keywordTokens.filter((token) => blob.includes(token)).length;
        if (keywordTokens.length <= 1 || matchedTokenCount === keywordTokens.length) {
            keywordTokens.forEach((token) => {
                if (title.includes(token)) score += 8;
                else if (location.includes(token)) score += 6;
                else if (blob.includes(token)) score += 3;
            });
        }
    }

    score += getBehaviorRecommendationScore(listing);
    return score;
}

function getBehaviorRecommendationScore(listing) {
    if (!state.viewedListingIds.length) return 0;
    const viewed = state.viewedListingIds
        .slice(-12)
        .map((id) => state.listings.find((item) => String(item.id) === String(id)))
        .filter(Boolean);
    if (!viewed.length) return 0;

    return viewed.reduce((score, viewedItem) => {
        if (String(viewedItem.id) === String(listing.id)) return score + 4;
        if (viewedItem.type && viewedItem.type === listing.type) score += 8;
        const viewedPrice = Number(viewedItem.price || 0);
        const price = Number(listing.price || 0);
        if (viewedPrice > 0 && price > 0 && Math.abs(price - viewedPrice) / viewedPrice <= 0.25) score += 10;
        const viewedUnitPrice = pricePerM2Number(viewedItem);
        const unitPrice = pricePerM2Number(listing);
        if (viewedUnitPrice > 0 && unitPrice > 0 && Math.abs(unitPrice - viewedUnitPrice) / viewedUnitPrice <= 0.2) score += 9;
        const viewedText = normalizeSearchText(`${viewedItem.location || ""} ${viewedItem.adminUnit || ""}`);
        const text = normalizeSearchText(`${listing.location || ""} ${listing.adminUnit || ""}`);
        if (viewedText && text && viewedText.split(" ").some((token) => token.length > 3 && text.includes(token))) score += 5;
        return score;
    }, 0);
}

function updateSmartSearchHint() {
    if (!el.smartSearchHint) return;
    const unit = state.selectedAdminUnit;
    const quickArea = state.selectedAreaCenter;
    const keyword = getKeywordValue();

    if (!unit && !quickArea && !keyword) {
        el.smartSearchHint.classList.add("hidden");
        el.smartSearchHint.textContent = "";
        return;
    }

    const parts = [];
    if (unit) {
        const oldArea = unit.oldText ? ` gồm địa bàn cũ: ${unit.oldText}` : "";
        parts.push(`Đang lọc ${unit.label}${oldArea}.`);
        if (state.exactMatches.length === 0 && getAdminUnitCenter(unit)) {
            parts.push("Chưa có tin tại khu vực này, bản đồ đang đưa về tâm xã/phường để anh dễ định vị.");
        }
    }
    if (!unit && quickArea) {
        const desc = quickArea.description ? ` ${quickArea.description}` : "";
        parts.push(`Đang xem ${quickArea.label}.${desc}`);
        if (state.exactMatches.length === 0 && getQuickAreaCenter(quickArea)) {
            parts.push("Chưa có tin tại khu này, bản đồ đang đưa về tâm khu vực.");
        }
    }
    if (keyword) parts.push(`Từ khóa "${keyword}" được tìm không phân biệt dấu.`);
    if (state.exactMatches.length === 0 && state.suggestedMatches.length > 0) {
        parts.push("Chưa có tin đúng khu vực, hệ thống đang gợi ý các tin gần nhất theo bộ lọc.");
    }

    el.smartSearchHint.textContent = parts.join(" ");
    el.smartSearchHint.classList.remove("hidden");
}

function showSmartHint(message, timeout = 4200) {
    if (!el.smartSearchHint) return;
    el.smartSearchHint.textContent = message;
    el.smartSearchHint.classList.remove("hidden");
    window.clearTimeout(showSmartHint._timer);
    showSmartHint._timer = window.setTimeout(() => {
        updateSmartSearchHint();
    }, timeout);
}

function applyFilters() {
    const typ = el.filterType.value;
    const prc = el.filterPrice.value;
    const areaRange = el.filterArea?.value || "all";
    const direction = el.filterDirection?.value || "all";
    const beds = el.filterBeds.value;
    const baths = el.filterBaths.value;
    const legal = el.filterLegal?.value || "all";
    const kw = getKeywordValue();
    setKeywordValue(kw);
    const normalizedKeyword = normalizeSearchText(kw);
    const adminUnit = getSelectedAdminUnit();
    state.selectedAdminUnit = adminUnit;
    state.searchScores = new Map();
    syncPrimaryFilterState();

    const baseMatches = state.listings.filter(l => {
        const mTyp = typ === "all" || l.type === typ;
        const mPrc = prc === "all" || checkPrice(Number(l.price), prc);
        const mArea = areaRange === "all" || checkArea(Number(l.area), areaRange);
        const mDirection = direction === "all" || normalizeSearchText(l.direction).includes(normalizeSearchText(direction));
        const mBeds = beds === "all" || l.beds >= Number(beds);
        const mBaths = baths === "all" || l.baths >= Number(baths);
        const mLegal = legal === "all" || String(l.legal || "").toLowerCase().includes(legal.toLowerCase());
        const mFavorite = !state.showFavoritesOnly || state.savedFavorites.includes(String(l.id));
        return mTyp && mPrc && mArea && mDirection && mBeds && mBaths && mLegal && mFavorite;
    });

    state.exactMatches = baseMatches.filter(l => {
        const mKw = listingMatchesKeyword(l, normalizedKeyword);
        const mAdmin = listingMatchesAdminUnit(l, adminUnit);
        if (mKw && mAdmin) {
            state.searchScores.set(String(l.id), scoreListingForSearch(l, normalizedKeyword, adminUnit));
        }
        return mKw && mAdmin;
    });

    state.suggestedMatches = [];
    
    const isSearching = normalizedKeyword !== "" || Boolean(adminUnit) || typ !== "all" || prc !== "all" || areaRange !== "all" || direction !== "all" || beds !== "all" || baths !== "all" || legal !== "all" || state.showFavoritesOnly;
    if (isSearching && state.exactMatches.length > 0 && state.exactMatches.length < baseMatches.length) {
        const exactIds = new Set(state.exactMatches.map((item) => String(item.id)));
        const related = baseMatches
            .filter((item) => !exactIds.has(String(item.id)))
            .map((item) => {
                let score = scoreListingForSearch(item, normalizedKeyword, null);
                if (state.exactMatches.some((match) => match.type === item.type)) score += 12;
                if (state.exactMatches.some((match) => Number(match.price) > 0 && Math.abs(Number(item.price || 0) - Number(match.price)) / Number(match.price) <= 0.25)) score += 8;
                if (adminUnit && state.exactMatches.length === 0) score += 1;
                return { item, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);

        state.suggestedMatches = related.slice(0, adminUnit ? 8 : 3).map(({ item, score }) => {
            state.searchScores.set(String(item.id), score);
            return item;
        });
    }
    
    state.filteredListings = [...state.exactMatches, ...state.suggestedMatches];
    sortFilteredListings();
    state.visibleListCount = LIST_PAGE_SIZE;
    updateSmartSearchHint();
    if (isSearching) {
        trackEvent("SEARCH", {
            query: kw,
            summary: getActiveFilterSummary() || `${state.filteredListings.length} kết quả`
        });
    }
    
    renderMapMarkers({ fitBounds: true, animate: true });
}

function sortFilteredListings() {
    const sortBy = el.sortBy?.value || "recommended";
    if (sortBy === "recommended") {
        state.filteredListings.sort((a, b) => {
            const scoreDiff = (state.searchScores.get(String(b.id)) || 0) - (state.searchScores.get(String(a.id)) || 0);
            if (scoreDiff !== 0) return scoreDiff;
            const dateDiff = Date.parse(b.updatedAt || b.createdAt || "") - Date.parse(a.updatedAt || a.createdAt || "");
            return Number.isNaN(dateDiff) ? 0 : dateDiff;
        });
    }
    if (sortBy === "investment") {
        state.filteredListings.sort((a, b) => getInvestmentScore(b) - getInvestmentScore(a));
    }
    if (sortBy === "price-asc") {
        state.filteredListings.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === "price-desc") {
        state.filteredListings.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    if (sortBy === "area-desc") {
        state.filteredListings.sort((a, b) => Number(b.area || 0) - Number(a.area || 0));
    }
}

function getInvestmentScore(listing) {
    const asking = Number(listing.price || 0);
    const area = Number(listing.area || 0);
    const valuation = getListingValuation(listing);
    const pricePerM2 = asking > 0 && area > 0 ? (asking * 1000) / area : 9999;
    const discount = asking > 0 && valuation > 0 ? ((valuation - asking) / asking) * 100 : 0;
    const roadWidth = Number(listing.roadWidth || 0);
    const legalBonus = normalizeSearchText(listing.legal || "").includes("so") ? 12 : 0;
    return discount * 2 + Math.min(roadWidth, 16) + legalBonus - pricePerM2 / 5;
}

function checkPrice(price, range) {
    if (range === "under-1") return price > 0 && price < 1;
    if (range === "1-2") return price >= 1 && price <= 2;
    if (range === "2-3") return price > 2 && price <= 3;
    if (range === "3-5") return price > 3 && price <= 5;
    if (range === "under-5") return price < 5;
    if (range === "5-10") return price >= 5 && price <= 10;
    if (range === "10-20") return price > 10 && price <= 20;
    if (range === "10-plus") return price > 10;
    if (range === "20-plus") return price > 20;
    return true;
}

function checkArea(area, range) {
    if (range === "under-100") return area > 0 && area < 100;
    if (range === "100-300") return area >= 100 && area <= 300;
    if (range === "300-1000") return area > 300 && area <= 1000;
    if (range === "1000-plus") return area > 1000;
    return true;
}

function formatPrice(price) {
    return price % 1 === 0 ? price : price.toFixed(1);
}

function pricePerM2Number(listing) {
    const price = Number(listing?.price || 0);
    const area = Number(listing?.area || 0);
    return price > 0 && area > 0 ? (price * 1000) / area : 0;
}

function formatPricePerM2(listing) {
    const unitPrice = pricePerM2Number(listing);
    if (!unitPrice) return "Chưa rõ giá/m2";
    const millionPerM2 = Math.round(unitPrice);
    return `${millionPerM2.toLocaleString("vi-VN")} triệu/m2`;
}

function formatFact(value, suffix = "") {
    if (value === null || value === undefined || value === "") return "Chưa rõ";
    return `${value}${suffix}`;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
    return escapeHTML(value).replace(/'/g, "&#39;");
}

function safeMediaUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (url.startsWith("data:image/")) return url;
    try {
        const parsed = new URL(url, window.location.origin);
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
}

function optimizedImageUrl(value, width = 900, quality = 72) {
    const url = safeMediaUrl(value);
    if (!url || url.startsWith("data:image/")) return url;
    try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.hostname.includes("images.unsplash.com")) {
            parsed.searchParams.set("auto", "format");
            parsed.searchParams.set("fit", "crop");
            parsed.searchParams.set("w", String(width));
            parsed.searchParams.set("q", String(quality));
            return parsed.href;
        }
        return parsed.href;
    } catch {
        return url;
    }
}

function imageTag(src, className = "", alt = "", width = 900) {
    const optimized = optimizedImageUrl(src, width) || FALLBACK_IMAGE;
    const cls = className ? ` class="${escapeAttr(className)}"` : "";
    return `<img src="${escapeAttr(optimized)}"${cls} alt="${escapeAttr(alt)}" loading="lazy" decoding="async">`;
}

function isUploadedVideoUrl(value) {
    const url = String(value || "").trim();
    if (!url) return false;
    if (url.startsWith("/uploads/videos/")) return true;
    if (/\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url)) return true;
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.origin === window.location.origin && parsed.pathname.startsWith("/uploads/videos/");
    } catch {
        return false;
    }
}

function safeVideoUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("/uploads/videos/") && !raw.includes("..")) return raw;
    try {
        const parsed = new URL(raw, window.location.origin);
        if (parsed.origin === window.location.origin && parsed.pathname.startsWith("/uploads/videos/")) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
}

function getListingImageUrls(listing) {
    const rawImages = Array.isArray(listing?.images) && listing.images.length
        ? listing.images
        : [listing?.image];
    const images = rawImages.map((item) => optimizedImageUrl(item, 1200)).filter(Boolean);
    return images.length ? images : [FALLBACK_IMAGE];
}

function getListingCoordinates(listing) {
    if (!Array.isArray(listing.coordinates) || listing.coordinates.length !== 2) return null;
    const lat = Number(listing.coordinates[0]);
    const lng = Number(listing.coordinates[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    // Chỉ chấp nhận tọa độ nằm trong lãnh thổ Việt Nam (mở rộng)
    if (lat < 7 || lat > 24 || lng < 100 || lng > 115) return null;
    return [lat, lng];
}

function hasStreetViewCandidate(listing) {
    if (listing?.streetView === false || listing?.hasStreetView === false) return false;
    return Boolean(listing?.streetViewUrl || getListingCoordinates(listing));
}

function loadStreetView(listing) {
    const iframeStreetview = document.getElementById("iframe-streetview");
    if (!iframeStreetview) return false;

    try {
        const directUrl = safeMediaUrl(listing.streetViewUrl || "");
        const coords = getListingCoordinates(listing);
        if (!directUrl && !coords) return false;

        const svUrl = directUrl || `https://maps.google.com/maps?layer=c&cbll=${coords[0]},${coords[1]}&cbp=11,0,0,0,0&output=svembed&z=18`;
        iframeStreetview.dataset.loaded = "0";
        iframeStreetview.onload = () => {
            iframeStreetview.dataset.loaded = "1";
        };
        iframeStreetview.onerror = () => fallbackToPhotoTab("Không tải được Google Street View cho vị trí này.");
        if (iframeStreetview.src !== svUrl) iframeStreetview.src = svUrl;

        const openLink = document.getElementById("streetview-open-google");
        if (openLink && coords) {
            openLink.href = `https://www.google.com/maps/@${coords[0]},${coords[1]},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192`;
        }

        window.clearTimeout(loadStreetView._timer);
        loadStreetView._timer = window.setTimeout(() => {
            if (iframeStreetview.dataset.loaded !== "1") {
                fallbackToPhotoTab("Street View có thể chưa có ở khu vực này, đã chuyển về ảnh thường.");
            }
        }, 4500);
        return true;
    } catch {
        fallbackToPhotoTab("Không tải được Street View, đã chuyển về ảnh thường.");
        return false;
    }
}

function fallbackToPhotoTab(message) {
    document.getElementById("tab-photos")?.click();
    showSmartHint(message);
}

function getAdminUnitCenter(unit) {
    if (!unit || !Array.isArray(unit.center) || unit.center.length !== 2) return null;
    const lat = Number(unit.center[0]);
    const lng = Number(unit.center[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return [lat, lng];
}

function getQuickAreaCenter(area) {
    if (!area || !Array.isArray(area.center) || area.center.length !== 2) return null;
    const lat = Number(area.center[0]);
    const lng = Number(area.center[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return [lat, lng];
}

function isMobileViewport() {
    return window.matchMedia("(max-width: 768px)").matches;
}

function getMapFitOptions(animate = true) {
    const isMobile = isMobileViewport();
    return {
        paddingTopLeft: isMobile ? [24, 130] : [60, 140],
        paddingBottomRight: isMobile ? [24, 90] : [60, 80],
        maxZoom: 15,
        animate
    };
}

function fitCoordinatesOnMap(coords, { animate = true } = {}) {
    if (!state.map || typeof L === "undefined") return;
    if (coords.length === 0) return;

    const bounds = L.latLngBounds(coords);
    if (coords.length === 1) {
        const [lat, lng] = coords[0];
        bounds.extend([lat + 0.004, lng + 0.004]);
        bounds.extend([lat - 0.004, lng - 0.004]);
    }
    state.map.fitBounds(bounds, getMapFitOptions(animate));
}

function fitMapToFilteredResults({ animate = true } = {}) {
    const unitCenter = getAdminUnitCenter(state.selectedAdminUnit);
    if (unitCenter && state.selectedAdminUnit && state.exactMatches.length === 0) {
        fitCoordinatesOnMap([unitCenter], { animate });
        return;
    }

    const quickAreaCenter = getQuickAreaCenter(state.selectedAreaCenter);
    if (quickAreaCenter && state.exactMatches.length === 0) {
        fitCoordinatesOnMap([quickAreaCenter], { animate });
        return;
    }

    const coords = state.filteredListings.map(getListingCoordinates).filter(Boolean);
    if (coords.length > 0) {
        fitCoordinatesOnMap(coords, { animate });
        return;
    }

    if (unitCenter) {
        fitCoordinatesOnMap([unitCenter], { animate });
        return;
    }

    if (quickAreaCenter) {
        fitCoordinatesOnMap([quickAreaCenter], { animate });
    }
}

function getPopupOptions() {
    const isMobile = isMobileViewport();
    return {
        autoPan: true,
        autoPanPaddingTopLeft: isMobile ? [24, 140] : [60, 150],
        autoPanPaddingBottomRight: isMobile ? [24, 100] : [80, 90],
        maxWidth: 420
    };
}

function updateMapResultStatus(markerCount) {
    if (!el.mapResultsCount || !el.mapResultsStatus) return;
    const exactCount = state.exactMatches.length;
    const suggestedCount = state.suggestedMatches.length;
    const unitLabel = state.selectedAdminUnit?.label || "";
    const areaLabel = state.selectedAreaCenter?.label || "";
    const hasUnitCenter = Boolean(getAdminUnitCenter(state.selectedAdminUnit));
    const hasAreaCenter = Boolean(getQuickAreaCenter(state.selectedAreaCenter));
    const filterSummary = getActiveFilterSummary();

    el.mapResultsStatus.classList.toggle("is-empty", markerCount === 0);
    if (el.fitResultsButton) el.fitResultsButton.disabled = markerCount === 0 && !hasUnitCenter && !hasAreaCenter;
    if (markerCount === 0) {
        if (filterSummary) {
            el.mapResultsCount.textContent = `Chưa có tin khớp ${filterSummary}`;
            return;
        }
        if (unitLabel) {
            el.mapResultsCount.textContent = `Chưa có tin có tọa độ tại ${unitLabel}, đang hiện tâm khu vực`;
            return;
        }
        if (areaLabel) {
            el.mapResultsCount.textContent = `Chưa có tin tại ${areaLabel}, đang hiện tâm khu vực`;
            return;
        }
        el.mapResultsCount.textContent = "Không có tin có tọa độ để hiện trên bản đồ";
        return;
    }

    const exactLabel = filterSummary ? `${exactCount} tin khớp ${filterSummary}` : `${exactCount} tin khớp`;
    const parts = [exactLabel];
    if (suggestedCount > 0) parts.push(`${suggestedCount} đề xuất gần giống`);
    el.mapResultsCount.textContent = `${parts.join(" + ")} trên bản đồ`;
}

function markerStateClass(id) {
    const sId = String(id || "");
    if (sId && String(state.currentListingId || "") === sId) return "marker-current";
    if (sId && state.viewedListingIds.includes(sId)) return "marker-viewed";
    return "marker-unseen";
}

function saveViewedListingState() {
    try {
        localStorage.setItem(VIEWED_LISTINGS_KEY, JSON.stringify(state.viewedListingIds.slice(-500)));
    } catch (error) {}
}

function updateMarkerVisualState() {
    state.markers.forEach((item) => {
        const dom = document.getElementById(`marker-${item.id}`);
        if (!dom) return;
        dom.classList.remove("marker-current", "marker-viewed", "marker-unseen");
        dom.classList.add(markerStateClass(item.id));
    });
    if (state.markerClusterGroup && typeof state.markerClusterGroup.refreshClusters === "function") {
        state.markerClusterGroup.refreshClusters();
    }
}

function updateActiveListingCards() {
    document.querySelectorAll(".list-card").forEach((card) => {
        const isActive = card.dataset.listingId === String(state.currentListingId || "");
        const isViewed = state.viewedListingIds.includes(card.dataset.listingId);
        card.classList.toggle("is-active", isActive);
        card.classList.toggle("is-viewed", !isActive && isViewed);
    });
}

function setCurrentListing(id, remember = true) {
    const sId = id ? String(id) : "";
    state.currentListingId = sId || null;
    if (sId && remember && !state.viewedListingIds.includes(sId)) {
        state.viewedListingIds.push(sId);
        saveViewedListingState();
    }
    updateMarkerVisualState();
    updateActiveListingCards();
}

function closeMobileListingPreview(options = {}) {
    if (!el.mobileListingPreview) return;
    el.mobileListingPreview.classList.add("hidden");
    el.mobileListingPreview.innerHTML = "";
    document.body.classList.remove("mobile-preview-open");
    if (!options.preserveCurrent) setCurrentListing(null, false);
}

window.closeMobileListingPreview = closeMobileListingPreview;

function showMobileListingPreview(listing, coverImg, contact) {
    if (!el.mobileListingPreview) return;
    setCurrentListing(listing.id);
    const images = getListingImageUrls(listing);
    const firstImage = safeMediaUrl(coverImg) || images[0] || FALLBACK_IMAGE;
    const imageCount = images.length;
    popupSlideIndex[String(listing.id)] = Math.max(0, images.indexOf(firstImage));
    el.mobileListingPreview.innerHTML = `
        <article class="mobile-preview-card">
            <button class="mobile-preview-close" type="button" onclick="window.closeMobileListingPreview()" aria-label="Đóng">×</button>
            <div class="mobile-preview-media">
                <img class="mobile-preview-img" id="mobilePreviewImg-${listing.id}" src="${escapeAttr(firstImage)}" alt="${escapeAttr(listing.title)}" loading="lazy" decoding="async">
                <span class="mobile-preview-counter" id="mobilePreviewCounter-${listing.id}">1/${imageCount}</span>
                ${imageCount > 1 ? `
                    <button class="mobile-preview-slide prev" type="button" onclick="event.stopPropagation(); window.slideMobilePreviewImg('${listing.id}', -1)" aria-label="Ảnh trước">‹</button>
                    <button class="mobile-preview-slide next" type="button" onclick="event.stopPropagation(); window.slideMobilePreviewImg('${listing.id}', 1)" aria-label="Ảnh sau">›</button>
                ` : ""}
            </div>
            <div class="mobile-preview-body">
                <div class="mobile-preview-top">
                    <span>${listing.type || "Nhà đất"}</span>
                    <em>Đang xem</em>
                    <strong>${formatPrice(listing.price)} Tỷ</strong>
                </div>
                <h3>${listing.title}</h3>
                <p>${listing.location || "Đang cập nhật vị trí"}</p>
                <div class="mobile-preview-specs">
                    <span>${formatFact(listing.beds)} PN</span>
                    <span>${formatFact(listing.baths)} PT</span>
                    <span>${formatFact(listing.area, "m²")}</span>
                </div>
                <div class="mobile-preview-actions">
                    <button type="button" onclick="window.openFullscreenModal('${listing.id}')">Chi tiết</button>
                    <a href="tel:${contact.phoneRaw || ""}" onclick="window.trackListingEvent('CALL', '${listing.id}')">Gọi</a>
                    <a href="${contact.zaloUrl || "#"}" target="_blank" rel="noopener" onclick="window.trackListingEvent('ZALO', '${listing.id}')">Zalo</a>
                </div>
            </div>
        </article>
    `;
    el.mobileListingPreview.classList.remove("hidden");
    document.body.classList.add("mobile-preview-open");
}

function getContact() {
    return state.site?.contact || {
        phoneDisplay: "0900 000 000",
        phoneRaw: "0900000000",
        email: "hello@example.com",
        zaloUrl: "https://zalo.me/0900000000"
    };
}

function distanceMeters(a, b) {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    const toRad = (value) => Number(value) * Math.PI / 180;
    const earth = 6371000;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getRoadBasePrice(listing) {
    const text = normalizeSearchText(`${listing.title || ""} ${listing.location || ""} ${listing.address || ""}`);
    const matchedRoad = state.roadPriceTable.find((road) => road.keys.some((key) => text.includes(key)));
    return matchedRoad?.price || null;
}

function getNearbyComparablePrice(listing) {
    const coords = getListingCoordinates(listing);
    const area = Number(listing.area || 0);
    if (!coords || !area) return null;

    const comparables = state.listings
        .filter((item) => String(item.id) !== String(listing.id))
        .map((item) => {
            const itemCoords = getListingCoordinates(item);
            const itemArea = Number(item.area || 0);
            const itemPrice = Number(item.price || 0);
            if (!itemCoords || !itemArea || !itemPrice) return null;
            const meters = distanceMeters(coords, itemCoords);
            if (meters > 500) return null;
            return {
                millionPerM2: (itemPrice * 1000) / itemArea,
                weight: Math.max(0.2, 1 - meters / 500)
            };
        })
        .filter(Boolean);

    if (!comparables.length) return null;
    const weighted = comparables.reduce((sum, item) => sum + item.millionPerM2 * item.weight, 0);
    const totalWeight = comparables.reduce((sum, item) => sum + item.weight, 0);
    return totalWeight > 0 ? weighted / totalWeight : null;
}

function getListingValuation(listing) {
    if (Number(listing.aiValuation) > 0) {
        return Number(listing.aiValuation);
    }
    const area = Number(listing.area || 0);
    if (!area) return Number(listing.price || 0);

    const text = normalizeSearchText(`${listing.title || ""} ${listing.location || ""} ${listing.type || ""}`);
    const roadBasePrice = getRoadBasePrice(listing);
    let baseMillionPerM2 = roadBasePrice || 18;
    if (!roadBasePrice && (text.includes("quy nhon") || text.includes("phu cat"))) baseMillionPerM2 = 32;
    if (!roadBasePrice && (text.includes("pleiku") || text.includes("bien ho") || text.includes("hoi phu"))) baseMillionPerM2 = 22;
    if (!roadBasePrice && (text.includes("an khe") || text.includes("ayun") || text.includes("chu se") || text.includes("dak doa"))) baseMillionPerM2 = 12;
    const nearbyPrice = getNearbyComparablePrice(listing);
    if (nearbyPrice) {
        baseMillionPerM2 = baseMillionPerM2 * 0.55 + nearbyPrice * 0.45;
    }
    if (text.includes("nha pho")) baseMillionPerM2 *= 1.18;
    if (text.includes("biet thu") || text.includes("nha vuon")) baseMillionPerM2 *= 1.1;

    const roadWidth = Number(listing.roadWidth || 0);
    const frontage = Number(listing.frontage || 0);
    const positionFactor = roadWidth >= 12 ? 1.18 : roadWidth >= 8 ? 1.1 : roadWidth >= 5 ? 1.03 : 0.94;
    const frontageFactor = frontage >= 8 ? 1.08 : frontage >= 5 ? 1.03 : frontage > 0 ? 0.97 : 1;
    const legalFactor = normalizeSearchText(listing.legal || "").includes("so") ? 1.05 : 0.96;
    const estimate = (area * baseMillionPerM2 * positionFactor * frontageFactor * legalFactor) / 1000;
    return Number(estimate.toFixed(1));
}

function getUtilityDistance(listing) {
    if (Number(listing.utilityDistance) > 0) return Number(listing.utilityDistance);
    const text = normalizeSearchText(`${listing.location || ""} ${listing.title || ""}`);
    if (text.includes("pleiku") || text.includes("quy nhon")) return 450;
    if (text.includes("bien ho") || text.includes("hoi phu") || text.includes("thong nhat")) return 700;
    if (text.includes("an khe") || text.includes("ayun")) return 950;
    return 1300;
}

function utilityDistanceLabel(distance) {
    if (distance <= 500) return "trường/chợ/dịch vụ trong bán kính đi bộ gần";
    if (distance <= 1000) return "tiện ích chính cách khoảng vài phút đi xe";
    if (distance <= 2000) return "cần xe máy/ô tô để tới tiện ích chính";
    return "vị trí yên tĩnh, tiện ích xa hơn";
}

function renderRuleBasedValuation(listing) {
    const zbox = document.querySelector(".zestimate-box");
    const zValueNode = document.getElementById("modal-zestimate-val");
    const zLabelNode = document.getElementById("modal-zestimate-lbl");
    if (!zbox || !zValueNode || !zLabelNode) return;

    zbox.classList.remove("overpriced");
    zValueNode.textContent = "...";
    zLabelNode.textContent = "Đang phân tích dữ liệu khu vực...";

    window.clearTimeout(renderRuleBasedValuation._timer);
    renderRuleBasedValuation._timer = window.setTimeout(() => {
        const zPrice = getListingValuation(listing);
        if (!zPrice) {
            zValueNode.textContent = "--";
            zLabelNode.textContent = "Chưa đủ dữ liệu diện tích/giá";
            return;
        }

        const askingPrice = Number(listing.price || 0);
        const deltaPercent = askingPrice > 0 ? Math.round(Math.abs(zPrice - askingPrice) / askingPrice * 100) : 0;
        const isCheaper = zPrice >= askingPrice;
        zValueNode.textContent = formatPrice(zPrice) + " Tỷ";
        zLabelNode.textContent = askingPrice > 0
            ? (isCheaper ? `Thấp hơn ước tính ${deltaPercent}%` : `Cao hơn ước tính ${deltaPercent}%`)
            : "Ước tính theo diện tích và vị trí";
        zbox.classList.toggle("overpriced", !isCheaper);
    }, 1500);
}

function trackEvent(type, details = {}) {
    fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type,
            listingId: details.listingId || state.currentListingId || "",
            query: details.query || "",
            summary: details.summary || ""
        }),
        keepalive: true
    }).catch(() => {});
}
window.trackListingEvent = (type, listingId) => trackEvent(type, { listingId });

function buildClusterIcon(cluster) {
    const childMarkers = cluster.getAllChildMarkers ? cluster.getAllChildMarkers() : [];
    const ids = childMarkers.map((marker) => String(marker.options?.listingId || "")).filter(Boolean);
    const hasCurrent = ids.some((id) => String(state.currentListingId || "") === id);
    const allViewed = ids.length > 0 && ids.every((id) => state.viewedListingIds.includes(id));
    const stateClass = hasCurrent ? "cluster-current" : allViewed ? "cluster-viewed" : "cluster-unseen";
    const count = cluster.getChildCount();
    const sizeClass = count < 10 ? "marker-cluster-small" : count < 100 ? "marker-cluster-medium" : "marker-cluster-large";
    return L.divIcon({
        html: `<div><span>${count}</span></div>`,
        className: `marker-cluster ${sizeClass} ${stateClass}`,
        iconSize: L.point(40, 40)
    });
}

function calculateMortgage(dpPercent, interestRate = 9) {
    if (!currentListingPrice) return;
    const loanAmount = currentListingPrice * 1000000000 * (1 - dpPercent / 100);
    if (loanAmount <= 0) {
        document.getElementById("mortgage-monthly").textContent = "0 ₫/tháng";
        return;
    }
    
    // Tính gốc lãi trả góp, Lãi suất interestRate/năm, Kỳ hạn 20 năm (240 tháng)
    const monthlyRate = (interestRate / 100) / 12;
    const months = 240;
    let payment = 0;
    
    if (monthlyRate === 0) {
         payment = loanAmount / months;
    } else {
         payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    }
    
    document.getElementById("mortgage-monthly").textContent = (payment / 1000000).toLocaleString('vi-VN', {maximumFractionDigits: 1}) + " triệu/tháng";
}

// ================== MAP ==================
function initMap() {
    if (typeof L === "undefined") {
        if (el.mapResultsCount) el.mapResultsCount.textContent = "Không tải được thư viện bản đồ. Vui lòng tải lại trang.";
        return;
    }
    state.map = L.map(el.mapContainer, { zoomControl: false, maxZoom: 18 }).setView([13.9833, 108.0], 13);
    
    const streetTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { attribution: '&copy; CARTO' });
    const satelliteTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: 'Tiles &copy; Esri' });
    streetTiles.on("tileerror", () => showSmartHint("Bản đồ nền đang tải chậm. Hệ thống sẽ thử làm mới khung bản đồ."));
    
    streetTiles.addTo(state.map);
    L.control.layers({"🗺️ Bản đồ gốc": streetTiles, "🛰️ Vệ tinh": satelliteTiles}, null, { position: 'topright' }).addTo(state.map);
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);
    
    // Khởi tạo nhóm Sinh Thái Chùm (Marker Clustering)
    if (typeof L.markerClusterGroup !== "undefined") {
        state.markerClusterGroup = L.markerClusterGroup({
            disableClusteringAtZoom: 16,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: buildClusterIcon
        });
        state.map.addLayer(state.markerClusterGroup);
    }

    window.addEventListener("load", () => {
        setTimeout(() => state.map && state.map.invalidateSize(), 250);
        setTimeout(() => state.map && state.map.invalidateSize(), 900);
    });
}

function clearAdminUnitLayer() {
    if (state.adminUnitLayer && state.map) {
        state.map.removeLayer(state.adminUnitLayer);
    }
    state.adminUnitLayer = null;
}

function renderAdminUnitCenter(unit) {
    const center = getAdminUnitCenter(unit);
    if (!center || !state.map || typeof L === "undefined") return;

    state.adminUnitLayer = L.circleMarker(center, {
        radius: 12,
        color: "#f59e0b",
        weight: 3,
        fillColor: "#f59e0b",
        fillOpacity: 0.28
    }).addTo(state.map);

    state.adminUnitLayer.bindPopup(`
        <div style="min-width:220px">
            <strong>${unit.label}</strong>
            <div style="margin-top:6px;color:#475569;font-size:13px;line-height:1.45">${unit.oldText || "Tâm khu vực theo dữ liệu bản đồ mở."}</div>
            <div style="margin-top:8px;color:#64748b;font-size:12px">Chưa có tin đăng tại khu vực này.</div>
        </div>
    `);
    state.adminUnitLayer.bindTooltip(unit.label, { sticky: true });
}

function renderQuickAreaCenter(area) {
    const center = getQuickAreaCenter(area);
    if (!center || !state.map || typeof L === "undefined") return;

    state.adminUnitLayer = L.circleMarker(center, {
        radius: 12,
        color: "#f59e0b",
        weight: 3,
        fillColor: "#f59e0b",
        fillOpacity: 0.28
    }).addTo(state.map);

    state.adminUnitLayer.bindPopup(`
        <div style="min-width:220px">
            <strong>${area.label}</strong>
            <div style="margin-top:6px;color:#475569;font-size:13px;line-height:1.45">${area.description || "Tâm khu vực để định vị nhanh trên bản đồ."}</div>
            <div style="margin-top:8px;color:#64748b;font-size:12px">Chưa có tin đăng tại khu vực này.</div>
        </div>
    `);
    state.adminUnitLayer.bindTooltip(area.label, { sticky: true });
}

function renderMapMarkers({ fitBounds = false, animate = true } = {}) {
    if (!state.map) return;
    const renderToken = ++state.mapRenderToken;
    
    closeMobileListingPreview();
    clearAdminUnitLayer();
    if (state.markerClusterGroup) {
        state.markerClusterGroup.clearLayers();
    } else {
        state.markers.forEach(m => state.map.removeLayer(m.layer));
    }
    state.markers = [];
    
    if (state.filteredListings.length === 0) el.emptyState.classList.remove("hidden");
    else el.emptyState.classList.add("hidden");

    const bounds = [];
    let listHTML = '';
    const shownCount = Math.min(state.visibleListCount, state.filteredListings.length);
    const visibleListingIds = new Set(
        state.filteredListings.slice(0, shownCount).map((listing) => String(listing.id))
    );
    
    state.filteredListings.forEach(listing => {
        const coordinates = getListingCoordinates(listing);
        if (!coordinates) return;
        const contact = getContact();
        bounds.push(coordinates);
        
        const isSuggested = state.suggestedMatches.find(sm => sm.id === listing.id);
        const markerClass = `custom-marker ${isSuggested ? "suggested-marker" : ""} ${markerStateClass(listing.id)}`.trim();
        
        const iconHtml = `<div class="${markerClass}" id="marker-${listing.id}">${formatPrice(listing.price)}T</div>`;
        const icon = L.divIcon({ className: "marker-wrapper", html: iconHtml, iconSize: null, popupAnchor: [0, -15] });
        const marker = L.marker(coordinates, { icon, listingId: String(listing.id) });
        
        if (state.markerClusterGroup) {
            state.markerClusterGroup.addLayer(marker);
        } else {
            marker.addTo(state.map);
        }
        
        // Build Thumbs HTML Row
        const hasImages = listing.images && listing.images.length > 0;
        const coverImg = optimizedImageUrl(hasImages ? listing.images[0] : listing.image, 900) || FALLBACK_IMAGE;
        const listingVideo = safeVideoUrl(listing.video);
        
        // Accumulate only the visible sidebar batch; markers still render for all filtered listings.
        if (visibleListingIds.has(String(listing.id))) {
            const isLiked = state.savedFavorites && state.savedFavorites.includes(String(listing.id));
            const isActive = String(state.currentListingId || "") === String(listing.id);
            const matchLabel = isSuggested ? "Đề xuất gần giống" : "Khớp tìm kiếm";
            listHTML += `
                <div class="list-card ${isSuggested ? 'suggested' : 'exact'} ${isActive ? 'is-active' : ''}" data-listing-id="${listing.id}" onmouseover="window.highlightMarker('${listing.id}')" onmouseout="window.unhighlightMarker('${listing.id}')" onclick="window.focusListingOnMap('${listing.id}')">
                    <div class="list-card-img-wrap">
                        ${imageTag(coverImg, "list-card-img", listing.title, 520)}
                        <span class="list-card-badge">${escapeHTML(listing.type)}</span>
                        <button class="list-card-like ${isLiked ? 'active' : ''}" onclick="event.stopPropagation(); window.toggleLike(this, '${listing.id}')">❤️</button>
                    </div>
                    <div class="list-card-body">
                        <div class="list-card-match">${matchLabel}</div>
                        <div class="list-card-price">${formatPrice(listing.price)} Tỷ</div>
                        <div class="list-card-specs">
                            <span><strong>${listing.beds}</strong> PN</span>
                            <span><strong>${listing.baths}</strong> PT</span>
                            <span><strong>${listing.area}</strong> m²</span>
                        </div>
                        <div class="list-card-specs">
                            <span>${formatPricePerM2(listing)}</span>
                            <span>Đường ${formatFact(listing.roadWidth, "m")}</span>
                        </div>
                        <div class="list-card-title">${escapeHTML(listing.title)}</div>
                        <div class="list-card-specs">
                            <span>${escapeHTML(listing.legal || "Đang cập nhật pháp lý")}</span>
                            <span>${escapeHTML(listing.direction || "Chưa rõ hướng")}</span>
                        </div>
                        <div class="list-card-actions">
                            <button type="button" onclick="event.stopPropagation(); window.focusListingOnMap('${listing.id}')">Xem trên bản đồ</button>
                            <button type="button" onclick="event.stopPropagation(); window.openFullscreenModal('${listing.id}')">Chi tiết</button>
                            <button type="button" onclick="event.stopPropagation(); window.toggleCompare('${listing.id}')">So sánh</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        let thumbsHtml = '';
        if (hasImages) {
            listing.images.forEach((img, idx) => {
                const active = idx === 0 ? 'active' : '';
                const thumbSrc = optimizedImageUrl(img, 180) || FALLBACK_IMAGE;
                const fullSrc = optimizedImageUrl(img, 1200) || thumbSrc;
                thumbsHtml += `<div class="thumb-item ${active}" id="thumb-${listing.id}-${idx}" onclick="window.selectMedia('${listing.id}', '${idx}', '${escapeAttr(fullSrc)}', 'img')">
                                   ${imageTag(thumbSrc, "", listing.title, 180)}
                               </div>`;
            });
        }
        if (listingVideo) {
            thumbsHtml += `<div class="thumb-item video-thumb" id="thumb-${listing.id}-vid" onclick="window.selectMedia('${listing.id}', 'vid', '${escapeAttr(listingVideo)}', 'video')">▶</div>`;
        }
        
        const tagHTMLDesktop = isSuggested ? `<span class="suggested-label">🔥 Đề xuất tương tự</span>` : '';

        const popupHTML = `
            <div class="map-popup-card compact-map-popup">
                <button class="btn-expand" onclick="window.openFullscreenModal('${listing.id}')">⛶ Tràn màn hình</button>
                <div class="popup-gallery-wrap">
                    <div class="popup-main-media">
                        <img id="mainImg-${listing.id}" src="${escapeAttr(coverImg)}" class="media-item active" alt="${escapeAttr(listing.title)}" loading="lazy" decoding="async" />
                        <iframe id="mainVid-${listing.id}" src="" class="media-item" allow="fullscreen"></iframe>
                        <video id="mainVideoFile-${listing.id}" src="" class="media-item" controls playsinline></video>
                        <span class="map-popup-badge">${listing.type || "Khác"}</span>
                        ${hasImages && listing.images.length > 1 ? `
                        <button class="popup-slide-btn popup-slide-prev" onclick="event.stopPropagation(); window.slidePopupImg('${listing.id}', -1)">❮</button>
                        <button class="popup-slide-btn popup-slide-next" onclick="event.stopPropagation(); window.slidePopupImg('${listing.id}', 1)">❯</button>
                        <span class="popup-img-counter" id="imgCounter-${listing.id}">1 / ${listing.images.length}</span>
                        ` : ''}
                    </div>
                    ${thumbsHtml ? `<div class="popup-thumbs-row">${thumbsHtml}</div>` : ''}
                </div>
                
                <div class="map-popup-body">
                    <div class="map-popup-header">
                        <div class="header-text">
                            ${tagHTMLDesktop}
                            <h3 class="map-popup-title">${escapeHTML(listing.title)}</h3>
                            <div class="map-popup-address">${escapeHTML(listing.location)}</div>
                        </div>
                        <div class="map-popup-price">${formatPrice(listing.price)} Tỷ</div>
                    </div>

                    <div class="map-popup-specs">
                        <div class="spec-box"><span class="spec-val">${listing.beds}<span>PN</span></span><span class="spec-lbl">Phòng ngủ</span></div>
                        <div class="spec-divider"></div>
                        <div class="spec-box"><span class="spec-val">${listing.baths}<span>PT</span></span><span class="spec-lbl">Phòng tắm</span></div>
                        <div class="spec-divider"></div>
                        <div class="spec-box"><span class="spec-val">${listing.area}<span>m²</span></span><span class="spec-lbl">Diện tích</span></div>
                    </div>
                    <div class="map-popup-facts">
                        <span>Ngang ${formatFact(listing.frontage, "m")}</span>
                        <span>Dài ${formatFact(listing.depth, "m")}</span>
                        <span>Đường ${formatFact(listing.roadWidth, "m")}</span>
                        <span>${escapeHTML(listing.direction || "Chưa rõ hướng")}</span>
                        <span>${escapeHTML(listing.landUse || "Chưa rõ thổ cư")}</span>
                        <span>${formatPricePerM2(listing)}</span>
                    </div>
                    
                    <div class="map-popup-desc">${escapeHTML(listing.description || "Đang cập nhật...")}</div>
                    
                    <div class="popup-social-bar">
                        <div class="rating-group">
                            <button class="action-btn btn-like ${state.savedFavorites && state.savedFavorites.includes(String(listing.id)) ? 'active' : ''}" onclick="window.toggleLike(this, '${listing.id}')">❤️</button>
                            <button class="action-btn btn-dislike" onclick="window.toggleDislike(this)">👎</button>
                        </div>
                        <button class="action-btn btn-share" onclick="window.shareListing('${listing.id}')">🔗 Chia sẻ</button>
                    </div>
                    
                    <div class="map-popup-footer">
                        <button class="btn-modern btn-detail" onclick="window.openFullscreenModal('${listing.id}')">🔍 XEM CHI TIẾT</button>
                    </div>
                    <div class="map-popup-footer" style="margin-top:0;">
                        <a href="tel:${contact.phoneRaw}" class="btn-modern btn-call" style="font-size:0.85rem; padding: 10px;" onclick="window.trackListingEvent('CALL', '${listing.id}')">📞 ${contact.phoneDisplay || "Gọi điện"}</a>
                        <a href="${contact.zaloUrl || "#"}" class="btn-modern btn-zalo" style="font-size:0.85rem; padding: 10px;" target="_blank" rel="noopener" onclick="window.trackListingEvent('ZALO', '${listing.id}')">💬 ZALO</a>
                    </div>
                </div>
            </div>
        `;
        
        if (isMobileViewport()) {
            marker.on("click", () => showMobileListingPreview(listing, coverImg, contact));
        } else {
            marker.bindPopup(popupHTML, getPopupOptions());
        }

        marker.on("mouseover", () => {
            const dom = document.getElementById(`marker-${listing.id}`);
            if (dom) dom.classList.add("highlight");
        });
        marker.on("mouseout", () => {
            const dom = document.getElementById(`marker-${listing.id}`);
            if (dom) dom.classList.remove("highlight");
        });
        
        state.markers.push({ id: listing.id, layer: marker, coordinates });
    });

    if (state.selectedAdminUnit && (state.exactMatches.length === 0 || bounds.length === 0)) {
        renderAdminUnitCenter(state.selectedAdminUnit);
    } else if (state.selectedAreaCenter && (state.exactMatches.length === 0 || bounds.length === 0)) {
        renderQuickAreaCenter(state.selectedAreaCenter);
    }
    
    // Render the Sidebar List
    const listContainer = document.getElementById("property-list-container");
    const countNode = document.getElementById("list-count");
    if (listContainer) {
        listContainer.innerHTML = listHTML;
        if (state.filteredListings.length > shownCount) {
            const remainingCount = state.filteredListings.length - shownCount;
            listContainer.insertAdjacentHTML("beforeend", `
                <div class="list-load-more">
                    <button type="button" id="load-more-listings">Tải thêm ${Math.min(LIST_PAGE_SIZE, remainingCount)} tin</button>
                    <span>Đang xem ${shownCount}/${state.filteredListings.length} tin</span>
                </div>
            `);
            document.getElementById("load-more-listings")?.addEventListener("click", () => {
                state.visibleListCount += LIST_PAGE_SIZE;
                renderMapMarkers({ fitBounds: false, animate: false });
            });
        }
    }
    if (countNode) {
        countNode.textContent = state.filteredListings.length > shownCount
            ? `Hiển thị ${shownCount}/${state.filteredListings.length} tin đăng`
            : `Hiển thị ${state.filteredListings.length} tin đăng`;
    }
    updateMapResultStatus(bounds.length);
    
    setTimeout(() => {
        if (renderToken !== state.mapRenderToken) return;
        state.map.invalidateSize();
        if (fitBounds) fitMapToFilteredResults({ animate });
    }, 100);
    
    // Giữ trạng thái quy hoạch nếu đang bật mà render lại marker
    if (state.isZoningActive) renderZoning();
}

window.highlightMarker = function(id) {
    const dom = document.getElementById(`marker-${id}`);
    if (dom) { dom.classList.add("highlight"); dom.style.zIndex="1000"; dom.style.transform="scale(1.2)"; }
};

window.unhighlightMarker = function(id) {
    const dom = document.getElementById(`marker-${id}`);
    if (dom) { dom.classList.remove("highlight"); dom.style.zIndex=""; dom.style.transform=""; }
};

window.focusListingOnMap = function(id) {
    const markerData = state.markers.find(m => String(m.id) === String(id));
    if (!markerData || !state.map) return;

    setCurrentListing(id);
    window.highlightMarker(id);
    fitCoordinatesOnMap([markerData.coordinates], { animate: true });

    setTimeout(() => {
        if (isMobileViewport()) {
            const listing = state.listings.find((item) => String(item.id) === String(id));
            if (!listing) return;
            const hasImages = listing.images && listing.images.length > 0;
            const coverImg = optimizedImageUrl(hasImages ? listing.images[0] : listing.image, 900) || FALLBACK_IMAGE;
            showMobileListingPreview(listing, coverImg, getContact());
        } else if (typeof markerData.layer.openPopup === "function") {
            markerData.layer.openPopup();
        }
    }, 450);
};

// Toggle sidebar list view (mobile & desktop)
window.toggleListView = function() {
    const panel = document.getElementById("side-list-panel");
    const btn = document.getElementById("toggle-list-view");
    if (!panel) return;
    const isHidden = panel.style.display === "none" || getComputedStyle(panel).display === "none";
    panel.style.display = isHidden ? "flex" : "none";
    if (btn) btn.textContent = isHidden ? "🗂️ Ẩn danh sách" : "🗂️ Danh sách";
    setTimeout(() => state.map && state.map.invalidateSize(), 300);
};

// 2026 Social Interactions
state.savedFavorites = [];
try {
    const raw = localStorage.getItem("globalEstateFavs");
    if (raw) state.savedFavorites = JSON.parse(raw);
} catch (e) {}
try {
    const rawCompare = localStorage.getItem("ndvCompareIds");
    if (rawCompare) state.compareIds = JSON.parse(rawCompare).map(String).slice(0, 3);
} catch (e) {}
try {
    const rawViewed = localStorage.getItem(VIEWED_LISTINGS_KEY);
    if (rawViewed) state.viewedListingIds = JSON.parse(rawViewed).map(String).slice(-500);
} catch (e) {}

function saveCompareState() {
    localStorage.setItem("ndvCompareIds", JSON.stringify(state.compareIds));
    updateCompareFab();
}

function updateCompareFab() {
    const fab = document.getElementById("compare-fab");
    if (!fab) return;
    fab.classList.toggle("show", state.compareIds.length > 0);
    fab.querySelector("span").textContent = `⚖ So sánh (${state.compareIds.length})`;
}

window.toggleCompare = function(id) {
    const sId = String(id || state.currentListingId || "");
    if (!sId) return;
    if (state.compareIds.includes(sId)) {
        state.compareIds = state.compareIds.filter((item) => item !== sId);
    } else {
        if (state.compareIds.length >= 3) state.compareIds.shift();
        state.compareIds.push(sId);
    }
    saveCompareState();
    renderCompareModal();
    const btn = document.querySelector(".social-action-bar .btn-compare");
    if (btn && String(state.currentListingId) === sId) {
        btn.classList.toggle("active", state.compareIds.includes(sId));
        btn.textContent = state.compareIds.includes(sId) ? "✓ Đã chọn" : "⚖ So sánh";
    }
};

window.toggleCompareCurrent = function() {
    window.toggleCompare(state.currentListingId);
};

window.openCompareModal = function() {
    renderCompareModal();
    document.getElementById("compare-modal-backdrop")?.classList.add("show");
};

window.closeCompareModal = function() {
    document.getElementById("compare-modal-backdrop")?.classList.remove("show");
};

function renderCompareModal() {
    const body = document.getElementById("compare-body");
    if (!body) return;
    const listings = state.compareIds
        .map((id) => state.listings.find((item) => String(item.id) === String(id)))
        .filter(Boolean);
    if (!listings.length) {
        body.innerHTML = '<p class="compare-empty">Chọn tối đa 3 tin để so sánh giá/m2, diện tích, pháp lý và vị trí.</p>';
        return;
    }
    body.innerHTML = listings.map((listing) => {
        const cover = listing.images?.[0] || listing.image || FALLBACK_IMAGE;
        return `
            <article class="compare-col">
                <img src="${cover}" alt="">
                <h3>${escapeHTML(listing.title || "Tin chưa có tiêu đề")}</h3>
                <p>${escapeHTML(listing.location || "")}</p>
                <div class="compare-price">${formatPrice(Number(listing.price || 0))} Tỷ</div>
                <dl>
                    <div><dt>Giá/m2</dt><dd>${formatPricePerM2(listing)}</dd></div>
                    <div><dt>Diện tích</dt><dd>${formatFact(listing.area, "m²")}</dd></div>
                    <div><dt>Đường</dt><dd>${formatFact(listing.roadWidth, "m")}</dd></div>
                    <div><dt>Hướng</dt><dd>${escapeHTML(listing.direction || "Chưa rõ")}</dd></div>
                    <div><dt>Pháp lý</dt><dd>${escapeHTML(listing.legal || "Chưa rõ")}</dd></div>
                    <div><dt>Quy hoạch</dt><dd>${escapeHTML(listing.planningStatus || "Cần kiểm tra")}</dd></div>
                </dl>
                <div class="compare-actions">
                    <button type="button" onclick="window.openFullscreenModal('${listing.id}')">Xem chi tiết</button>
                    <button type="button" onclick="window.toggleCompare('${listing.id}')">Bỏ chọn</button>
                </div>
            </article>
        `;
    }).join("");
}

window.toggleLike = function(btn, id) {
    btn.classList.toggle('active');
    const dislikeBtn = btn.parentElement.querySelector('.btn-dislike');
    if (dislikeBtn) dislikeBtn.classList.remove('active');
    
    if (id) {
        const sId = String(id);
        if (btn.classList.contains('active')) {
            if (!state.savedFavorites.includes(sId)) state.savedFavorites.push(sId);
        } else {
            state.savedFavorites = state.savedFavorites.filter(x => x !== sId);
        }
        localStorage.setItem("globalEstateFavs", JSON.stringify(state.savedFavorites));
        if (state.showFavoritesOnly) applyFilters();
    }
};

window.toggleDislike = function(btn) {
    btn.classList.toggle('active');
    const likeBtn = btn.parentElement.querySelector('.btn-like');
    if (likeBtn) likeBtn.classList.remove('active');
};

window.shareListing = async function(listingId) {
    const listing = state.listings.find(l => l.id === listingId) || state.listings.find(l => l.id === state.currentListingId);
    let titleToShare = listing?.title;
    if (!titleToShare) {
        const titleDOM = document.getElementById('modal-title');
        titleToShare = titleDOM ? titleDOM.textContent : "Nhà Đất Việt";
    }
    const url = listing ? listingUrl(listing.id) : window.location.href;
    const shareData = {
        title: titleToShare,
        text: `Xem tin nhà đất: ${titleToShare}`,
        url
    };
    trackEvent("SHARE", { listingId: listing?.id || state.currentListingId || "" });
    if (navigator.share) {
        navigator.share(shareData).catch(err => console.log('Lỗi Share:', err));
    } else {
        try {
            await navigator.clipboard.writeText(url);
            alert("Đã sao chép link tin đăng:\n" + url);
        } catch {
            alert("Link chia sẻ:\n" + url);
        }
    }
};

window.postComment = function() {
    const input = document.getElementById("new-comment");
    const text = input.value.trim();
    if (!text) return;
    const normalized = normalizeSearchText(text);
    if (BLOCKED_COMMENT_WORDS.some((word) => normalized.includes(normalizeSearchText(word)))) {
        showSmartHint("Bình luận có từ ngữ không phù hợp, anh vui lòng viết lại lịch sự hơn.");
        return;
    }
    
    const list = document.getElementById("comments-list");
    const html = `
        <div class="comment-item" style="animation: modalPop 0.3s ease;">
            <div class="c-avatar">K</div>
            <div class="c-body">
                <div class="c-name">Khách hàng <span class="c-time">Chờ duyệt</span></div>
                <div class="c-text">${escapeHTML(text)}</div>
            </div>
        </div>
    `;
    list.insertAdjacentHTML('beforeend', html);
    input.value = "";
    list.scrollTop = list.scrollHeight;
    
    const h3 = document.querySelector(".comments-section h3");
    if(h3) {
        let count = parseInt((h3.textContent.match(/\d+/) || [2])[0]) + 1;
        h3.textContent = `💬 Bình luận đánh giá (${count})`;
    }
    showSmartHint("Bình luận đã lưu ở trạng thái chờ duyệt để tránh spam và phá giá tin đăng.");
};

function renderZoning() {
    clearZoning();
    if (!state.map) return;
    
    // Không tải KML/GeoJSON lớn trên mobile. Chỉ dựng lớp mô phỏng cho tin trong khung nhìn hiện tại.
    const bounds = state.map.getBounds();
    const targets = state.filteredListings
        .filter((listing) => {
            const coords = getListingCoordinates(listing);
            return coords && bounds.pad(0.25).contains(coords);
        })
        .slice(0, 80);
    if (state.filteredListings.length > targets.length) {
        showSmartHint("Quy hoạch demo chỉ tải phần đang nhìn để tránh treo máy. Phóng to khu vực cần xem để tải chính xác hơn.");
    }
    targets.forEach(listing => {
        const coords = getListingCoordinates(listing);
        if (!coords) return;
        const [lat, lng] = coords;
        // Generate a polygon around the point to simulate land boundary
        // Increased size vastly to make it highly visible even at zoom 12!
        const offsetLat = 0.003;
        const offsetLng = 0.002;
        const pts = [
            [lat + offsetLat, lng - offsetLng],
            [lat + offsetLat + 0.001, lng + offsetLng],
            [lat - offsetLat, lng + offsetLng + 0.002],
            [lat - offsetLat - 0.001, lng - offsetLng]
        ];
        
        // Randomly pick color based on type
        const isVilla = listing.type === "Biệt thự";
        const color = isVilla ? "#ff385c" : "#f1c40f"; // Pink for ODT/Villa, Yellow for others
        const label = isVilla ? "Đất ở tại đô thị (ODT)" : "Đất thương mại, dịch vụ (TMD)";
        
        const polygon = L.polygon(pts, {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
            weight: 4
        }).addTo(state.map);
        
        polygon.bindTooltip(label, { sticky: true, className: "zoning-tooltip" });
        state.zoningLayers.push(polygon);
    });
    
    // Auto zoom so the user immediately notices the plots drawn
    if (state.zoningLayers.length > 0) {
        const group = new L.featureGroup(state.zoningLayers);
        state.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }
}

function clearZoning() {
    state.zoningLayers.forEach(layer => {
        state.map.removeLayer(layer);
    });
    state.zoningLayers = [];
}

// Global Media Select Logic for popups
window.selectMedia = function(listingId, thumbId, src, type) {
    const mainImg = document.getElementById(`mainImg-${listingId}`);
    const mainVid = document.getElementById(`mainVid-${listingId}`);
    const mainVideoFile = document.getElementById(`mainVideoFile-${listingId}`);
    
    const popupEl = mainImg?.closest('.map-popup-card') || mainVid?.closest('.map-popup-card') || mainVideoFile?.closest('.map-popup-card');
    if (popupEl) {
        popupEl.querySelectorAll('.thumb-item').forEach(th => th.classList.remove('active'));
    }
    const clickedThumb = document.getElementById(`thumb-${listingId}-${thumbId}`);
    if (clickedThumb) clickedThumb.classList.add('active');

    if (type === 'img') {
        if (mainVid) {
            mainVid.classList.remove('active');
            mainVid.src = '';
        }
        if (mainVideoFile) {
            mainVideoFile.pause();
            mainVideoFile.classList.remove('active');
            mainVideoFile.removeAttribute("src");
            mainVideoFile.load();
        }
        if (mainImg) {
            mainImg.src = src;
            mainImg.classList.add('active');
        }
    } else if (type === 'video') {
        const videoSrc = safeVideoUrl(src);
        if (!videoSrc) return;
        if (mainImg) mainImg.classList.remove('active');
        if (isUploadedVideoUrl(videoSrc)) {
            if (mainVid) {
                mainVid.classList.remove('active');
                mainVid.src = '';
            }
            if (mainVideoFile) {
                mainVideoFile.src = videoSrc;
                mainVideoFile.classList.add('active');
                mainVideoFile.load();
            }
        } else if (mainVid) {
            if (mainVideoFile) {
                mainVideoFile.pause();
                mainVideoFile.classList.remove('active');
                mainVideoFile.removeAttribute("src");
                mainVideoFile.load();
            }
            mainVid.src = videoSrc;
            mainVid.classList.add('active');
        }
    }
}

window.openFullscreenModal = function(id) {
    const listing = state.listings.find(l => l.id === id);
    if (!listing) return;
    setCurrentListing(id);
    trackEvent("VIEW", { listingId: id });
    if (state.map && typeof state.map.closePopup === "function") {
        state.map.closePopup();
    }
    closeMobileListingPreview({ preserveCurrent: true });
    if (window.location.hash !== `#${encodeURIComponent(id)}`) {
        history.replaceState(null, "", `#${encodeURIComponent(id)}`);
    }
    
    document.getElementById("modal-title").textContent = listing.title;
    document.getElementById("modal-location").textContent = listing.location;
    document.getElementById("modal-price").textContent = formatPrice(listing.price) + " Tỷ";
    document.getElementById("modal-beds").textContent = listing.beds;
    document.getElementById("modal-baths").textContent = listing.baths;
    document.getElementById("modal-area").textContent = listing.area;
    document.getElementById("modal-type").textContent = listing.type || "Bất động sản";
    document.getElementById("modal-desc").textContent = listing.description || "Chưa có mô tả.";
    const realFacts = document.getElementById("modal-real-facts");
    if (realFacts) {
        const facts = [
            ["Giá/m2", formatPricePerM2(listing)],
            ["Ngang", formatFact(listing.frontage, "m")],
            ["Dài", formatFact(listing.depth, "m")],
            ["Đường", formatFact(listing.roadWidth, "m")],
            ["Hướng", listing.direction || "Chưa rõ"],
            ["Thổ cư", listing.landUse || "Chưa rõ"],
            ["Quy hoạch", listing.planningStatus || "Chưa rõ"],
            ["Vay ngân hàng", listing.bankLoan || "Chưa rõ"]
        ];
        realFacts.innerHTML = facts.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
    }
    
    currentListingPrice = listing.price;
    const streetViewTab = document.getElementById("tab-streetview");
    if (streetViewTab) {
        streetViewTab.hidden = !hasStreetViewCandidate(listing);
        streetViewTab.title = streetViewTab.hidden ? "Khu vực này chưa có dữ liệu 360° ổn định" : "";
    }
    
    const contact = getContact();
    const callLinks = [
        document.getElementById("modal-call-link"),
        document.getElementById("modal-sticky-call-link")
    ].filter(Boolean);
    const zaloLinks = [
        document.getElementById("modal-zalo-link"),
        document.getElementById("modal-sticky-zalo-link")
    ].filter(Boolean);
    callLinks.forEach((link) => {
        link.href = `tel:${contact.phoneRaw || "0900000000"}`;
        link.onclick = () => trackEvent("CALL", { listingId: listing.id });
        link.textContent = link.id === "modal-sticky-call-link"
            ? `📞 ${contact.phoneDisplay || "Gọi ngay"}`
            : `📞 ${contact.phoneDisplay || "GỌI ĐIỆN NGAY"}`;
    });
    zaloLinks.forEach((link) => {
        link.href = contact.zaloUrl || "#";
        link.onclick = () => trackEvent("ZALO", { listingId: listing.id });
        link.target = "_blank";
        link.rel = "noopener";
        if (link.id === "modal-sticky-zalo-link") link.textContent = "💬 Chat Zalo";
    });

    if (el.leadMessage) {
        el.leadMessage.className = "lead-message";
        el.leadMessage.textContent = "";
    }

    // AI định giá chạy local rule-based: không gọi API, không phát sinh chi phí.
    renderRuleBasedValuation(listing);

    const utilityDistance = getUtilityDistance(listing);
    const walkNode = document.getElementById("modal-walk-score");
    if (walkNode) {
        walkNode.innerHTML = `<strong>Khoảng cách tiện ích: ~${utilityDistance.toLocaleString("vi-VN")}m</strong> (${utilityDistanceLabel(utilityDistance)})`;
    }
    
    // Reset Slider
    const dpSlider = document.getElementById("dp-slider");
    const irSlider = document.getElementById("ir-slider");
    const bankSelector = document.getElementById("bank-selector");
    
    if (dpSlider && irSlider) {
        dpSlider.value = 30;
        irSlider.value = 6.0; // Default Vietcombank mock
        if (bankSelector) bankSelector.value = "6.0";
        document.getElementById("dp-label").textContent = "30%";
        document.getElementById("ir-label").textContent = "6.0%/năm";
        calculateMortgage(30, 6.0);
    }
    
    // Sync Social Action buttons with localStorage
    const isLiked = state.savedFavorites && state.savedFavorites.includes(String(listing.id));
    const btnLike = document.querySelector('.social-action-bar .btn-like');
    const btnDislike = document.querySelector('.social-action-bar .btn-dislike');
    if (btnLike) {
        btnLike.className = `action-btn btn-like ${isLiked ? 'active' : ''}`;
        // Re-bind click event with current id
        btnLike.setAttribute("onclick", `window.toggleLike(this, '${listing.id}')`);
    }
    if (btnDislike) btnDislike.classList.remove('active');
    const shareButton = document.querySelector('.social-action-bar .btn-share');
    if (shareButton) shareButton.setAttribute("onclick", `window.shareListing('${listing.id}')`);
    const compareButton = document.querySelector('.social-action-bar .btn-compare');
    if (compareButton) {
        const selectedForCompare = state.compareIds.includes(String(listing.id));
        compareButton.classList.toggle("active", selectedForCompare);
        compareButton.textContent = selectedForCompare ? "✓ Đã chọn" : "⚖ So sánh";
        compareButton.setAttribute("onclick", `window.toggleCompare('${listing.id}')`);
    }
    
    // Reset Comments to default
    const commentList = document.getElementById("comments-list");
    if (commentList) {
        commentList.innerHTML = `
            <div class="comment-item">
                <div class="c-avatar">A</div>
                <div class="c-body">
                    <div class="c-name">Anh Tú <span class="c-time">Mới đây</span></div>
                    <div class="c-text">Đã đi xem thực tế, nhà rất vuông vắn, sổ sách chuẩn chỉnh. Đáng cân nhắc cho ai mua ở thực!</div>
                </div>
            </div>
            <div class="comment-item">
                <div class="c-avatar">L</div>
                <div class="c-body">
                    <div class="c-name">Linh Đan <span class="c-time">1 giờ trước</span></div>
                    <div class="c-text">Khu vực này an ninh rất tốt, hàng xóm tri thức, hơi xa đại siêu thị một xíu thôi.</div>
                </div>
            </div>
        `;
        const h3 = document.querySelector(".comments-section h3");
        if(h3) h3.textContent = "💬 Bình luận đánh giá (2)";
    }
    
    // Reset Tabs
    const tabPhotos = document.getElementById("tab-photos");
    if (tabPhotos) tabPhotos.click();
    const iframe3d = document.getElementById("iframe-3d");
    if (iframe3d) {
        iframe3d.removeAttribute("src");
        iframe3d.setAttribute("data-src", listing.vrUrl || "https://kuula.co/share/collection/7l1c8?fs=1&vr=1&sd=1&initload=0&thumbs=1&chromeless=1&logo=0");
    }
    const iframeStreetview = document.getElementById("iframe-streetview");
    if (iframeStreetview) iframeStreetview.removeAttribute("src");
    
    // Ensure gallery nav buttons are visible
    const btnPrev = document.getElementById("gallery-prev");
    const btnNext = document.getElementById("gallery-next");
    if (btnPrev) btnPrev.style.display = "flex";
    if (btnNext) btnNext.style.display = "flex";
    
    // Render gallery
    const galleryEl = document.getElementById("modal-gallery");
    galleryEl.innerHTML = "";
    
    if (listing.images && listing.images.length > 0) {
        listing.images.forEach(img => {
            galleryEl.innerHTML += imageTag(img, "", listing.title || "Ảnh nhà đất", 1400);
        });
    } else {
        galleryEl.innerHTML += imageTag(FALLBACK_IMAGE, "", "Ảnh nhà đất", 1200);
    }
    
    if (listing.video) {
        const rawVideo = listing.video.includes("Scxs7L0vhZ4") ? "https://www.youtube.com/embed/u31qwQUeGuM" : listing.video;
        const safeVideo = safeVideoUrl(rawVideo);
        if (safeVideo && isUploadedVideoUrl(safeVideo)) {
            galleryEl.innerHTML += `<video src="${escapeAttr(safeVideo)}" controls playsinline preload="metadata"></video>`;
        } else if (safeVideo) {
            galleryEl.innerHTML += `<iframe src="${escapeAttr(safeVideo)}" allow="fullscreen"></iframe>`;
        }
    }
    
    const modalRight = document.querySelector(".modal-right");
    if (modalRight) modalRight.scrollTop = 0;
    document.getElementById("fullscreen-modal").classList.remove("hidden");
    document.body.classList.add("modal-open");
}

window.closeFullscreenModal = function() {
    document.getElementById("fullscreen-modal").classList.add("hidden");
    document.body.classList.remove("modal-open");
    setCurrentListing(null, false);
    
    // Stop any playing iframe video
    const galleryEl = document.getElementById("modal-gallery");
    galleryEl.querySelectorAll("video").forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
    });
    galleryEl.innerHTML = "";
    const iframe3d = document.getElementById("iframe-3d");
    if (iframe3d) iframe3d.removeAttribute("src");
    const iframeStreetview = document.getElementById("iframe-streetview");
    if (iframeStreetview) iframeStreetview.removeAttribute("src");
}

// ================== POPUP IMAGE SLIDER ==================
const popupSlideIndex = {}; // { listingId: currentIndex }

window.slidePopupImg = function(listingId, direction) {
    const listing = state.listings.find(l => l.id === listingId);
    if (!listing || !listing.images || listing.images.length <= 1) return;
    
    const total = listing.images.length;
    const current = popupSlideIndex[listingId] || 0;
    let next = current + direction;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    popupSlideIndex[listingId] = next;
    
    // Update main image
    const mainImg = document.getElementById(`mainImg-${listingId}`);
    if (mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(() => {
            mainImg.src = listing.images[next];
            mainImg.style.opacity = '1';
        }, 150);
    }
    
    // Update counter
    const counter = document.getElementById(`imgCounter-${listingId}`);
    if (counter) counter.textContent = `${next + 1} / ${total}`;
    
    // Update thumbnail highlights
    for (let i = 0; i < total; i++) {
        const thumb = document.getElementById(`thumb-${listingId}-${i}`);
        if (thumb) thumb.classList.toggle('active', i === next);
    }
    
    // Hide video iframe if visible
    const mainVid = document.getElementById(`mainVid-${listingId}`);
    if (mainVid) { mainVid.classList.remove('active'); mainVid.src = ''; }
    const mainVideoFile = document.getElementById(`mainVideoFile-${listingId}`);
    if (mainVideoFile) {
        mainVideoFile.pause();
        mainVideoFile.classList.remove('active');
        mainVideoFile.removeAttribute("src");
        mainVideoFile.load();
    }
    if (mainImg) mainImg.classList.add('active');
};

window.slideMobilePreviewImg = function(listingId, direction) {
    const listing = state.listings.find((item) => String(item.id) === String(listingId));
    const images = getListingImageUrls(listing);
    if (!listing || images.length <= 1) return;

    const key = String(listingId);
    const total = images.length;
    const current = popupSlideIndex[key] || 0;
    let next = current + direction;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    popupSlideIndex[key] = next;

    const img = document.getElementById(`mobilePreviewImg-${listingId}`);
    if (img) {
        img.style.opacity = "0";
        setTimeout(() => {
            img.src = images[next];
            img.style.opacity = "1";
        }, 120);
    }

    const counter = document.getElementById(`mobilePreviewCounter-${listingId}`);
    if (counter) counter.textContent = `${next + 1}/${total}`;
};

window.addEventListener("DOMContentLoaded", init);


