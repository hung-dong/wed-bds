import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());

function sqlString(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function jsonSql(value) {
  return `'${sqlString(JSON.stringify(value))}'::jsonb`;
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

function sanitizeListingForSeed(listing) {
  const clean = { ...listing };
  if (typeof clean.image === "string" && clean.image.startsWith("data:")) {
    clean.image = "";
  }
  if (Array.isArray(clean.images)) {
    clean.images = clean.images.filter((image) => typeof image === "string" && !image.startsWith("data:"));
  }
  if (Array.isArray(clean.media)) {
    clean.media = clean.media.filter((item) => {
      const url = typeof item === "string" ? item : item?.url || item?.src || "";
      return typeof url === "string" && !url.startsWith("data:");
    });
  }
  return clean;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
  } catch {
    return fallback;
  }
}

const listings = await readJson("data/listings.json", []);
const roads = (await readJson("data/road-prices.json", { roads: [] })).roads || [];
const site = await readJson("data/site.json", null);
const submissions = await readJson("data/submissions.json", []);
const leads = await readJson("data/leads.json", []);

const lines = [
  "-- Seed data for Nha Dat Viet Supabase.",
  "-- Run data/supabase-schema.sql first.",
  "begin;"
];

for (const listing of listings) {
  const id = String(listing.id || `listing-${Date.now()}`);
  const seedListing = sanitizeListingForSeed({ ...listing, id });
  const coords = Array.isArray(listing.coordinates) ? listing.coordinates : [];
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  const location = Number.isFinite(lat) && Number.isFinite(lng)
    ? `st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography`
    : "null";
  lines.push(
    `insert into public.listings (id, data, status, location, updated_at) values ('${sqlString(id)}', ${jsonSql(seedListing)}, 'PUBLIC', ${location}, now()) on conflict (id) do update set data = excluded.data, status = excluded.status, location = excluded.location, updated_at = now();`
  );
}

for (const road of roads) {
  const aliases = Array.isArray(road.aliases) ? road.aliases.map((item) => `'${sqlString(item)}'`).join(",") : "";
  lines.push(
    `insert into public.road_prices (name, display_name, area, price_million_per_m2, aliases, position1_factor, alley_factor, updated_at) values ('${sqlString(road.name || "")}', '${sqlString(road.displayName || road.name || "")}', '${sqlString(road.area || "")}', ${Number(road.priceMillionPerM2 || 0)}, array[${aliases}], ${Number(road.position1Factor || 1)}, ${Number(road.alleyFactor || 0.7)}, now()) on conflict (name, area) do update set display_name = excluded.display_name, price_million_per_m2 = excluded.price_million_per_m2, aliases = excluded.aliases, position1_factor = excluded.position1_factor, alley_factor = excluded.alley_factor, updated_at = now();`
  );
}

if (site) {
  lines.push(
    `insert into public.site_settings (id, data, updated_at) values ('main', ${jsonSql(site)}, now()) on conflict (id) do update set data = excluded.data, updated_at = now();`
  );
}

for (const submission of submissions) {
  const contact = submission.contact || {};
  const phone = sanitizePhone(contact.phone || "");
  lines.push(
    `insert into public.submissions (id, tracking_code, member_id, contact, listing, status, review_note, listing_id, updated_at) values ('${sqlString(submission.id)}', '${sqlString(submission.trackingCode || "")}', '${sqlString(submission.memberId || memberIdFromPhone(phone))}', ${jsonSql(contact)}, ${jsonSql(submission.listing || {})}, '${sqlString(submission.status || "PENDING")}', '${sqlString(submission.reviewNote || "")}', '${sqlString(submission.listingId || "")}', now()) on conflict (id) do update set contact = excluded.contact, listing = excluded.listing, status = excluded.status, review_note = excluded.review_note, listing_id = excluded.listing_id, updated_at = now();`
  );
}

for (const lead of leads) {
  lines.push(
    `insert into public.leads (id, listing_id, data, status, note, updated_at) values ('${sqlString(lead.id)}', '${sqlString(lead.listingId || "")}', ${jsonSql(lead)}, '${sqlString(lead.status || "NEW")}', '${sqlString(lead.note || "")}', now()) on conflict (id) do update set data = excluded.data, status = excluded.status, note = excluded.note, updated_at = now();`
  );
}

lines.push("commit;");
await fs.writeFile(path.join(root, "data", "supabase-seed.sql"), `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote data/supabase-seed.sql with ${listings.length} listings, ${roads.length} roads.`);
