declare global {
  interface ImportMetaEnv {
    [key: string]: string;
  }
  interface ImportMeta {
    env: ImportMetaEnv;
  }
}
export {};
