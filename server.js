const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { once } = require("events");
const { URL } = require("url");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123456";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_COOKIE = "ndv_session";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ============ RATE LIMITING ============
const loginAttempts = new Map(); // IP -> { count, resetAt }
const postRateMap = new Map();   // IP -> { count, resetAt }
const RATE_LOGIN_MAX = 5;
const RATE_LOGIN_WINDOW = 15 * 60 * 1000; // 15 phút
const RATE_POST_MAX = 60;
const RATE_POST_WINDOW = 60 * 1000; // 1 phút

function getClientIP(req) {
    return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
        || req.headers["x-real-ip"]
        || req.socket?.remoteAddress
        || "unknown";
}

function isRateLimited(map, ip, maxAttempts, windowMs) {
    const now = Date.now();
    const entry = map.get(ip);
    if (!entry || now > entry.resetAt) {
        map.set(ip, { count: 1, resetAt: now + windowMs });
        return false;
    }
    entry.count += 1;
    return entry.count > maxAttempts;
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
        if (now > entry.resetAt) loginAttempts.delete(ip);
    }
    for (const [ip, entry] of postRateMap) {
        if (now > entry.resetAt) postRateMap.delete(ip);
    }
}, 10 * 60 * 1000);

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const LISTINGS_FILE = path.join(DATA_DIR, "listings.json");
const SITE_FILE = path.join(DATA_DIR, "site.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const VIDEO_UPLOADS_DIR = path.join(UPLOADS_DIR, "videos");
const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024;

// ============ FILE LOCKING (Async Mutex) ============
const fileLocks = new Map();

async function withFileLock(filePath, fn) {
    if (!fileLocks.has(filePath)) {
        fileLocks.set(filePath, { queue: [], locked: false });
    }
    const lock = fileLocks.get(filePath);

    if (lock.locked) {
        await new Promise((resolve) => lock.queue.push(resolve));
    }
    lock.locked = true;
    try {
        return await fn();
    } finally {
        lock.locked = false;
        if (lock.queue.length > 0) {
            const next = lock.queue.shift();
            next();
        }
    }
}

// ============ IN-MEMORY CACHE ============
const dataCache = new Map(); // filePath -> { data, loadedAt }

async function cachedRead(filePath) {
    const cached = dataCache.get(filePath);
    if (cached) return cached.data;
    const data = await readJsonDisk(filePath);
    dataCache.set(filePath, { data, loadedAt: Date.now() });
    return data;
}

function cacheInvalidate(filePath) {
    dataCache.delete(filePath);
}

async function cachedWrite(filePath, data) {
    return withFileLock(filePath, async () => {
        await writeJsonDisk(filePath, data);
        dataCache.set(filePath, { data, loadedAt: Date.now() });
    });
}

async function cachedReadModifyWrite(filePath, modifyFn) {
    return withFileLock(filePath, async () => {
        const data = await readJsonDisk(filePath);
        const result = await modifyFn(data);
        await writeJsonDisk(filePath, result.data);
        dataCache.set(filePath, { data: result.data, loadedAt: Date.now() });
        return result;
    });
}

// ============ CSRF TOKEN ============
const csrfTokens = new Map(); // sessionUsername -> Set<token>

function generateCsrfToken(username) {
    const token = crypto.randomBytes(24).toString("hex");
    const tokens = csrfTokens.get(username) || new Set();
    tokens.add(token);
    while (tokens.size > 10) {
        tokens.delete(tokens.values().next().value);
    }
    csrfTokens.set(username, tokens);
    return token;
}

function verifyCsrfToken(username, token) {
    if (!username || !token) return false;
    return csrfTokens.get(username)?.has(token) || false;
}

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v"
};

function staticHeaders(filePath, mimeType) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();
    const noStore = ext === ".html" || fileName === "service-worker.js" || ext === ".js" || ext === ".css";
    const headers = {
        "Content-Type": mimeType,
        "Cache-Control": noStore ? "no-store, no-cache, must-revalidate" : "public, max-age=3600"
    };
    if (noStore) headers.Pragma = "no-cache";
    return headers;
}

async function ensureDataFiles() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(VIDEO_UPLOADS_DIR, { recursive: true });
    await ensureFile(LISTINGS_FILE, "[]");
    await ensureFile(SITE_FILE, JSON.stringify(defaultSiteSettings(), null, 2));
    await ensureFile(LEADS_FILE, "[]");
    await ensureFile(SUBMISSIONS_FILE, "[]");
    await ensureFile(EVENTS_FILE, "[]");
}

async function ensureFile(filePath, content) {
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, content, "utf8");
    }
}

function defaultSiteSettings() {
    return {
        brandName: "Nhà Đất Việt",
        tagline: "Mua bán nhà đất nhanh gọn",
        contact: {
            phoneDisplay: "0900 000 000",
            phoneRaw: "0900000000",
            email: "hello@example.com",
            zaloUrl: "https://zalo.me/0900000000"
        }
    };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        ...extraHeaders
    });
    res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, extraHeaders = {}) {
    res.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8",
        ...extraHeaders
    });
    res.end(text);
}

function notFound(res) {
    sendJson(res, 404, { error: "Không tìm thấy tài nguyên." });
}

async function readJsonDisk(filePath) {
    const raw = (await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
    return JSON.parse(raw);
}

// Alias for cached read (used by all handlers)
async function readJson(filePath) {
    return cachedRead(filePath);
}

async function writeJsonDisk(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// Alias for cached write (used by all handlers)
async function writeJson(filePath, data) {
    return cachedWrite(filePath, data);
}

async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
            if (body.length > 8_000_000) {
                reject(new Error("Payload quá lớn."));
                req.destroy();
            }
        });
        req.on("end", () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("Dữ liệu JSON không hợp lệ."));
            }
        });
        req.on("error", reject);
    });
}

