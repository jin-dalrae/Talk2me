// Local, on-disk storage — everything here lives only on your machine in ./data
// (gitignored). Nothing is uploaded anywhere except, inherently, what you say to
// the Gemini API during a live conversation.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';

const DIR = 'data';
mkdirSync(DIR, { recursive: true });
const PROFILE = `${DIR}/profile.json`;
const TRANSCRIPT = `${DIR}/transcript.jsonl`;

export function loadProfile() {
  try {
    return JSON.parse(readFileSync(PROFILE, 'utf8'));
  } catch {
    return null;
  }
}

export function saveProfile(p) {
  try {
    writeFileSync(PROFILE, JSON.stringify(p, null, 2));
  } catch (e) {
    console.error('profile save failed:', e?.message || e);
  }
}

// Turn the stored profile into a short context note the coaches read at the
// start of each session.
export function profileContext(p) {
  if (!p) return null;
  const parts = [];
  if (p.name) parts.push(`Their name is ${p.name}.`);
  if (p.summary) parts.push(p.summary);
  if (p.goals?.length) parts.push(`Their goals: ${p.goals.join(', ')}.`);
  if (p.interests?.length) parts.push(`Their interests: ${p.interests.join(', ')}.`);
  if (p.facts?.length) parts.push(`Remember: ${p.facts.join(' ')}`);
  if (!parts.length) return null;
  return `(What you both remember about the user from past chats — weave it in naturally, do not recite it back.) ${parts.join(' ')}`;
}

export function appendTranscript(entries) {
  if (!entries.length) return;
  try {
    const ts = new Date().toISOString();
    const lines = entries.map((e) => JSON.stringify({ time: ts, ...e })).join('\n') + '\n';
    appendFileSync(TRANSCRIPT, lines);
  } catch (e) {
    console.error('transcript write failed:', e?.message || e);
  }
}
