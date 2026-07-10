const state = {
  authed: false,
  user: null,
  data: {},
  privateLoaded: false,
  rsvps: [],
  attendeeSummary: {},
  route: "home",
  standingsFlight: "A",
  matchesDivision: "A",
  expandedPlayer: "",
};

let inlineResetToken = "";

function ensureLoginModalMarkup() {
  if (document.querySelector("#loginModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="loginModal" class="login-modal hidden" role="dialog" aria-modal="true" aria-labelledby="loginTitle" hidden>
      <form id="loginForm" class="login-card">
        <button class="modal-close" type="button" id="closeLogin" aria-label="Close login">x</button>
        <div id="loginPanel">
          <h2 id="loginTitle">Member Login</h2>
          <p>Log in to view standings, matches, tournaments, the Rant, and member contact details.</p>
          <label>Email<input id="emailInput" type="email" autocomplete="username" placeholder="member@email.com" /></label>
          <label>Password<input id="passwordInput" type="password" autocomplete="current-password" placeholder="Password" /></label>
          <button class="button button-red full" type="submit">Log In</button>
        </div>
        <div id="resetPanel" class="hidden" hidden>
          <h2>Set New Password</h2>
          <p>Choose a new member password. Use at least 10 characters.</p>
          <label>New Password<input id="resetPasswordInput" type="password" autocomplete="new-password" placeholder="10 characters minimum" /></label>
          <label>Confirm New Password<input id="resetPasswordConfirm" type="password" autocomplete="new-password" placeholder="Type it again" /></label>
          <label class="login-check-row"><input id="showResetPassword" type="checkbox" />Show password</label>
          <button class="button button-red full" type="button" id="resetPasswordButton">Save New Password</button>
        </div>
        <div id="forgotPasswordPanel" class="hidden" hidden>
          <h2>Forgot Password</h2>
          <p>Enter the email, phone number, and last name on your Rangers account. If email delivery is unavailable, these details let you set the password here.</p>
          <label>Member Email<input id="forgotPasswordEmail" type="email" autocomplete="email" placeholder="member@email.com" /></label>
          <label>Phone Number On File<input id="forgotPasswordPhone" type="tel" autocomplete="tel" placeholder="Phone number" /></label>
          <label>Last Name<input id="forgotPasswordLastName" type="text" autocomplete="family-name" placeholder="Last name" /></label>
          <div class="modal-actions">
            <button class="button button-red full" type="button" id="sendResetLinkButton">Continue</button>
            <button class="button button-outline full" type="button" data-login-back>Back To Login</button>
          </div>
        </div>
        <div id="forgotEmailPanel" class="hidden" hidden>
          <h2>Forgot Email</h2>
          <p>Enter your last name and phone number so we can look up the email on file.</p>
          <label>Last Name<input id="forgotEmailLastName" type="text" autocomplete="family-name" placeholder="Last name" /></label>
          <label>Phone Number<input id="forgotEmailPhone" type="tel" autocomplete="tel" placeholder="Phone number" /></label>
          <div class="modal-actions">
            <button class="button button-red full" type="button" id="lookupEmailButton">Find Email</button>
            <button class="button button-outline full" type="button" data-login-back>Back To Login</button>
          </div>
        </div>
        <div id="createAccountPanel" class="hidden" hidden>
          <h2>Create Account</h2>
          <p>If you are already on the member list, enter your full name and email to connect your Rangers record and set a password. Add your phone number if you know the one on file.</p>
          <label>Full Name<input id="accountNameInput" type="text" autocomplete="name" placeholder="Full name" /></label>
          <label>Email<input id="accountEmailInput" type="email" autocomplete="email" placeholder="member@email.com" /></label>
          <label>Phone Number<input id="accountPhoneInput" type="tel" autocomplete="tel" placeholder="Phone number" /></label>
          <div class="modal-actions">
            <button class="button button-red full" type="button" id="sendAccountRequestButton">Continue</button>
            <button class="button button-outline full" type="button" data-login-back>Back To Login</button>
          </div>
        </div>
        <p id="loginStatus" class="login-status" role="status" aria-live="polite"></p>
        <div class="login-links">
          <button type="button" id="forgotPasswordButton">Forgot password</button>
          <button type="button" id="forgotEmailButton">Forgot email</button>
          <button type="button" id="createAccountButton">Create account</button>
        </div>
      </form>
    </div>
  `);
}

const routes = new Set(["home", "rules", "committee", "store", "standings", "matches", "tournaments", "rant", "profile"]);
const privateRoutes = new Set(["standings", "matches", "tournaments", "rant", "profile"]);
const pathRoutes = new Map([
  ["/home", "home"],
  ["/rules", "rules"],
  ["/committee", "committee"],
  ["/store", "store"],
  ["/standings", "standings"],
  ["/matches", "matches"],
  ["/tournaments", "tournaments"],
  ["/rant", "rant"],
  ["/profile", "profile"],
]);
ensureLoginModalMarkup();

const view = document.querySelector("#view");
const loginModal = document.querySelector("#loginModal");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const loginForm = document.querySelector("#loginForm");
const closeLogin = document.querySelector("#closeLogin");
const loginStatus = document.querySelector("#loginStatus");

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

async function refreshPublicHome() {
  state.data.home = await loadJson("data/public/home.json");
  document.querySelector("#currentUpdate").textContent = `Current Update: ${state.data.home.currentUpdate}`;
}

async function boot() {
  const [home, rules, committee, session] = await Promise.all([
    loadJson("data/public/home.json"),
    loadJson("data/public/rules.json"),
    loadJson("api/public/committee"),
    loadJson("api/session"),
  ]);

  state.authed = Boolean(session.authed);
  state.user = session.user || null;
  state.data = { home, rules, committee };
  document.querySelector("#currentUpdate").textContent = `Current Update: ${home.currentUpdate}`;
  syncAuthButtons();
  window.addEventListener("hashchange", renderRoute);
  await renderRoute();
  if (new URLSearchParams(window.location.search).get("login") === "1" && !state.authed) openLogin();
}

function syncAuthButtons() {
  loginButton.classList.toggle("hidden", state.authed);
  loginButton.hidden = state.authed;
  logoutButton.classList.toggle("hidden", !state.authed);
  logoutButton.hidden = !state.authed;
}

function getRoute() {
  const hashRoute = window.location.hash.replace("#", "");
  if (routes.has(hashRoute)) return hashRoute;
  const pathRoute = pathRoutes.get(window.location.pathname);
  return routes.has(pathRoute) ? pathRoute : "home";
}

function normalizeDirectPath() {
  if (window.location.pathname === "/login") {
    window.history.replaceState({}, "", "/?login=1");
    openLogin();
    return;
  }
  const pathRoute = pathRoutes.get(window.location.pathname);
  if (pathRoute && !window.location.hash) {
    window.history.replaceState({}, "", `/#${pathRoute}`);
  }
}

async function renderRoute() {
  const directPathRoute = pathRoutes.get(window.location.pathname);
  if (directPathRoute && !window.location.hash) {
    state.route = directPathRoute;
    window.history.replaceState({}, "", `/#${directPathRoute}`);
  } else {
    state.route = getRoute();
  }
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === state.route);
  });
  if (privateRoutes.has(state.route) && !state.authed) {
    renderLocked(state.route);
    return;
  }
  if (privateRoutes.has(state.route)) {
    await ensurePrivateData();
  }
  if (state.route === "home" && state.authed) {
    await ensurePrivateData();
  }
  if (state.route === "committee") {
    state.data.committee = await loadJson("api/public/committee");
  }
  if (state.route === "home") {
    await refreshPublicHome();
  }
  const renderers = {
    home: renderHome,
    rules: renderRules,
    committee: renderCommittee,
    store: renderStore,
    standings: renderStandings,
    matches: renderMatches,
    tournaments: renderTournaments,
    rant: renderRant,
    profile: renderProfile,
  };
  renderers[state.route]();
  view.focus({ preventScroll: true });
}

