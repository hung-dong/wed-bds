import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const configPath = path.join(root, "data", "supabase-config.json");
const listingsPath = path.join(root, "data", "listings.json");
const roadPricesPath = path.join(root, "data", "road-prices.json");
const sitePath = path.join(root, "data", "site.json");
const submissionsPath = path.join(root, "data", "submissions.json");
const leadsPath = path.join(root, "data", "leads.json");

function required(value, label) {
  if (!value) throw new Error(`Missing ${label}. Fill data/supabase-config.json first.`);
  return value;
}

function rowId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sanitizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function memberIdFromPhone(phone) {
  const clean = sanitizePhone(phone);
  if (!clean) return "";
  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0;
  }
  return `member-${Math.abs(hash).toString(16).slice(0, 10)}`;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function supabase(pathname, options = {}) {
  const url = `${baseUrl}/rest/v1/${pathname}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "resolution=merge-duplicates,return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${data?.message || text}`);
  }
  return data;
}

function listingRow(listing) {
  const id = String(listing.id || rowId("listing"));
  const coords = Array.isArray(listing.coordinates) ? listing.coordinates : [];
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  return {
    id,
    data: { ...listing, id },
    status: "PUBLIC",
    member_id: listing.memberId || "",
    source_submission_id: listing.sourceSubmissionId || "",
    location: Number.isFinite(lat) && Number.isFinite(lng) ? `SRID=4326;POINT(${lng} ${lat})` : null,
    updated_at: new Date().toISOString()
  };
}

function roadRow(road) {
  return {
    name: road.name || road.road || "",
    display_name: road.displayName || road.name || road.road || "",
    area: road.area || "",
    price_million_per_m2: Number(road.priceMillionPerM2 || road.price || 0),
    aliases: Array.isArray(road.aliases) ? road.aliases : [],
    position1_factor: Number(road.position1Factor || 1),
    alley_factor: Number(road.alleyFactor || 0.7)
  };
}

function submissionRow(submission) {
  const contact = submission.contact || {};
  const phone = sanitizePhone(contact.phone || submission.contactPhone || "");
  return {
    id: submission.id || rowId("sub"),
    tracking_code: submission.trackingCode || submission.tracking_code || `NDV-${Date.now().toString(36).toUpperCase()}`,
    member_id: submission.memberId || memberIdFromPhone(phone),
    contact,
    listing: submission.listing || {},
    status: submission.status || "PENDING",
    review_note: submission.reviewNote || "",
    listing_id: submission.listingId || "",
    updated_at: submission.updatedAt || new Date().toISOString()
  };
}

function leadRow(lead) {
  return {
    id: lead.id || rowId("lead"),
    listing_id: lead.listingId || "",
    data: lead,
    status: lead.status || "NEW",
    note: lead.note || "",
    updated_at: lead.updatedAt || new Date().toISOString()
  };
}

async function upsertChunks(table, rows, chunkSize = 200, onConflict = "") {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const conflictQuery = onConflict ? `?on_conflict=${onConflict}` : "";
    await supabase(`${table}${conflictQuery}`, {
      method: "POST",
      body: JSON.stringify(chunk)
    });
    console.log(`Imported ${Math.min(i + chunk.length, rows.length)}/${rows.length} into ${table}`);
  }
}

const config = await readJson(configPath, {});
const baseUrl = required(String(config.url || "").replace(/\/+$/, ""), "Supabase URL");
const anonKey = required(String(config.anonKey || ""), "Supabase anonKey");

const [listings, roadPriceData, site, submissions, leads] = await Promise.all([
  readJson(listingsPath, []),
  readJson(roadPricesPath, { roads: [] }),
  readJson(sitePath, null),
  readJson(submissionsPath, []),
  readJson(leadsPath, [])
]);

await upsertChunks("listings", listings.map(listingRow), 200, "id");
await upsertChunks("road_prices", (roadPriceData.roads || []).map(roadRow), 200, "name,area");
if (site) {
  await supabase("site_settings", {
    method: "POST",
    body: JSON.stringify([{ id: "main", data: site, updated_at: new Date().toISOString() }])
  });
  console.log("Imported site_settings");
}
await upsertChunks("submissions", submissions.map(submissionRow), 200, "id");
await upsertChunks("leads", leads.map(leadRow), 200, "id");

console.log("Supabase import completed.");
