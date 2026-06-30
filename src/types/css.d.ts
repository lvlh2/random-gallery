// Type declarations for CSS module imports
// These allow TypeScript to understand CSS/CSS-module imports
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.module.css" {
  const content: Record<string, string>;
  export default content;
}
