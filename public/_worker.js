const DEFAULT_BACKEND_API_BASE = "";
const DEFAULT_THAI_HOLIDAY_API_URL = "https://api.iapp.co.th/v3/store/data/thai-holiday";
const PAGE_SIZE = 1000;
const READ_TIMEOUT_MS = 15000;
const WRITE_TIMEOUT_MS = 20000;
const PROXY_TIMEOUT_MS = 25000;
const READ_RETRY_DELAYS_MS = [500, 1200];
const READ_TABLES = ["users", "tasks", "kpis", "teams", "holidays", "audit_log", "app_system_links", "app_system_settings"];
const ADMIN_ANNOUNCEMENT_SETTING_KEY = "admin_announcement";
const SERVER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TABLE_COLUMNS_CACHE = new Map();
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_TIMEOUT_MS = 8000;
const TMD_WARNING_NEWS_URL = "https://www.tmd.go.th/api/xml/warning-news";
const TMD_CAP_WARNING_URL = "https://www.tmd.go.th/api/xml/CAP";
const TMD_WARNING_STORM_PAGE_URL = "https://www5.tmd.go.th/warning-and-events/warning-storm";
const GOOGLE_GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_WEATHER_CURRENT_URL = "https://weather.googleapis.com/v1/currentConditions:lookup";
const GOOGLE_WEATHER_TIMEOUT_MS = 8000;
const TMD_WEATHER_TODAY_URL = "https://data.tmd.go.th/api/WeatherToday/V2/";
const TMD_AWS_WEATHER_URL = "https://www.tmd.go.th/api/weather/get-aws-weather-by-province";
const TMD_PROVINCE_SEARCH_URL = "https://www.tmd.go.th/api/Province/getProvinces";
const TMD_WEATHER_TIMEOUT_MS = 6500;
const TMD_PROVINCE_ALIASES = [
  {
    keys: [
      "กรุงเทพ", "bangkok", "ลาดยาว", "จตุจักร", "บางนา", "สายไหม", "ดอนเมือง", "หลักสี่", "บางเขน",
      "ลาดพร้าว", "วังทองหลาง", "ห้วยขวาง", "ดินแดง", "พญาไท", "บางซื่อ", "ดุสิต", "พระนคร",
      "ปทุมวัน", "สาทร", "สีลม", "บางรัก", "คลองเตย", "วัฒนา", "พระโขนง", "สวนหลวง", "ประเวศ",
      "มีนบุรี", "หนองจอก", "ลาดกระบัง", "คลองสามวา", "คันนายาว", "บึงกุ่ม", "สะพานสูง",
      "บางกะปิ", "ธนบุรี", "บางแค", "บางขุนเทียน", "บางบอน", "หนองแขม", "ตลิ่งชัน", "ทวีวัฒนา"
    ],
    province: "กรุงเทพมหานคร",
  },
  { keys: ["ปทุมธานี", "pathum", "ธัญบุรี", "รังสิต", "ลำลูกกา", "คลองหลวง", "หนองเสือ"], province: "ปทุมธานี" },
  { keys: ["นนทบุรี", "nonthaburi", "ปากเกร็ด", "บางใหญ่", "บางบัวทอง", "เมืองทอง"], province: "นนทบุรี" },
  { keys: ["สมุทรปราการ", "samut prakan", "บางพลี", "บางเสาธง", "พระประแดง"], province: "สมุทรปราการ" },
  { keys: ["นครปฐม", "nakhon pathom", "สามพราน", "พุทธมณฑล"], province: "นครปฐม" },
  { keys: ["อยุธยา", "ayutthaya", "พระนครศรีอยุธยา", "วังน้อย", "บางปะอิน"], province: "พระนครศรีอยุธยา" },
  { keys: ["ชลบุรี", "chonburi"], province: "ชลบุรี" },
  { keys: ["ระยอง", "rayong"], province: "ระยอง" },
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-empid, x-session-empid, x-session-id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

function missingBackendConfigResponse(request, apiPath) {
  return jsonResponse(
    request,
    {
      error: "Backend API is not configured",
      endpoint: `/api/${apiPath}`,
      expected: [
        "SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY (or MAXIWA_* equivalents)",
        "MAXIWA_BACKEND_API_BASE for the legacy backend proxy",
      ],
    },
    503,
    { "X-Maxiwa-Proxy": "disabled" }
  );
}

function supabaseSettings(env) {
  const url = env.SUPABASE_URL || env.MAXIWA_SUPABASE_URL;
  const writeKey = env.SUPABASE_SERVICE_ROLE_KEY
    || env.MAXIWA_SUPABASE_SERVICE_ROLE_KEY
    || env.SUPABASE_KEY
    || env.MAXIWA_SUPABASE_KEY
    || env.SUPABASE_ANON_KEY
    || env.MAXIWA_SUPABASE_ANON_KEY;
  const publicKey = env.SUPABASE_ANON_KEY || env.MAXIWA_SUPABASE_ANON_KEY || "";
  if (!url || !writeKey) return null;
  return { url: url.replace(/\/+$/, ""), writeKey, publicKey };
}

function endpoint(settings, table, query = "") {
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  return `${settings.url}/rest/v1/${encodeURIComponent(table)}${qs}`;
}

function getByPath(obj, path) {
  return path.split(".").reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), obj);
}