async function ensurePrivateData() {
  if (state.privateLoaded) return;
  const [standings, weekly, matches, rant, tournaments, contacts] = await Promise.all([
    loadJson("api/private/standings"),
    loadJson("api/private/weekly"),
    loadJson("api/private/matches"),
    loadJson("api/private/rant"),
    loadJson("api/private/tournaments"),
    loadJson("api/private/contacts"),
  ]);
  Object.assign(state.data, { standings, weekly, matches, rant, tournaments, contacts });
  state.rsvps = await loadRsvps();
  state.privateLoaded = true;
}

async function loadRsvps() {
  if (!state.authed) return [];
  const response = await fetch("api/rsvps", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) return [];
  const payload = await response.json();
  state.attendeeSummary = payload.attendeeSummary || {};
  return payload.rsvps || [];
}

async function postJson(url, payload, method = "POST") {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Request failed.");
  return result;
}

function html(strings, ...values) {
  return strings.reduce((out, string, index) => out + string + (values[index] ?? ""), "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderHome() {
  const { home } = state.data;
  const thisWeekItems = [
    ["Next League Night", "July 8"],
    ["Feature", "Sweeps Week"],
    ["Round 2 Matches", "Due July 15"],
    ["Next Tournament", "Rockway · July 25"],
  ];
  const twos = home.weeklyPrizeWinners.twos.length
    ? home.weeklyPrizeWinners.twos.map((name) => `<li>Two: ${escapeHtml(name)}</li>`).join("")
    : "<li>No twos posted.</li>";
  const sweeps = Array.isArray(home.weeklyPrizeWinners.sweeps) && home.weeklyPrizeWinners.sweeps.length
    ? home.weeklyPrizeWinners.sweeps.map((flight) => `
      <li>
        <strong>${escapeHtml(flight.flight)} Division</strong>
        ${flight.places.map((place) => `
          <span>${escapeHtml(place.place)}: ${escapeHtml(place.names.join(", "))}</span>
        `).join("")}
      </li>
    `).join("")
    : "";
  const pinHighlights = home.weeklyPrizeWinners.closestToPin
    .map((winner) => {
      const label = `Hole ${winner.hole}`;
      const photoDataUrl = findMemberPhoto(winner.name);
      const photo = photoDataUrl
        ? `<img src="${escapeHtml(photoDataUrl)}" alt="${escapeHtml(winner.name)} closest to the pin winner" />`
        : `<span>${escapeHtml(getInitials(winner.name))}</span>`;
      return html`
        <div class="pin-winner-card">
          <div class="pin-winner-photo">${photo}</div>
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(winner.name)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  view.innerHTML = html`
    <section class="hero">
      <div class="hero-copy">
        <h1>Welcome to the St. Catharines Rangers Golf League</h1>
        <div class="hero-rule"></div>
        <p class="hero-subtitle">Fun, Friendship &amp; Fairways Since 1978</p>
        <div class="glance-strip" aria-label="This week at a glance">
          ${thisWeekItems.map(([label, value]) => `
            <div class="glance-item">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `).join("")}
        </div>
        ${state.authed ? renderMemberSnapshot() : ""}
        <div class="home-panels">
          <article class="glass-panel">
            <h2 class="panel-title">Weekly Prize Winners</h2>
            <p><strong>${escapeHtml(home.weeklyPrizeWinners.label)}</strong></p>
            ${sweeps ? `
              <div class="winner-badge-row">
                <span class="winner-badge">Sweeps</span>
                <span class="winner-note">Division results</span>
              </div>
              <ul class="prize-list prize-list-compact prize-list-stacked">${sweeps}</ul>
            ` : ""}
            <div class="winner-badge-row">
              <span class="winner-badge">2s</span>
              <span class="winner-note">Members who carded a two</span>
            </div>
            <ul class="prize-list prize-list-compact">${twos}</ul>
            <div class="pin-winner-strip" aria-label="Closest to the pin photo highlights">
              <p>Closest to the Pins</p>
              <div class="pin-winner-grid">${pinHighlights}</div>
            </div>
          </article>
          <article class="glass-panel">
            <h2 class="panel-title">Latest League News</h2>
            <p><strong>${escapeHtml(home.weeklyNews.headline)}</strong></p>
            <p>${escapeHtml(home.weeklyNews.body)}</p>
          </article>
        </div>
      </div>
      <aside class="memorial-card">
        <img src="assets/peter-mcbride-memorial.jpg" alt="Peter McBride" />
        <div>
          <h2>${escapeHtml(home.memorial.kicker)}<br />Peter McBride.</h2>
          <p>${escapeHtml(home.memorial.body)}</p>
          <strong>${escapeHtml(home.memorial.closing)}</strong>
        </div>
      </aside>
    </section>
  `;
}

function renderMemberSnapshot() {
  const player = findCurrentStanding();
  const nextMatches = findCurrentMemberMatches();
  const nextRsvp = findNextRsvp();
  const matchRows = nextMatches.length
    ? nextMatches.map((match) => `
      <div class="snapshot-match">
        <strong>${escapeHtml(getMatchOpponent(match))}</strong>
        <p>${escapeHtml(getMatchLabel(match))}</p>
        ${renderOpponentHandicap(match)}
      </div>
    `).join("")
    : `<div class="snapshot-match"><strong>No pending match</strong><p>You are clear for now.</p></div>`;
  return html`
    <section class="member-snapshot" aria-label="Member snapshot">
      <article>
        <span>Your Next Match${nextMatches.length > 1 ? "es" : ""}</span>
        <div class="snapshot-match-list">${matchRows}</div>
      </article>
      <article>
        <span>Your Standings</span>
        <strong>${escapeHtml(player ? `${player.flight} Flight · #${player.rank}` : "Not listed yet")}</strong>
        <p>${escapeHtml(player ? `${player.points} points · ${player.handicap} handicap` : "Check standings after the next update.")}</p>
      </article>
      <article>
        <span>Your Next Tournament</span>
        <strong>${escapeHtml(nextRsvp ? nextRsvp.tournamentTitle : "No RSVP yet")}</strong>
        <p>${escapeHtml(nextRsvp ? `${nextRsvp.eventDate} · ${nextRsvp.status}` : "Visit Tournaments to RSVP.")}</p>
      </article>
    </section>
  `;
}

function renderRules() {
  const rules = state.data.rules || {};
  const general = Array.isArray(rules) ? rules : rules.general || [];
  const sections = Array.isArray(rules) ? [] : [
    ["Weekly Scoring", rules.weeklyScoring],
    ["Handicaps", rules.handicaps],
    ["Standings", rules.standings],
    ["Match Scoring", rules.matchScoring],
  ];
  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Rangers Rules</h1>
          <p class="page-lede">League rules, scoring notes, handicap handling, and match-play formulas.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="rules-grid">
        ${renderRuleSection("General League Rules", general)}
        ${sections.map(([title, items]) => renderRuleSection(title, items || [])).join("")}
      </div>
    </section>
  `;
}

function renderRuleSection(title, items) {
  return `
    <article class="panel rules-section">
      <h2 class="panel-title">${escapeHtml(title)}</h2>
      <ol class="rules-list">
        ${(items || []).map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}
      </ol>
    </article>
  `;
}

function renderCommittee() {
  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Committee</h1>
          <p class="page-lede">League contacts and responsibilities.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="committee-grid">
        ${state.data.committee.map((member) => `
          <article class="panel committee-card">
            <div class="committee-photo">
              ${member.photoDataUrl ? `<img src="${escapeHtml(member.photoDataUrl)}" alt="${escapeHtml(member.name)} profile photo" />` : `<span>${escapeHtml(getInitials(member.name))}</span>`}
            </div>
            <div>
              <h2 class="panel-title">${escapeHtml(member.name)}</h2>
              <p><strong>${escapeHtml(member.role)}</strong></p>
              <p class="committee-contact"><strong>Phone:</strong> ${escapeHtml(member.phone || "Phone not listed")}</p>
              ${member.email ? `<p class="committee-contact"><strong>Email:</strong> ${escapeHtml(member.email)}</p>` : ""}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

async function renderStore() {
  const store = state.data.store || await loadJson("data/public/store.json");
  state.data.store = store;
  const products = store.products || [];
  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Store</h1>
          <p class="page-lede">Rangers gear and league items. The current shirt order is handled through the official Promotions Plus / OrderMyGear store.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="store-grid">
        ${products.map(renderStoreProduct).join("")}
      </div>
    </section>
  `;
  view.querySelectorAll("[data-store-form]").forEach((form) => {
    form.addEventListener("submit", handleStoreRequest);
  });
}

function renderStoreProduct(product) {
  const sizes = (product.sizes || []).map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join("");
  const price = product.priceText || (product.price ? `$${Number(product.price).toFixed(2)}` : "Price to be confirmed");
  return html`
    <article class="panel store-card">
      <div class="store-media">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" />
        ${product.badge ? `<span class="store-badge">${escapeHtml(product.badge)}</span>` : ""}
      </div>
      <div class="store-details">
        <p class="store-kicker">${escapeHtml(product.kicker || "Rangers Store")}</p>
        <h2 class="panel-title">${escapeHtml(product.title)}</h2>
        <p class="store-price">${escapeHtml(price)}</p>
        <p>${escapeHtml(product.description || "")}</p>
        ${product.deadline ? `<p class="store-deadline"><strong>Deadline:</strong> ${escapeHtml(product.deadline)}</p>` : ""}
        ${product.externalUrl ? `<a class="button button-red" href="${escapeHtml(product.externalUrl)}" target="_blank" rel="noopener">Order Shirt</a>` : ""}
        <form class="store-form" data-store-form data-product-id="${escapeHtml(product.id)}">
          <h3>Future Store Request</h3>
          <p class="page-lede">Use this if you want the committee to follow up, or for future Rangers items listed here.</p>
          <div class="store-form-grid">
            <label>Name <input name="name" value="${escapeHtml(state.user?.name || "")}" required /></label>
            <label>Email <input name="email" type="email" value="${escapeHtml(state.user?.email || "")}" required /></label>
            <label>Phone <input name="phone" value="${escapeHtml(state.user?.phone || "")}" /></label>
            <label>Size <select name="size">${sizes}</select></label>
            <label>Quantity <input name="quantity" type="number" min="1" max="20" value="1" /></label>
          </div>
          <label>Notes <textarea name="notes" placeholder="Pickup notes, extra sizing questions, or future item requests"></textarea></label>
          <button class="button button-outline full" type="submit">Send Store Request</button>
          <p class="login-status" data-store-status role="status" aria-live="polite"></p>
        </form>
      </div>
    </article>
  `;
}

async function handleStoreRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("[data-store-status]");
  const formData = new FormData(form);
  status.textContent = "Saving request...";
  try {
    const result = await postJson("api/store-orders", {
      productId: form.dataset.productId,
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      size: formData.get("size"),
      quantity: formData.get("quantity"),
      notes: formData.get("notes"),
    });
    status.textContent = result.message || "Store request saved.";
    form.reset();
  } catch (error) {
    status.textContent = error.message;
  }
}

function getInitials(name) {
  return String(name || "Member")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function normalizePersonName(name) {
  const normalized = String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
  const aliases = {
    "casey jarzebek": "casey jarzabek",
    "fred kryzanowksi": "fred kryzanowski",
    "jim babin": "james babin",
    "jim findly": "jim findlay",
    "mark renolds": "mark reynolds",
    "renolds m": "mark reynolds",
  };
  return aliases[normalized] || normalized;
}

function findMemberPhoto(name) {
  const target = normalizePersonName(name);
  if (!target) return "";
  if (normalizePersonName(state.user?.name) === target && state.user?.photoDataUrl) return state.user.photoDataUrl;

  const players = Array.isArray(state.data.standings) ? state.data.standings : [];
  const player = players.find((item) => normalizePersonName(item.displayName) === target);
  if (player?.photoDataUrl) return player.photoDataUrl;

  const contacts = Array.isArray(state.data.contacts) ? state.data.contacts : [];
  const contact = contacts.find((item) => normalizePersonName(item.name) === target);
  return contact?.photoDataUrl || "";
}

function findCurrentStanding() {
  const players = Array.isArray(state.data.standings) ? state.data.standings : [];
  return players.find((player) => isCurrentMemberName(player.displayName) || isCurrentMemberEmail(player.contact?.email));
}

function findCurrentMemberMatches() {
  const matches = Array.isArray(state.data.matches) ? state.data.matches : [];
  return matches
    .filter((match) => {
      if (!isCurrentMemberInMatch(match)) return false;
      if (String(match.status || "").toLowerCase() === "complete") return false;
      if (isAwaitingOpponentMatch(match)) return true;
      if (isBracketVacancy(match)) return false;
      return true;
    })
    .sort((a, b) => getRoundNumber(a) - getRoundNumber(b));
}

function isCurrentMemberInMatch(match) {
  return isCurrentMemberName(match.playerOne)
        || isCurrentMemberName(match.playerTwo)
        || isCurrentMemberContact(match.contacts?.[match.playerOne])
        || isCurrentMemberContact(match.contacts?.[match.playerTwo]);
}

function isAwaitingOpponentMatch(match) {
  if (!isBracketVacancy(match)) return false;
  const status = String(match.status || "").toLowerCase();
  if (status === "complete" && !isCurrentMemberName(match.winner)) return false;
  return true;
}

function findNextRsvp() {
  const rsvps = Array.isArray(state.rsvps) ? state.rsvps : [];
  return rsvps
    .filter((rsvp) => rsvp.status === "Going" || rsvp.status === "Maybe")
    .sort((a, b) => parseEventDate(a.eventDate) - parseEventDate(b.eventDate))[0] || null;
}

function getMatchOpponent(match) {
  if (isAwaitingOpponentMatch(match)) return "Awaiting opponent";
  if (isCurrentMemberName(match.playerOne) || isCurrentMemberContact(match.contacts?.[match.playerOne])) {
    return match.playerTwo || "Opponent TBD";
  }
  if (isCurrentMemberName(match.playerTwo) || isCurrentMemberContact(match.contacts?.[match.playerTwo])) {
    return match.playerOne || "Opponent TBD";
  }
  return "Opponent TBD";
}

function renderOpponentHandicap(match) {
  const handicap = getOpponentHandicap(match);
  return handicap === "" ? "" : `<p class="snapshot-handicap">Opponent handicap: ${escapeHtml(handicap)}</p>`;
}

function getOpponentHandicap(match) {
  if (isAwaitingOpponentMatch(match)) return "";
  if (isCurrentMemberName(match.playerOne) || isCurrentMemberContact(match.contacts?.[match.playerOne])) {
    return formatHandicap(match.playerTwoHandicap);
  }
  if (isCurrentMemberName(match.playerTwo) || isCurrentMemberContact(match.contacts?.[match.playerTwo])) {
    return formatHandicap(match.playerOneHandicap);
  }
  return "";
}

function formatHandicap(value) {
  return value === undefined || value === null || value === "" ? "" : String(value);
}

function getMatchLabel(match) {
  const competition = match.competition === "Division" ? `${match.division} Division` : match.competition;
  const suffix = isAwaitingOpponentMatch(match) ? " · awaiting opponent" : "";
  return `${competition || "Match"} · ${match.round || "Round pending"}${suffix}`;
}

function isCurrentMemberName(name) {
  const target = normalizePersonName(name);
  return Boolean(target && target === normalizePersonName(state.user?.name));
}

function isCurrentMemberEmail(email) {
  return Boolean(email && state.user?.email && normalizeEmailInput(email) === normalizeEmailInput(state.user.email));
}

function isCurrentMemberContact(contact) {
  return Boolean(contact && (isCurrentMemberEmail(contact.email) || isCurrentMemberName(contact.name)));
}

function getRoundNumber(match) {
  return Number(String(match.round || "").match(/\d+/)?.[0] || 99);
}

function parseEventDate(value) {
  const time = Date.parse(String(value || ""));
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function renderLocked(route) {
  view.innerHTML = html`
    <section class="page">
      <article class="panel locked-panel">
        <h1>Member Login Required</h1>
        <p class="page-lede">The ${escapeHtml(route)} section contains private member information and is kept behind the member gate.</p>
        <button class="button button-red" type="button" data-open-login>Log In</button>
      </article>
    </section>
  `;
  view.querySelector("[data-open-login]").addEventListener("click", openLogin);
}

function renderStandings() {
  const flights = ["A", "B", "C"];
  const rows = state.data.standings
    .filter((player) => player.flight === state.standingsFlight)
    .sort((a, b) => a.rank - b.rank);

  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Standings</h1>
          <p class="page-lede">Click a player name to open their score history directly beneath them.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="flight-tabs">
        ${flights.map((flight) => `<button class="seg ${flight === state.standingsFlight ? "active" : ""}" data-flight="${flight}" type="button">${flight} Flight</button>`).join("")}
      </div>
      <div class="table-wrap">
        <table class="standings-table">
          <thead>
            <tr><th>Rank</th><th>Name</th><th>Points</th><th>Handicap</th><th>Latest</th></tr>
          </thead>
          <tbody>
            ${rows.map(renderStandingRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;

  view.querySelectorAll("[data-flight]").forEach((button) => {
    button.addEventListener("click", () => {
      state.standingsFlight = button.dataset.flight;
      state.expandedPlayer = "";
      renderStandings();
    });
  });
  view.querySelectorAll("[data-player]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expandedPlayer = state.expandedPlayer === button.dataset.player ? "" : button.dataset.player;
      renderStandings();
    });
  });
}

function renderStandingRow(player) {
  const playerId = `${player.flight}-${player.displayName}`;
  const expanded = state.expandedPlayer === playerId;
  const scores = player.scoresByWeek
    .map((score) => `
      <div class="score-pill">
        <b>${escapeHtml(score.date)}</b>
        Score ${escapeHtml(score.score)} · ${escapeHtml(score.points)} pts<br />
        HCP ${escapeHtml(score.hcpBefore)}
      </div>
    `)
    .join("");
  const contact = player.contact?.phone || player.contact?.email
    ? `<span class="post-meta">${escapeHtml(player.contact.phone || "")}${player.contact.phone && player.contact.email ? " · " : ""}${escapeHtml(player.contact.email || "")}</span>`
    : "";

  const photo = player.photoDataUrl
    ? `<img src="${escapeHtml(player.photoDataUrl)}" alt="${escapeHtml(player.displayName)} profile photo" />`
    : `<span>${escapeHtml(getInitials(player.displayName))}</span>`;

  return html`
    <tr>
      <td>
        <div class="standing-rank-cell">
          <span>${escapeHtml(player.rank)}</span>
          <div class="standing-avatar">${photo}</div>
        </div>
      </td>
      <td>
        <div class="standing-player-cell">
          <button class="player-button" type="button" data-player="${escapeHtml(playerId)}">${escapeHtml(player.displayName)}</button><br />${contact}
        </div>
      </td>
      <td>${escapeHtml(player.points)}</td>
      <td>${escapeHtml(player.handicap)}</td>
      <td>${escapeHtml(player.latestScore)}</td>
    </tr>
    ${expanded ? `<tr class="scores-row"><td colspan="5"><div class="score-grid">${scores}</div></td></tr>` : ""}
  `;
}

function renderMatches() {
  const divisions = ["A", "B", "C", "Club Championship"];
  const current = state.matchesDivision;
  const matches = state.data.matches.filter((match) => {
    if (current === "Club Championship") return match.competition === "Club Championship";
    return match.competition === "Division" && match.division === current;
  });
  const playableMatches = matches.filter((match) => !isBracketVacancy(match));
  const rounds = groupByRound(playableMatches);

  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Matches</h1>
          <p class="page-lede">Bracket lanes are grouped by round. Hover a match or player for a larger view and contact details.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="division-tabs">
        ${divisions.map((division) => `<button class="seg ${division === current ? "active" : ""}" data-division="${division}" type="button">${division === "Club Championship" ? "Club" : division}</button>`).join("")}
      </div>
      <div class="panel bracket-shell">
        <div class="bracket-board bracket-board-${escapeHtml(String(current).toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">
          ${rounds.map(([round, roundMatches]) => `
            <section class="round-column" style="--round-size:${Math.max(1, roundMatches.length)}">
              <h3>${escapeHtml(round)}</h3>
              ${roundMatches.map(renderMatchCard).join("")}
            </section>
          `).join("")}
          <section class="round-column champion-column">
            <h3>Champion</h3>
            <article class="match-card champion-card">
              <div class="match-meta"><span>${escapeHtml(current)}</span><span>Final target</span></div>
              <div class="player-line winner"><span>${escapeHtml(findBracketLeader(matches) || "To be decided")}</span><span></span></div>
              <p class="match-result">Winner arrives here as rounds are completed.</p>
            </article>
          </section>
        </div>
      </div>
    </section>
  `;
  view.querySelectorAll("[data-division]").forEach((button) => {
    button.addEventListener("click", () => {
      state.matchesDivision = button.dataset.division;
      renderMatches();
    });
  });
}

function isBracketVacancy(match) {
  const first = String(match.playerOne || "").toLowerCase();
  const second = String(match.playerTwo || "").toLowerCase();
  const status = String(match.status || "").toLowerCase();
  return status === "bye" || first.includes("bye") || second.includes("bye") || first.includes("tbd") || second.includes("tbd");
}

function findBracketLeader(matches) {
  const championshipMatches = matches.filter((match) => /final|championship/i.test(String(match.round || "")));
  const completedChampionship = championshipMatches.filter((match) => match.winner && !isBracketVacancy(match));
  return completedChampionship.length === 1 ? completedChampionship[0].winner : "";
}

function groupByRound(matches) {
  const order = ["Round 1", "Round 2", "Round 3", "Round 4", "Semi Final", "Final", "Championship"];
  const buckets = new Map();
  matches.forEach((match) => {
    const round = match.round || "Round";
    if (!buckets.has(round)) buckets.set(round, []);
    buckets.get(round).push(match);
  });
  return Array.from(buckets.entries()).sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a[0].localeCompare(b[0]);
  });
}

function renderMatchCard(match) {
  const resultText = getPublicMatchResult(match);
  return html`
    <article class="match-card">
      <div class="match-meta"><span>${escapeHtml(match.matchNumber)}</span><span>${escapeHtml(match.status)}</span></div>
      ${renderPlayerLine(match, match.playerOne, match.playerOneHandicap)}
      ${renderPlayerLine(match, match.playerTwo, match.playerTwoHandicap)}
      <p class="match-result">${escapeHtml(match.winner ? `Winner: ${match.winner}` : "Winner pending")}${resultText ? ` · ${escapeHtml(resultText)}` : ""}</p>
    </article>
  `;
}

function getPublicMatchResult(match) {
  const result = String(match.result || "").trim();
  if (!result) return match.winner ? "" : "Result pending";
  const internalPattern = /awaiting bracket confirmation|avoid repeat bye|bye awarded|bye slot|bracket note|assigned opponent/i;
  if (internalPattern.test(result)) return "";
  return result;
}

function renderPlayerLine(match, name, handicap) {
  const contact = match.contacts?.[name] || {};
  const isWinner = match.winner && match.winner === name;
  return html`
    <div class="player-line ${isWinner ? "winner" : ""}">
      <span>${escapeHtml(name || "TBD")}</span>
      <span>${escapeHtml(handicap)}</span>
      <span class="contact-pop">
        <strong>${escapeHtml(name || "TBD")}</strong><br />
        ${escapeHtml(contact.phone || "Phone not listed")}<br />
        ${escapeHtml(contact.email || "Email not listed")}
      </span>
    </div>
  `;
}

function renderTournaments() {
  const rsvpByTournament = Object.fromEntries(state.rsvps.map((rsvp) => [rsvp.tournamentId, rsvp]));
  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Tournaments</h1>
          <p class="page-lede">Tournament dates, RSVP actions, and confirmed attendee lists for logged-in members.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="tournament-list tournament-list-wide">
          ${state.data.tournaments.map((event) => `
            <article class="tournament-card">
              <h3>${escapeHtml(event.title)}</h3>
              <div class="event-meta">${escapeHtml(event.eventDate)} · ${escapeHtml(event.status)}</div>
              ${(event.teeTime || event.format || event.price) ? `
                <div class="tournament-facts">
                  ${event.teeTime ? `<span><strong>Time</strong>${escapeHtml(event.teeTime)}</span>` : ""}
                  ${event.format ? `<span><strong>Format</strong>${escapeHtml(event.format)}</span>` : ""}
                  ${event.price ? `<span><strong>Price</strong>${escapeHtml(event.price)}</span>` : ""}
                </div>
              ` : ""}
              <p><strong>${escapeHtml(event.location)}</strong><br />${escapeHtml(event.description)}</p>
              <p class="rsvp-status">${rsvpByTournament[event.id] ? `Your RSVP: ${escapeHtml(rsvpByTournament[event.id].status)}` : "No RSVP yet"}</p>
              <div class="rsvp-row">
                ${["Going", "Maybe", "Not Going"].map((status) => `
                  <button class="seg ${rsvpByTournament[event.id]?.status === status ? "active" : ""}" type="button" data-rsvp="${escapeHtml(event.id)}" data-status="${status}">${status}</button>
                `).join("")}
              </div>
              ${renderTournamentAttendees(event.id)}
            </article>
          `).join("")}
      </div>
      <p class="page-lede">Please RSVP again on this new site so the current attendee list is accurate. Confirmation emails are sent automatically once league email is connected.</p>
    </section>
  `;
  view.querySelectorAll("[data-rsvp]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.textContent = "Saving...";
      try {
        const result = await postJson("api/rsvps", { tournamentId: button.dataset.rsvp, status: button.dataset.status });
        if (result.attendeeSummary) state.attendeeSummary = result.attendeeSummary;
        state.rsvps = await loadRsvps();
        renderTournaments();
        if (result.emailDelivery && result.emailDelivery !== "sent") {
          alert("Your RSVP was saved. The confirmation email is queued until the league email connection is active.");
        }
      } catch (error) {
        button.textContent = button.dataset.status;
        alert(error.message);
      }
    });
  });
}

function renderTournamentAttendees(tournamentId) {
  const attendees = state.attendeeSummary[tournamentId] || [];
  if (!attendees.length) {
    return html`
      <div class="attendee-box">
        <strong>Confirmed Going</strong>
        <p>No confirmed RSVPs yet.</p>
      </div>
    `;
  }
  return html`
    <div class="attendee-box">
      <strong>Confirmed Going (${attendees.length})</strong>
      <ul>
        ${attendees.map((attendee) => `<li>${escapeHtml(attendee.name || "Member")}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderRant() {
  const localPosts = JSON.parse(localStorage.getItem("stcRantDraftPosts") || "[]");
  const posts = [...localPosts, ...state.data.rant];
  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>Rant</h1>
          <p class="page-lede">Members can post a title and message. Preview posts save locally until production storage is connected.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="rant-layout">
        <form class="panel rant-form" id="rantForm">
          <h2 class="panel-title">New Rant</h2>
          <label>Title <input id="rantTitle" required maxlength="90" placeholder="Post title" /></label>
          <label>Message <textarea id="rantMessage" required placeholder="Write your rant..."></textarea></label>
          <button class="button button-red full" type="submit">Post</button>
        </form>
        <article class="panel">
          ${posts.map((post) => `
            <section class="post">
              <h3>${escapeHtml(post.title || "Rant")}</h3>
              <div class="post-meta">${escapeHtml(post.displayName || "Member")} · ${escapeHtml(post.createdAt || "Preview")}</div>
              <p>${escapeHtml(post.message).replace(/\n/g, "<br />")}</p>
            </section>
          `).join("")}
        </article>
      </div>
    </section>
  `;
  document.querySelector("#rantForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.querySelector("#rantTitle").value.trim();
    const message = document.querySelector("#rantMessage").value.trim();
    if (!title || !message) return;
    const nextPosts = [{
      id: `local-${Date.now()}`,
      title,
      message,
      displayName: "Preview Member",
      createdAt: new Date().toLocaleDateString(),
    }, ...localPosts];
    localStorage.setItem("stcRantDraftPosts", JSON.stringify(nextPosts));
    renderRant();
  });
}

function renderProfile() {
  const user = state.user || {};
  view.innerHTML = html`
    <section class="page">
      <div class="page-head">
        <div>
          <h1>My Profile</h1>
          <p class="page-lede">Manage your member contact details, password, and profile photo.</p>
        </div>
        <a class="button button-outline" href="#home">Home</a>
      </div>
      <div class="profile-layout">
        <article class="panel profile-photo-panel">
          <div class="profile-photo">
            ${user.photoDataUrl ? `<img src="${escapeHtml(user.photoDataUrl)}" alt="Profile photo" />` : `<span>${escapeHtml((user.name || user.email || "M").slice(0, 1).toUpperCase())}</span>`}
          </div>
          <h2 class="panel-title">${escapeHtml(user.name || "Member")}</h2>
          <p>${escapeHtml(user.email || "")}</p>
          <p>${escapeHtml(user.phone || "")}</p>
        </article>
        <form class="panel profile-form" id="profileForm">
          <h2 class="panel-title">Contact Info</h2>
          <label>Name <input id="profileName" value="${escapeHtml(user.name || "")}" /></label>
          <label>Email <input id="profileEmail" type="email" value="${escapeHtml(user.email || "")}" /></label>
          <label>Phone <input id="profilePhone" value="${escapeHtml(user.phone || "")}" /></label>
          <label>Photo <input id="profilePhoto" type="file" accept="image/*" /></label>
          <h2 class="panel-title">Change Password</h2>
          <label>Current Password <input class="password-field" id="currentPassword" type="password" autocomplete="current-password" /></label>
          <label class="check-row"><input id="showCurrentPassword" type="checkbox" data-toggle-password="#currentPassword" /> Show current password</label>
          <label>New Password <input class="password-field" id="newPassword" type="password" autocomplete="new-password" placeholder="10 characters minimum" /></label>
          <label>Confirm New Password <input class="password-field" id="confirmPassword" type="password" autocomplete="new-password" placeholder="Type it again" /></label>
          <label class="check-row"><input id="showNewPasswords" type="checkbox" data-toggle-password="#newPassword,#confirmPassword" /> Show new passwords</label>
          <button class="button button-red full" type="submit">Save Profile</button>
          <p id="profileStatus" class="login-status" role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>
  `;

  view.querySelector("#profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = view.querySelector("#profileStatus");
    status.textContent = "Saving...";
    try {
      const photoDataUrl = await readSelectedPhoto(view.querySelector("#profilePhoto"));
      const payload = {
        name: view.querySelector("#profileName").value,
        email: view.querySelector("#profileEmail").value,
        phone: view.querySelector("#profilePhone").value,
      };
      if (photoDataUrl) payload.photoDataUrl = photoDataUrl;
      const currentPassword = view.querySelector("#currentPassword").value;
      const newPassword = view.querySelector("#newPassword").value;
      const confirmPassword = view.querySelector("#confirmPassword").value;
      if (newPassword || confirmPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
        if (!currentPassword) {
          status.textContent = "Enter your current password to change it.";
          return;
        }
        if (newPassword !== confirmPassword) {
          status.textContent = "New password and confirmation do not match.";
          return;
        }
      }
      const result = await postJson("api/me", payload, "PATCH");
      state.user = result.user;
      state.privateLoaded = false;
      state.data.committee = await loadJson("api/public/committee");
      status.textContent = "Profile saved.";
      renderProfile();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  view.querySelectorAll("[data-toggle-password]").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      toggle.dataset.togglePassword.split(",").forEach((selector) => {
        const input = view.querySelector(selector.trim());
        if (input) input.type = toggle.checked ? "text" : "password";
      });
    });
  });
}

function readSelectedPhoto(input) {
  const file = input.files && input.files[0];
  if (!file) return Promise.resolve("");
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Choose an image file for your profile photo."));
  if (file.size > 15 * 1024 * 1024) return Promise.reject(new Error("Photo is too large. Choose a photo under 15 MB."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        try {
          resolve(cropAndCompressProfilePhoto(image));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error("Could not load photo."));
      image.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Could not read photo."));
    reader.readAsDataURL(file);
  });
}

function cropAndCompressProfilePhoto(image) {
  const outputSize = 640;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceX = ((image.naturalWidth || image.width) - sourceSize) / 2;
  const sourceY = ((image.naturalHeight || image.height) - sourceSize) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

  for (const quality of [0.86, 0.78, 0.68, 0.58]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= 900000) return dataUrl;
  }
  throw new Error("Photo could not be compressed enough. Try a different image.");
}

function openLogin() {
  loginStatus.textContent = "";
  showLoginPanel();
  loginModal.classList.remove("hidden");
  loginModal.hidden = false;
  document.querySelector("#emailInput").focus();
}

function normalizeEmailInput(value) {
  return String(value || "").trim().toLowerCase().replace(/@(gmail|hotmail|outlook|yahoo)\.co$/, "@$1.com");
}

function showLoginPanel(status = "") {
  showLoginSubpanel("loginPanel", status);
  document.querySelector("#emailInput").focus();
}

function showResetPanel() {
  showLoginSubpanel("resetPanel", "");
  loginModal.classList.remove("hidden");
  loginModal.hidden = false;
  document.querySelector("#resetPasswordInput").focus();
}

function showCreateAccountPanel(prefillEmail = "") {
  document.querySelector("#accountEmailInput").value = normalizeEmailInput(prefillEmail || document.querySelector("#emailInput").value);
  showLoginSubpanel("createAccountPanel", "");
  document.querySelector("#accountNameInput").focus();
}

function showLoginSubpanel(panelId, status = "") {
  ["loginPanel", "resetPanel", "forgotPasswordPanel", "forgotEmailPanel", "createAccountPanel"].forEach((id) => {
    const panel = document.querySelector(`#${id}`);
    panel.classList.toggle("hidden", id !== panelId);
    panel.hidden = id !== panelId;
  });
  const loginLinks = document.querySelector(".login-links");
  loginLinks.classList.toggle("hidden", panelId !== "loginPanel");
  loginLinks.hidden = panelId !== "loginPanel";
  loginStatus.textContent = status;
}

function closeLoginModal() {
  loginModal.classList.add("hidden");
  loginModal.hidden = true;
}

loginButton.addEventListener("click", openLogin);
closeLogin.addEventListener("click", closeLoginModal);
logoutButton.addEventListener("click", () => {
  fetch("api/logout", { method: "POST" }).catch(() => {});
  state.authed = false;
  state.user = null;
  state.privateLoaded = false;
  syncAuthButtons();
  renderRoute();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await fetch("api/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: normalizeEmailInput(document.querySelector("#emailInput").value),
      password: document.querySelector("#passwordInput").value,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (result.requiresPasswordSetup) {
      document.querySelector("#forgotPasswordEmail").value = normalizeEmailInput(document.querySelector("#emailInput").value);
      if (result.resetToken) {
        inlineResetToken = result.resetToken;
        showResetPanel();
        loginStatus.textContent = result.message || "Temporary password accepted. Choose your own password now.";
        document.querySelector("#resetPasswordInput").focus();
        return;
      }
      showLoginSubpanel("forgotPasswordPanel", result.message || "This account needs a password setup. Use Forgot password and we will send a setup link.");
      document.querySelector("#forgotPasswordPhone").value = "";
      document.querySelector("#forgotPasswordLastName").value = "";
      document.querySelector("#forgotPasswordEmail").focus();
      return;
    }
    if (result.offerAccountSetup) {
      showCreateAccountPanel(document.querySelector("#emailInput").value);
    }
    loginStatus.textContent = result.message || "Login failed. Please try again.";
    return;
  }
  state.authed = true;
  state.user = result.user || null;
  state.privateLoaded = false;
  syncAuthButtons();
  closeLoginModal();
  await renderRoute();
});

document.querySelector("#forgotPasswordButton").addEventListener("click", () => {
  document.querySelector("#forgotPasswordEmail").value = normalizeEmailInput(document.querySelector("#emailInput").value);
  showLoginSubpanel("forgotPasswordPanel", "");
  document.querySelector("#forgotPasswordEmail").focus();
});

document.querySelector("#sendResetLinkButton").addEventListener("click", async () => {
  const email = normalizeEmailInput(document.querySelector("#forgotPasswordEmail").value);
  const phone = document.querySelector("#forgotPasswordPhone").value.trim();
  const lastName = document.querySelector("#forgotPasswordLastName").value.trim();
  if (!email) {
    loginStatus.textContent = "Enter your member email address.";
    return;
  }
  loginStatus.textContent = "Checking your member account...";
  const response = await fetch("api/request-password-reset", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, phone, lastName }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok && result.inlineReset && result.resetToken) {
    inlineResetToken = result.resetToken;
    showResetPanel();
  }
  if (!response.ok && result.offerAccountSetup) {
    showCreateAccountPanel(email);
  }
  loginStatus.textContent = result.message || (response.ok ? "Reset link sent. Check inbox and spam." : "Could not start password reset.");
});

