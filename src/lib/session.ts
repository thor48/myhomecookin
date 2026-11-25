import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MealieAuthError } from "./mealie";

export const SESSION_COOKIE = "mealie_token";

/** Current user's Mealie token, or a redirect to /login. Must run inside a <Suspense> boundary. */
export async function requireToken(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return token;
}

/**
 * Run a Mealie call with the user's token. An expired token sends them to
 * /logout, which clears the cookie and shows the login page.
 */
export async function withMealie<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await requireToken();
  await connection(); // always fetch fresh from Mealie at request time
  try {
    return await fn(token);
  } catch (e) {
    if (e instanceof MealieAuthError) redirect("/logout?expired=1");
    throw e;
  }
}