function videoExtensionFromMime(contentType = "") {
    const type = String(contentType || "").split(";")[0].trim().toLowerCase();
    const mimeToExt = {
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/quicktime": "mov",
        "video/x-m4v": "m4v"
    };
    return mimeToExt[type] || "";
}

function videoExtensionFromFileName(fileName = "") {
    const ext = path.extname(String(fileName || "")).replace(".", "").toLowerCase();
    return ["mp4", "webm", "mov", "m4v"].includes(ext) ? ext : "";
}

async function finishWriteStream(stream) {
    if (stream.destroyed) return;
    stream.end();
    await Promise.race([
        once(stream, "finish"),
        once(stream, "error").then(([error]) => {
            throw error;
        })
    ]);
}

async function handleVideoUpload(req, res) {
    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > MAX_VIDEO_UPLOAD_BYTES) {
        req.resume();
        sendJson(res, 413, { error: "Video quá lớn. Vui lòng chọn file tối đa 25MB." });
        return;
    }

    let originalName = "";
    try {
        originalName = decodeURIComponent(String(req.headers["x-file-name"] || ""));
    } catch {
        originalName = String(req.headers["x-file-name"] || "");
    }

    const ext = videoExtensionFromMime(req.headers["content-type"]) || videoExtensionFromFileName(originalName);
    if (!ext) {
        req.resume();
        sendJson(res, 415, { error: "Chỉ hỗ trợ video MP4, WebM, MOV hoặc M4V." });
        return;
    }

    await fs.mkdir(VIDEO_UPLOADS_DIR, { recursive: true });
    const fileName = `video-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const filePath = path.join(VIDEO_UPLOADS_DIR, fileName);
    const stream = fsSync.createWriteStream(filePath, { flags: "wx" });
    let streamError = null;
    let written = 0;
    let tooLarge = false;
    stream.on("error", (error) => {
        streamError = error;
    });

    try {
        for await (const chunk of req) {
            if (streamError) throw streamError;
            written += chunk.length;
            if (written > MAX_VIDEO_UPLOAD_BYTES) {
                tooLarge = true;
                continue;
            }
            if (!stream.write(chunk)) {
                await Promise.race([
                    once(stream, "drain"),
                    once(stream, "error").then(([error]) => {
                        throw error;
                    })
                ]);
            }
            if (streamError) throw streamError;
        }

        if (tooLarge) {
            stream.destroy();
            await fs.unlink(filePath).catch(() => null);
            sendJson(res, 413, { error: "Video quá lớn. Vui lòng chọn file tối đa 25MB." });
            return;
        }

        if (written === 0) {
            stream.destroy();
            await fs.unlink(filePath).catch(() => null);
            sendJson(res, 400, { error: "Chưa nhận được file video." });
            return;
        }

        await finishWriteStream(stream);
        if (streamError) throw streamError;
        sendJson(res, 201, {
            ok: true,
            url: `/uploads/videos/${fileName}`,
            size: written,
            maxSize: MAX_VIDEO_UPLOAD_BYTES
        });
    } catch (error) {
        stream.destroy();
        await fs.unlink(filePath).catch(() => null);
        throw error;
    }
}

function parseCookies(req) {
    const header = req.headers.cookie || "";
    return header.split(";").reduce((acc, pair) => {
        const [name, ...rest] = pair.trim().split("=");
        if (!name) {
            return acc;
        }
        acc[name] = decodeURIComponent(rest.join("="));
        return acc;
    }, {});
}

function base64UrlEncode(value) {
    return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
    return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value) {
    return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken(username) {
    const payload = {
        username,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    };
    const encoded = base64UrlEncode(JSON.stringify(payload));
    const signature = sign(encoded);
    return `${encoded}.${signature}`;
}

function verifySessionToken(token) {
    if (!token || !token.includes(".")) {
        return null;
    }
    const [encoded, signature] = token.split(".");
    if (sign(encoded) !== signature) {
        return null;
    }
    try {
        const payload = JSON.parse(base64UrlDecode(encoded));
        if (payload.exp < Date.now()) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function authenticatedUser(req) {
    const cookies = parseCookies(req);
    return verifySessionToken(cookies[SESSION_COOKIE]);
}

function sessionCookie(token) {
    const secure = IS_PRODUCTION ? " Secure;" : "";
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax;${secure}`;
}