document.querySelector("#forgotEmailButton").addEventListener("click", () => {
  showLoginSubpanel("forgotEmailPanel", "");
  document.querySelector("#forgotEmailLastName").focus();
});

document.querySelector("#lookupEmailButton").addEventListener("click", async () => {
  const lastName = document.querySelector("#forgotEmailLastName").value.trim();
  const phone = document.querySelector("#forgotEmailPhone").value.trim();
  if (!lastName || !phone) {
    loginStatus.textContent = "Enter your last name and phone number.";
    return;
  }
  loginStatus.textContent = "Checking member list...";
  const response = await fetch("api/forgot-email", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lastName, phone }),
  });
  const result = await response.json().catch(() => ({}));
  loginStatus.textContent = result.message || (response.ok ? "Email found." : "No matching member email was found.");
});

document.querySelector("#createAccountButton").addEventListener("click", () => {
  showCreateAccountPanel();
});

document.querySelector("#sendAccountRequestButton").addEventListener("click", async () => {
  const name = document.querySelector("#accountNameInput").value.trim();
  const email = normalizeEmailInput(document.querySelector("#accountEmailInput").value);
  const phone = document.querySelector("#accountPhoneInput").value.trim();
  if (!name || !email) {
    loginStatus.textContent = "Enter your name and email.";
    return;
  }
  loginStatus.textContent = "Sending account request...";
  const response = await fetch("api/account-request", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, phone }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok && result.inlineReset && result.resetToken) {
    inlineResetToken = result.resetToken;
    showResetPanel();
  }
  loginStatus.textContent = result.message || (response.ok ? "Account request received." : "Could not send account request.");
});

