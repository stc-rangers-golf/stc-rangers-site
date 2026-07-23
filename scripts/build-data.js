const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const redesign = "/Users/caseyjarzabek/.openclaw/agent-workspaces/website-willy/stc-rangers-redesign";
const imports = path.join(redesign, "wix-rebuild-package/imports");
const wixAudit = path.resolve(root, "../wix-audit");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseMaybeJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function cleanPhone(phone) {
  return String(phone || "").trim();
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const contactsRaw = readJson(path.join(imports, "contact-email-export-2026-06-10.private.json"));
const contactByName = new Map();
for (const contact of contactsRaw) {
  const displayName = [contact.first, contact.last].filter(Boolean).join(" ").trim() || contact.nickname || "";
  if (!displayName) continue;
  contactByName.set(normalizeName(displayName), {
    name: displayName,
    email: contact.email || contact.memberEmail || "",
    phone: cleanPhone(contact.phone),
  });
}

const standings = readJson(path.join(imports, "LeagueStandings-import-2026-06-03.json")).map((row) => {
  const contact = contactByName.get(normalizeName(row.displayName)) || {};
  return {
    flight: row.flight,
    rank: Number(row.rank) || 0,
    displayName: row.displayName,
    sheetName: row.sheetName || "",
    points: Number(row.points) || 0,
    handicap: row.handicap,
    latestScore: row.latestScore || "",
    updatedAt: row.updatedAt || "",
    scoresByWeek: parseMaybeJson(row.scoresByWeek, []),
    contact,
  };
});

const weekly = readJson(path.join(imports, "WeeklyResults-import-2026-06-03.json")).map((row) => ({
  weekDate: row.weekDate,
  displayLabel: row.displayLabel,
  sheetLabel: row.sheetLabel,
  status: row.status,
  flightWinners: parseMaybeJson(row.flightWinners, {}),
  twos: parseMaybeJson(row.twos, []),
  closestToPin: parseMaybeJson(row.closestToPin, []),
  scores: parseMaybeJson(row.scores, []),
  note: row.note || "",
  summaryPublic: row.summaryPublic || "",
  updatedAt: row.updatedAt || "",
}));

const latestCompleteWeekly =
  weekly
    .filter((row) => row.status === "Complete")
    .sort((a, b) => String(b.weekDate).localeCompare(String(a.weekDate)))[0] ||
  weekly.find((row) => row.weekDate === "2026-07-08") ||
  weekly[0];
const currentUpdate =
  latestCompleteWeekly.weekDate === "2026-07-22"
    ? `${latestCompleteWeekly.displayLabel} results are loaded for member preview. Carts are 90 degrees or scatter; bunkers are in play unless full of water.`
    : `${latestCompleteWeekly.displayLabel} results are loaded for member preview.`;
const publicHome = {
  currentUpdate,
  weeklyPrizeWinners: {
    label: latestCompleteWeekly.displayLabel,
    twos: latestCompleteWeekly?.twos || [],
    closestToPin: latestCompleteWeekly?.closestToPin || [],
  },
  weeklyNews: {
    headline: `${latestCompleteWeekly.displayLabel} Weekly Winners`,
    body: "Flight winners, weekly scores, match results, and updated standings are available after member login.",
  },
  memorial: {
    title: "Peter McBride Memorial",
    kicker: "Our leader, our friend.",
    body: "Gone but not forgotten.",
    closing: "RIP Big Chum.",
  },
};

const matchSource = readJson(path.join(imports, "MatchResults-import-2026.json"));
const matches = matchSource.map((row) => {
  const p1Contact = contactByName.get(normalizeName(row.playerOne)) || {
    email: row.playerOneEmail || "",
    phone: cleanPhone(row.playerOnePhone),
  };
  const p2Contact = contactByName.get(normalizeName(row.playerTwo)) || {
    email: row.playerTwoEmail || "",
    phone: cleanPhone(row.playerTwoPhone),
  };
  return {
    id: row._id || `${row.competition}-${row.division}-${row.round}-${row.matchNumber}`,
    title: row.title || "",
    competition: row.competition || "",
    division: row.division || "",
    round: row.round || "",
    matchNumber: row.matchNumber || "",
    playerOne: row.playerOne || "",
    playerTwo: row.playerTwo || "",
    playerOneHandicap: row.playerOneHandicap ?? "",
    playerTwoHandicap: row.playerTwoHandicap ?? "",
    status: row.status || "",
    result: row.result || "",
    winner: row.winner || "",
    updatedAt: row.updatedAt || "",
    contacts: {
      [row.playerOne || "playerOne"]: p1Contact,
      [row.playerTwo || "playerTwo"]: p2Contact,
    },
  };
});

const rantPosts = readJson(path.join(imports, "RantPosts-import-2026.json"))
  .filter((post) => post.status === "Published")
  .map((post, index) => ({
    id: `rant-${index + 1}`,
    title: (post.message || "").split("\n").find(Boolean) || "Rant",
    displayName: post.displayName || "Member",
    message: post.message || "",
    source: post.source || "",
    createdAt: post.createdAt || "",
    updatedAt: post.updatedAt || "",
  }));

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

const tournaments = readJson(path.join(imports, "TournamentEvents-import-2026.json")).map((event, index) => ({
  id: `tournament-${index + 1}`,
  title: event.title || "",
  eventDate: event.eventDate || "",
  ...(tournamentDetails[event.title] || {}),
  location: event.location || "",
  description: event.description || "",
  registrationUrl: event.registrationUrl || "",
  status: event.status || "",
  updatedAt: event.updatedAt || "",
}));

const rules = [
  "Be ready and checked in before your tee time.",
  "League play follows the weekly format posted on the homepage.",
  "Closest-to-the-pin prizes are tracked on holes 4 and 7 unless posted otherwise.",
  "Twos and prize winners are posted after results are confirmed.",
  "Match play opponents are responsible for contacting each other and arranging match dates.",
  "Completed match results should be reported to league scoring as soon as possible.",
  "Respect the course, staff, league members, and pace of play.",
];

writeJson(path.join(root, "data/public/home.json"), publicHome);
writeJson(path.join(root, "data/private/standings.json"), standings);
writeJson(path.join(root, "data/private/weekly.json"), weekly);
writeJson(path.join(root, "data/private/matches.json"), matches);
writeJson(path.join(root, "data/private/rant.json"), rantPosts);
writeJson(path.join(root, "data/private/tournaments.json"), tournaments);
writeJson(path.join(root, "data/public/rules.json"), rules);
writeJson(
  path.join(root, "data/private/contacts.json"),
  Array.from(contactByName.values()).sort((a, b) => a.name.localeCompare(b.name))
);

console.log(`Wrote ${standings.length} standings, ${matches.length} matches, ${rantPosts.length} rant posts, ${tournaments.length} tournaments.`);