function firstValue(obj, paths = []) {
  for (const path of paths) {
    const value = getByPath(obj, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function numberValue(value) {
  const raw = typeof value === "object" && value !== null ? firstValue(value, ["Value", "value", "_text", "#text"]) : value;
  const num = Number.parseFloat(String(raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function decodeTmdAlertText(value = "") {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function tmdAlertTagText(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeTmdAlertText(match[1]) : "";
}

function parseTmdWarningXml(xml) {
  const text = String(xml || "");
  const itemMatches = text.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entries = itemMatches.length ? itemMatches : (text.match(/<entry\b[\s\S]*?<\/entry>/gi) || []);
  return entries.map((entry, index) => ({
    id: tmdAlertTagText(entry, "guid") || tmdAlertTagText(entry, "id") || `tmd-warning-${index}`,
    title: tmdAlertTagText(entry, "title"),
    description: tmdAlertTagText(entry, "description") || tmdAlertTagText(entry, "summary"),
    link: tmdAlertTagText(entry, "link"),
    publishedAt: tmdAlertTagText(entry, "pubDate") || tmdAlertTagText(entry, "published") || tmdAlertTagText(entry, "updated"),
    source: "กรมอุตุนิยมวิทยา",
  })).filter((item) => item.title || item.description);
}

function parseTmdWarningPage(html) {
  const alerts = [];
  const text = String(html || "");
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(text))) {
    const title = decodeTmdAlertText(match[2]);
    if (!title || title.length < 18) continue;
    if (!/(ฉบับ|เตือน|พายุ|ฝน|อากาศ|คลื่น|ลม|warning|storm)/i.test(title)) continue;
    const href = String(match[1] || "").trim();
    const link = href.startsWith("http") ? href : new URL(href, TMD_WARNING_STORM_PAGE_URL).toString();
    alerts.push({
      id: `tmd-page-${alerts.length + 1}-${title.slice(0, 24)}`,
      title,
      description: "",
      link,
      publishedAt: "",
      source: "กรมอุตุนิยมวิทยา",
    });
  }
  return alerts.filter((alert, index, list) => list.findIndex((item) => item.title === alert.title) === index);
}

function tmdAlertLooksFresh(alert) {
  const text = `${alert.title || ""} ${alert.description || ""} ${alert.publishedAt || ""}`;
  const yearMatch = text.match(/\b(25\d{2}|20\d{2})\b/);
  if (!yearMatch) return true;
  const rawYear = Number(yearMatch[1]);
  const currentYear = new Date().getFullYear();
  const currentThaiYear = currentYear + 543;
  if (rawYear >= 2500) return rawYear >= currentThaiYear - 1;
  return rawYear >= currentYear - 1;
}

function alertAreaTerms(location = "", province = "") {
  const joined = `${location} ${province}`.toLowerCase();
  const terms = new Set();
  for (const value of [location, province]) {
    String(value || "")
      .split(/[,\s/()]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
      .forEach((part) => terms.add(part.toLowerCase()));
  }
  if (joined.includes("กรุงเทพ") || joined.includes("bangkok")) {
    ["กรุงเทพ", "กรุงเทพมหานคร", "กรุงเทพฯ", "ปริมณฑล", "ภาคกลาง"].forEach((term) => terms.add(term));
  }
  return Array.from(terms);
}

function officialAlertMatchesArea(alert, location = "", province = "") {
  const body = `${alert.title || ""} ${alert.description || ""}`.toLowerCase();
  if (!body) return false;
  const broadTerms = ["ประเทศไทย", "ทั่วประเทศ", "ตอนบน", "ภาคกลาง", "กรุงเทพมหานครและปริมณฑล"];
  if (broadTerms.some((term) => body.includes(term.toLowerCase()))) return true;
  return alertAreaTerms(location, province).some((term) => body.includes(term));
}

async function fetchTmdOfficialAlerts(request, url) {
  const location = String(url.searchParams.get("location") || "").trim();
  const province = String(url.searchParams.get("province") || "").trim();
  try {
    const sources = await Promise.allSettled([
      fetchWithTimeout(TMD_WARNING_STORM_PAGE_URL, { headers: { Accept: "text/html" } }, TMD_WEATHER_TIMEOUT_MS),
      fetchWithTimeout(TMD_WARNING_NEWS_URL, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } }, TMD_WEATHER_TIMEOUT_MS),
      fetchWithTimeout(TMD_CAP_WARNING_URL, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } }, TMD_WEATHER_TIMEOUT_MS),
    ]);
    const parsedAlerts = [];
    for (const [index, result] of sources.entries()) {
      if (result.status !== "fulfilled" || !result.value.ok) continue;
      const body = await result.value.text();
      parsedAlerts.push(...(index === 0 ? parseTmdWarningPage(body) : parseTmdWarningXml(body)));
    }
    const alerts = parsedAlerts
      .filter((alert, index, list) => list.findIndex((item) => item.title === alert.title) === index)
      .filter(tmdAlertLooksFresh)
      .filter((alert) => officialAlertMatchesArea(alert, location, province))
      .slice(0, 3);
    return jsonResponse(request, {
      source: "กรมอุตุนิยมวิทยา",
      sourceUrl: "https://www.tmd.go.th/forecast/forecastWarning",
      alerts,
    }, 200, {
      "Cache-Control": "public, max-age=600",
      "X-Maxiwa-Backend": "tmd-official-alerts",
    });
  } catch (error) {
    return jsonResponse(request, {
      error: error?.message || "TMD official alerts are unavailable",
      source: "กรมอุตุนิยมวิทยา",
      alerts: [],
    }, 502, { "X-Maxiwa-Backend": "tmd-official-alerts-error" });
  }
}

function openMeteoWeatherMeta(code) {
  const weatherCode = Number(code);
  if (weatherCode === 0) return { description: "ท้องฟ้าแจ่มใส", icon: "fa-sun" };
  if ([1, 2, 3].includes(weatherCode)) return { description: "มีเมฆบางส่วน", icon: "fa-cloud-sun" };
  if ([45, 48].includes(weatherCode)) return { description: "หมอก", icon: "fa-smog" };
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return { description: "ฝนปรอย", icon: "fa-cloud-rain" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return { description: "ฝนตก", icon: "fa-cloud-showers-heavy" };
  if ([95, 96, 99].includes(weatherCode)) return { description: "ฝนฟ้าคะนอง", icon: "fa-cloud-bolt" };
  return { description: "สภาพอากาศ", icon: "fa-cloud-sun" };
}

function normalizeOpenMeteoPlace(item = {}) {
  const label = [item.name, item.admin2, item.admin1, item.country].filter(Boolean);
  return {
    id: `openmeteo-${item.id || `${item.latitude},${item.longitude}`}`,
    label: Array.from(new Set(label)).join(", "),
    province: item.admin1 || item.name || "",
    latitude: numberValue(item.latitude),
    longitude: numberValue(item.longitude),
    timezone: item.timezone || "",
    country: item.country || "",
  };
}

async function fetchOpenMeteoPlaces(request, url) {
  const query = String(url.searchParams.get("query") || "").trim();
  if (query.length < 2) return jsonResponse(request, { places: [] }, 200, { "X-Maxiwa-Backend": "open-meteo-geocoding" });
  try {
    const params = new URLSearchParams({
      name: query,
      count: "8",
      language: "th",
      format: "json",
    });
    const res = await fetchWithTimeout(`${OPEN_METEO_GEOCODING_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    }, OPEN_METEO_TIMEOUT_MS);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Open-Meteo Geocoding HTTP ${res.status}`);
    const places = (data?.results || [])
      .map(normalizeOpenMeteoPlace)
      .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
    return jsonResponse(request, { places }, 200, {
      "Cache-Control": "public, max-age=3600",
      "X-Maxiwa-Backend": "open-meteo-geocoding",
    });
  } catch (error) {
    return jsonResponse(request, {
      error: error?.message || "Open-Meteo location search is unavailable",
      places: [],
    }, 502, { "X-Maxiwa-Backend": "open-meteo-geocoding-error" });
  }
}

async function fetchOpenMeteoWeather(request, url) {
  try {
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const label = String(url.searchParams.get("label") || url.searchParams.get("province") || "").trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return jsonResponse(request, { error: "Weather location is missing latitude/longitude" }, 400, { "X-Maxiwa-Backend": "open-meteo" });
    }
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
      hourly: "precipitation_probability,precipitation,rain,showers,weather_code,wind_speed_10m",
      timezone: "auto",
      forecast_days: "1",
      forecast_hours: "6",
    });
    const res = await fetchWithTimeout(`${OPEN_METEO_FORECAST_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    }, OPEN_METEO_TIMEOUT_MS);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.reason || `Open-Meteo HTTP ${res.status}`);
    const current = data?.current || {};
    const hourly = data?.hourly || {};
    const hourlyRows = Array.isArray(hourly.time)
      ? hourly.time.map((time, index) => ({
        time,
        precipitationProbability: numberValue(hourly.precipitation_probability?.[index]),
        precipitation: numberValue(hourly.precipitation?.[index]),
        rain: numberValue(hourly.rain?.[index]),
        showers: numberValue(hourly.showers?.[index]),
        weatherCode: numberValue(hourly.weather_code?.[index]),
        wind: numberValue(hourly.wind_speed_10m?.[index]),
      }))
      : [];
    const nextHours = hourlyRows
      .filter((row) => !current.time || String(row.time || "") >= String(current.time))
      .slice(0, 3);
    const shortTermRows = nextHours.length ? nextHours : hourlyRows.slice(0, 3);
    const shortTermPrecip = shortTermRows.reduce((sum, row) => {
      const value = Number(row.precipitation ?? row.rain ?? row.showers);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const shortTermProbability = shortTermRows.reduce((max, row) => {
      const value = Number(row.precipitationProbability);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    const shortTermWind = shortTermRows.reduce((max, row) => {
      const value = Number(row.wind);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    const stormSoon = shortTermRows.some((row) => [95, 96, 99].includes(Number(row.weatherCode)));
    const firstRainRow = shortTermRows.find((row) => {
      const precipitation = Number(row.precipitation ?? row.rain ?? row.showers);
      const probability = Number(row.precipitationProbability);
      return (Number.isFinite(precipitation) && precipitation > 0) || (Number.isFinite(probability) && probability >= 50);
    });
    const meta = openMeteoWeatherMeta(current.weather_code);
    return jsonResponse(request, {
      source: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      weather: {
        location: label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        stationName: "",
        temp: numberValue(current.temperature_2m),
        humidity: numberValue(current.relative_humidity_2m),
        wind: numberValue(current.wind_speed_10m),
        rainfall: numberValue(current.precipitation ?? current.rain),
        description: meta.description,
        observedAt: current.time || "",
        icon: meta.icon,
        shortTerm: {
          hours: shortTermRows.length,
          precipitation: Math.round(shortTermPrecip * 10) / 10,
          precipitationProbability: Math.round(shortTermProbability),
          wind: Math.round(shortTermWind),
          stormSoon,
          firstRainTime: firstRainRow?.time || "",
          source: "Open-Meteo hourly forecast",
        },
      },
    }, 200, {
      "Cache-Control": "public, max-age=300",
      "X-Maxiwa-Backend": "open-meteo",
    });
  } catch (error) {
    return jsonResponse(request, {
      error: error?.message || "Open-Meteo weather is unavailable",
      source: "Open-Meteo",
    }, 502, { "X-Maxiwa-Backend": "open-meteo-error" });
  }
}

function googleMapsApiKey(env) {
  return env.GOOGLE_MAPS_API_KEY
    || env.GOOGLE_WEATHER_API_KEY
    || env.GOOGLE_API_KEY
    || env.MAXIWA_GOOGLE_MAPS_API_KEY
    || env.MAXIWA_GOOGLE_WEATHER_API_KEY
    || "";
}

function googleConfigError(request) {
  return jsonResponse(request, {
    error: "Google Weather API key is not configured",
    expected: ["GOOGLE_MAPS_API_KEY", "GOOGLE_WEATHER_API_KEY", "GOOGLE_API_KEY", "MAXIWA_GOOGLE_MAPS_API_KEY"],
  }, 503, { "X-Maxiwa-Backend": "google-weather-config" });
}

function googleAddressPart(result, type) {
  return (result?.address_components || []).find((part) => (part.types || []).includes(type))?.long_name || "";
}

function normalizeGooglePlace(result = {}) {
  const location = result.geometry?.location || {};
  const district = googleAddressPart(result, "sublocality_level_1")
    || googleAddressPart(result, "administrative_area_level_2")
    || googleAddressPart(result, "locality");
  const province = googleAddressPart(result, "administrative_area_level_1") || district;
  const labelParts = [district, province].filter(Boolean);
  const label = labelParts.length > 0
    ? Array.from(new Set(labelParts)).join(", ")
    : String(result.formatted_address || "").replace(/,\s*Thailand$/i, "");
  return {
    id: `google-${result.place_id || `${location.lat},${location.lng}`}`,
    label,
    province,
    latitude: numberValue(location.lat),
    longitude: numberValue(location.lng),
    placeId: result.place_id || "",
    formattedAddress: result.formatted_address || "",
  };
}

async function geocodeGoogleLocation(env, query) {
  const key = googleMapsApiKey(env);
  if (!key) throw new Error("Google Weather API key is not configured");
  const params = new URLSearchParams({
    address: `${query}, Thailand`,
    components: "country:TH",
    language: "th",
    region: "th",
    key,
  });
  const res = await fetchWithTimeout(`${GOOGLE_GEOCODING_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  }, GOOGLE_WEATHER_TIMEOUT_MS);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== "OK") throw new Error(data?.error_message || `Google Geocoding ${data?.status || res.status}`);
  return (data.results || []).map(normalizeGooglePlace).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

async function fetchGooglePlaces(request, url, env) {
  const query = String(url.searchParams.get("query") || "").trim();
  if (query.length < 2) return jsonResponse(request, { places: [] }, 200, { "X-Maxiwa-Backend": "google-geocoding" });
  if (!googleMapsApiKey(env)) return googleConfigError(request);
  try {
    const places = await geocodeGoogleLocation(env, query);
    return jsonResponse(request, { places: places.slice(0, 8) }, 200, {
      "Cache-Control": "public, max-age=3600",
      "X-Maxiwa-Backend": "google-geocoding",
    });
  } catch (error) {
    return jsonResponse(request, {
      error: error?.message || "Google location search is unavailable",
      places: [],
    }, 502, { "X-Maxiwa-Backend": "google-geocoding-error" });
  }
}

function googleWeatherIcon(type = "") {
  const key = String(type || "").toUpperCase();
  if (key.includes("THUNDER")) return "fa-cloud-bolt";
  if (key.includes("RAIN") || key.includes("DRIZZLE") || key.includes("SHOWERS")) return "fa-cloud-showers-heavy";
  if (key.includes("CLOUD")) return "fa-cloud-sun";
  if (key.includes("FOG") || key.includes("HAZE") || key.includes("MIST")) return "fa-smog";
  if (key.includes("CLEAR") || key.includes("SUN")) return "fa-sun";
  return "fa-cloud-sun";
}

async function fetchGoogleWeather(request, url, env) {
  if (!googleMapsApiKey(env)) return googleConfigError(request);
  try {
    let lat = Number(url.searchParams.get("lat"));
    let lon = Number(url.searchParams.get("lon"));
    let label = String(url.searchParams.get("label") || url.searchParams.get("province") || "").trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const places = await geocodeGoogleLocation(env, label || "กรุงเทพมหานคร");
      const first = places[0];
      lat = first?.latitude;
      lon = first?.longitude;
      label = first?.label || label;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return jsonResponse(request, { error: "Weather location is missing latitude/longitude" }, 400, { "X-Maxiwa-Backend": "google-weather" });
    }
    const params = new URLSearchParams({
      key: googleMapsApiKey(env),
      "location.latitude": String(lat),
      "location.longitude": String(lon),
      unitsSystem: "METRIC",
      languageCode: "th",
    });
    const res = await fetchWithTimeout(`${GOOGLE_WEATHER_CURRENT_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    }, GOOGLE_WEATHER_TIMEOUT_MS);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message || `Google Weather HTTP ${res.status}`);
    const condition = data?.weatherCondition || {};
    const description = condition.description?.text || condition.type || "";
    return jsonResponse(request, {
      source: "Google Weather",
      sourceUrl: "https://developers.google.com/maps/documentation/weather",
      weather: {
        location: label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        stationName: "",
        temp: numberValue(data?.temperature?.degrees),
        humidity: numberValue(data?.relativeHumidity),
        wind: numberValue(data?.wind?.speed?.value),
        rainfall: numberValue(data?.currentConditionsHistory?.qpf?.quantity ?? data?.precipitation?.qpf?.quantity),
        precipitationProbability: numberValue(data?.precipitation?.probability?.percent),
        description,
        observedAt: data?.currentTime || "",
        icon: googleWeatherIcon(condition.type || description),
      },
    }, 200, {
      "Cache-Control": "public, max-age=300",
      "X-Maxiwa-Backend": "google-weather",
    });
  } catch (error) {
    return jsonResponse(request, {
      error: error?.message || "Google Weather is unavailable",
      source: "Google Weather",
    }, 502, { "X-Maxiwa-Backend": "google-weather-error" });
  }
}

function provinceForTmd(value = "") {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "กรุงเทพมหานคร";
  const match = TMD_PROVINCE_ALIASES.find((item) => item.keys.some((alias) => key.includes(alias.toLowerCase())));
  return match?.province || String(value || "").split(",")[0].trim() || "กรุงเทพมหานคร";
}

function normalizeSearchText(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function localTmdProvinceMatches(query) {
  const key = normalizeSearchText(query);
  if (key.length < 2) return [];
  return TMD_PROVINCE_ALIASES.filter((item) => {
    const province = normalizeSearchText(item.province);
    return province.includes(key)
      || item.keys.some((alias) => {
        const aliasKey = normalizeSearchText(alias);
        return aliasKey.includes(key) || key.includes(aliasKey);
      });
  }).map((item) => ({
    id: `tmd-local-${encodeURIComponent(item.province)}`,
    label: normalizeSearchText(item.province).includes(key) ? item.province : `${query} (${item.province})`,
    province: item.province,
    latitude: null,
    longitude: null,
    localMatch: true,
  }));
}

function tmdWeatherDescription(weatherType) {
  const code = String(weatherType ?? "").padStart(2, "0");
  const descriptions = {
    "01": "ท้องฟ้าแจ่มใส",
    "02": "มีเมฆบางส่วน",
    "03": "มีเมฆเป็นส่วนมาก",
    "04": "มีเมฆมาก",
    "05": "ฝนตก",
    "63": "ฝนฟ้าคะนอง",
  };
  return descriptions[code] || "";
}

function normalizeTmdAwsStation(row = {}) {
  return {
    name: row.stationNameTh || row.stationNameEn || "TMD AWS Station",
    province: row.provinceNameTh || row.provinceNameEn || "",
    lat: numberValue(row.stationLat),
    lon: numberValue(row.stationLon),
    temperature: numberValue(row.temperature),
    humidity: numberValue(row.humidity),
    wind: numberValue(row.windSpeed),
    rainfall: numberValue(row.precipToday ?? row.precip1Hr ?? row.precip15Mins),
    description: tmdWeatherDescription(row.weatherType),
    time: row.dateTimeUtc7 || "",
  };
}

async function fetchTmdProvinces(request, url) {
  const query = String(url.searchParams.get("query") || "").trim();
  if (query.length < 2) return jsonResponse(request, { provinces: [] }, 200, { "X-Maxiwa-Backend": "tmd" });
  const localMatches = localTmdProvinceMatches(query);
  try {
    const tmdUrl = `${TMD_PROVINCE_SEARCH_URL}?FilterText=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(tmdUrl, { headers: { Accept: "application/json" } }, TMD_WEATHER_TIMEOUT_MS);
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(`TMD province HTTP ${res.status}`);
    const tmdProvinces = (Array.isArray(data) ? data : []).map((item) => ({
      id: `tmd-province-${item.id || item.geoCode || item.nameEN || item.name}`,
      label: item.name || item.nameEN || "",
      province: item.name || item.nameEN || "",
      latitude: numberValue(item.latitude),
      longitude: numberValue(item.longitude),
      nameEN: item.nameEN || "",
    })).filter((item) => item.label && item.province);
    const byProvince = new Map();
    [...localMatches, ...tmdProvinces].forEach((item) => {
      const key = normalizeSearchText(item.province);
      if (key && !byProvince.has(key)) byProvince.set(key, item);
    });
    const provinces = Array.from(byProvince.values());
    return jsonResponse(request, { provinces }, 200, {
      "Cache-Control": "public, max-age=3600",
      "X-Maxiwa-Backend": "tmd",
    });
  } catch (error) {
    return jsonResponse(request, {
      error: error?.message || "TMD province search is unavailable",
      provinces: localMatches,
    }, localMatches.length > 0 ? 200 : 502, { "X-Maxiwa-Backend": localMatches.length > 0 ? "tmd" : "tmd-error" });
  }
}

function decodeXmlText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .trim();
}

