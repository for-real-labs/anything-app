import { AppData, validAppData } from './document';
type Storage = {getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>};
export function appDataKey(owner: string, id: string) { return `anything.data.${owner}.${id}`; }
export function createAppStorage(storage: Storage) {
  const pending = new Map<string, Promise<void>>();
  return {
    async load(key: string): Promise<AppData> {
      await pending.get(key);
      const raw = await storage.getItem(key);
      if (!raw) return {};
      const data: unknown = JSON.parse(raw);
      if (!validAppData(data)) throw new Error('Saved app data could not be read.');
      return data;
    },
    save(key: string, data: AppData) {
      if (!validAppData(data)) return Promise.reject(new Error('App storage is full.'));
      const json = JSON.stringify(data);
      const write = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(() => storage.setItem(key, json));
      pending.set(key, write);
      void write.finally(() => { if (pending.get(key) === write) pending.delete(key); }).catch(() => {});
      return write;
    },
  };
}
