export function loginReturnUrl(returnUrl: string | string[] | undefined) {
  const value = Array.isArray(returnUrl) ? returnUrl[0] : returnUrl;

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (value === "/login" || value.startsWith("/login?")) {
    return "/dashboard";
  }

  return value;
}