function xmlTagValue(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXmlText(match[1]) : "";
}

function parseTmdXmlStations(xml) {
  const stations = [];
  const stationMatches = String(xml || "").match(/<Station(?:\s[^>]*)?>[\s\S]*?<\/Station>/gi) || [];
  for (const stationXml of stationMatches) {
    const observationXml = (stationXml.match(/<Observation(?:\s[^>]*)?>[\s\S]*?<\/Observation>/i) || [""])[0];
    stations.push({
      StationNameThai: xmlTagValue(stationXml, "StationNameThai"),
      StationNameEnglish: xmlTagValue(stationXml, "StationNameEnglish"),
      Province: xmlTagValue(stationXml, "Province"),
      Latitude: xmlTagValue(stationXml, "Latitude"),
      Longitude: xmlTagValue(stationXml, "Longitude"),
      Observation: {
        DateTime: xmlTagValue(observationXml, "DateTime"),
        Temperature: xmlTagValue(observationXml, "Temperature"),
        RelativeHumidity: xmlTagValue(observationXml, "RelativeHumidity"),
        WindSpeed: xmlTagValue(observationXml, "WindSpeed"),
        Rainfall: xmlTagValue(observationXml, "Rainfall"),
        WeatherDescriptionThai: xmlTagValue(observationXml, "Weather") || xmlTagValue(observationXml, "WeatherDescriptionThai"),
      },
    });
  }
  return stations;
}

function collectTmdStations(value, stations = []) {
  if (!value || typeof value !== "object") return stations;
  if (Array.isArray(value)) {
    value.forEach((item) => collectTmdStations(item, stations));
    return stations;
  }
  const hasStationName = firstValue(value, ["StationNameThai", "StationName", "StationNameEnglish", "Name"]);
  const hasObserve = value.Observe || value.Observation || value.WeatherObservation;
  if (hasStationName && hasObserve) stations.push(value);
  for (const child of Object.values(value)) collectTmdStations(child, stations);
  return stations;
}

function distanceKm(a, b) {
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon) || !Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return Number.POSITIVE_INFINITY;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeTmdStation(row) {
  const observe = row.Observe || row.Observation || row.WeatherObservation || row || {};
  const station = {
    name: firstValue(row, ["StationNameThai", "StationName", "StationNameEnglish", "Name", "name"]) || "TMD Station",
    province: firstValue(row, ["Province", "ProvinceName", "ProvinceThai", "StationProvince", "province"]) || "",
    lat: numberValue(firstValue(row, ["Latitude", "Lat", "latitude", "lat"])),
    lon: numberValue(firstValue(row, ["Longitude", "Lon", "Long", "longitude", "lon"])),
    temperature: numberValue(firstValue(observe, ["Temperature.Value", "Temperature", "MeanTemperature.Value", "MeanTemperature", "temperature"])),
    humidity: numberValue(firstValue(observe, ["RelativeHumidity.Value", "RelativeHumidity", "Humidity.Value", "Humidity", "humidity"])),
    wind: numberValue(firstValue(observe, ["WindSpeed.Value", "WindSpeed", "wind"])),
    rainfall: numberValue(firstValue(observe, ["Rainfall.Value", "Rainfall", "Rainfall24Hr.Value", "Rainfall24Hr", "rainfall"])),
    description: firstValue(observe, ["Weather", "WeatherDescription", "WeatherDescriptionThai", "Condition", "description"]) || "",
    time: firstValue(observe, ["Time", "DateTime", "ObservationTime", "time"]) || "",
  };
  return station;
}

function chooseTmdStation(stations, { province = "", lat = null, lon = null } = {}) {
  const normalized = stations.map(normalizeTmdStation).filter((station) => station.name);
  const provinceKey = String(province || "").trim().toLowerCase();
  if (provinceKey) {
    const exact = normalized.find((station) => [station.province, station.name].some((value) => String(value || "").toLowerCase().includes(provinceKey)));
    if (exact) return exact;
  }
  const point = { lat: Number(lat), lon: Number(lon) };
  if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
    return normalized
      .map((station) => ({ station, distance: distanceKm(point, { lat: station.lat, lon: station.lon }) }))
      .sort((a, b) => a.distance - b.distance)[0]?.station || normalized[0] || null;
  }
  return normalized[0] || null;
}

