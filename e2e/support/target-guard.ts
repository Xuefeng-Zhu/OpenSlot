const LOCAL_E2E_HOSTNAMES = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
]);

export const E2E_BACKEND_APP_ID_HEADER =
  "X-OpenSlot-Butterbase-App-Id";
export const EXTERNAL_E2E_MUTATION_OPT_IN =
  "E2E_ALLOW_EXTERNAL_MUTATIONS";

interface AssertSafeE2ETargetOptions {
  baseURL: string;
  expectedButterbaseAppId: string;
  allowExternalMutations?: string;
  fetchImpl?: typeof fetch;
}

/** Returns whether Playwright owns a local development server for this URL. */
export function isLocalE2ETarget(baseURL: string) {
  return LOCAL_E2E_HOSTNAMES.has(new URL(baseURL).hostname);
}

/**
 * Fails before fixture setup can mutate an external Butterbase app unless the
 * operator explicitly opted in and the deployment advertises the same public
 * Butterbase app id configured for E2E database access.
 */
export async function assertSafeE2ETarget({
  baseURL,
  expectedButterbaseAppId,
  allowExternalMutations,
  fetchImpl = fetch,
}: AssertSafeE2ETargetOptions) {
  if (isLocalE2ETarget(baseURL)) return;

  const target = new URL(baseURL);
  if (target.protocol !== "https:") {
    throw new Error(
      `External Playwright targets must use HTTPS. Received ${target.origin}.`
    );
  }

  if (allowExternalMutations !== "true") {
    throw new Error(
      `External Playwright runs mutate test data. Re-run with ${EXTERNAL_E2E_MUTATION_OPT_IN}=true only after confirming ${target.origin} is a disposable QA deployment.`
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(target, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(
      `Could not verify the Butterbase app id advertised by ${target.origin}. No external test data was changed.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Could not verify the Butterbase app id advertised by ${target.origin} (HTTP ${response.status}). No external test data was changed.`
    );
  }

  const deployedButterbaseAppId = response.headers.get(
    E2E_BACKEND_APP_ID_HEADER
  );

  if (!deployedButterbaseAppId) {
    throw new Error(
      `${target.origin} did not advertise ${E2E_BACKEND_APP_ID_HEADER}. Deploy the current app before running external E2E. No external test data was changed.`
    );
  }

  if (deployedButterbaseAppId !== expectedButterbaseAppId) {
    throw new Error(
      `External E2E backend mismatch: ${target.origin} advertises Butterbase app ${deployedButterbaseAppId}, but the configured service key targets ${expectedButterbaseAppId}. No external test data was changed.`
    );
  }
}
