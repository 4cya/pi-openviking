export function resolveHome(p: string): string {
  if (p.startsWith("~/")) {
    const homedir = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
    return homedir + p.slice(1);
  }
  return p;
}