async function fetchTmdWeather(request, url) {
  try {
    const awsProvince = provinceForTmd(url.searchParams.get("province") || "");
    const awsUrl = `${TMD_AWS_WEATHER_URL}?province=${encodeURIComponent(awsProvince)}`;
    const awsRes = await fetchWithTimeout(awsUrl, { headers: { Accept: "application/json" } }, TMD_WEATHER_TIMEOUT_MS);
    const awsData = await awsRes.json().catch(() => null);
    if (!awsRes.ok) throw new Error(awsData?.message || `TMD AWS weather HTTP ${awsRes.status}`);
    const awsStations = (Array.isArray(awsData?.data) ? awsData.data : []).map(normalizeTmdAwsStation);
    const awsStation = chooseTmdStation(awsStations, {
      province: awsProvince,
      lat: url.searchParams.get("lat"),
      lon: url.searchParams.get("lon"),
    });
    if (awsStation) {
      return jsonResponse(request, {
        source: "TMD",
        sourceUrl: "https://www.tmd.go.th/",
        station: awsStation,
        weather: {
          location: awsStation.province || awsProvince,
          stationName: awsStation.name,
          temp: awsStation.temperature,
          humidity: awsStation.humidity,
          wind: awsStation.wind,
          rainfall: awsStation.rainfall,
          description: awsStation.description,
          observedAt: awsStation.time,
        },
      }, 200, {
        "Cache-Control": "public, max-age=300",
        "X-Maxiwa-Backend": "tmd",
      });
    }

    const params = new URLSearchParams({ uid: "api", ukey: "api12345" });
    const res = await fetchWithTimeout(`${TMD_WEATHER_TODAY_URL}?${params.toString()}`, {
      headers: { Accept: "application/xml,text/xml,application/json" },
    }, TMD_WEATHER_TIMEOUT_MS);
    const text = await res.text();
    if (!res.ok) throw new Error(`TMD weather HTTP ${res.status}`);
    let stations = [];
    try {
      stations = collectTmdStations(JSON.parse(text));
    } catch {
      stations = parseTmdXmlStations(text);
    }
    const station = chooseTmdStation(stations, {
      province: url.searchParams.get("province") || "",
      lat: url.searchParams.get("lat"),
      lon: url.searchParams.get("lon"),
    });
    if (!station) return jsonResponse(request, { error: "No TMD station data found" }, 502, { "X-Maxiwa-Backend": "tmd" });
    return jsonResponse(request, {
      source: "TMD",
      sourceUrl: "https://www.tmd.go.th/",
      station,
      weather: {
        location: station.province || station.name,
        stationName: station.name,
        temp: station.temperature,
        humidity: station.humidity,
        wind: station.wind,
        rainfall: station.rainfall,
        description: station.description,
        observedAt: station.time,
      },
    }, 200, {
      "Cache-Control": "public, max-age=300",
      "X-Maxiwa-Backend": "tmd",
    });
  } catch (error) {
    return jsonResponse(request, {
      error: error?.message || "TMD weather is unavailable",
      source: "TMD",
      sourceUrl: "https://www.tmd.go.th/",
    }, 502, { "X-Maxiwa-Backend": "tmd-error" });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutError(timeoutMs) {
  const error = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
  error.code = "REQUEST_TIMEOUT";
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = READ_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(timeoutError(timeoutMs)), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError" || error?.code === "REQUEST_TIMEOUT") throw timeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableReadError(error) {
  return error?.code === "REQUEST_TIMEOUT"
    || error?.name === "TypeError"
    || error?.status === 408
    || error?.status === 425
    || error?.status === 429
    || (error?.status >= 500 && error?.status <= 599);
}

async function retryRead(operation) {
  let lastError;
  for (let attempt = 0; attempt <= READ_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableReadError(error) || attempt === READ_RETRY_DELAYS_MS.length) break;
      await sleep(READ_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

async function supabaseFetch(env, table, query = "") {
  const settings = supabaseSettings(env);
  if (!settings) throw new Error("Supabase environment variables are not configured");
  return retryRead(async () => {
    const res = await fetchWithTimeout(endpoint(settings, table, query), {
      headers: {
        apikey: settings.writeKey,
        Authorization: `Bearer ${settings.writeKey}`,
        Accept: "application/json",
      },
    }, READ_TIMEOUT_MS);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error = new Error(data?.message || data?.error || `Supabase ${table} HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return Array.isArray(data) ? data : [];
  });
}

async function supabaseWrite(env, table, { method = "POST", query = "", body, prefer = "return=representation" } = {}) {
  const settings = supabaseSettings(env);
  if (!settings) throw new Error("Supabase environment variables are not configured");
  const res = await fetchWithTimeout(endpoint(settings, table, query), {
    method,
    headers: {
      apikey: settings.writeKey,
      Authorization: `Bearer ${settings.writeKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, WRITE_TIMEOUT_MS);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase ${table} HTTP ${res.status}`);
  return Array.isArray(data) ? data : (data ? [data] : []);
}

async function readAll(env, table, queryPrefix = "select=*") {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const sep = queryPrefix ? "&" : "";
    const page = await supabaseFetch(env, table, `${queryPrefix}${sep}limit=${PAGE_SIZE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function readAllForDashboard(env, table) {
  try {
    return { rows: await readAll(env, table), error: "" };
  } catch (error) {
    console.warn(`Dashboard read failed for ${table}:`, error?.message || error);
    return { rows: [], error: error?.message || `Failed to read ${table}` };
  }
}

async function tableColumns(env, table) {
  if (TABLE_COLUMNS_CACHE.has(table)) return TABLE_COLUMNS_CACHE.get(table);
  const promise = supabaseFetch(env, table, "select=*&limit=1")
    .then((page) => (page[0] ? new Set(Object.keys(page[0])) : null))
    .catch((error) => {
      TABLE_COLUMNS_CACHE.delete(table);
      throw error;
    });
  TABLE_COLUMNS_CACHE.set(table, promise);
  return promise;
}

function shapeWithColumns(row, columns) {
  const clean = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (value === undefined) continue;
    if (!columns || columns.has(key)) clean[key] = value;
  }
  return clean;
}

async function shapeForTable(env, table, row) {
  const columns = await tableColumns(env, table);
  return shapeWithColumns(row, columns);
}

function userEmpId(user) {
  return String(user?.empid || user?.empId || "").trim();
}

function serverSessionColumns(columns) {
  if (!columns?.has("active_session_id")) return null;
  return {
    id: "active_session_id",
    expiresAt: columns.has("active_session_expires_at") ? "active_session_expires_at" : null,
    updatedAt: columns.has("active_session_updated_at") ? "active_session_updated_at" : null,
  };
}

async function writeServerSession(env, user, requestedSessionId = "") {
  const columns = await tableColumns(env, "users");
  const sessionColumns = serverSessionColumns(columns);
  const sessionId = String(requestedSessionId || randomId()).trim();
  if (!sessionColumns) return { sessionId, enforced: false };
  const empid = userEmpId(user);
  if (!empid) return { sessionId, enforced: false };
  const empColumn = columns?.has("empid") ? "empid" : (columns?.has("empId") ? "empId" : "empid");
  const expiresAt = new Date(Date.now() + SERVER_SESSION_TTL_MS).toISOString();
  const updates = {
    [sessionColumns.id]: sessionId,
    ...(sessionColumns.expiresAt ? { [sessionColumns.expiresAt]: expiresAt } : {}),
    ...(sessionColumns.updatedAt ? { [sessionColumns.updatedAt]: new Date().toISOString() } : {}),
  };
  await supabaseWrite(env, "users", {
    method: "PATCH",
    query: `${empColumn}=eq.${encodeEq(empid)}`,
    body: updates,
    prefer: "return=minimal",
  });
  return { sessionId, enforced: true, expiresAt };
}

async function validateServerSession(request, env) {
  const sessionId = String(request.headers.get("x-session-id") || "").trim();
  const empId = String(request.headers.get("x-session-empid") || "").trim();
  if (!sessionId || !empId) return { ok: true, enforced: false };
  const columns = await tableColumns(env, "users");
  const sessionColumns = serverSessionColumns(columns);
  if (!sessionColumns) return { ok: true, enforced: false };
  const user = await findUserByEmpId(env, empId).catch(() => null);
  if (!user) return { ok: false, status: 401, error: "Session user was not found" };
  const activeSessionId = String(user[sessionColumns.id] || "").trim();
  const expiresAt = sessionColumns.expiresAt ? new Date(user[sessionColumns.expiresAt] || "") : null;
  if (activeSessionId && activeSessionId !== sessionId) {
    return { ok: false, status: 409, code: "SESSION_SUPERSEDED", error: "This account is active in another session" };
  }
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 401, code: "SESSION_EXPIRED", error: "Session expired" };
  }
  const empColumn = columns?.has("empid") ? "empid" : (columns?.has("empId") ? "empId" : "empid");
  const updates = {
    ...(sessionColumns.expiresAt ? { [sessionColumns.expiresAt]: new Date(Date.now() + SERVER_SESSION_TTL_MS).toISOString() } : {}),
    ...(sessionColumns.updatedAt ? { [sessionColumns.updatedAt]: new Date().toISOString() } : {}),
  };
  if (Object.keys(updates).length > 0) {
    await supabaseWrite(env, "users", {
      method: "PATCH",
      query: `${empColumn}=eq.${encodeEq(empId)}`,
      body: updates,
      prefer: "return=minimal",
    }).catch(() => null);
  }
  return { ok: true, enforced: true };
}

function encodeEq(value) {
  return encodeURIComponent(String(value ?? "").trim());
}

export function bangkokDateKey(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const sourceDate = value ? new Date(value) : new Date();
  if (Number.isNaN(sourceDate.getTime())) return "";
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(sourceDate).map((part) => [part.type, part.value])
    );
    if (parts.year && parts.month && parts.day) return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    // Fall back to UTC only if the runtime cannot format Bangkok time.
  }
  return sourceDate.toISOString().slice(0, 10);
}

function dateFromDateKey(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function dateKeyFromUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

export function todayIso() {
  return bangkokDateKey(new Date());
}

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isTerminalStatus(status) {
  const s = statusKey(status);
  return s === "completed" || s === "cancelled";
}

function statusKey(status) {
  return String(status || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function normalizeStatus(status, fallback = "Pending") {
  const raw = String(status || fallback).trim() || fallback;
  const key = statusKey(raw);
  if (key === "on process") return "On Process";
  if (key === "on hold") return "On Hold";
  if (key === "pending") return "Pending";
  if (key === "completed") return "Completed";
  if (key === "cancelled") return "Cancelled";
  return raw;
}

function appendTaskNote(existingNote, nextNote) {
  const previous = String(existingNote || "").trim();
  const incoming = String(nextNote || "").trim();
  if (!incoming) return previous;
  return previous ? `${previous}\n${incoming}` : incoming;
}

function kpiMain(row) {
  return row?.main ?? row?.mainkpi ?? row?.mainKpi ?? "";
}

function kpiSub(row) {
  return row?.sub ?? row?.subkpi ?? row?.subKpi ?? "";
}

function kpiWeight(row) {
  const raw = row?.main_weight ?? row?.mainkpiweight ?? row?.weight ?? 1;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function isActiveFlag(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  return !["false", "0", "inactive", "disabled", "no", "n"].includes(text);
}

export function activeHolidayDates(holidays) {
  return new Set((holidays || [])
    .filter((h) => isActiveFlag(h.is_active ?? h.active ?? true))
    .map((h) => String(h.holiday_date || h.date || "").slice(0, 10))
    .filter(Boolean));
}

function currentYearBangkok() {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());
  return Number(year) || new Date().getUTCFullYear();
}

function normalizeHolidayYears(input) {
  const current = currentYearBangkok();
  const rawYears = Array.isArray(input?.years)
    ? input.years
    : (input?.year ? [input.year] : [current, current + 1]);
  const years = rawYears
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100);
  return [...new Set(years)].slice(0, 5);
}

async function fetchThaiPublicHolidays(year) {
  const res = await fetchWithTimeout(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`, { headers: { Accept: "application/json" } }, READ_TIMEOUT_MS);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Nager.Date HTTP ${res.status}`);
  return normalizeThaiHolidayResponse(data, year, "nager.date");
}

function thaiHolidayApiUrl(env) {
  return env.THAI_HOLIDAY_API_URL || env.IAPP_THAI_HOLIDAY_API_URL || DEFAULT_THAI_HOLIDAY_API_URL;
}

function thaiHolidayHeaders(env) {
  const headers = { Accept: "application/json" };
  const key = env.THAI_HOLIDAY_API_KEY || env.IAPP_API_KEY || env.IAPP_KEY || "";
  if (key) {
    headers.apikey = key;
    headers["x-api-key"] = key;
    headers.Authorization = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
  }
  return headers;
}

function pickHolidayArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["data", "items", "holidays", "holiday", "results", "rows"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  for (const key of ["data", "result", "response", "payload"]) {
    const nested = pickHolidayArray(data[key]);
    if (nested.length > 0) return nested;
  }
  return [];
}

export function normalizeThaiHolidayDate(value) {
  const text = String(value || "").trim();
  const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  const match = ymd || dmy;
  if (!match) return "";
  let year = Number(ymd ? match[1] : match[3]);
  const rawMonth = Number(ymd ? match[2] : match[2]);
  const rawDay = Number(ymd ? match[3] : match[1]);
  const month = String(rawMonth).padStart(2, "0");
  const day = String(rawDay).padStart(2, "0");
  if (year >= 2400) year -= 543;
  if (!year || rawMonth < 1 || rawMonth > 12 || rawDay < 1 || rawDay > 31) return "";
  return `${year}-${month}-${day}`;
}

export function normalizeThaiHolidayResponse(data, year, provider = "iapp") {
  const rows = pickHolidayArray(data);
  return rows.map((item) => {
    const rawDate = item.date || item.holiday_date || item.holidayDate || item.holiday_date_ad || item.date_ad
      || item.startDate || item.start_date || item.start || item.day || item.holiday
      || item.date_th || item.holiday_date_th || item.date_buddhist;
    const date = normalizeThaiHolidayDate(
      rawDate
    );
    if (!date || (year && !date.startsWith(String(year)))) return null;
    return {
      date,
      localName: item.localName || item.local_name || item.nameTh || item.name_th || item.nameThai || item.name_thai || item.thaiName || item.thai_name || item.name || item.title || item.summary || "",
      name: item.name || item.nameEn || item.name_en || item.nameEnglish || item.name_english || item.englishName || item.english_name || item.localName || item.title || item.summary || "",
      countryCode: "TH",
      global: item.global ?? item.active ?? true,
      types: item.types || item.type || ["Public"],
      provider,
    };
  }).filter(Boolean);
}

async function fetchThaiPublicHolidaysFromIapp(env, year) {
  const apiUrl = new URL(thaiHolidayApiUrl(env));
  if (!apiUrl.searchParams.has("year")) apiUrl.searchParams.set("year", String(year));
  const res = await fetchWithTimeout(apiUrl.toString(), { headers: thaiHolidayHeaders(env) }, READ_TIMEOUT_MS);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || `iApp Thai holiday HTTP ${res.status}`);
  return normalizeThaiHolidayResponse(data, year, "iapp");
}

async function fetchThaiPublicHolidaysForYear(env, year) {
  const iappRows = await fetchThaiPublicHolidaysFromIapp(env, year).catch(() => []);
  if (iappRows.length > 0) return iappRows;
  return fetchThaiPublicHolidays(year);
}

async function upsertHolidayRow(env, row, columns) {
  const shaped = shapeWithColumns(row, columns);
  const date = shaped.holiday_date || row.holiday_date;
  const existing = date
    ? await supabaseFetch(env, "holidays", `select=*&holiday_date=eq.${encodeEq(date)}&limit=1`).then((rows) => rows[0]).catch(() => null)
    : null;
  if (existing?.id) {
    const rows = await supabaseWrite(env, "holidays", {
      method: "PATCH",
      query: `id=eq.${encodeEq(existing.id)}`,
      body: shaped,
    });
    return rows[0] || { ...existing, ...shaped };
  }
  if (existing && date) {
    const rows = await supabaseWrite(env, "holidays", {
      method: "PATCH",
      query: `holiday_date=eq.${encodeEq(date)}`,
      body: shaped,
    });
    return rows[0] || { ...existing, ...shaped };
  }
  if (shaped.id && (!columns || columns.has("id"))) {
    const rows = await supabaseWrite(env, "holidays", {
      query: "on_conflict=id",
      body: shaped,
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return rows[0] || shaped;
  }
  const rows = await supabaseWrite(env, "holidays", { body: shaped });
  return rows[0] || shaped;
}

async function syncThaiPublicHolidays(env, body = {}) {
  const years = normalizeHolidayYears(body);
  const columns = await tableColumns(env, "holidays");
  const holidayColumns = columns || new Set(["id", "holiday_date", "name", "is_active"]);
  const rawRows = [];

  for (const year of years) {
    const holidays = await fetchThaiPublicHolidaysForYear(env, year);
    for (const item of holidays) {
      const date = String(item.date || "").slice(0, 10);
      if (!date) continue;
      const provider = item.provider || "iapp";
      rawRows.push({
        holiday_date: date,
        name: item.localName || item.name || `Thailand public holiday ${date}`,
        is_active: true,
        source: "thai_public",
        holiday_source: "thai_public",
        type: "thai_public",
        country_code: "TH",
        external_id: `${provider}-th-${date}`,
        provider,
      });
    }
  }

  let synced = [];
  for (const row of rawRows) synced.push(await upsertHolidayRow(env, row, holidayColumns));

  return { ok: true, years, imported: synced.length, holidays: synced };
}

export function addWorkingDays(startDate, days, holidays = []) {
  const holidaySet = activeHolidayDates(holidays);
  const date = dateFromDateKey(startDate ? bangkokDateKey(startDate) : todayIso()) || dateFromDateKey(todayIso());
  let remaining = Math.max(0, Number(days || 0));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    const iso = dateKeyFromUtcDate(date);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) remaining -= 1;
  }
  return dateKeyFromUtcDate(date);
}

function normalizeDateOnly(value) {
  if (!value) return null;
  return dateFromDateKey(bangkokDateKey(value));
}

export function businessDaysBetween(startValue, endValue, holidays = []) {
  const start = normalizeDateOnly(startValue);
  const end = normalizeDateOnly(endValue);
  if (!start || !end || start.getTime() === end.getTime()) return 0;
  const holidaySet = activeHolidayDates(holidays);
  const direction = end > start ? 1 : -1;
  const cursor = new Date(start);
  let count = 0;
  while (cursor.getTime() !== end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    const day = cursor.getUTCDay();
    const iso = dateKeyFromUtcDate(cursor);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) count += direction;
  }
  return count;
}

function normalizeExtraData(extraData) {
  if (!extraData) return {};
  if (typeof extraData === "string") {
    try { return JSON.parse(extraData); } catch { return {}; }
  }
  return typeof extraData === "object" ? extraData : {};
}

function userPermissions(user) {
  const raw = user?.permissions;
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  return typeof raw === "object" ? raw : {};
}

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

function kpiCompositeKey(row) {
  return `${normalizeKeyPart(row?.team)}::${normalizeKeyPart(kpiMain(row))}::${normalizeKeyPart(kpiSub(row))}`;
}

function kpiOverrideKeys(row) {
  return [
    row?.id ? String(row.id) : "",
    kpiCompositeKey(row),
  ].filter(Boolean);
}

function numericWeight(value, fallback = null) {
  const raw = typeof value === "object" && value !== null
    ? (value.weight ?? value.main_weight ?? value.mainWeight)
    : value;
  const number = typeof raw === "string" ? Number.parseFloat(raw.replace("%", "").trim()) : Number(raw);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function personalKpiWeight(user, kpi) {
  const permissions = userPermissions(user);
  const overrides = permissions.kpiOverrides || user?.kpiOverrides || {};
  for (const key of kpiOverrideKeys(kpi)) {
    const override = numericWeight(overrides[key], null);
    if (override !== null) return override;
  }
  return kpiWeight(kpi);
}

function kpiAssignments(user) {
  return userPermissions(user).kpiAssignments || user?.kpiAssignments || {};
}

function hasAnyKpiAssignments(user) {
  return Object.keys(kpiAssignments(user)).length > 0;
}

function isKpiAssigned(user, kpi) {
  const assignments = kpiAssignments(user);
  if (Object.keys(assignments).length === 0) return true;
  return kpiOverrideKeys(kpi).some((key) => assignments[key] === true);
}

function kpiOverrideSnapshot(user) {
  const overrides = userPermissions(user).kpiOverrides || user?.kpiOverrides || {};
  const out = {};
  for (const [key, value] of Object.entries(overrides || {})) {
    const weight = numericWeight(value, null);
    if (weight !== null) out[key] = weight;
  }
  return out;
}

function diffKpiOverrides(beforeUser, afterUser) {
  const before = kpiOverrideSnapshot(beforeUser);
  const after = kpiOverrideSnapshot(afterUser);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const key of keys) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    if (from !== to) changes.push({ key, from, to });
  }
  return changes;
}

function kpiAssignmentSnapshot(user) {
  const assignments = kpiAssignments(user);
  const out = {};
  for (const [key, value] of Object.entries(assignments || {})) {
    if (key === "__configured") continue;
    if (value === true) out[key] = true;
  }
  return out;
}

function diffKpiAssignments(beforeUser, afterUser) {
  const before = kpiAssignmentSnapshot(beforeUser);
  const after = kpiAssignmentSnapshot(afterUser);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const key of keys) {
    const from = before[key] === true;
    const to = after[key] === true;
    if (from !== to) changes.push({ key, from, to });
  }
  return changes;
}

function activeHoldStart(task) {
  const extra = normalizeExtraData(task?.extra_data);
  return extra.hold_started_at || extra.holdStartAt || extra.holdStart || null;
}

function buildHoldStatusUpdate(task, nextStatus, holidays = [], changedBy = "") {
  const currentStatus = statusKey(task?.status);
  const targetStatus = statusKey(nextStatus);
  const extra = { ...normalizeExtraData(task?.extra_data) };
  const now = new Date().toISOString();
  const start = activeHoldStart(task);

  if (targetStatus === "on hold") {
    if (!start) {
      extra.hold_started_at = now;
      extra.hold_started_by = changedBy || extra.hold_started_by || "";
      extra.hold_deadline_before = task?.deadline || "";
    }
    return { extra_data: extra, deadline: task?.deadline || "" };
  }

  if (currentStatus !== "on hold" || !start) return {};

  const holdDays = Math.max(0, businessDaysBetween(start, now, holidays));
  const nextDeadline = holdDays > 0 ? addWorkingDays(task.deadline, holdDays, holidays) : (task?.deadline || "");
  const history = Array.isArray(extra.hold_history) ? [...extra.hold_history] : [];
  history.push({
    start,
    end: now,
    businessDays: holdDays,
    deadlineBefore: extra.hold_deadline_before || task?.deadline || "",
    deadlineAfter: nextDeadline || task?.deadline || "",
    changedBy: changedBy || "",
  });
  delete extra.hold_started_at;
  delete extra.hold_started_by;
  delete extra.hold_deadline_before;
  extra.hold_days_total = Number(extra.hold_days_total || 0) + holdDays;
  extra.hold_history = history.slice(-20);
  return { extra_data: extra, deadline: nextDeadline || task?.deadline || "" };
}

function dateInPeriod(value, month, year, allTime) {
  if (allTime) return true;
  if (!month || !year) return true;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return true;
  return date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month);
}

function taskInPeriod(task, month, year, allTime) {
  if (allTime) return true;
  if (!month || !year) return true;
  const dates = [task.startdate, task.created_at, task.deadline, task.completiondate].filter(Boolean);
  if (dates.some((value) => dateInPeriod(value, month, year, false))) return true;
  if (isTerminalStatus(task.status)) return dates.length === 0;

  const startedAt = new Date(task.startdate || task.created_at || task.deadline || "");
  if (Number.isNaN(startedAt.getTime())) return true;
  const periodEnd = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
  return startedAt <= periodEnd;
}

function taskPersonId(task) {
  return String(task.empId || task.empid || task.assignedToEmpId || "").trim();
}

export function normalizeCompletionDate(value) {
  const normalized = value ? bangkokDateKey(value) : todayIso();
  return normalized || todayIso();
}

function taskKpiText(value) {
  return normalizeKeyPart(value).toLowerCase();
}

function taskMatchesKpiRule(task, rule = {}) {
  return taskKpiText(task.team) === taskKpiText(rule.team)
    && taskKpiText(task.mainkpi || task.mainKpi || task.main) === taskKpiText(rule.main)
    && taskKpiText(task.subkpi || task.subKpi || task.sub) === taskKpiText(rule.sub);
}

function filterTasks(tasks, params = {}) {
  const month = Number(params.month || 0);
  const year = Number(params.year || 0);
  const allTime = params.allTime === true || params.allTime === "true" || month === 0;
  const team = String(params.team || "").trim();
  const name = String(params.name || "").trim();
  const requesterEmpId = String(params.requesterEmpId || params.empId || params.empid || "").trim();
  return (tasks || []).filter((task) => {
    if (team && team !== "all" && task.team !== team) return false;
    if (name && String(task.name || "").trim() !== name) return false;
    if (requesterEmpId && name) {
      const taskEmp = taskPersonId(task);
      if (taskEmp && taskEmp.toUpperCase() !== requesterEmpId.toUpperCase() && String(task.name || "").trim() !== name) return false;
    }
    return taskInPeriod(task, month, year, allTime);
  });
}

function monthEndIso(month, year) {
  if (!month || !year) return "";
  const date = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function taskQueryPrefix(params = {}) {
  const month = Number(params.month || 0);
  const year = Number(params.year || 0);
  const allTime = params.allTime === true || params.allTime === "true" || month === 0;
  const team = String(params.team || "").trim();
  const name = String(params.name || "").trim();
  const filters = ["select=*"];

  if (team && team !== "all") filters.push(`team=eq.${encodeEq(team)}`);
  if (name) filters.push(`name=eq.${encodeEq(name)}`);

  const periodEnd = !allTime ? monthEndIso(month, year) : "";
  if (periodEnd) {
    const encodedEnd = encodeEq(periodEnd);
    filters.push(`or=(startdate.lte.${encodedEnd},created_at.lte.${encodedEnd},deadline.lte.${encodedEnd},completiondate.lte.${encodedEnd},startdate.is.null)`);
  }

  return filters.join("&");
}

async function readTasksForParams(env, params = {}) {
  try {
    return await readAll(env, "tasks", taskQueryPrefix(params));
  } catch (error) {
    if (error?.status === 400 || error?.status === 404) {
      console.warn("Filtered task query failed, falling back to full task scan:", error?.message || error);
      return readAll(env, "tasks");
    }
    throw error;
  }
}

async function readTargetUser(env, targetEmpId) {
  const cleanTargetEmpId = String(targetEmpId || "").trim();
  if (!cleanTargetEmpId) return null;
  const columns = await tableColumns(env, "users").catch(() => null);
  const empColumns = ["empid", "empId"].filter((column) => !columns || columns.has(column));
  for (const column of empColumns) {
    const user = await supabaseFetch(env, "users", `select=*&${column}=eq.${encodeEq(cleanTargetEmpId)}&limit=1`)
      .then((rows) => rows[0] || null)
      .catch(() => null);
    if (user) return user;
  }
  return findUserByEmpId(env, cleanTargetEmpId).catch(() => null);
}

async function readTasksForRecalculation(env, targetEmpId = "") {
  const cleanTargetEmpId = String(targetEmpId || "").trim();
  const normalizedTargetEmpId = cleanTargetEmpId.toUpperCase();
  if (!normalizedTargetEmpId) return readAll(env, "tasks");

  // Personal KPI recalculation must inspect every task because legacy rows can
  // be missing employee id columns, use mixed casing, or predate user renames.
  // The row filter in recalculateTasks still limits writes to the selected user.
  return readAll(env, "tasks");
}

async function readTaskRecalculationPage(env, { cursor = "", offset = 0, limit = PAGE_SIZE } = {}) {
  const cleanCursor = String(cursor || "").trim();
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.min(PAGE_SIZE, Math.max(1, Number(limit) || PAGE_SIZE));
  const query = cleanCursor
    ? `select=*&order=id.asc&id=gt.${encodeEq(cleanCursor)}&limit=${safeLimit}`
    : `select=*&order=id.asc&limit=${safeLimit}`;
  return supabaseFetch(env, "tasks", query).catch(() =>
    supabaseFetch(env, "tasks", `select=*&limit=${safeLimit}&offset=${safeOffset}`)
  );
}

function summarizeTasks(tasks) {
  const people = new Map();
  for (const task of tasks || []) {
    const key = taskPersonId(task) || `${task.name || "Unassigned"}|${task.team || ""}`;
    if (!people.has(key)) {
      people.set(key, {
        empId: task.empId || task.empid || task.assignedToEmpId || "",
        empid: task.empId || task.empid || task.assignedToEmpId || "",
        name: task.name || task.assignee || task.owner || "Unassigned",
        team: task.team || "",
        total: 0,
        completed: 0,
        onProcess: 0,
        pending: 0,
        onHold: 0,
        cancelled: 0,
        onTime: 0,
        overKpi: 0,
      });
    }
    const row = people.get(key);
    const status = statusKey(task.status);
    row.total += 1;
    if (status === "completed") row.completed += 1;
    else if (status === "on process") row.onProcess += 1;
    else if (status === "pending") row.pending += 1;
    else if (status === "on hold") row.onHold += 1;
    else if (status === "cancelled") row.cancelled += 1;
    if (status === "completed") {
      const done = task.completiondate ? new Date(task.completiondate) : null;
      const deadline = task.deadline ? new Date(task.deadline) : null;
      if (done && deadline && !Number.isNaN(done.getTime()) && !Number.isNaN(deadline.getTime()) && done <= deadline) row.onTime += 1;
      else row.overKpi += 1;
    }
  }
  return Array.from(people.values());
}

async function findUserByEmpId(env, empId) {
  const cleanEmpId = String(empId || "").trim();
  if (!cleanEmpId) return null;
  for (const column of ["empid", "empId"]) {
    try {
      const rows = await supabaseFetch(env, "users", `select=*&${column}=eq.${encodeEq(cleanEmpId)}&limit=1`);
      if (rows[0]) return rows[0];
    } catch {}
  }
  const users = await readAll(env, "users");
  return users.find((user) => String(user.empid || user.empId || "").trim().toUpperCase() === cleanEmpId.toUpperCase()) || null;
}

async function kpisForTeam(env, team) {
  if (!team) return readAll(env, "kpis");
  return supabaseFetch(env, "kpis", `select=*&team=eq.${encodeEq(team)}`).catch(async () => {
    const all = await readAll(env, "kpis").catch(() => []);
    return all.filter((kpi) => String(kpi.team || "") === String(team || ""));
  });
}

async function findKpi(env, team, subkpi) {
  const kpis = await kpisForTeam(env, team);
  const wanted = String(subkpi || "").trim().toLowerCase();
  return kpis.find((kpi) => String(kpiSub(kpi)).trim().toLowerCase() === wanted) || null;
}

async function writeAudit(env, event) {
  const candidates = [
    {
      task_id: event.taskId || event.task_id || null,
      action: event.action || event.type || "update",
      changed_by: event.changedBy || event.changed_by || event.user || "",
      details: event.details || event,
      created_at: new Date().toISOString(),
    },
    {
      taskid: event.taskId || event.task_id || null,
      action: event.action || event.type || "update",
      changedby: event.changedBy || event.changed_by || event.user || "",
      details: JSON.stringify(event.details || event),
      created_at: new Date().toISOString(),
    },
  ];
  for (const row of candidates) {
    try {
      const shaped = await shapeForTable(env, "audit_log", row);
      await supabaseWrite(env, "audit_log", { body: shaped, prefer: "return=minimal" });
      return;
    } catch {}
  }
}

async function patchTask(env, id, updates) {
  const shaped = await shapeForTable(env, "tasks", updates);
  const rows = await supabaseWrite(env, "tasks", {
    method: "PATCH",
    query: `id=eq.${encodeEq(id)}`,
    body: shaped,
  });
  return rows[0] || null;
}

async function buildTaskRows(env, body) {
  const jobs = Array.isArray(body.jobs) && body.jobs.length > 0 ? body.jobs : [body.job || ""];
  const holidays = await readAll(env, "holidays").catch(() => []);
  const kpi = await findKpi(env, body.team || body.assignedToTeam, body.subkpi);
  const assignee = await findUserByEmpId(env, body.empId || body.empid || body.assignedToEmpId).catch(() => null);
  if (assignee && kpi && !isKpiAssigned(assignee, kpi)) {
    throw new Error("SubKPI is not assigned to this employee");
  }
  const effectiveWeight = personalKpiWeight(assignee, kpi);
  const baseWeight = kpiWeight(kpi);
  const startdate = body.startdate || body.startDate || todayIso();
  const deadline = body.deadline || addWorkingDays(startdate, kpi?.days || body.days || 1, holidays);
  return Promise.all(jobs.map(async (job) => {
    const jobText = typeof job === "string" ? job : (job.job || job.name || "");
    const extra = {
      ...(typeof job === "object" ? (job.extra_data || body.extra_data || {}) : (body.extra_data || {})),
      kpi_base_weight: baseWeight,
      kpi_effective_weight: effectiveWeight,
      kpi_personal_override: effectiveWeight !== baseWeight,
    };
    const raw = {
      id: body.id || randomId(),
      name: body.name || body.assignedToName || "",
      team: body.team || body.assignedToTeam || "",
      empId: body.empId || body.empid || body.assignedToEmpId || "",
      empid: body.empid || body.empId || body.assignedToEmpId || "",
      assignedToEmpId: body.assignedToEmpId || body.empId || body.empid || "",
      job: jobText,
      mainkpi: body.mainkpi || kpiMain(kpi),
      subkpi: body.subkpi || kpiSub(kpi),
      deadline,
      startdate,
      status: normalizeStatus(body.status, body.assignedToEmpId ? "Pending" : "On Process"),
      note: body.note || "",
      extra_data: extra,
      mainkpiweight: body.mainkpiweight || body.main_weight || effectiveWeight,
      weight: body.weight || effectiveWeight,
      created_at: new Date().toISOString(),
    };
    return shapeForTable(env, "tasks", raw);
  }));
}

function systemLinkFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    url: row.url || "",
    icon: row.icon || "fa-up-right-from-square",
    status: row.status || "Active",
    visibleToAll: row.visible_to_all === true,
    allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles : [],
    allowedTeams: Array.isArray(row.allowed_team_names) ? row.allowed_team_names : [],
    allowedEmpIds: Array.isArray(row.allowed_emp_ids) ? row.allowed_emp_ids : [],
    sortOrder: row.sort_order || 100,
    isActive: row.is_active !== false,
  };
}

