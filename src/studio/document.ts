export type AppData = Record<string, string>;
export const MAX_APP_DATA = 200_000;
export function validAppData(value: unknown): value is AppData {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length <= 200 &&
    Object.entries(value).every(
      ([k, v]) => k.length <= 200 && typeof v === "string"
    ) &&
    JSON.stringify(value).length <= MAX_APP_DATA
  );
}
export function parseStorageMessage(message: string): AppData | null {
  if (message.length > MAX_APP_DATA + 100) return null;
  try {
    const event = JSON.parse(message);
    return event.type === "anything-storage" && validAppData(event.data)
      ? event.data
      : null;
  } catch {
    return null;
  }
}
const scriptJSON = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
// The opaque iframe receives only this mini app's local data. It never receives identity,
// credentials, filesystem access, or other apps' data. The only bridge is a bounded snapshot.
export function playerDocument(html: string, data: AppData = {}) {
  const bootstrap = `<script>(()=>{let data=Object.assign(Object.create(null),${scriptJSON(
    validAppData(data) ? data : {}
  )});
    const commit=next=>{if(Object.keys(next).length>200||JSON.stringify(next).length>200000)throw new DOMException('App storage is full','QuotaExceededError');data=next;parent.postMessage({type:'anything-storage',data},'*')};
    const storage={getItem:k=>Object.hasOwn(data,String(k))?data[String(k)]:null,setItem:(k,v)=>{k=String(k);if(k.length>200)throw new Error('Storage key is too long');commit(Object.assign(Object.create(null),data,{[k]:String(v)}))},removeItem:k=>{const next=Object.assign(Object.create(null),data);delete next[String(k)];commit(next)},clear:()=>commit(Object.create(null)),key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};
    Object.defineProperty(window,'localStorage',{value:storage});
  })();<\/script>`;
  const source = (bootstrap + html)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden;background:#F7F8FC}</style></head><body><iframe id="mini" sandbox="allow-scripts allow-pointer-lock" allow="autoplay; fullscreen" srcdoc="${source}"></iframe><script>window.addEventListener('message',e=>{if(e.source!==document.getElementById('mini').contentWindow||e.data?.type!=='anything-storage')return;const message=JSON.stringify(e.data);if(message.length<=200100)window.ReactNativeWebView?.postMessage(message)});<\/script></body></html>`;
}