function expiredSessionCookie() {
    return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function requireAuth(req, res) {
    const user = authenticatedUser(req);
    if (!user) {
        sendJson(res, 401, { error: "Bạn cần đăng nhập quản trị." });
        return null;
    }
    return user;
}

function sanitizePhone(value) {
    return String(value || "").replace(/[^\d+]/g, "").trim();
}

function createTrackingCode() {
    return `NDV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function memberIdFromPhone(phone) {
    return phone ? `member-${crypto.createHash("sha1").update(phone).digest("hex").slice(0, 10)}` : "";
}

function cleanText(value, maxLength = 1000) {
    return String(value || "")
        .replace(/<[^>]*>/g, "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, maxLength);
}

function sanitizeMediaUrl(value, { allowDataImage = false } = {}) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (allowDataImage && raw.startsWith("data:image/")) return raw;
    if (raw.startsWith("/uploads/videos/") && !raw.includes("..")) return raw;
    try {
        const parsed = new URL(raw);
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
}

function scoreListingQuality(listing = {}) {
    const suggestions = [];
    let score = 0;
    const images = Array.isArray(listing.images) ? listing.images.filter(Boolean) : [];
    const hasCoords = Array.isArray(listing.coordinates)
        && listing.coordinates.length === 2
        && listing.coordinates.every((value) => !Number.isNaN(Number(value)));

    if (String(listing.title || "").trim().length >= 20) score += 10;
    else suggestions.push("Tiêu đề nên rõ vị trí, loại tài sản và điểm mạnh chính.");

    if (String(listing.description || "").trim().length >= 120) score += 15;
    else suggestions.push("Mô tả nên có hiện trạng, đường, pháp lý, điểm mạnh và điều kiện giao dịch.");

    if (images.length >= 5) score += 18;
    else if (images.length >= 3) score += 14;
    else if (images.length >= 1 || listing.image) {
        score += 7;
        suggestions.push("Nên có ít nhất 3-5 ảnh thật: mặt tiền, đường, bên trong, sổ/quy hoạch nếu được phép.");
    } else {
        suggestions.push("Cần ảnh thật để tăng niềm tin và tỷ lệ khách liên hệ.");
    }

    if (hasCoords) score += 12;
    else suggestions.push("Cần tọa độ đúng để khách xem trực tiếp trên bản đồ.");

    if (Number(listing.price) > 0 && Number(listing.area) > 0) score += 12;
    else suggestions.push("Cần đủ giá và diện tích để hệ thống tính giá/m2.");

    if (listing.frontage && listing.depth && listing.roadWidth) score += 10;
    else suggestions.push("Bổ sung ngang, dài và đường trước nhà để khách lọc nhanh.");

    if (listing.legal && listing.landUse && listing.planningStatus) score += 15;
    else suggestions.push("Bổ sung pháp lý, thổ cư và tình trạng quy hoạch để giảm câu hỏi lặp lại.");

    if (listing.video || listing.vrUrl) score += 8;
    else suggestions.push("Có video hoặc 3D/VR sẽ giúp khách ở xa xem trước tốt hơn.");

    if (listing.bankLoan) score += 5;
    else suggestions.push("Ghi rõ có vay ngân hàng hay không để khách chuẩn bị giao dịch.");

    if (listing.walkScore || Array.isArray(listing.nearby) && listing.nearby.length) score += 10;
    else suggestions.push("Thêm tiện ích xung quanh: trường học, chợ, đường lớn, khu dân cư.");

    return {
        score: Math.min(100, score),
        level: score >= 85 ? "Tốt" : score >= 65 ? "Khá" : "Cần bổ sung",
        suggestions: suggestions.slice(0, 5)
    };
}

function sanitizeEvent(input, req) {
    const allowedTypes = new Set(["VIEW", "CALL", "ZALO", "SHARE", "SEARCH"]);
    const type = String(input.type || "").trim().toUpperCase();
    if (!allowedTypes.has(type)) return null;
    return {
        id: `event-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        type,
        listingId: String(input.listingId || "").trim(),
        query: String(input.query || "").trim().slice(0, 160),
        summary: String(input.summary || "").trim().slice(0, 220),
        createdAt: new Date().toISOString(),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 180)
    };
}

function emptyListingMetric(listingId) {
    return {
        listingId,
        views: 0,
        calls: 0,
        zalo: 0,
        shares: 0,
        leads: 0,
        conversionRate: 0
    };
}

function buildListingMetrics(events = [], leads = []) {
    const metrics = {};
    function ensure(listingId) {
        const id = String(listingId || "");
        if (!id) return null;
        if (!metrics[id]) metrics[id] = emptyListingMetric(id);
        return metrics[id];
    }

    events.forEach((event) => {
        const metric = ensure(event.listingId);
        if (!metric) return;
        if (event.type === "VIEW") metric.views += 1;
        if (event.type === "CALL") metric.calls += 1;
        if (event.type === "ZALO") metric.zalo += 1;
        if (event.type === "SHARE") metric.shares += 1;
    });

    leads.forEach((lead) => {
        const metric = ensure(lead.listingId);
        if (metric) metric.leads += 1;
    });

    Object.values(metrics).forEach((metric) => {
        metric.conversionRate = metric.views > 0 ? Math.round((metric.leads / metric.views) * 1000) / 10 : 0;
    });
    return metrics;
}

function buildAnalytics(listings = [], leads = [], submissions = [], events = []) {
    const listingMetrics = buildListingMetrics(events, leads);
    const eventTotals = events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
    }, {});
    const topListings = listings
        .map((listing) => ({
            id: listing.id,
            title: listing.title,
            location: listing.location,
            price: listing.price,
            quality: scoreListingQuality(listing),
            metrics: listingMetrics[listing.id] || emptyListingMetric(listing.id)
        }))
        .sort((a, b) => {
            const aScore = a.metrics.views * 2 + a.metrics.leads * 12 + a.metrics.calls * 8 + a.metrics.zalo * 8 + a.metrics.shares * 4;
            const bScore = b.metrics.views * 2 + b.metrics.leads * 12 + b.metrics.calls * 8 + b.metrics.zalo * 8 + b.metrics.shares * 4;
            return bScore - aScore;
        })
        .slice(0, 8);

    return {
        totals: {
            listings: listings.length,
            pendingSubmissions: submissions.filter((item) => item.status === "PENDING").length,
            leads: leads.length,
            views: eventTotals.VIEW || 0,
            calls: eventTotals.CALL || 0,
            zalo: eventTotals.ZALO || 0,
            shares: eventTotals.SHARE || 0,
            searches: eventTotals.SEARCH || 0
        },
        listingMetrics,
        topListings,
        recentSearches: events
            .filter((event) => event.type === "SEARCH")
            .slice(0, 12)
            .map((event) => ({ query: event.query, summary: event.summary, createdAt: event.createdAt }))
    };
}