function systemLinkToRow(item, index = 0) {
  return {
    id: String(item.id || `system-${Date.now().toString(36)}-${index + 1}`).trim(),
    name: item.name,
    description: item.description || "",
    url: item.url || "",
    icon: item.icon || "fa-up-right-from-square",
    status: item.status || "Active",
    visible_to_all: item.visibleToAll === true,
    allowed_roles: Array.isArray(item.allowedRoles) ? item.allowedRoles : [],
    allowed_team_names: Array.isArray(item.allowedTeams) ? item.allowedTeams : [],
    allowed_emp_ids: Array.isArray(item.allowedEmpIds) ? item.allowedEmpIds : [],
    sort_order: Number.isFinite(Number(item.sortOrder ?? item.sort_order)) ? Number(item.sortOrder ?? item.sort_order) : (index + 1) * 10,
    is_active: item.isActive !== false,
  };
}

async function readSystemLinks(env) {
  const rows = await readAll(env, "app_system_links").catch(() => []);
  return rows
    .map(systemLinkFromRow)
    .filter((item) => item.isActive !== false && item.status !== "Hidden")
    .sort((a, b) => (a.sortOrder || 100) - (b.sortOrder || 100) || String(a.name || "").localeCompare(String(b.name || "")));
}

function normalizeAdminAnnouncement(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    message: String(raw.message || "").trim(),
    isActive: raw.isActive === true || raw.is_active === true || String(raw.isActive ?? raw.is_active).toLowerCase() === "true",
    updatedAt: raw.updatedAt || raw.updated_at || "",
    updatedBy: raw.updatedBy || raw.updated_by || "",
  };
}

