import { supabase } from "./supabaseClient.js";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured — check your .env file.");
  return supabase;
}

// -----------------------------------------------------------------------------
// Session
// -----------------------------------------------------------------------------

export async function getSession() {
  const db = requireClient();
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  return data.session; // null if nobody's signed in
}

// Fires immediately with the current state, then again on every future
// change (sign in, sign out, token refresh, and — importantly — the
// moment someone lands on an invite/recovery link, which signs them into
// a temporary session before they've set a password).
export function onAuthStateChange(callback) {
  const db = requireClient();
  const {
    data: { subscription },
  } = db.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => subscription.unsubscribe();
}

export async function signInWithPassword(email, password) {
  const db = requireClient();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const db = requireClient();
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

// Used right after someone clicks their invite email link — Supabase signs
// them into a temporary session automatically; this sets their real
// password on it, same call also works for a "forgot password" reset.
export async function setPassword(newPassword) {
  const db = requireClient();
  const { error } = await db.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Player-profile linking
// -----------------------------------------------------------------------------

// The player row linked to whoever's currently signed in — null if they
// haven't claimed one yet (first login).
export async function fetchMyPlayer() {
  const db = requireClient();
  const { data: sessionData } = await db.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await db.from("players").select("id, name, is_admin").eq("auth_user_id", uid).maybeSingle();
  if (error) throw error;
  return data;
}

// Players nobody has linked an account to yet — the pool the claim screen
// picks from.
export async function fetchUnclaimedPlayers() {
  const db = requireClient();
  const { data, error } = await db.from("players").select("id, name").is("auth_user_id", null).order("name");
  if (error) throw error;
  return data || [];
}

// Links the current session's account to a player row. Only works if that
// row is still unclaimed (enforced again server-side by RLS once that's
// turned on — see sql/26_row_level_security.sql).
export async function claimPlayer(playerId) {
  const db = requireClient();
  const { data: sessionData } = await db.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) throw new Error("Not signed in.");
  const { error } = await db.from("players").update({ auth_user_id: uid }).eq("id", playerId).is("auth_user_id", null);
  if (error) throw error;
}