function sanitizeListing(input) {
    const rawImages = Array.isArray(input.images)
        ? input.images
        : typeof input.imagesText === "string"
          ? input.imagesText.split(/\r?\n/).map((item) => item.trim())
          : [];
    const images = rawImages
        .map((item) => sanitizeMediaUrl(item, { allowDataImage: true }))
        .filter(Boolean)
        .slice(0, 12);
    const primaryImage = sanitizeMediaUrl(input.image || images[0] || "", { allowDataImage: true });
    if (primaryImage && !images.length) {
        images.push(primaryImage);
    }

    let coordinates = Array.isArray(input.coordinates) ? input.coordinates.slice(0, 2).map(Number) : [13.9833, 108.0];
    // Reset tọa độ ngoài vùng Việt Nam về mặc định
    if (coordinates.length === 2 && (coordinates[0] < 7 || coordinates[0] > 24 || coordinates[1] < 100 || coordinates[1] > 115)) {
        coordinates = [13.9833, 108.0];
    }
    const nearby = Array.isArray(input.nearby)
        ? input.nearby.map((item) => ({
              name: cleanText(item.name, 160),
              distance: cleanText(item.distance, 80),
              coordinates: Array.isArray(item.coordinates) ? item.coordinates.slice(0, 2).map(Number) : coordinates,
              image: sanitizeMediaUrl(item.image, { allowDataImage: true }),
              text: cleanText(item.text, 1000),
              videoUrl: sanitizeMediaUrl(item.videoUrl)
          }))
        : [];

    return {
        id: input.id ? String(input.id) : `listing-${Date.now()}`,
        title: cleanText(input.title, 200),
        location: cleanText(input.location, 300),
        type: cleanText(input.type, 120),
        price: Number(input.price || 0),
        area: Number(input.area || 0),
        beds: Number(input.beds || 0),
        baths: Number(input.baths || 0),
        legal: cleanText(input.legal, 160),
        frontage: input.frontage === null || input.frontage === undefined || input.frontage === ""
            ? null
            : Number(input.frontage),
        depth: input.depth === null || input.depth === undefined || input.depth === ""
            ? null
            : Number(input.depth),
        direction: cleanText(input.direction, 80),
        roadWidth: input.roadWidth === null || input.roadWidth === undefined || input.roadWidth === ""
            ? null
            : Number(input.roadWidth),
        landUse: cleanText(input.landUse, 160),
        planningStatus: cleanText(input.planningStatus, 300),
        bankLoan: cleanText(input.bankLoan, 160),
        image: primaryImage,
        images,
        description: cleanText(input.description, 5000),
        coordinates,
        video: sanitizeMediaUrl(input.video),
        vrUrl: sanitizeMediaUrl(input.vrUrl),
        aiValuation: input.aiValuation === null || input.aiValuation === undefined || input.aiValuation === ""
            ? null
            : Number(input.aiValuation),
        walkScore: input.walkScore === null || input.walkScore === undefined || input.walkScore === ""
            ? null
            : Number(input.walkScore),
        mapSummary: cleanText(input.mapSummary, 1000),
        nearby
    };
}

function validateListing(listing) {
    if (!listing.title || !listing.location || !listing.type) {
        return "Thiếu tiêu đề, khu vực hoặc loại hình.";
    }
    if (String(listing.title).length > 200) {
        return "Tiêu đề quá dài (tối đa 200 ký tự).";
    }
    if (String(listing.location).length > 300) {
        return "Khu vực quá dài (tối đa 300 ký tự).";
    }
    if (String(listing.description || "").length > 5000) {
        return "Mô tả quá dài (tối đa 5000 ký tự).";
    }
    if (!listing.image) {
        return "Cần có ảnh đại diện cho tin đăng.";
    }
    if (!listing.description) {
        return "Cần có mô tả cho tin đăng.";
    }
    if (!Array.isArray(listing.coordinates) || listing.coordinates.length !== 2 || listing.coordinates.some((value) => Number.isNaN(value))) {
        return "Tọa độ bất động sản chưa hợp lệ.";
    }
    const [vLat, vLng] = listing.coordinates;
    if (vLat < 7 || vLat > 24 || vLng < 100 || vLng > 115) {
        return "Tọa độ nằm ngoài lãnh thổ Việt Nam. Vui lòng kiểm tra lại.";
    }
    return null;
}

function sanitizeLead(input) {
    return {
        id: `lead-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        listingId: String(input.listingId || "").trim(),
        listingTitle: String(input.listingTitle || "").trim(),
        name: String(input.name || "").trim(),
        phone: sanitizePhone(input.phone),
        need: String(input.need || "").trim(),
        source: String(input.source || "website").trim(),
        createdAt: new Date().toISOString(),
        status: "NEW",
        note: ""
    };
}

function validateLead(lead) {
    if (!lead.name || lead.name.length < 2) {
        return "Vui lòng nhập tên khách.";
    }
    if (lead.name.length > 100) {
        return "Tên khách quá dài (tối đa 100 ký tự).";
    }
    if (!lead.phone || lead.phone.length < 9) {
        return "Số điện thoại chưa hợp lệ.";
    }
    if (lead.phone.length > 20) {
        return "Số điện thoại quá dài.";
    }
    if (String(lead.need || "").length > 1000) {
        return "Nhu cầu quá dài (tối đa 1000 ký tự).";
    }
    return null;
}

function sanitizeSubmission(input) {
    const listing = sanitizeListing({
        ...input,
        id: `listing-${Date.now()}`
    });
    const phone = sanitizePhone(input.contactPhone || input.phone);

    return {
        id: `submission-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        trackingCode: String(input.trackingCode || "").trim() || createTrackingCode(),
        memberId: memberIdFromPhone(phone),
        createdAt: new Date().toISOString(),
        status: "PENDING",
        contact: {
            name: String(input.contactName || input.name || "").trim(),
            phone,
            note: String(input.contactNote || input.note || "").trim()
        },
        listing
    };
}