async function readAdminAnnouncement(env) {
  const rows = await supabaseFetch(
    env,
    "app_system_settings",
    `select=*&key=eq.${encodeEq(ADMIN_ANNOUNCEMENT_SETTING_KEY)}&limit=1`
  ).catch(() => []);
  const row = rows[0] || null;
  return normalizeAdminAnnouncement(row?.value || {});
}

async function saveAdminAnnouncement(env, announcement, changedBy = "") {
  const normalized = normalizeAdminAnnouncement(announcement);
  const next = {
    ...normalized,
    updatedAt: normalized.updatedAt || new Date().toISOString(),
    updatedBy: normalized.updatedBy || changedBy || "",
  };
  const row = await shapeForTable(env, "app_system_settings", {
    key: ADMIN_ANNOUNCEMENT_SETTING_KEY,
    value: next,
    description: "Header announcement shown to all signed-in users",
    is_public: true,
    updated_by_emp_id: changedBy || next.updatedBy || "",
  });
  await supabaseWrite(env, "app_system_settings", {
    query: "on_conflict=key",
    body: row,
    prefer: "resolution=merge-duplicates,return=representation",
  });
  return next;
}

async function recalculateTasks(env, { updateKpiValues = false, targetEmpId = "", cursor = "", offset = null, limit = null, returnStats = false } = {}) {
  const cleanTargetEmpId = String(targetEmpId || "").trim();
  const normalizedTargetEmpId = cleanTargetEmpId.toUpperCase();
  const targetUser = normalizedTargetEmpId ? await readTargetUser(env, cleanTargetEmpId) : null;
  const pageLimit = limit === null || limit === undefined ? null : Math.min(PAGE_SIZE, Math.max(1, Number(limit) || PAGE_SIZE));
  const pageOffset = offset === null || offset === undefined ? 0 : Math.max(0, Number(offset) || 0);
  const pageCursor = String(cursor || "").trim();
  const usePage = pageLimit !== null;
  const [tasks, kpis, holidays] = await Promise.all([
    (usePage ? readTaskRecalculationPage(env, { cursor: pageCursor, offset: pageOffset, limit: pageLimit }) : readTasksForRecalculation(env, cleanTargetEmpId)).catch(() => []),
    readAll(env, "kpis").catch(() => []),
    readAll(env, "holidays").catch(() => []),
  ]);
  const users = normalizedTargetEmpId
    ? (targetUser ? [targetUser] : [])
    : await readAll(env, "users").catch(() => []);
  const usersByEmpId = new Map(users.map((user) => [
    String(user.empid || user.empId || "").trim().toUpperCase(),
    user,
  ]).filter(([empId]) => empId));
  const usersByNameTeam = new Map(users.map((user) => [
    `${normalizeKeyPart(user.name)}::${normalizeKeyPart(user.team)}`,
    user,
  ]).filter(([key]) => key !== "::"));
  let updated = 0;
  let failed = 0;

  for (const task of tasks) {
    const taskEmpId = String(task.empid || task.empId || task.assignedToEmpId || "").trim().toUpperCase();
    const taskNameTeamKey = `${normalizeKeyPart(task.name)}::${normalizeKeyPart(task.team)}`;
    const taskMatchesTargetWithoutEmpId = Boolean(
      normalizedTargetEmpId &&
      !taskEmpId &&
      targetUser &&
      taskNameTeamKey === `${normalizeKeyPart(targetUser.name)}::${normalizeKeyPart(targetUser.team)}`
    );
    if (normalizedTargetEmpId && taskEmpId !== normalizedTargetEmpId && !taskMatchesTargetWithoutEmpId) continue;

    const taskTeam = normalizeKeyPart(task.team);
    const taskSub = normalizeKeyPart(task.subkpi || task.subKpi || task.sub);
    const kpi = kpis.find((item) =>
      normalizeKeyPart(item.team) === taskTeam &&
      normalizeKeyPart(kpiSub(item)) === taskSub
    );
    if (!kpi) continue;

    const user = usersByEmpId.get(taskEmpId)
      || usersByNameTeam.get(taskNameTeamKey)
      || (taskMatchesTargetWithoutEmpId ? targetUser : null);
    const effectiveWeight = personalKpiWeight(user, kpi);
    const baseWeight = kpiWeight(kpi);
    const extra = normalizeExtraData(task.extra_data);
    const terminal = isTerminalStatus(task.status);
    const baseDeadline = terminal ? task.deadline : addWorkingDays(task.startdate || task.created_at || todayIso(), kpi.days || 1, holidays);
    const holdDays = Number(extra.hold_days_total || extra.holdDaysTotal || 0);
    const activeDays = !terminal && statusKey(task.status) === "on hold" ? Math.max(0, businessDaysBetween(activeHoldStart(task), new Date(), holidays)) : 0;
    const nextDeadline = !terminal && holdDays + activeDays > 0 ? addWorkingDays(baseDeadline, holdDays + activeDays, holidays) : baseDeadline;
    const nextExtra = {
      ...extra,
      kpi_base_weight: baseWeight,
      kpi_effective_weight: effectiveWeight,
      kpi_personal_override: effectiveWeight !== baseWeight,
    };

    const currentMainKpi = task.mainkpi || task.mainKpi || task.main || "";
    const currentSubKpi = task.subkpi || task.subKpi || task.sub || "";
    const nextMainKpi = kpiMain(kpi);
    const nextSubKpi = kpiSub(kpi);
    const mainKpiChanged = normalizeKeyPart(currentMainKpi) !== normalizeKeyPart(nextMainKpi);
    const subKpiChanged = normalizeKeyPart(currentSubKpi) !== normalizeKeyPart(nextSubKpi);
    const weightChanged = numericWeight(task.mainkpiweight ?? task.main_weight ?? task.weight ?? task.kpiweight, 1) !== effectiveWeight
      || numericWeight(task.weight ?? task.main_weight ?? task.mainkpiweight ?? task.kpiweight, 1) !== effectiveWeight;
    const extraChanged = numericWeight(extra.kpi_base_weight, null) !== baseWeight
      || numericWeight(extra.kpi_effective_weight, null) !== effectiveWeight
      || Boolean(extra.kpi_personal_override) !== (effectiveWeight !== baseWeight);

    const patch = {};
    if (!updateKpiValues) {
      if ((nextDeadline && nextDeadline !== task.deadline)) patch.deadline = nextDeadline;
    } else {
      if (weightChanged) {
        patch.mainkpiweight = effectiveWeight;
        patch.weight = effectiveWeight;
      }
      if (!taskEmpId && user) {
        const normalizedUserEmpId = String(user.empid || user.empId || "").trim();
        if (normalizedUserEmpId) {
          patch.empId = normalizedUserEmpId;
          patch.empid = normalizedUserEmpId;
          patch.assignedToEmpId = normalizedUserEmpId;
        }
      }
      if (mainKpiChanged) patch.mainkpi = nextMainKpi;
      if (subKpiChanged) patch.subkpi = nextSubKpi;
      if (extraChanged) patch.extra_data = nextExtra;
    }

    if (Object.keys(patch).length > 0) {
      const patched = await patchTask(env, task.id, patch).catch((error) => {
        failed += 1;
        console.warn("Task recalculation patch failed:", task.id, error?.message || error);
        return null;
      });
      if (patched) updated += 1;
    }
  }

  if (returnStats) {
    const lastTask = tasks[tasks.length - 1] || null;
    const nextCursor = lastTask?.id ? String(lastTask.id) : "";
    return {
      updated,
      failed,
      scanned: tasks.length,
      cursor: pageCursor,
      nextCursor,
      offset: pageOffset,
      limit: pageLimit || tasks.length,
      nextOffset: usePage ? pageOffset + tasks.length : null,
      done: usePage ? tasks.length < pageLimit : true,
    };
  }
  return updated;
}

