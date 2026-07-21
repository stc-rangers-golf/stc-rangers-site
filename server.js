const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const root = __dirname;
const dataRoot = process.env.STC_DATA_DIR || path.join(root, "data");
const port = Number(process.env.PORT || 8790);
const sessionSecret = process.env.STC_SESSION_SECRET || "stc-rangers-session-v2";
const sessions = new Map();
const loginAttempts = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, value, headers = {}) {
  send(res, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
}

function readBody(req, limit = 2_500_000) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) req.destroy();
    });
    req.on("end", () => resolve(body));
  });
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function isAuthed(req) {
  return Boolean(currentUser(req));
}

function currentUser(req) {
  const sid = parseCookies(req).stc_session;
  if (!sid) return null;
  if (sessions.has(sid)) return sessions.get(sid);
  const session = verifySessionToken(sid);
  if (!session || !session.email) return null;
  return publicUser(findUser(session.email));
}

function secureCookie(req) {
  const forwarded = String(req.headers["x-forwarded-proto"] || "");
  const cfVisitor = String(req.headers["cf-visitor"] || "");
  return req.socket.encrypted || forwarded.includes("https") || cfVisitor.includes("https");
}

function sessionCookie(req, sid, maxAge = 28800) {
  const secure = secureCookie(req) ? "; Secure" : "";
  return `stc_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function dataPath(...parts) {
  return path.join(dataRoot, ...parts);
}

function seedDataFile(...parts) {
  const target = dataPath(...parts);
  if (fs.existsSync(target)) return target;
  const source = path.join(root, "data", ...parts);
  if (source !== target && fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return target;
}

function loadUsers() {
  const usersPath = process.env.STC_USERS_FILE || seedDataFile("private", "users.local.json");
  if (!fs.existsSync(usersPath)) return [];
  return JSON.parse(fs.readFileSync(usersPath, "utf8"));
}

function usersFile() {
  return process.env.STC_USERS_FILE || seedDataFile("private", "users.local.json");
}

function writeUsers(users) {
  fs.writeFileSync(usersFile(), JSON.stringify(users, null, 2) + "\n");
}

function readJsonFile(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function updateJamesMcgowanDisplayEmail() {
  const displayEmail = "james.mcgowan@hotmail.com";
  updateMemberEmailByName(privateFile("contacts"), "James Mcgowan", displayEmail);
  updateNestedContactEmail(privateFile("matches"), "James Mcgowan", displayEmail);
  updateNestedContactEmail(privateFile("standings"), "James Mcgowan", displayEmail);
}

function updateMarkHoenigDisplayEmail() {
  const displayEmail = "unitytrim@gmail.com";
  updateMemberEmailByName(privateFile("contacts"), "Mark Hoenig", displayEmail);
  updateMemberEmailByName(usersFile(), "Mark Hoenig", displayEmail);
  updateNestedContactEmail(privateFile("matches"), "Mark Hoenig", displayEmail);
  updateNestedContactEmail(privateFile("standings"), "Mark Hoenig", displayEmail);
}

function ensureStephenWattonRollingMeadowsRsvp() {
  const file = rsvpsFile();
  const rows = readJsonFile(file, []);
  if (!Array.isArray(rows)) return;
  const email = "stephen.watton@farmlending.ca";
  const tournamentId = "tournament-1";
  const existing = rows.find((row) => {
    return row && row.tournamentId === tournamentId && (
      normalizeEmail(row.email) === email || normalizeMemberName(row.name) === normalizeMemberName("Stephen Watton")
    );
  });
  const update = {
    tournamentId,
    tournamentTitle: "Rolling Meadows",
    eventDate: "June 13, 2026",
    status: "Going",
    email,
    name: "Stephen Watton",
  };
  if (existing) {
    let changed = false;
    Object.entries(update).forEach(([key, value]) => {
      if (existing[key] !== value) {
        existing[key] = value;
        changed = true;
      }
    });
    if (changed) {
      existing.updatedAt = new Date().toISOString();
      writeJsonFile(file, rows);
    }
    return;
  }
  rows.unshift({
    id: crypto.randomUUID(),
    ...update,
    updatedAt: new Date().toISOString(),
  });
  writeJsonFile(file, rows);
}

function ensureStephenWattonRockwayRsvp() {
  const file = rsvpsFile();
  const rows = readJsonFile(file, []);
  if (!Array.isArray(rows)) return;
  const email = "stephen.watton@farmlending.ca";
  const tournamentId = "tournament-2";
  const existing = rows.find((row) => {
    return row && row.tournamentId === tournamentId && (
      normalizeEmail(row.email) === email || normalizeMemberName(row.name) === normalizeMemberName("Stephen Watton")
    );
  });
  const update = {
    tournamentId,
    tournamentTitle: "Rockway",
    eventDate: "July 25, 2026",
    status: "Going",
    email,
    name: "Stephen Watton",
  };
  if (existing) {
    let changed = false;
    Object.entries(update).forEach(([key, value]) => {
      if (existing[key] !== value) {
        existing[key] = value;
        changed = true;
      }
    });
    if (changed) {
      existing.updatedAt = new Date().toISOString();
      writeJsonFile(file, rows);
    }
    return;
  }
  rows.unshift({
    id: crypto.randomUUID(),
    ...update,
    updatedAt: new Date().toISOString(),
  });
  writeJsonFile(file, rows);
}

function ensureMikeChmielewskiRound2Bye() {
  const file = privateFile("matches");
  const rows = readJsonFile(file, []);
  if (!Array.isArray(rows)) return;
  const match = rows.find((row) => row && row.id === "Division-B-Round 2-R2-7");
  if (!match) return;
  const update = {
    playerOne: "Mike Chmielewski",
    playerTwo: "BYE",
    playerOneHandicap: 10,
    playerTwoHandicap: "",
    status: "Bye",
    result: "Bye",
    winner: "Mike Chmielewski",
    updatedAt: "2026-07-15",
    contacts: {
      "Mike Chmielewski": (match.contacts && match.contacts["Mike Chmielewski"]) || {
        name: "Mike Chmielewski",
        email: "chummerthe1@hotmail.com",
        phone: "905-651-1546",
      },
      "BYE": { email: "", phone: "" },
    },
  };
  let changed = false;
  Object.entries(update).forEach(([key, value]) => {
    if (JSON.stringify(match[key]) !== JSON.stringify(value)) {
      match[key] = value;
      changed = true;
    }
  });
  if (changed) writeJsonFile(file, rows);
}

function updateMemberEmailByName(file, name, email) {
  const rows = readJsonFile(file, []);
  if (!Array.isArray(rows)) return;
  let changed = false;
  rows.forEach((row) => {
    if (normalizeMemberName(row && row.name) === normalizeMemberName(name) && row.email !== email) {
      row.email = email;
      changed = true;
    }
  });
  if (changed) writeJsonFile(file, rows);
}

function updateNestedContactEmail(file, name, email) {
  const rows = readJsonFile(file, []);
  if (!Array.isArray(rows)) return;
  let changed = false;
  const target = normalizeMemberName(name);
  rows.forEach((row) => {
    const contactSources = [row && row.contact, row && row.contacts, row && row.playerContact, row && row.memberContact].filter(Boolean);
    contactSources.forEach((source) => {
      if (source.email && normalizeMemberName(source.name || row.name || row.displayName) === target && source.email !== email) {
        source.email = email;
        changed = true;
      }
      Object.values(source).forEach((contact) => {
        if (contact && typeof contact === "object" && contact.email && normalizeMemberName(contact.name) === target && contact.email !== email) {
          contact.email = email;
          changed = true;
        }
      });
    });
  });
  if (changed) writeJsonFile(file, rows);
}

function bootstrapDataFiles() {
  return new Set([
    "account-requests.local.json",
    "codex-bulk-temp-password-used.local.json",
    "contacts.json",
    "email-outbox.local.json",
    "magic-login.local.json",
    "matches.json",
    "password-reset.local.json",
    "rant.json",
    "standings.json",
    "store-orders.local.json",
    "tournament-rsvps.local.json",
    "tournaments.json",
    "users.local.json",
    "weekly.json",
  ]);
}

function hashPassword(salt, password) {
  return crypto.createHash("sha256").update(String(salt) + String(password)).digest("hex");
}

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized.replace(/@(gmail|hotmail|outlook|yahoo)\.co$/, "@$1.com");
}

function findUser(email) {
  const normalized = normalizeEmail(email);
  return loadUsers().find((user) => normalizeEmail(user.email) === normalized);
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signSessionPayload(payload) {
  return crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function createSessionToken(user, maxAge = 28800) {
  const payload = base64Url(JSON.stringify({
    email: normalizeEmail(user.email),
    exp: Date.now() + maxAge * 1000,
  }));
  return `stc2.${payload}.${signSessionPayload(payload)}`;
}

function verifySessionToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "stc2") return null;
  const [, payload, signature] = parts;
  const expected = signSessionPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature || "");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || Date.now() > Number(session.exp)) return null;
    return session;
  } catch {
    return null;
  }
}

function createSessionForUser(req, user) {
  const publicProfile = publicUser(user);
  const sid = createSessionToken(publicProfile);
  return { sid, user: publicProfile };
}

function publicUser(user) {
  if (!user) return null;
  return {
    email: user.email,
    name: user.name || user.email,
    role: user.role || "member",
    phone: user.phone || "",
    photoDataUrl: user.photoDataUrl || "",
  };
}

function verifyLogin(email, password) {
  const user = findUser(email);
  if (!user || !password) return null;
  const expected = Buffer.from(String(user.passwordHash || ""), "hex");
  const actual = Buffer.from(hashPassword(user.salt || "", password), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return publicUser(user);
}

function verifyLoginRecord(email, password) {
  const user = findUser(email);
  if (!user || !password) return null;
  const expected = Buffer.from(String(user.passwordHash || ""), "hex");
  const actual = Buffer.from(hashPassword(user.salt || "", password), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return user;
}

function tooManyAttempts(req) {
  const key = req.socket.remoteAddress || "local";
  const now = Date.now();
  const attempts = (loginAttempts.get(key) || []).filter((time) => now - time < 10 * 60 * 1000);
  attempts.push(now);
  loginAttempts.set(key, attempts);
  return attempts.length > 20;
}

function privateFile(name) {
  const allowed = new Set(["standings", "weekly", "matches", "rant", "tournaments", "contacts"]);
  if (!allowed.has(name)) return "";
  return seedDataFile("private", `${name}.json`);
}

const tournamentDetails = {
  Rockway: {
    teeTime: "7:15 a.m.",
    format: "Individual score with handicap",
    price: "$80",
  },
  "Willow Dell": {
    teeTime: "11:30 a.m.",
    format: "2-man best ball",
    price: "$75",
  },
  "Whisky Run": {
    teeTime: "7:30 a.m.",
    format: "4-man best ball",
    price: "$75",
  },
};

function enrichTournaments(tournaments) {
  return tournaments.map((event) => ({
    ...event,
    ...(tournamentDetails[event.title] || {}),
  }));
}

function rsvpsFile() {
  return seedDataFile("private", "tournament-rsvps.local.json");
}

function publicRsvpSummary(items) {
  const summary = items.reduce((summary, item) => {
    if (item.status !== "Going") return summary;
    if (!summary[item.tournamentId]) summary[item.tournamentId] = [];
    summary[item.tournamentId].push({
      name: item.name,
      updatedAt: item.updatedAt,
    });
    return summary;
  }, {});
  Object.values(summary).forEach((attendees) => {
    attendees.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  });
  return summary;
}

function emailOutboxFile() {
  return dataPath("private", "email-outbox.local.json");
}

function passwordResetFile() {
  return dataPath("private", "password-reset.local.json");
}

function accountRequestsFile() {
  return dataPath("private", "account-requests.local.json");
}

function storeOrdersFile() {
  return seedDataFile("private", "store-orders.local.json");
}

function rangersRickAuthorized(req, url) {
  const expected = process.env.RANGERS_RICK_API_KEY || "";
  if (!expected) return false;
  const auth = String(req.headers.authorization || "");
  const supplied = auth.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : String(req.headers["x-rangers-rick-key"] || url.searchParams.get("key") || "").trim();
  if (!supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function rangersRickSnapshot() {
  const standings = JSON.parse(patchStandings(fs.readFileSync(privateFile("standings"), "utf8")));
  const matches = JSON.parse(patchMatches(fs.readFileSync(privateFile("matches"), "utf8")));
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: "stcrangers.ca",
    publicHome: readJsonFile(seedDataFile("public", "home.json"), {}),
    standings,
    matches,
    weekly: readJsonFile(privateFile("weekly"), []),
    tournaments: enrichTournaments(readJsonFile(privateFile("tournaments"), [])),
    tournamentRsvps: readJsonFile(rsvpsFile(), []),
    rant: readJsonFile(privateFile("rant"), []),
    contacts: readJsonFile(privateFile("contacts"), []),
  };
}

async function deliverEmail(message) {
  const httpDelivery = await deliverEmailOverHttp(message);
  if (httpDelivery) return httpDelivery;
  if (!process.env.SMTP_HOST) return "logged-only-no-email-provider";
  const attempts = [
    {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    },
    { host: process.env.SMTP_HOST, port: 465, secure: true },
    { host: process.env.SMTP_HOST, port: 587, secure: false },
  ].filter((attempt, index, list) =>
    index === list.findIndex((item) => item.host === attempt.host && item.port === attempt.port && item.secure === attempt.secure)
  );
  const errors = [];
  for (const attempt of attempts) {
    const delivery = await tryDeliverEmail(message, attempt);
    if (delivery === "sent") return delivery;
    errors.push(`${attempt.port}: ${delivery}`);
  }
  return `send-failed: ${errors.join(" | ")}`;
}

async function deliverEmailOverHttp(message) {
  if (process.env.STC_EMAIL_WEBHOOK_URL) {
    return postEmailWebhook(message);
  }
  if (process.env.RESEND_API_KEY) {
    return postResendEmail(message);
  }
  return "";
}

async function postEmailWebhook(message) {
  try {
    const response = await fetch(process.env.STC_EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.STC_EMAIL_WEBHOOK_SECRET || "",
        to: message.to,
        subject: message.subject,
        body: message.body,
        kind: message.kind || "",
      }),
    });
    const text = await response.text();
    if (!response.ok) return `webhook-failed: ${response.status} ${text.slice(0, 200)}`;
    let payload = {};
    try {
      payload = JSON.parse(text || "{}");
    } catch {
      payload = {};
    }
    return payload.ok === false ? `webhook-failed: ${payload.message || text.slice(0, 200)}` : "sent";
  } catch (error) {
    return `webhook-failed: ${error.message}`;
  }
}

async function postResendEmail(message) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.SMTP_FROM || "STC Rangers Golf League <info@stcrangers.ca>",
        to: [message.to],
        subject: message.subject,
        text: message.body,
      }),
    });
    const text = await response.text();
    return response.ok ? "sent" : `resend-failed: ${response.status} ${text.slice(0, 200)}`;
  } catch (error) {
    return `resend-failed: ${error.message}`;
  }
}

async function tryDeliverEmail(message, attempt) {
  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: attempt.host,
      port: attempt.port,
      secure: attempt.secure,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || "",
      } : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "STC Rangers Golf League <no-reply@stcrangers.com>",
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
    return "sent";
  } catch (error) {
    return error.message;
  }
}

async function addEmailOutbox(message) {
  const delivery = await deliverEmail(message);
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    delivery,
    ...message,
  };
  const outbox = readJsonFile(emailOutboxFile(), []);
  outbox.unshift(entry);
  writeJsonFile(emailOutboxFile(), outbox);
  return entry;
}

function contactsFile() {
  return seedDataFile("private", "contacts.json");
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeMemberName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function memberNameMatches(user, name) {
  const submitted = normalizeMemberName(name);
  if (!submitted) return false;
  const candidates = [user.name];
  const contacts = readJsonFile(contactsFile(), []);
  contacts
    .filter((contact) => normalizeEmail(contact.email) === normalizeEmail(user.email))
    .forEach((contact) => candidates.push(contact.name));
  return candidates.some((candidate) => normalizeMemberName(candidate) === submitted);
}

function findKnownMemberByNamePhone(name, phone) {
  return loadUsers().find((user) => memberNameMatches(user, name) && memberPhoneMatches(user, phone));
}

function findKnownMemberByUniquePhone(phone) {
  const submitted = normalizePhone(phone);
  if (submitted.length < 7) return null;
  const matches = loadUsers().filter((user) => memberPhoneMatches(user, phone));
  if (matches.length !== 1) return null;
  return matches[0];
}

function findKnownMemberForSignup(name, phone) {
  const phoneMatch = findKnownMemberByNamePhone(name, phone);
  if (phoneMatch) return { user: phoneMatch, verifiedBy: "name-phone" };

  const uniquePhoneMatch = findKnownMemberByUniquePhone(phone);
  if (uniquePhoneMatch) return { user: uniquePhoneMatch, verifiedBy: "unique-phone" };

  const submittedName = normalizeMemberName(name);
  if (!submittedName) return null;
  const nameMatches = loadUsers().filter((user) => memberNameMatches(user, name));
  if (nameMatches.length !== 1) return null;
  return { user: nameMatches[0], verifiedBy: "unique-name" };
}

function syncContactRecord(previousEmail, user) {
  if (!user || !normalizeEmail(user.email)) return;
  const contacts = readJsonFile(contactsFile(), []);
  const previous = normalizeEmail(previousEmail);
  const next = normalizeEmail(user.email);
  let index = contacts.findIndex((contact) => normalizeEmail(contact.email) === previous);
  if (index === -1) {
    const userName = normalizeMemberName(user.name);
    const userPhone = normalizePhone(user.phone);
    index = contacts.findIndex((contact) => {
      const nameMatches = userName && normalizeMemberName(contact.name) === userName;
      const phoneMatches = userPhone && normalizePhone(contact.phone).slice(-7) === userPhone.slice(-7);
      return nameMatches && phoneMatches;
    });
  }
  const nextContact = {
    ...(index === -1 ? {} : contacts[index]),
    name: user.name || (index === -1 ? "" : contacts[index].name),
    email: next,
    phone: user.phone || (index === -1 ? "" : contacts[index].phone),
  };
  if (index === -1) contacts.push(nextContact);
  else contacts[index] = nextContact;
  writeJsonFile(contactsFile(), contacts);
}

function updateMemberLoginEmail(user, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!user || !normalizedEmail || normalizeEmail(user.email) === normalizedEmail) return user;
  const previousEmail = user.email;
  const users = loadUsers();
  const index = users.findIndex((item) => normalizeEmail(item.email) === normalizeEmail(user.email));
  if (index === -1) return user;
  users[index].email = normalizedEmail;
  writeUsers(users);
  syncContactRecord(previousEmail, users[index]);
  return users[index];
}

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, name.length - 1)))}@${domain}`;
}