function validateSubmission(submission) {
    if (!submission.contact.name || submission.contact.name.length < 2) {
        return "Vui lòng nhập tên người đăng.";
    }
    if (!submission.contact.phone || submission.contact.phone.length < 9) {
        return "Số điện thoại người đăng chưa hợp lệ.";
    }
    return validateListing(submission.listing);
}

async function handleApi(req, res, pathname) {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { ok: true, date: new Date().toISOString() });
        return;
    }

    if (req.method === "GET" && pathname === "/api/listings") {
        const [listings, site] = await Promise.all([readJson(LISTINGS_FILE), readJson(SITE_FILE)]);
        
        // Pagination support: ?page=1&limit=40 (default: return all for backwards compatibility)
        const pageParam = requestUrl.searchParams.get("page");
        const limitParam = requestUrl.searchParams.get("limit");
        
        if (pageParam) {
            const page = Math.max(1, parseInt(pageParam, 10) || 1);
            const limit = Math.min(200, Math.max(1, parseInt(limitParam, 10) || 40));
            const total = listings.length;
            const totalPages = Math.ceil(total / limit);
            const start = (page - 1) * limit;
            const paginatedListings = listings.slice(start, start + limit);
            sendJson(res, 200, {
                listings: paginatedListings,
                site,
                pagination: { page, limit, total, totalPages, hasMore: page < totalPages }
            });
        } else {
            // Full response for backwards compatibility (map view needs all markers)
            sendJson(res, 200, { listings, site });
        }
        return;
    }

    if (req.method === "POST" && pathname === "/api/uploads/video") {
        await handleVideoUpload(req, res);
        return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/listings/")) {
        const id = decodeURIComponent(pathname.replace("/api/listings/", ""));
        const listings = await readJson(LISTINGS_FILE);
        const listing = listings.find((item) => item.id === id);
        if (!listing) {
            sendJson(res, 404, { error: "Không tìm thấy tin đăng." });
            return;
        }
        sendJson(res, 200, { listing });
        return;
    }

    if (req.method === "POST" && pathname === "/api/leads") {
        const body = await parseBody(req);
        const lead = sanitizeLead(body);
        const validationError = validateLead(lead);
        if (validationError) {
            sendJson(res, 400, { error: validationError });
            return;
        }
        const leads = await readJson(LEADS_FILE);
        leads.unshift(lead);
        await writeJson(LEADS_FILE, leads);
        sendJson(res, 201, { ok: true, lead: { id: lead.id, createdAt: lead.createdAt } });
        return;
    }

    if (req.method === "POST" && pathname === "/api/events") {
        const body = await parseBody(req);
        const event = sanitizeEvent(body, req);
        if (!event) {
            sendJson(res, 400, { error: "Sự kiện không hợp lệ." });
            return;
        }
        const events = await readJson(EVENTS_FILE);
        events.unshift(event);
        await writeJson(EVENTS_FILE, events.slice(0, 5000));
        sendJson(res, 201, { ok: true });
        return;
    }

    if (req.method === "POST" && pathname === "/api/submissions") {
        const body = await parseBody(req);
        const submission = sanitizeSubmission(body);
        const validationError = validateSubmission(submission);
        if (validationError) {
            sendJson(res, 400, { error: validationError });
            return;
        }
        const submissions = await readJson(SUBMISSIONS_FILE);
        submissions.unshift(submission);
        await writeJson(SUBMISSIONS_FILE, submissions);
        sendJson(res, 201, {
            ok: true,
            submission: {
                id: submission.id,
                trackingCode: submission.trackingCode,
                memberId: submission.memberId,
                createdAt: submission.createdAt,
                status: submission.status
            }
        });
        return;
    }

    if (req.method === "GET" && pathname === "/api/member/submissions") {
        const phone = sanitizePhone(requestUrl.searchParams.get("phone"));
        const code = String(requestUrl.searchParams.get("code") || "").trim();
        if (!phone && !code) {
            sendJson(res, 400, { error: "Cần nhập số điện thoại hoặc mã hồ sơ." });
            return;
        }

        const [submissions, leads, events] = await Promise.all([
            readJson(SUBMISSIONS_FILE),
            readJson(LEADS_FILE),
            readJson(EVENTS_FILE)
        ]);
        const ownedSubmissions = submissions.filter((item) => {
            const samePhone = phone && sanitizePhone(item.contact?.phone) === phone;
            const sameCode = code && (item.trackingCode === code || item.id === code);
            return samePhone || sameCode;
        });
        const approvedListingIds = new Set(
            ownedSubmissions
                .filter((item) => item.status === "APPROVED" && item.listingId)
                .map((item) => item.listingId)
        );
        const ownedLeads = leads.filter((lead) => approvedListingIds.has(lead.listingId));
        const metrics = buildListingMetrics(events, leads);
        sendJson(res, 200, {
            member: {
                phone,
                memberId: memberIdFromPhone(phone || ownedSubmissions[0]?.contact?.phone || "")
            },
            submissions: ownedSubmissions.map((item) => ({
                ...item,
                quality: scoreListingQuality(item.listing),
                metrics: item.listingId ? metrics[item.listingId] || emptyListingMetric(item.listingId) : emptyListingMetric(item.listing?.id || item.id)
            })),
            leads: ownedLeads,
            analytics: {
                totals: ownedSubmissions.reduce((acc, item) => {
                    const metric = item.listingId ? metrics[item.listingId] || emptyListingMetric(item.listingId) : emptyListingMetric(item.listing?.id || item.id);
                    acc.views += metric.views;
                    acc.calls += metric.calls;
                    acc.zalo += metric.zalo;
                    acc.shares += metric.shares;
                    return acc;
                }, { views: 0, calls: 0, zalo: 0, shares: 0 })
            }
        });
        return;
    }

    const memberSubmissionUpdate = pathname.match(/^\/api\/member\/submissions\/([^/]+)$/);
    if (req.method === "PUT" && memberSubmissionUpdate) {
        const id = decodeURIComponent(memberSubmissionUpdate[1]);
        const body = await parseBody(req);
        const phone = sanitizePhone(body.contactPhone || body.phone);
        const code = String(body.trackingCode || body.code || "").trim();
        const submissions = await readJson(SUBMISSIONS_FILE);
        const index = submissions.findIndex((item) => item.id === id || item.trackingCode === id);
        if (index === -1) {
            sendJson(res, 404, { error: "Không tìm thấy hồ sơ đăng tin." });
            return;
        }
        const current = submissions[index];
        const allowed = (phone && sanitizePhone(current.contact?.phone) === phone) || (code && current.trackingCode === code);
        if (!allowed) {
            sendJson(res, 403, { error: "Số điện thoại hoặc mã hồ sơ không đúng." });
            return;
        }
        if (current.status !== "PENDING") {
            sendJson(res, 400, { error: "Tin đã được quản trị xử lý nên không thể tự sửa." });
            return;
        }

        const listing = sanitizeListing({
            ...current.listing,
            ...(body.listing || body),
            id: current.listing?.id || `listing-${Date.now()}`
        });
        const validationError = validateListing(listing);
        if (validationError) {
            sendJson(res, 400, { error: validationError });
            return;
        }
        submissions[index] = {
            ...current,
            contact: {
                ...current.contact,
                name: String(body.contactName || body.name || current.contact?.name || "").trim(),
                phone: sanitizePhone(body.contactPhone || body.phone || current.contact?.phone),
                note: String(body.contactNote || body.note || current.contact?.note || "").trim()
            },
            memberId: current.memberId || memberIdFromPhone(phone),
            listing,
            updatedAt: new Date().toISOString()
        };
        await writeJson(SUBMISSIONS_FILE, submissions);
        sendJson(res, 200, { ok: true, submission: submissions[index] });
        return;
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
        const ip = getClientIP(req);
        if (isRateLimited(loginAttempts, ip, RATE_LOGIN_MAX, RATE_LOGIN_WINDOW)) {
            sendJson(res, 429, { error: "Quá nhiều lần thử. Vui lòng chờ 15 phút." });
            return;
        }
        const body = await parseBody(req);
        if (!ADMIN_PASSWORD) {
            sendJson(res, 503, { error: "Chưa cấu hình mật khẩu admin. Set ADMIN_PASSWORD env var." });
            return;
        }
        if (body.username !== ADMIN_USERNAME || body.password !== ADMIN_PASSWORD) {
            sendJson(res, 401, { error: "Sai tài khoản hoặc mật khẩu." });
            return;
        }
        // Reset rate limit on successful login
        loginAttempts.delete(ip);
        const token = createSessionToken(ADMIN_USERNAME);
        const csrfToken = generateCsrfToken(ADMIN_USERNAME);
        sendJson(
            res,
            200,
            {
                ok: true,
                user: { username: ADMIN_USERNAME },
                csrfToken
            },
            { "Set-Cookie": sessionCookie(token) }
        );
        return;
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
        sendJson(res, 200, { ok: true }, { "Set-Cookie": expiredSessionCookie() });
        return;
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
        const user = authenticatedUser(req);
        if (user) {
            const csrfToken = generateCsrfToken(user.username);
            sendJson(res, 200, { authenticated: true, user: { username: user.username }, csrfToken });
        } else {
            sendJson(res, 200, { authenticated: false, user: null });
        }
        return;
    }

    if (pathname.startsWith("/api/admin/")) {
        const user = requireAuth(req, res);
        if (!user) {
            return;
        }

        // CSRF verification for mutation requests (POST/PUT/DELETE)
        if (req.method !== "GET") {
            const csrfHeader = req.headers["x-csrf-token"] || "";
            if (!verifyCsrfToken(user.username, csrfHeader)) {
                sendJson(res, 403, { error: "CSRF token không hợp lệ. Vui lòng đăng nhập lại." });
                return;
            }
        }

        if (req.method === "GET" && pathname === "/api/admin/bootstrap") {
            const [listings, site, leads, submissions, events] = await Promise.all([
                readJson(LISTINGS_FILE),
                readJson(SITE_FILE),
                readJson(LEADS_FILE),
                readJson(SUBMISSIONS_FILE),
                readJson(EVENTS_FILE)
            ]);
            sendJson(res, 200, {
                listings,
                site,
                leads,
                submissions,
                analytics: buildAnalytics(listings, leads, submissions, events),
                user: { username: user.username }
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/admin/analytics") {
            const [listings, leads, submissions, events] = await Promise.all([
                readJson(LISTINGS_FILE),
                readJson(LEADS_FILE),
                readJson(SUBMISSIONS_FILE),
                readJson(EVENTS_FILE)
            ]);
            sendJson(res, 200, { analytics: buildAnalytics(listings, leads, submissions, events) });
            return;
        }

        if (req.method === "GET" && pathname === "/api/admin/leads") {
            const leads = await readJson(LEADS_FILE);
            sendJson(res, 200, { leads });
            return;
        }

        if (req.method === "GET" && pathname === "/api/admin/submissions") {
            const submissions = await readJson(SUBMISSIONS_FILE);
            sendJson(res, 200, { submissions });
            return;
        }

        const submissionUpdate = pathname.match(/^\/api\/admin\/submissions\/([^/]+)$/);
        if (req.method === "DELETE" && submissionUpdate) {
            const id = decodeURIComponent(submissionUpdate[1]);
            const submissions = await readJson(SUBMISSIONS_FILE);
            const nextSubmissions = submissions.filter((item) => item.id !== id);
            if (nextSubmissions.length === submissions.length) {
                sendJson(res, 404, { error: "Không tìm thấy tin chờ duyệt." });
                return;
            }
            await writeJson(SUBMISSIONS_FILE, nextSubmissions);
            sendJson(res, 200, { ok: true });
            return;
        }

        if (req.method === "PUT" && submissionUpdate) {
            const id = decodeURIComponent(submissionUpdate[1]);
            const body = await parseBody(req);
            const submissions = await readJson(SUBMISSIONS_FILE);
            const index = submissions.findIndex((item) => item.id === id);
            if (index === -1) {
                sendJson(res, 404, { error: "Không tìm thấy tin chờ duyệt." });
                return;
            }
            if (submissions[index].status !== "PENDING") {
                sendJson(res, 400, { error: "Chỉ sửa được tin đang chờ duyệt." });
                return;
            }

            const listing = sanitizeListing({
                ...submissions[index].listing,
                ...(body.listing || {}),
                id: submissions[index].listing?.id || `listing-${Date.now()}`
            });
            const validationError = validateListing(listing);
            if (validationError) {
                sendJson(res, 400, { error: validationError });
                return;
            }

            submissions[index] = {
                ...submissions[index],
                contact: {
                    ...submissions[index].contact,
                    name: String(body.contact?.name || submissions[index].contact?.name || "").trim(),
                    phone: sanitizePhone(body.contact?.phone || submissions[index].contact?.phone),
                    note: String(body.contact?.note || submissions[index].contact?.note || "").trim()
                },
                listing,
                editedAt: new Date().toISOString()
            };
            await writeJson(SUBMISSIONS_FILE, submissions);
            sendJson(res, 200, { ok: true, submission: submissions[index] });
            return;
        }

        const submissionAction = pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/(approve|reject)$/);
        if (req.method === "POST" && submissionAction) {
            const id = decodeURIComponent(submissionAction[1]);
            const action = submissionAction[2];
            const body = await parseBody(req);
            const submissions = await readJson(SUBMISSIONS_FILE);
            const index = submissions.findIndex((item) => item.id === id);
            if (index === -1) {
                sendJson(res, 404, { error: "Không tìm thấy tin chờ duyệt." });
                return;
            }

            if (action === "approve") {
                const listing = sanitizeListing({
                    ...submissions[index].listing,
                    ...(body.listing || {}),
                    id: `listing-${Date.now()}`
                });
                const validationError = validateListing(listing);
                if (validationError) {
                    sendJson(res, 400, { error: validationError });
                    return;
                }
                const listings = await readJson(LISTINGS_FILE);
                const approvedListing = {
                    ...listing,
                    owner: {
                        memberId: submissions[index].memberId || memberIdFromPhone(submissions[index].contact?.phone),
                        name: submissions[index].contact?.name || "",
                        phone: submissions[index].contact?.phone || ""
                    },
                    sourceSubmissionId: submissions[index].id,
                    sourceTrackingCode: submissions[index].trackingCode || ""
                };
                listings.unshift(approvedListing);
                submissions[index] = {
                    ...submissions[index],
                    status: "APPROVED",
                    reviewedAt: new Date().toISOString(),
                    listingId: approvedListing.id
                };
                await Promise.all([writeJson(LISTINGS_FILE, listings), writeJson(SUBMISSIONS_FILE, submissions)]);
                sendJson(res, 200, { ok: true, listing: approvedListing, submission: submissions[index] });
                return;
            }

            submissions[index] = {
                ...submissions[index],
                status: "REJECTED",
                reviewedAt: new Date().toISOString(),
                reviewNote: String(body.reason || "").trim()
            };
            await writeJson(SUBMISSIONS_FILE, submissions);
            sendJson(res, 200, { ok: true, submission: submissions[index] });
            return;
        }

        if (req.method === "PUT" && pathname === "/api/admin/site") {
            const body = await parseBody(req);
            const site = {
                brandName: String(body.brandName || defaultSiteSettings().brandName).trim(),
                tagline: String(body.tagline || defaultSiteSettings().tagline).trim(),
                contact: {
                    phoneDisplay: String(body.contact?.phoneDisplay || "").trim(),
                    phoneRaw: String(body.contact?.phoneRaw || "").trim(),
                    email: String(body.contact?.email || "").trim(),
                    zaloUrl: String(body.contact?.zaloUrl || "").trim()
                }
            };
            await writeJson(SITE_FILE, site);
            sendJson(res, 200, { ok: true, site });
            return;
        }

        if (req.method === "POST" && pathname === "/api/admin/listings") {
            const body = await parseBody(req);
            const listing = sanitizeListing({ ...body, id: `listing-${Date.now()}` });
            const validationError = validateListing(listing);
            if (validationError) {
                sendJson(res, 400, { error: validationError });
                return;
            }
            const listings = await readJson(LISTINGS_FILE);
            listings.unshift(listing);
            await writeJson(LISTINGS_FILE, listings);
            sendJson(res, 201, { ok: true, listing });
            return;
        }

        if (req.method === "PUT" && pathname.startsWith("/api/admin/listings/")) {
            const id = decodeURIComponent(pathname.replace("/api/admin/listings/", ""));
            const body = await parseBody(req);
            const listings = await readJson(LISTINGS_FILE);
            const index = listings.findIndex((item) => item.id === id);
            if (index === -1) {
                sendJson(res, 404, { error: "Không tìm thấy tin đăng để cập nhật." });
                return;
            }
            const listing = {
                ...sanitizeListing({ ...body, id }),
                owner: listings[index].owner,
                sourceSubmissionId: listings[index].sourceSubmissionId,
                sourceTrackingCode: listings[index].sourceTrackingCode
            };
            const validationError = validateListing(listing);
            if (validationError) {
                sendJson(res, 400, { error: validationError });
                return;
            }
            listings[index] = listing;
            await writeJson(LISTINGS_FILE, listings);
            sendJson(res, 200, { ok: true, listing });
            return;
        }

        if (req.method === "DELETE" && pathname.startsWith("/api/admin/listings/")) {
            const id = decodeURIComponent(pathname.replace("/api/admin/listings/", ""));
            const listings = await readJson(LISTINGS_FILE);
            const nextListings = listings.filter((item) => item.id !== id);
            if (nextListings.length === listings.length) {
                sendJson(res, 404, { error: "Không tìm thấy tin đăng để xóa." });
                return;
            }
            await writeJson(LISTINGS_FILE, nextListings);
            sendJson(res, 200, { ok: true });
            return;
        }

        const leadUpdate = pathname.match(/^\/api\/admin\/leads\/([^/]+)$/);
        if (req.method === "PUT" && leadUpdate) {
            const id = decodeURIComponent(leadUpdate[1]);
            const body = await parseBody(req);
            const leads = await readJson(LEADS_FILE);
            const index = leads.findIndex((item) => item.id === id);
            if (index === -1) {
                sendJson(res, 404, { error: "Không tìm thấy khách liên hệ." });
                return;
            }
            const allowedStatuses = new Set(["NEW", "CONTACTED", "VIEWING", "NEGOTIATING", "CLOSED", "LOST"]);
            const status = String(body.status || leads[index].status || "NEW").trim().toUpperCase();
            leads[index] = {
                ...leads[index],
                status: allowedStatuses.has(status) ? status : leads[index].status,
                note: String(body.note || "").trim(),
                updatedAt: new Date().toISOString()
            };
            await writeJson(LEADS_FILE, leads);
            sendJson(res, 200, { ok: true, lead: leads[index] });
            return;
        }
    }

    notFound(res);
}