document.querySelectorAll("[data-login-back]").forEach((button) => {
  button.addEventListener("click", () => showLoginPanel());
});

document.querySelector("#showResetPassword").addEventListener("change", (event) => {
  const type = event.target.checked ? "text" : "password";
  document.querySelector("#resetPasswordInput").type = type;
  document.querySelector("#resetPasswordConfirm").type = type;
});

document.querySelector("#resetPasswordButton").addEventListener("click", async () => {
  const token = inlineResetToken || new URLSearchParams(window.location.search).get("token") || "";
  const password = document.querySelector("#resetPasswordInput").value;
  const confirm = document.querySelector("#resetPasswordConfirm").value;
  if (password !== confirm) {
    loginStatus.textContent = "New password and confirmation do not match.";
    return;
  }
  loginStatus.textContent = "Saving new password...";
  const response = await fetch("api/reset-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    loginStatus.textContent = result.message || "Could not reset password.";
    return;
  }
  state.authed = true;
  state.user = result.user || null;
  state.privateLoaded = false;
  inlineResetToken = "";
  window.history.replaceState({}, "", "/#home");
  syncAuthButtons();
  closeLoginModal();
  await renderRoute();
});

if (window.location.pathname === "/reset-password" && new URLSearchParams(window.location.search).get("token")) {
  showResetPanel();
} else {
  normalizeDirectPath();
}

boot().catch((error) => {
  view.innerHTML = `<section class="page"><article class="panel"><h1>Could not load site data</h1><p>${escapeHtml(error.message)}</p></article></section>`;
});
