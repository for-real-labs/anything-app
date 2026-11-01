import {it,expect} from 'vitest';
import vm from 'node:vm';
import {appDataKey,createAppStorage} from '../src/studio/persistence';
import {parseStorageMessage,playerDocument} from '../src/studio/document';
it('isolates data by account and app',()=>{expect(appDataKey('a','one')).not.toBe(appDataKey('b','one'));expect(appDataKey('a','one')).not.toBe(appDataKey('a','two'));});
it('rejects malformed and oversized messages without accepting commands',()=>{
 expect(parseStorageMessage('{')).toBeNull();expect(parseStorageMessage(JSON.stringify({type:'openURL',data:{}}))).toBeNull();
 expect(parseStorageMessage(JSON.stringify({type:'anything-storage',data:{key:3}}))).toBeNull();
 expect(parseStorageMessage(JSON.stringify({type:'anything-storage',data:{key:'x'.repeat(200001)}}))).toBeNull();
 expect(parseStorageMessage(JSON.stringify({type:'anything-storage',data:{note:'hello'}}))).toEqual({note:'hello'});
});
it('serializes writes and loads the latest committed snapshot after relaunch',async()=>{
 const disk=new Map<string,string>();const store=createAppStorage({getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{await new Promise(r=>setTimeout(r,v.includes('old')?15:1));disk.set(k,v)}});
 const key=appDataKey('a','one');const first=store.save(key,{note:'old'});const last=store.save(key,{note:'new'});
 expect(await store.load(key)).toEqual({note:'new'});await Promise.all([first,last]);
 expect(await createAppStorage({getItem:async k=>disk.get(k)??null,setItem:async()=>{}}).load(key)).toEqual({note:'new'});
});
it('does not silently replace corrupted data; recovers after a failed write',async()=>{
 let fail=true,raw='broken';const store=createAppStorage({getItem:async()=>raw,setItem:async(_k,v)=>{if(fail){fail=false;throw Error('disk full')}raw=v}});
 await expect(store.load('key')).rejects.toThrow();await expect(store.save('key',{note:'first'})).rejects.toThrow('disk full');await store.save('key',{note:'second'});expect(await store.load('key')).toEqual({note:'second'});
});
it('the actual injected localStorage persists data and cannot break out through stored HTML',()=>{
 const dangerous='</script><script>throw new Error("escape")</script>';
 const doc=playerDocument('<body>test</body>',{note:dangerous});
 const encoded=doc.match(/srcdoc="([\s\S]*?)"><\/iframe>/)![1];
 const source=encoded.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
 const script=source.match(/<script>([\s\S]*?)<\/script>/)![1];const sent:unknown[]=[];
 const context:any={window:{},parent:{postMessage:(value:unknown)=>sent.push(value)},DOMException};vm.runInNewContext(script,context);
 expect(context.window.localStorage.getItem('note')).toBe(dangerous);
 context.window.localStorage.setItem('__proto__','safe');expect(context.window.localStorage.getItem('__proto__')).toBe('safe');
 context.window.localStorage.setItem('counter',2);expect(context.window.localStorage.getItem('counter')).toBe('2');expect(sent).toHaveLength(2);
 context.window.localStorage.removeItem('note');expect(context.window.localStorage.getItem('note')).toBeNull();
 expect(()=>context.window.localStorage.setItem('huge','a'.repeat(200001))).toThrow();
});
