export async function loginAndGetDestination(login, credentials, requestedPath) {
  const authenticatedUser = await login(credentials)
  return requestedPath
    || (['admin', 'sales_agent'].includes(authenticatedUser?.role) ? '/dashboard' : '/')
}