async function recalculateDeadlines(env) {
  return recalculateTasks(env, { updateKpiValues: false });
}

async function recalculateTaskKpiValues(env, targetEmpId = "") {
  return recalculateTasks(env, { updateKpiValues: true, targetEmpId });
}

async function syncKpiRuleToTasks(env, beforeKpi, afterKpi) {
  if (!beforeKpi || !afterKpi) return 0;
  const oldTeam = String(beforeKpi.team || "").trim();
  const oldMain = String(kpiMain(beforeKpi) || "").trim();
  const oldSub = String(kpiSub(beforeKpi) || "").trim();
  const nextMain = String(kpiMain(afterKpi) || "").trim();
  const nextSub = String(kpiSub(afterKpi) || "").trim();
  const mainChanged = normalizeKeyPart(oldMain) !== normalizeKeyPart(nextMain);
  const subChanged = normalizeKeyPart(oldSub) !== normalizeKeyPart(nextSub);
  if (!oldTeam || (!mainChanged && !subChanged)) return 0;

  const tasks = await readAll(env, "tasks").catch(() => []);
  let updated = 0;
  for (const task of tasks) {
    const matches = String(task.team || "").trim() === oldTeam
      && normalizeKeyPart(task.mainkpi || task.mainKpi || task.main) === normalizeKeyPart(oldMain)
      && normalizeKeyPart(task.subkpi || task.subKpi || task.sub) === normalizeKeyPart(oldSub);
    if (!matches) continue;
    await patchTask(env, task.id, {
      mainkpi: nextMain || oldMain,
      subkpi: nextSub || oldSub,
    }).catch(() => null);
    updated += 1;
  }
  return updated;
}