async function serveStatic(req, res, pathname) {
    let filePath = pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, pathname);
    filePath = path.normalize(filePath);

    if (!filePath.startsWith(ROOT)) {
        sendText(res, 403, "Forbidden");
        return;
    }

    try {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
            filePath = path.join(filePath, "index.html");
        }
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";
        const data = await fs.readFile(filePath);
        res.writeHead(200, staticHeaders(filePath, mimeType));
        res.end(data);
    } catch {
        if (pathname === "/admin") {
            serveStatic(req, res, "/admin.html");
            return;
        }
        if (pathname === "/member") {
            serveStatic(req, res, "/member.html");
            return;
        }
        notFound(res);
    }
}

const SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)"
};

async function requestHandler(req, res) {
    // Apply security headers to ALL responses
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(key, value);
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    // Rate limit POST/PUT/DELETE requests (except login which has its own)
    if (req.method !== "GET" && pathname !== "/api/auth/login") {
        const ip = getClientIP(req);
        if (isRateLimited(postRateMap, ip, RATE_POST_MAX, RATE_POST_WINDOW)) {
            sendJson(res, 429, { error: "Quá nhiều yêu cầu. Vui lòng chờ 1 phút." });
            return;
        }
    }

    try {
        if (pathname.startsWith("/api/")) {
            await handleApi(req, res, pathname);
            return;
        }
        await serveStatic(req, res, pathname);
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { error: "Máy chủ gặp lỗi khi xử lý yêu cầu." });
    }
}

async function bootstrap() {
    await ensureDataFiles();
    if (!ADMIN_PASSWORD) {
        console.warn("\n⚠️  ADMIN_PASSWORD chưa được cấu hình! Set env var ADMIN_PASSWORD trước khi deploy.");
        console.warn("   Ví dụ: set ADMIN_PASSWORD=MyStr0ngP@ss && node server.js\n");
    }
    if (!process.env.SESSION_SECRET) {
        console.warn("⚠️  SESSION_SECRET tự sinh ngẫu nhiên. Session sẽ mất khi restart server.");
        console.warn("   Set env var SESSION_SECRET để giữ session giữa các lần restart.\n");
    }
    const server = http.createServer(requestHandler);
    server.listen(PORT, HOST, () => {
        console.log(`Nha Dat Viet server running at http://localhost:${PORT}`);
    });
}

bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
});