function resetUrl(req, token) {
  const base = process.env.STC_PUBLIC_URL || `${secureCookie(req) ? "https" : "http"}://${req.headers.host || "localhost"}`;
  return `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

async function createPasswordReset(req, user) {
  const token = crypto.randomBytes(24).toString("hex");
  const resets = readJsonFile(passwordResetFile(), []);
  resets.unshift({
    id: crypto.randomUUID(),
    email: user.email,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    usedAt: "",
  });
  writeJsonFile(passwordResetFile(), resets.slice(0, 500));
  const entry = await addEmailOutbox({
    to: user.email,
    subject: "STC Rangers password reset",
    body: `Hi ${user.name || "Ranger"},\n\nUse this link to set a new STC Rangers member password:\n\n${resetUrl(req, token)}\n\nThis link expires in 1 hour.\n\nSTC Rangers Golf League`,
    kind: "password-reset",
  });
  return { ...entry, resetToken: token };
}

function recentPasswordReset(email, minutes = 10) {
  const normalized = normalizeEmail(email);
  const cutoff = Date.now() - minutes * 60 * 1000;
  return readJsonFile(passwordResetFile(), []).find((item) => {
    const created = Date.parse(item.createdAt || "");
    return normalizeEmail(item.email) === normalized && !item.usedAt && created > cutoff;
  });
}

function resetRecord(token) {
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const resets = readJsonFile(passwordResetFile(), []);
  const index = resets.findIndex((item) => item.tokenHash === hash && !item.usedAt);
  if (index === -1) return null;
  if (new Date(resets[index].expiresAt).getTime() < Date.now()) return null;
  return { resets, index, record: resets[index] };
}

function memberPhoneMatches(user, phone) {
  const submitted = normalizePhone(phone);
  if (submitted.length < 7) return false;
  const submittedLast = submitted.slice(-7);
  const candidates = [user.phone];
  const contacts = readJsonFile(contactsFile(), []);
  contacts
    .filter((contact) => normalizeEmail(contact.email) === normalizeEmail(user.email))
    .forEach((contact) => candidates.push(contact.phone));
  return candidates.some((candidate) => {
    const normalized = normalizePhone(candidate);
    if (normalized.length < 7) return false;
    const candidateLast = normalized.slice(-7);
    return candidateLast === submittedLast || phoneDigitsClose(candidateLast, submittedLast);
  });
}

function memberLastNameMatches(user, lastName) {
  const submitted = String(lastName || "").trim().toLowerCase();
  if (submitted.length < 2) return false;
  const candidates = [user.name];
  const contacts = readJsonFile(contactsFile(), []);
  contacts
    .filter((contact) => normalizeEmail(contact.email) === normalizeEmail(user.email))
    .forEach((contact) => candidates.push(contact.name));
  return candidates.some((candidate) => {
    const parts = String(candidate || "").toLowerCase().split(/\s+/).filter(Boolean);
    const expected = parts[parts.length - 1] || "";
    return expected === submitted;
  });
}

function phoneDigitsClose(expected, submitted) {
  if (expected.length !== submitted.length || expected.length < 7) return false;
  let differences = 0;
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] !== submitted[index]) differences += 1;
    if (differences > 1) return false;
  }
  return differences === 1;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/codex-bootstrap-data" && req.method === "POST") {
    const secret = process.env.STC_BOOTSTRAP_SECRET || "";
    if (!secret || url.searchParams.get("key") !== secret) {
      return sendJson(res, 404, { ok: false, message: "Not found." });
    }
    const body = await readBody(req, 25_000_000);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid bootstrap request." });
    }
    const allowed = bootstrapDataFiles();
    const incoming = payload.files && typeof payload.files === "object" ? payload.files : {};
    const publicIncoming = payload.publicFiles && typeof payload.publicFiles === "object" ? payload.publicFiles : {};
    const written = [];
    for (const [filename, contents] of Object.entries(incoming)) {
      if (!allowed.has(filename)) continue;
      let value = contents;
      if (typeof contents === "string") {
        try {
          value = JSON.parse(contents);
        } catch {
          return sendJson(res, 400, { ok: false, message: `Invalid JSON for ${filename}.` });
        }
      }
      writeJsonFile(dataPath("private", filename), value);
      written.push(filename);
    }
    for (const [filename, contents] of Object.entries(publicIncoming)) {
      if (filename !== "home.json") continue;
      let value = contents;
      if (typeof contents === "string") {
        try {
          value = JSON.parse(contents);
        } catch {
          return sendJson(res, 400, { ok: false, message: `Invalid JSON for public/${filename}.` });
        }
      }
      writeJsonFile(dataPath("public", filename), value);
      written.push(`public/${filename}`);
    }
    return sendJson(res, 200, { ok: true, written });
  }

  if (url.pathname === "/api/codex-bulk-temp-password" && req.method === "POST") {
    const repairFile = dataPath("private", "codex-bulk-temp-password-used.local.json");
    if (url.searchParams.get("key") !== "d85c126ba56714517a00ec4b320b838d1ba7137580481ee7" || fs.existsSync(repairFile)) {
      return sendJson(res, 404, { ok: false, message: "Not found." });
    }
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid request." });
    }
    const tempPassword = String(payload.tempPassword || "");
    if (tempPassword.length < 10) return sendJson(res, 400, { ok: false, message: "Temporary password must be at least 10 characters." });
    const users = loadUsers().map((user) => {
      const salt = crypto.randomBytes(16).toString("hex");
      return {
        ...user,
        salt,
        passwordHash: hashPassword(salt, tempPassword),
        passwordResetRequired: true,
      };
    });
    writeUsers(users);
    writeJsonFile(repairFile, { usedAt: new Date().toISOString(), count: users.length });
    return sendJson(res, 200, { ok: true, count: users.length });
  }

  if (url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "stc-rangers-standalone",
      time: new Date().toISOString(),
      emailConfigured: Boolean(process.env.SMTP_HOST || process.env.STC_EMAIL_WEBHOOK_URL || process.env.RESEND_API_KEY),
      users: loadUsers().length,
    });
  }

  if (url.pathname === "/api/rangers-rick/snapshot" && req.method === "GET") {
    if (!rangersRickAuthorized(req, url)) return sendJson(res, 404, { ok: false, message: "Not found." });
    return sendJson(res, 200, rangersRickSnapshot());
  }

  if (url.pathname === "/api/session") {
    return sendJson(res, 200, { authed: isAuthed(req), productionLogin: true, user: currentUser(req) });
  }

  if (url.pathname === "/api/public/committee" && req.method === "GET") {
    const committee = readJsonFile(seedDataFile("public", "committee.json"), []);
    const usersByEmail = new Map(loadUsers().map((user) => [String(user.email || "").toLowerCase(), user]));
    return sendJson(res, 200, committee.map((member) => {
      const user = usersByEmail.get(String(member.email || "").toLowerCase());
      return {
        ...member,
        photoDataUrl: (user && user.photoDataUrl) || member.photoDataUrl || "",
      };
    }));
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid login request." });
    }

    if (tooManyAttempts(req)) return sendJson(res, 429, { ok: false, message: "Too many login attempts. Try again shortly." });

    const existingUser = findUser(payload.email);
    if (existingUser && existingUser.passwordResetRequired) {
      return sendJson(res, 403, {
        ok: false,
        requiresPasswordSetup: true,
        resetToken: "",
        message: "This migrated account needs a new Rangers password. Tap Forgot password, enter the phone number and last name on file, and choose a new password.",
      });
    }

    const userRecord = verifyLoginRecord(payload.email, payload.password);
    if (!userRecord) {
      if (existingUser) {
        return sendJson(res, 401, {
          ok: false,
          message: "Login failed. Check your email and password, or tap Forgot password.",
        });
      }
      return sendJson(res, 401, {
        ok: false,
        offerAccountSetup: true,
        message: "No member account was found with that email. If this is your first login on the new site, tap Create account and enter your full name so we can connect you to the member list.",
      });
    }

    if (userRecord.passwordResetRequired) {
      const entry = await createPasswordReset(req, userRecord);
      return sendJson(res, 403, {
        ok: false,
        requiresPasswordSetup: true,
        resetToken: entry.resetToken,
        message: "Temporary password accepted. Choose your own password now.",
      });
    }

    const user = publicUser(userRecord);
    const { sid } = createSessionForUser(req, user);
    return sendJson(res, 200, { ok: true, user }, {
      "Set-Cookie": sessionCookie(req, sid),
    });
  }

  if (url.pathname === "/api/request-password-reset" && req.method === "POST") {
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid reset request." });
    }
    const email = normalizeEmail(payload.email);
    const user = findUser(email);
    if (!user) {
      return sendJson(res, 404, {
        ok: false,
        offerAccountSetup: true,
        message: "No member account was found with that email. If this is your first login on the new site, use Create account with your full name and this email to set your password.",
      });
    }
    const entry = await createPasswordReset(req, user);
    const verifiedByPhone = memberPhoneMatches(user, payload.phone);
    const verifiedByLastName = Boolean(user.passwordResetRequired) && memberLastNameMatches(user, payload.lastName);
    const canUseInlineReset = entry.delivery !== "sent" && (verifiedByPhone || verifiedByLastName);
    return sendJson(res, 200, {
      ok: true,
      delivery: entry.delivery,
      inlineReset: canUseInlineReset,
      resetToken: canUseInlineReset ? entry.resetToken : "",
      message: entry.delivery === "sent"
        ? `Password setup link sent to ${user.email}. Check inbox and spam.`
        : canUseInlineReset
          ? `${verifiedByPhone ? "Phone number" : "Last name"} verified. Choose a new password now.`
          : "Email delivery is unavailable right now. Enter the phone number and last name on file so we can verify you here.",
    });
  }

  if (url.pathname === "/api/reset-password" && req.method === "POST") {
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid password reset request." });
    }
    const nextPassword = String(payload.password || "");
    if (nextPassword.length < 10) return sendJson(res, 400, { ok: false, message: "New password must be at least 10 characters." });
    const found = resetRecord(payload.token);
    if (!found) return sendJson(res, 400, { ok: false, message: "This reset link is invalid or expired." });
    const users = loadUsers();
    const index = users.findIndex((item) => String(item.email || "").toLowerCase() === String(found.record.email || "").toLowerCase());
    if (index === -1) return sendJson(res, 404, { ok: false, message: "Member account not found." });
    users[index].salt = crypto.randomBytes(16).toString("hex");
    users[index].passwordHash = hashPassword(users[index].salt, nextPassword);
    users[index].passwordResetRequired = false;
    writeUsers(users);
    found.resets[found.index].usedAt = new Date().toISOString();
    writeJsonFile(passwordResetFile(), found.resets);
    const { sid, user } = createSessionForUser(req, users[index]);
    return sendJson(res, 200, { ok: true, user }, {
      "Set-Cookie": sessionCookie(req, sid),
    });
  }

  if (url.pathname === "/api/forgot-email" && req.method === "POST") {
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid email lookup request." });
    }
    const lastName = String(payload.lastName || "").trim().toLowerCase();
    const phone = normalizePhone(payload.phone);
    if (!lastName || phone.length < 7) return sendJson(res, 400, { ok: false, message: "Enter a last name and phone number." });
    const contacts = readJsonFile(contactsFile(), []);
    const submittedLast = phone.slice(-7);
    const match = contacts.find((item) => {
      const contactPhoneLast = normalizePhone(item.phone).slice(-7);
      const phoneMatches = contactPhoneLast === submittedLast || phoneDigitsClose(contactPhoneLast, submittedLast);
      return String(item.name || "").toLowerCase().split(/\s+/).includes(lastName) && phoneMatches && item.email;
    });
    if (!match) return sendJson(res, 404, { ok: false, message: "No matching member email was found. Please contact the committee." });
    return sendJson(res, 200, { ok: true, maskedEmail: maskEmail(match.email), message: `Your login email looks like ${maskEmail(match.email)}.` });
  }

  if (url.pathname === "/api/account-request" && req.method === "POST") {
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid account request." });
    }
    const name = String(payload.name || "").trim();
    const email = normalizeEmail(payload.email);
    const phone = String(payload.phone || "").trim();
    if (!name || !email.includes("@")) return sendJson(res, 400, { ok: false, message: "Enter your name and email." });
    let existingUser = findUser(email);
    let matchedExistingByNamePhone = false;
    let matchedExistingByUniqueName = false;
    let matchedExistingByUniquePhone = false;
    if (!existingUser) {
      const knownMember = findKnownMemberForSignup(name, phone);
      if (knownMember) {
        existingUser = updateMemberLoginEmail(knownMember.user, email);
        matchedExistingByNamePhone = knownMember.verifiedBy === "name-phone";
        matchedExistingByUniqueName = knownMember.verifiedBy === "unique-name";
        matchedExistingByUniquePhone = knownMember.verifiedBy === "unique-phone";
      }
    }
    if (existingUser) {
      const entry = await createPasswordReset(req, existingUser);
      const canUseInlineReset = entry.delivery !== "sent" && (memberPhoneMatches(existingUser, phone) || matchedExistingByUniqueName || matchedExistingByUniquePhone);
      return sendJson(res, 200, {
        ok: true,
        existingMember: true,
        matchedExistingByNamePhone,
        matchedExistingByUniqueName,
        matchedExistingByUniquePhone,
        delivery: entry.delivery,
        inlineReset: canUseInlineReset,
        resetToken: canUseInlineReset ? entry.resetToken : "",
        message: entry.delivery === "sent"
          ? `Member account found. A password setup link was sent to ${existingUser.email}.`
          : canUseInlineReset
            ? "Member account found. Choose a password now."
            : "You already have a member account, but email delivery is unavailable right now. Use Forgot password with the phone number on file.",
      });
    }
    const requests = readJsonFile(accountRequestsFile(), []);
    const request = { id: crypto.randomUUID(), name, email, phone, createdAt: new Date().toISOString(), status: "pending" };
    requests.unshift(request);
    writeJsonFile(accountRequestsFile(), requests.slice(0, 500));
    await addEmailOutbox({
      to: process.env.STC_ADMIN_EMAIL || "stcrangersgolf@gmail.com",
      subject: "STC Rangers account request",
      body: `New account request:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}`,
      kind: "account-request",
    });
    return sendJson(res, 200, { ok: true, message: "Account request received. The committee will review it." });
  }

  if (url.pathname === "/api/me") {
    const user = currentUser(req);
    if (!user) return sendJson(res, 401, { ok: false, message: "Login required." });

    if (req.method === "GET") return sendJson(res, 200, { ok: true, user });

    if (req.method === "PATCH") {
      const body = await readBody(req);
      let payload = {};
      try {
        payload = JSON.parse(body || "{}");
      } catch {
        return sendJson(res, 400, { ok: false, message: "Invalid profile request." });
      }
      const users = loadUsers();
      const index = users.findIndex((item) => String(item.email || "").toLowerCase() === String(user.email || "").toLowerCase());
      if (index === -1) return sendJson(res, 404, { ok: false, message: "User not found." });
      const existing = users[index];
      const previousEmail = existing.email;
      if (payload.name !== undefined) existing.name = String(payload.name || "").trim();
      if (payload.phone !== undefined) existing.phone = String(payload.phone || "").trim();
      if (payload.email !== undefined) {
        const nextEmail = normalizeEmail(payload.email);
        if (!nextEmail.includes("@")) return sendJson(res, 400, { ok: false, message: "Enter a valid email." });
        const duplicate = users.some((item, i) => i !== index && normalizeEmail(item.email) === nextEmail);
        if (duplicate) return sendJson(res, 409, { ok: false, message: "That email is already in use." });
        existing.email = nextEmail;
      }
      if (payload.photoDataUrl !== undefined) {
        const photo = String(payload.photoDataUrl || "");
        if (photo && (!photo.startsWith("data:image/") || photo.length > 1000000)) {
          return sendJson(res, 400, { ok: false, message: "Photo must be an image under 1 MB after cropping." });
        }
        existing.photoDataUrl = photo;
      }
      if (payload.currentPassword || payload.newPassword) {
        if (!payload.currentPassword || !payload.newPassword) return sendJson(res, 400, { ok: false, message: "Current and new password are required." });
        const valid = verifyLogin(user.email, payload.currentPassword);
        if (!valid) return sendJson(res, 401, { ok: false, message: "Current password is incorrect." });
        if (String(payload.newPassword).length < 10) return sendJson(res, 400, { ok: false, message: "New password must be at least 10 characters." });
        existing.salt = crypto.randomBytes(16).toString("hex");
        existing.passwordHash = hashPassword(existing.salt, payload.newPassword);
      }
      users[index] = existing;
      writeUsers(users);
      syncContactRecord(previousEmail, existing);
      const nextUser = publicUser(existing);
      const { sid } = createSessionForUser(req, nextUser);
      return sendJson(res, 200, { ok: true, user: nextUser }, {
        "Set-Cookie": sessionCookie(req, sid),
      });
    }
  }

  if (url.pathname === "/api/rsvps" && req.method === "GET") {
    const user = currentUser(req);
    if (!user) return sendJson(res, 401, { ok: false, message: "Login required." });
    const all = readJsonFile(rsvpsFile(), []);
    return sendJson(res, 200, {
      ok: true,
      rsvps: all.filter((item) => item.email === user.email),
      attendeeSummary: publicRsvpSummary(all),
    });
  }

  if (url.pathname === "/api/rsvps" && req.method === "POST") {
    const user = currentUser(req);
    if (!user) return sendJson(res, 401, { ok: false, message: "Login required." });
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid RSVP request." });
    }
    const tournamentId = String(payload.tournamentId || "");
    const status = String(payload.status || "");
    if (!tournamentId || !["Going", "Maybe", "Not Going"].includes(status)) {
      return sendJson(res, 400, { ok: false, message: "Choose Going, Maybe, or Not Going." });
    }
    const tournaments = enrichTournaments(readJsonFile(seedDataFile("private", "tournaments.json"), []));
    const tournament = tournaments.find((item) => item.id === tournamentId);
    if (!tournament) return sendJson(res, 404, { ok: false, message: "Tournament not found." });
    const all = readJsonFile(rsvpsFile(), []);
    const next = {
      id: crypto.randomUUID(),
      tournamentId,
      tournamentTitle: tournament.title,
      eventDate: tournament.eventDate,
      status,
      email: user.email,
      name: user.name,
      updatedAt: new Date().toISOString(),
    };
    const filtered = all.filter((item) => !(item.email === user.email && item.tournamentId === tournamentId));
    filtered.unshift(next);
    writeJsonFile(rsvpsFile(), filtered);
    const confirmation = await addEmailOutbox({
      to: user.email,
      subject: `STC Rangers Tournament RSVP: ${tournament.title}`,
      body: `Hi ${user.name},\n\nYour RSVP for ${tournament.title} on ${tournament.eventDate} is confirmed as: ${status}.\n\nTime: ${tournament.teeTime || "TBD"}\nFormat: ${tournament.format || "TBD"}\nPrice: ${tournament.price || "TBD"}\nLocation: ${tournament.location}\n${tournament.description}\n\nYou can return to the Tournaments page to update your RSVP if needed.\n\nSTC Rangers Golf League`,
      kind: "tournament-rsvp",
      tournamentId,
    });
    return sendJson(res, 200, {
      ok: true,
      rsvp: next,
      attendeeSummary: publicRsvpSummary(filtered),
      emailDelivery: confirmation.delivery,
      confirmationSent: confirmation.delivery === "sent",
    });
  }

  if (url.pathname === "/api/store-orders" && req.method === "POST") {
    const body = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      return sendJson(res, 400, { ok: false, message: "Invalid store request." });
    }
    const store = readJsonFile(seedDataFile("public", "store.json"), { products: [] });
    const product = (store.products || []).find((item) => item.id === String(payload.productId || ""));
    if (!product) return sendJson(res, 404, { ok: false, message: "Store item not found." });
    const name = String(payload.name || "").trim();
    const email = normalizeEmail(payload.email);
    const phone = String(payload.phone || "").trim();
    const size = String(payload.size || "").trim();
    const quantity = Math.max(1, Math.min(20, Number(payload.quantity || 1)));
    const notes = String(payload.notes || "").trim();
    if (!name || !email.includes("@")) {
      return sendJson(res, 400, { ok: false, message: "Enter your name and email." });
    }
    const request = {
      id: crypto.randomUUID(),
      productId: product.id,
      productTitle: product.title,
      priceText: product.priceText || "",
      name,
      email,
      phone,
      size,
      quantity,
      notes,
      userEmail: currentUser(req)?.email || "",
      createdAt: new Date().toISOString(),
      status: "new",
    };
    const orders = readJsonFile(storeOrdersFile(), []);
    orders.unshift(request);
    writeJsonFile(storeOrdersFile(), orders.slice(0, 1000));
    const delivery = await addEmailOutbox({
      to: process.env.STC_ADMIN_EMAIL || "stcrangersgolf@gmail.com",
      subject: `STC Rangers store request: ${product.title}`,
      body: `New store request:\n\nItem: ${product.title}\nPrice: ${product.priceText || "TBD"}\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}\nSize: ${size || "Not selected"}\nQuantity: ${quantity}\nNotes: ${notes || "None"}`,
      kind: "store-request",
      productId: product.id,
    });
    return sendJson(res, 200, {
      ok: true,
      request,
      emailDelivery: delivery.delivery,
      message: "Store request saved. The committee will follow up with details.",
    });
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    const sid = parseCookies(req).stc_session;
    if (sid) sessions.delete(sid);
    return sendJson(res, 200, { ok: true }, {
      "Set-Cookie": sessionCookie(req, "", 0),
    });
  }

  const privateMatch = url.pathname.match(/^\/api\/private\/([a-z]+)$/);
  if (privateMatch) {
    if (!isAuthed(req)) return sendJson(res, 401, { ok: false, message: "Login required." });
    const file = privateFile(privateMatch[1]);
    if (!file || !fs.existsSync(file)) return sendJson(res, 404, { ok: false, message: "Not found." });
    let body = fs.readFileSync(file, "utf8");
    if (privateMatch[1] === "matches") body = patchMatches(body);
    if (privateMatch[1] === "standings") body = patchStandings(body);
    if (privateMatch[1] === "tournaments") body = JSON.stringify(enrichTournaments(JSON.parse(body)), null, 2);
    return send(res, 200, body, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
  }

  return sendJson(res, 404, { ok: false, message: "Unknown API route." });
}

function patchStandings(body) {
  const standings = JSON.parse(body);
  const users = loadUsers();
  const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
  const usersByName = new Map(users.map((user) => [String(user.name || "").trim().toLowerCase(), user]));
  return JSON.stringify(standings.map((player) => {
    const email = normalizeEmail(player.contact && player.contact.email);
    const byEmail = email ? usersByEmail.get(email) : null;
    const byName = usersByName.get(String(player.displayName || "").trim().toLowerCase());
    const photoDataUrl = (byEmail && byEmail.photoDataUrl) || (byName && byName.photoDataUrl) || "";
    return photoDataUrl ? { ...player, photoDataUrl } : player;
  }));
}

function patchMatches(body) {
  let matches = JSON.parse(body);
  const findMatch = (division, round, matchNumber) => matches.find((match) =>
    match.division === division && match.round === round && match.matchNumber === matchNumber
  );
  const normalizeMatchName = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  const samePlayers = (match, first, second) => {
    const players = [match.playerOne, match.playerTwo].map((name) => normalizeMatchName(name));
    return players.includes(normalizeMatchName(first)) && players.includes(normalizeMatchName(second));
  };
  const findContact = (name) => {
    for (const match of matches) {
      if (match.contacts && match.contacts[name]) return match.contacts[name];
    }
    return { name, email: "", phone: "" };
  };
  const aR25 = findMatch("A", "Round 2", "R2-5");
  const aToddExtraBye = findMatch("A", "Round 2", "R2-9");
  const aToddCompleted = matches.find((match) =>
    match.competition === "Division" &&
    match.division === "A" &&
    match.round === "Round 2" &&
    samePlayers(match, "Andy Packham", "Todd Wark") &&
    normalizeMatchName(match.winner) === normalizeMatchName("Andy Packham")
  );
  if (aR25 && /bye/i.test(String(aR25.playerTwo || aR25.result || ""))) {
    Object.assign(aR25, {
      playerOne: "Andy Packham",
      playerTwo: "Todd Wark",
      playerOneHandicap: 5.5,
      playerTwoHandicap: 7.5,
      status: aToddCompleted ? "Complete" : "Pending",
      result: aToddCompleted ? aToddCompleted.result : "Round 2 pairing - Todd Wark assigned opponent to avoid repeat bye",
      winner: aToddCompleted ? "Andy Packham" : "",
      updatedAt: aToddCompleted ? aToddCompleted.updatedAt : "2026-06-26",
      contacts: {
        "Andy Packham": findContact("Andy Packham"),
        "Todd Wark": findContact("Todd Wark"),
      },
    });
  }
  if (aToddExtraBye || aToddCompleted) {
    matches = matches.filter((match) =>
      match === aR25 ||
      !(
        match.competition === "Division" &&
        match.division === "A" &&
        match.round === "Round 2" &&
        (
          (match.matchNumber === "R2-9" && samePlayers(match, "Todd Wark", "TBD / Bye")) ||
          (match.matchNumber !== "R2-5" && samePlayers(match, "Andy Packham", "Todd Wark"))
        )
      )
    );
  }
  if (!findMatch("A", "Round 3", "R3-BYE")) {
    matches.push({
      id: "Division-A-Round 3-R3-BYE",
      title: "Division A Round 3 Bye",
      competition: "Division",
      division: "A",
      round: "Round 3",
      matchNumber: "R3-BYE",
      playerOne: "Casey Jarzabek",
      playerTwo: "BYE",
      playerOneHandicap: 6.5,
      playerTwoHandicap: "",
      status: "Complete",
      result: "Round 3 bye awarded - first completed Round 2 match",
      winner: "Casey Jarzabek",
      updatedAt: "2026-06-26",
      contacts: {
        "Casey Jarzabek": findContact("Casey Jarzabek"),
        "BYE": { email: "", phone: "" },
      },
    });
  }
  const bR27 = findMatch("B", "Round 2", "R2-7");
  const bR28 = findMatch("B", "Round 2", "R2-8");
  if (bR27 && bR28 && /bye/i.test(String(bR28.playerTwo || bR28.result || ""))) {
    Object.assign(bR27, {
      playerOne: "Mike Chmielewski",
      playerTwo: "TBD / Bye",
      playerOneHandicap: 10,
      playerTwoHandicap: "",
      status: "Pending",
      result: "Round 2 bye slot reassigned to avoid repeat bye for Mike Mooradian",
      winner: "",
      updatedAt: "2026-06-26",
      contacts: {
        "Mike Chmielewski": findContact("Mike Chmielewski"),
        "TBD / Bye": { email: "", phone: "" },
      },
    });
    Object.assign(bR28, {
      playerOne: "Gary Dick",
      playerTwo: "Mike Mooradian",
      playerOneHandicap: 10,
      playerTwoHandicap: 11,
      status: "Pending",
      result: "Round 2 pairing - Mike Mooradian assigned opponent to avoid repeat bye",
      winner: "",
      updatedAt: "2026-06-26",
      contacts: {
        "Gary Dick": findContact("Gary Dick"),
        "Mike Mooradian": findContact("Mike Mooradian"),
      },
    });
  }
  if (bR27) {
    Object.assign(bR27, {
      playerOne: "Mike Chmielewski",
      playerTwo: "BYE",
      playerOneHandicap: 10,
      playerTwoHandicap: "",
      status: "Bye",
      result: "Bye",
      winner: "Mike Chmielewski",
      updatedAt: "2026-07-15",
      contacts: {
        "Mike Chmielewski": findContact("Mike Chmielewski"),
        "BYE": { email: "", phone: "" },
      },
    });
  }
  return JSON.stringify(matches);
}

function serveStatic(req, res, url) {
  if (url.pathname.startsWith("/data/private/")) {
    return send(res, 403, "Private data is only available through the authenticated API.", {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }

  const embedded = readEmbeddedAsset(url.pathname);
  if (embedded) {
    return send(res, 200, embedded.body, {
      "Content-Type": embedded.contentType,
      "Cache-Control": "no-store",
    });
  }

  const appRoutes = new Set([
    "/",
    "/home",
    "/login",
    "/rules",
    "/committee",
    "/store",
    "/standings",
    "/matches",
    "/tournaments",
    "/rant",
    "/profile",
    "/reset-password",
  ]);
  const hasExtension = Boolean(path.extname(url.pathname));
  const shouldServeApp = appRoutes.has(url.pathname) || (!hasExtension && !url.pathname.startsWith("/api/"));
  const cleanPath = decodeURIComponent(shouldServeApp ? "/index.html" : url.pathname);
  const file = path.normalize(path.join(root, cleanPath));
  if (!file.startsWith(root)) return send(res, 403, "Forbidden");
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "Not found");

  const ext = path.extname(file).toLowerCase();
  const headers = { "Content-Type": mimeTypes[ext] || "application/octet-stream" };
  if ([".html", ".css", ".js", ".json"].includes(ext)) headers["Cache-Control"] = "no-store";
  let body = fs.readFileSync(file);
  if (url.pathname === "/app.js") body = patchClientApp(String(body));
  if (cleanPath === "/index.html") body = patchIndexHtml(String(body));
  send(res, 200, body, headers);
}

function patchIndexHtml(body) {
  return String(body)
    .replace(/styles\.css\?v=[^"]+/g, "styles.css?v=20260628c")
    .replace(/app\.js\?v=[^"]+/g, "app.js?v=20260628c");
}

function patchClientApp(body) {
  return String(body);
}

function readEmbeddedAsset(pathname) {
  const manifestPath = path.join(root, "package.json");
  if (!fs.existsSync(manifestPath)) return null;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }

  const asset = pathname === "/app.js" ? "clientApp" : pathname === "/styles.css" ? "clientCss" : "";
  const chunks = manifest.codexEmbeddedAssets && manifest.codexEmbeddedAssets[asset];
  if (!Array.isArray(chunks) || chunks.length === 0) return null;

  const body = chunks
    .map((chunk) => {
      if (chunk.inline) return chunk.inline;
      const marker = `STC_${asset.toUpperCase()}_${chunk.id}:`;
      const file = path.join(root, chunk.file);
      if (!fs.existsSync(file)) return "";
      const source = fs.readFileSync(file, "utf8");
      const start = source.indexOf(marker);
      if (start === -1) return "";
      const rest = source.slice(start + marker.length);
      const end = rest.indexOf(`END_STC_${asset.toUpperCase()}_${chunk.id}`);
      return (end === -1 ? rest : rest.slice(0, end)).trim();
    })
    .join("");

  if (!body) return null;
  const decoded = zlib.gunzipSync(Buffer.from(body, "base64")).toString("utf8");
  return {
    body: asset === "clientApp" ? patchClientApp(decoded) : decoded,
    contentType: asset === "clientApp" ? mimeTypes[".js"] : mimeTypes[".css"],
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (error) {
    return sendJson(res, 500, { ok: false, message: error.message });
  }
});

updateJamesMcgowanDisplayEmail();
updateMarkHoenigDisplayEmail();
ensureStephenWattonRollingMeadowsRsvp();
ensureStephenWattonRockwayRsvp();
ensureMikeChmielewskiRound2Bye();

server.listen(port, () => {
  console.log(`STC Rangers standalone running at http://127.0.0.1:${port}`);
});
