import { useMemo } from 'react';
import { playerDocument } from '../studio/document';
export function AppPlayer({html}: {html: string; storageKey: string}) {
  const document = useMemo(() => playerDocument(html), [html]);
  return <iframe title="App preview" srcDoc={document} sandbox="allow-scripts" style={{border:0,flex:1,width:'100%',minHeight:400}}/>;
}
