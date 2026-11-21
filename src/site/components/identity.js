import { esc } from "../html.js";

export function avatar(t) {
  const initials =
    t.manager
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "T";
  return `<span class="portrait" aria-hidden="true"><span>${esc(initials)}</span>${t.avatar ? `<img src="https://sleepercdn.com/avatars/thumbs/${esc(t.avatar)}" alt="" width="48" height="48" decoding="async">` : ""}</span>`;
}
export function identity(t, withAvatar = false) {
  return `<a class="identity" href="#manager-${t.id}">${withAvatar ? avatar(t) : ""}<span><strong>${esc(t.name)}</strong>${withAvatar ? `<small>@${esc(t.manager)}</small>` : ""}</span></a>`;
}

export function finder(teams) {
  return `<label class="show-finder" data-enable-js hidden><span class="sr-only">Choose a manager for Weekly Wrapped</span><select id="team-jump" title="Choose a manager to open their Weekly Wrapped"><option value="">My Wrapped</option>${teams.map((t) => `<option value="${t.id}">@${esc(t.manager)} · ${esc(t.name)}</option>`).join("")}</select></label>`;
}

export function profileDialog(wrapped) {
  return `<dialog id="profile" aria-labelledby="profile-title"><div class="profile-shell"><header class="profile-head">
    <div class="profile-toolbar"><span>Manager profile</span><div><button type="button" data-share>Copy link</button> <button type="button" data-dismiss aria-label="Close manager profile">Close ×</button></div></div>
    <input class="profile-url" aria-label="Share this profile link" readonly hidden>
    <div class="profile-identity"><span data-port></span><div><h2 id="profile-title"></h2><span data-profile-handle></span></div></div>
    <button class="profile-wrapped" data-open-wrapped type="button">Play my Weekly Wrapped <b aria-hidden="true">↗</b></button><div class="profile-stats"></div></header><div class="profile-nav" aria-label="Profile sections"><button type="button" data-profile-tab="week" aria-pressed="true">The week</button><button type="button" data-profile-tab="lineup" aria-pressed="false">Lineup</button><button type="button" data-profile-tab="next" aria-pressed="false">Next matchup</button></div>
    <div class="profile-content"></div></div>${wrapped}</dialog>`;
}