async function handleApi(request, env, apiPath) {
  const url = new URL(request.url);
  if (apiPath === "openmeteo/weather") {
    return fetchOpenMeteoWeather(request, url);
  }
  if (apiPath === "openmeteo/places") {
    return fetchOpenMeteoPlaces(request, url);
  }
  if (apiPath === "google/weather") {
    return fetchGoogleWeather(request, url, env);
  }
  if (apiPath === "google/places") {
    return fetchGooglePlaces(request, url, env);
  }
  if (apiPath === "tmd/weather") {
    return fetchTmdWeather(request, url);
  }
  if (apiPath === "tmd/official-alerts") {
    return fetchTmdOfficialAlerts(request, url);
  }
  if (apiPath === "tmd/provinces") {
    return fetchTmdProvinces(request, url);
  }

  const settings = supabaseSettings(env);
  if (!settings) return null;

  if (apiPath === "public-config") {
    return jsonResponse(request, { url: settings.url, key: settings.publicKey }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getInitialData" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const user = await findUserByEmpId(env, body.empId || body.empid);
    if (!user) return jsonResponse(request, { error: "User profile was not found" }, 404, { "X-Maxiwa-Backend": "supabase" });
    const serverSession = await writeServerSession(env, user, body.sessionId).catch(() => ({ sessionId: body.sessionId || randomId(), enforced: false }));
    const kpis = await kpisForTeam(env, user.team || "");
    return jsonResponse(request, {
      user: {
        ...user,
        empId: user.empId || user.empid,
        serverSessionId: serverSession.sessionId,
        sessionEnforced: serverSession.enforced,
        sessionExpiresAt: serverSession.expiresAt || null,
      },
      kpis,
      session: serverSession,
    }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  const session = await validateServerSession(request, env);
  if (!session.ok) {
    return jsonResponse(request, {
      error: session.error,
      code: session.code || "SESSION_INVALID",
    }, session.status || 401, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "session/heartbeat") {
    return jsonResponse(request, { ok: true, session }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getKPIsByTeam") {
    return jsonResponse(request, { kpis: await kpisForTeam(env, url.searchParams.get("team") || "") }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getAllStaff") {
    return jsonResponse(request, { staff: await readAll(env, "users") }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getAllStaffInTeam") {
    const team = url.searchParams.get("team") || "";
    const staff = team ? await supabaseFetch(env, "users", `select=*&team=eq.${encodeEq(team)}`).catch(() => []) : await readAll(env, "users");
    return jsonResponse(request, { staff }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getDashboardData") {
    const [tasksResult, kpisResult, holidaysResult] = await Promise.all([
      readAllForDashboard(env, "tasks"),
      readAllForDashboard(env, "kpis"),
      readAllForDashboard(env, "holidays"),
    ]);
    const errors = {};
    if (tasksResult.error) errors.tasks = tasksResult.error;
    if (kpisResult.error) errors.kpis = kpisResult.error;
    if (holidaysResult.error) errors.holidays = holidaysResult.error;
    return jsonResponse(request, {
      tasks: tasksResult.rows,
      kpis: kpisResult.rows,
      holidays: holidaysResult.rows,
      errors,
    }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getEmployeeTasks" || apiPath === "getAllTasks") {
    const params = Object.fromEntries(url.searchParams.entries());
    const [allTasks, holidays] = await Promise.all([
      readTasksForParams(env, params),
      readAll(env, "holidays").catch(() => []),
    ]);
    return jsonResponse(request, { tasks: filterTasks(allTasks, params), holidays }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getSummaryReport" || apiPath === "getTeamSummaryReport") {
    const params = Object.fromEntries(url.searchParams.entries());
    const [allTasks, holidays] = await Promise.all([
      readTasksForParams(env, params),
      readAll(env, "holidays").catch(() => []),
    ]);
    const tasks = filterTasks(allTasks, params);
    return jsonResponse(request, { summary: summarizeTasks(tasks), holidays, period: params }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "calculateDeadlinePreview" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const [kpi, holidays] = await Promise.all([
      findKpi(env, body.team, body.subkpi || body.sub).catch(() => null),
      readAll(env, "holidays").catch(() => []),
    ]);
    const assignee = await findUserByEmpId(env, body.empId || body.empid || body.assignedToEmpId).catch(() => null);
    if (assignee && kpi && !isKpiAssigned(assignee, kpi)) {
      return jsonResponse(request, { error: "SubKPI is not assigned to this employee" }, 400, { "X-Maxiwa-Backend": "supabase" });
    }
    const baseWeight = kpiWeight(kpi);
    const effectiveWeight = personalKpiWeight(assignee, kpi);
    const deadline = addWorkingDays(body.startDate || body.startdate || todayIso(), kpi?.days || body.days || 1, holidays);
    return jsonResponse(request, {
      deadline,
      kpi,
      baseWeight,
      effectiveWeight,
      hasPersonalOverride: effectiveWeight !== baseWeight,
    }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if ((apiPath === "saveNewTask" || apiPath === "assignNewTask") && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const rows = await buildTaskRows(env, body);
    const inserted = await supabaseWrite(env, "tasks", { body: rows });
    await writeAudit(env, { action: "create_task", changedBy: body.changedBy || body.name, details: { count: rows.length } });
    return jsonResponse(request, { ok: true, tasks: inserted, task: inserted[0] || null }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "updateTaskDetails" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonResponse(request, { error: "Task id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    const { id, ...updates } = body;
    if (updates.completiondate) updates.completiondate = normalizeCompletionDate(updates.completiondate);
    const task = await patchTask(env, id, updates);
    await writeAudit(env, { taskId: id, action: "update_task", changedBy: body.changedBy, details: updates });
    return jsonResponse(request, { ok: true, task }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if ((apiPath === "updateTaskStatus" || apiPath === "updateTaskStatusWithLog" || apiPath === "acceptTask") && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonResponse(request, { error: "Task id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    const status = apiPath === "acceptTask" ? "On Process" : normalizeStatus(body.status || body.newStatus || body.new_status);
    const existing = await supabaseFetch(env, "tasks", `select=*&id=eq.${encodeEq(body.id)}&limit=1`).then((rows) => rows[0]).catch(() => null);
    const holidays = await readAll(env, "holidays").catch(() => []);
    const updates = { status, ...(existing ? buildHoldStatusUpdate(existing, status, holidays, body.changedBy || body.reason || "") : {}) };
    if (body.note !== undefined || body.reason !== undefined) {
      const nextNote = body.note ?? body.reason;
      const isBlankCompleteNote = statusKey(status) === "completed"
        && statusKey(body.mode) !== "append"
        && String(nextNote || "").trim() === "";
      if (!isBlankCompleteNote) {
        updates.note = statusKey(body.mode) === "append"
          ? appendTaskNote(existing?.note ?? existing?.notes, nextNote)
          : nextNote;
      }
    }
    if (statusKey(status) === "completed" && statusKey(body.mode) !== "append") updates.completiondate = normalizeCompletionDate(body.completiondate);
    const task = await patchTask(env, body.id, updates);
    await writeAudit(env, { taskId: body.id, action: "status_change", changedBy: body.changedBy || body.reason, details: updates });
    return jsonResponse(request, { ok: true, task }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "deleteTask" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonResponse(request, { error: "Task id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    await supabaseWrite(env, "tasks", { method: "DELETE", query: `id=eq.${encodeEq(body.id)}`, prefer: "return=minimal" });
    await writeAudit(env, { taskId: body.id, action: "delete_task", changedBy: body.changedBy, details: body });
    return jsonResponse(request, { ok: true }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getTasksByJob") {
    const q = url.searchParams.get("q") || "";
    const allTasks = await readAll(env, "tasks").catch(() => []);
    const needle = q.trim().toLowerCase();
    const tasks = needle ? allTasks.filter((task) => String(task.job || "").toLowerCase().includes(needle)) : [];
    return jsonResponse(request, { tasks }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getAuditLogsByTask") {
    const taskId = url.searchParams.get("taskId") || "";
    const logs = taskId
      ? await supabaseFetch(env, "audit_log", `select=*&or=(task_id.eq.${encodeEq(taskId)},taskid.eq.${encodeEq(taskId)})`).catch(() => [])
      : [];
    return jsonResponse(request, { logs }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "systemLinks") {
    return jsonResponse(request, { systemLinks: await readSystemLinks(env) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "adminAnnouncement") {
    return jsonResponse(request, { announcement: await readAdminAnnouncement(env) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveAnnouncement" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const changedBy = request.headers.get("x-admin-empid") || body.updatedBy || "";
    const announcement = await saveAdminAnnouncement(env, body.announcement || body, changedBy);
    await writeAudit(env, { action: "save_admin_announcement", changedBy, details: { isActive: announcement.isActive } });
    return jsonResponse(request, { ok: true, announcement }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveSystemLinks" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const rows = await Promise.all((body.systemLinks || []).map((item, index) => shapeForTable(env, "app_system_links", systemLinkToRow(item, index))));
    if (rows.length > 0) {
      await supabaseWrite(env, "app_system_links", {
        query: "on_conflict=id",
        body: rows,
        prefer: "resolution=merge-duplicates,return=representation",
      });
    }
    const existing = await readAll(env, "app_system_links").catch(() => []);
    const nextIds = new Set(rows.map((row) => row.id));
    for (const row of existing) {
      if (!nextIds.has(row.id)) {
        await supabaseWrite(env, "app_system_links", {
          method: "PATCH",
          query: `id=eq.${encodeEq(row.id)}`,
          body: await shapeForTable(env, "app_system_links", { is_active: false, status: "Hidden" }),
          prefer: "return=minimal",
        }).catch(() => null);
      }
    }
    return jsonResponse(request, { ok: true, systemLinks: await readSystemLinks(env) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/getTeams") return jsonResponse(request, { teams: await readAll(env, "teams") }, 200, { "X-Maxiwa-Backend": "supabase" });
  if (apiPath === "admin/getHolidays") return jsonResponse(request, { holidays: await readAll(env, "holidays") }, 200, { "X-Maxiwa-Backend": "supabase" });
  if (apiPath === "admin/getAuditLogs") return jsonResponse(request, { logs: await readAll(env, "audit_log").catch(() => []) }, 200, { "X-Maxiwa-Backend": "supabase" });
  if (apiPath === "admin/getTasksByKpiRule") {
    const rule = {
      team: url.searchParams.get("team") || "",
      main: url.searchParams.get("main") || "",
      sub: url.searchParams.get("sub") || "",
    };
    const filters = ["select=*"];
    if (rule.team) filters.push(`team=eq.${encodeEq(rule.team)}`);
    if (rule.main) filters.push(`mainkpi=eq.${encodeEq(rule.main)}`);
    if (rule.sub) filters.push(`subkpi=eq.${encodeEq(rule.sub)}`);
    let rows;
    try {
      rows = await readAll(env, "tasks", filters.join("&"));
    } catch (error) {
      if (error?.status !== 400 && error?.status !== 404) throw error;
      rows = await readTasksForParams(env, { team: rule.team, allTime: "true" });
    }
    return jsonResponse(request, { tasks: rows.filter((task) => taskMatchesKpiRule(task, rule)) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveUser" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const empid = String(body.empid || body.empId || "").trim();
    if (!empid) return jsonResponse(request, { error: "Emp ID is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    const existing = await findUserByEmpId(env, empid).catch(() => null);
    const { empId: _empId, ...rest } = body;
    const userColumns = await tableColumns(env, "users");
    const empColumn = userColumns?.has("empid") ? "empid" : (userColumns?.has("empId") ? "empId" : "empid");
    const row = await shapeForTable(env, "users", { ...rest, empid, empId: empid });
    const saved = await supabaseWrite(env, "users", {
      query: `on_conflict=${empColumn}`,
      body: row,
      prefer: "resolution=merge-duplicates,return=representation",
    });
    if (existing && (existing.name !== row.name || existing.team !== row.team)) {
      const allTasks = await readAll(env, "tasks").catch(() => []);
      const affected = allTasks.filter((task) =>
        String(task.empid || task.empId || task.assignedToEmpId || "").trim().toUpperCase() === empid.toUpperCase() ||
        (String(task.name || "").trim() === String(existing.name || "").trim() && String(task.team || "").trim() === String(existing.team || "").trim())
      );
      for (const task of affected) {
        await patchTask(env, task.id, { name: row.name, team: row.team }).catch(() => null);
      }
    }
    const user = saved[0] || row;
    const overrideChanges = diffKpiOverrides(existing, user);
    const assignmentChanges = diffKpiAssignments(existing, user);
    if (assignmentChanges.length > 0) {
      await writeAudit(env, {
        action: "save_kpi_assignment",
        changedBy: request.headers.get("x-admin-empid"),
        details: { empid, changes: assignmentChanges },
      });
    }
    if (overrideChanges.length > 0) {
      await writeAudit(env, {
        action: "save_kpi_override",
        changedBy: request.headers.get("x-admin-empid"),
        details: { empid, changes: overrideChanges },
      });
    }
    const recalculated = await recalculateDeadlines(env);
    await writeAudit(env, { action: "save_user", changedBy: request.headers.get("x-admin-empid"), details: { empid } });
    return jsonResponse(request, { ok: true, user: { ...user, empId: user.empid || empid }, recalculated }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveTeam" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const payload = body.id ? { ...body, id: body.id } : { ...body };
    const row = await shapeForTable(env, "teams", payload);
    const teams = row.id
      ? await supabaseWrite(env, "teams", {
          method: "PATCH",
          query: `id=eq.${encodeEq(row.id)}`,
          body: row,
        })
      : await supabaseWrite(env, "teams", { body: row });
    return jsonResponse(request, { ok: true, team: teams[0] || row }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveKpi" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const existing = body.id
      ? await supabaseFetch(env, "kpis", `select=*&id=eq.${encodeEq(body.id)}&limit=1`).then((rows) => rows[0]).catch(() => null)
      : null;
    const row = await shapeForTable(env, "kpis", body);
    const kpis = row.id
      ? await supabaseWrite(env, "kpis", { method: "PATCH", query: `id=eq.${encodeEq(row.id)}`, body: row })
      : await supabaseWrite(env, "kpis", { body: row });
    const kpi = kpis[0] || row;
    const syncedTasks = await syncKpiRuleToTasks(env, existing, kpi);
    const recalculated = await recalculateDeadlines(env);
    await writeAudit(env, {
      action: "save_kpi",
      changedBy: request.headers.get("x-admin-empid"),
      details: { id: kpi.id || body.id || null, syncedTasks, recalculated },
    });
    return jsonResponse(request, { ok: true, kpi, syncedTasks, recalculated }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveHoliday" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const source = body.source || body.holiday_source || body.type || "company";
    const columns = await tableColumns(env, "holidays");
    const row = shapeWithColumns({
      ...body,
      source,
      holiday_source: source,
      type: source,
    }, columns);
    const holiday = await upsertHolidayRow(env, row, columns || new Set(["id", "holiday_date", "name", "is_active"]));
    const recalculated = await recalculateDeadlines(env);
    await writeAudit(env, {
      action: "save_holiday",
      changedBy: request.headers.get("x-admin-empid"),
      details: { id: holiday.id || null, holiday_date: holiday.holiday_date || row.holiday_date || null, recalculated },
    });
    return jsonResponse(request, { ok: true, holiday, recalculated }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/syncThaiHolidays" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await syncThaiPublicHolidays(env, body);
    const recalculated = await recalculateDeadlines(env);
    await writeAudit(env, { action: "sync_thai_holidays", changedBy: request.headers.get("x-admin-empid"), details: { years: result.years, imported: result.imported, recalculated } });
    return jsonResponse(request, { ...result, recalculated }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/recalculateDeadlines" && request.method === "POST") {
    return jsonResponse(request, { ok: true, updated: await recalculateDeadlines(env) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/recalculateTaskKpiValues" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const targetEmpId = String(body.empId || body.empid || body.assignedToEmpId || "").trim();
    if (!targetEmpId) {
      return jsonResponse(request, { error: "empId is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    }
    const limit = body.limit === undefined || body.limit === null ? null : Number(body.limit);
    const offset = body.offset === undefined || body.offset === null ? null : Number(body.offset);
    const cursor = String(body.cursor || "").trim();
    const usePage = Number.isFinite(limit) && limit > 0;
    const result = await recalculateTasks(env, {
      updateKpiValues: true,
      targetEmpId,
      ...(usePage ? { cursor, offset, limit, returnStats: true } : {}),
    });
    return jsonResponse(
      request,
      typeof result === "number"
        ? { ok: true, updated: result, empId: targetEmpId.toUpperCase() }
        : { ok: true, ...result, empId: targetEmpId.toUpperCase() },
      200,
      { "X-Maxiwa-Backend": "supabase" }
    );
  }

  const deleteMatch = apiPath.match(/^admin\/delete(User|Team|Kpi|Holiday)$/);
  if (deleteMatch && request.method === "DELETE") {
    const type = deleteMatch[1];
    const config = {
      User: { table: "users", column: "empid", param: "empId" },
      Team: { table: "teams", column: "id", param: "id" },
      Kpi: { table: "kpis", column: "id", param: "id" },
      Holiday: { table: "holidays", column: "id", param: "id" },
    }[type];
    let value = type === "Holiday"
      ? (url.searchParams.get(config.param) || url.searchParams.get("holiday_date") || url.searchParams.get("date"))
      : url.searchParams.get(config.param);
    if (!value) return jsonResponse(request, { error: "Delete id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    if (type === "User") {
      const userColumns = await tableColumns(env, "users");
      config.column = userColumns?.has("empid") ? "empid" : (userColumns?.has("empId") ? "empId" : "empid");
    } else if (type === "Holiday") {
      const dateValue = url.searchParams.get("holiday_date") || url.searchParams.get("date");
      if (dateValue) {
        value = dateValue;
        config.column = "holiday_date";
      }
    }
    await supabaseWrite(env, config.table, {
      method: "DELETE",
      query: `${config.column}=eq.${encodeEq(value)}`,
      prefer: "return=minimal",
    });
    await writeAudit(env, { action: `delete_${config.table}`, changedBy: request.headers.get("x-admin-empid"), details: { value } });
    const shouldRecalculate = type === "User" || type === "Kpi" || type === "Holiday";
    const recalculated = shouldRecalculate ? await recalculateDeadlines(env) : 0;
    return jsonResponse(request, { ok: true, recalculated }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  return null;
}

async function proxyApiRequest(request, env) {
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/api\/?/, "");
  const backendBase = (env.MAXIWA_BACKEND_API_BASE || DEFAULT_BACKEND_API_BASE).replace(/\/+$/, "");
  if (!backendBase) {
    return missingBackendConfigResponse(request, apiPath);
  }
  const targetUrl = `${backendBase}/${apiPath}${url.search}`;
  const headers = new Headers(request.headers);
  ["host", "origin", "referer", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "x-forwarded-proto", "x-real-ip"]
    .forEach((header) => headers.delete(header));
  const backendResponse = await fetchWithTimeout(targetUrl, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow",
  }, PROXY_TIMEOUT_MS);
  const responseHeaders = new Headers(backendResponse.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) responseHeaders.set(key, value);
  responseHeaders.set("X-Maxiwa-Proxy-Target", `/api/${apiPath}`);
  return new Response(backendResponse.body, { status: backendResponse.status, statusText: backendResponse.statusText, headers: responseHeaders });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
      const apiPath = url.pathname.replace(/^\/api\/?/, "");
      const fallbackRequest = request.clone();
      try {
        const handled = await handleApi(fallbackRequest, env, apiPath);
        if (handled) return handled;
      } catch (error) {
        return jsonResponse(request, { error: error.message || "Supabase backend failed", endpoint: `/api/${apiPath}` }, 500, { "X-Maxiwa-Backend": "supabase-error" });
      }
      return proxyApiRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
