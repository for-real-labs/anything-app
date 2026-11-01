"""Compose original, continuous App Store wallpaper with genuine native captures."""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app-store/feature-images'
FONTS = ROOT / 'node_modules/@expo-google-fonts/dm-sans'
def font(size, bold=False):
    variant = '700Bold' if bold else '400Regular'
    return ImageFont.truetype(str(FONTS / variant / f'DMSans_{variant}.ttf'), size)

titles = [('Make room for', 'your ideas.'), ('Describe it.', 'Make it real.'), ('Little tools.', 'Made for you.')]
subs = ['A home for the apps you imagine.', 'Turn your words into a working mini app.', 'Save, use, and keep making it yours.']
files = ['01-home.png', '02-create.png', '03-play.png']
ledger = []

for device, w, h in [('iphone',1320,2868), ('ipad',2064,2752)]:
    wide = Image.new('RGB', (w*3,h), '#F4F1FA')
    d = ImageDraw.Draw(wide)
    # The ribbons are drawn once over the entire triptych, then sliced.
    for y in range(h):
        t=y/h
        d.line((0,y,w*3,y), fill=(int(248-11*t),int(246-10*t),int(252-5*t)))
    colors=['#E2DDF6','#C8BCEB','#DFEAE3','#B9D5CE','#F4DDCD']
    for n,color in enumerate(colors):
        points=[]
        for x in range(-20,w*3+21,12):
            y=h*.53 + math.sin(x/(w*.72)+n*.63)*h*.11+n*h*.14
            points.append((x,y))
        d.polygon(points+[(w*3,h),(0,h)], fill=color)
    wide.save(ROOT/f'app-store/design/wallpaper-{device}.png')
    panels=[]
    for i,name in enumerate(files):
        panel=wide.crop((i*w,0,(i+1)*w,h)).convert('RGBA')
        d=ImageDraw.Draw(panel)
        pad=98 if device=='iphone' else 150
        fs=112 if device=='iphone' else 154
        brand=31 if device=='iphone' else 43
        y=270 if device=='iphone' else 265
        icon=Image.open(ROOT/'assets/icon.png').convert('RGBA').resize((76,76))
        panel.alpha_composite(icon,(pad,100))
        d.text((pad+101,113),'ANYTHING APP',font=font(brand,True),fill='#3A344B')
        for n,line in enumerate(titles[i]):
            d.text((pad,y+n*fs*1.08),line,font=font(fs,True),fill='#302B43',stroke_width=0)
        d.text((pad,y+fs*2.38),subs[i],font=font(39 if device=='iphone' else 51),fill='#706B7C')
        source=ROOT/f'app-store/captures/{device}/{name}'
        shot=Image.open(source).convert('RGB')
        # Focused crops retain actual app UI, with no invented controls.
        crop=(0,180,1320,2550) if device=='iphone' else (0,45,2064,2480)
        if device=='ipad' and i==2: crop=(0,45,2064,1800)
        shot=shot.crop(crop)
        cw=1080 if device=='iphone' else 1730
        ch=round(shot.height*cw/shot.width)
        shot=shot.resize((cw,ch),Image.Resampling.LANCZOS)
        x=(w-cw)//2; top=810 if device=='iphone' else 810
        # Keep iPad captures inside the canvas without distorting their aspect ratio.
        if top+ch>h-130:
            ch=h-130-top; shot=shot.crop((0,0,cw,ch))
        mask=Image.new('L',(cw,ch)); ImageDraw.Draw(mask).rounded_rectangle((0,0,cw,ch),48,fill=255)
        shadow=Image.new('RGBA',(w,h)); sd=ImageDraw.Draw(shadow)
        sd.rounded_rectangle((x-4,top+20,x+cw+4,top+ch+28),52,fill=(58,44,87,48))
        panel=Image.alpha_composite(panel,shadow.filter(ImageFilter.GaussianBlur(24)))
        panel.paste(shot,(x,top),mask)
        d=ImageDraw.Draw(panel)
        d.rounded_rectangle((x-2,top-2,x+cw+2,top+ch+2),50,outline='#FFFFFF',width=5)
        d.text((pad,h-75),'IMAGINE • CREATE • SAVE',font=font(26 if device=='iphone' else 35,True),fill='#5C526C')
        d.text((w-pad-40,h-75),f'0{i+1}',font=font(26 if device=='iphone' else 35,True),fill='#5C526C')
        dest=OUT/device/name; dest.parent.mkdir(parents=True,exist_ok=True)
        panel.convert('RGB').save(dest,optimize=True)
        panels.append(panel.convert('RGB'))
        ledger.append({'output':str(dest.relative_to(ROOT)),'capture':str(source.relative_to(ROOT)),'crop':crop,'size':[w,h]})
    preview=Image.new('RGB',(w*3,h))
    for i,p in enumerate(panels): preview.paste(p,(i*w,0))
    preview.thumbnail((1800,1400))
    preview.save(OUT/f'preview-{device}.jpg',quality=94)

(ROOT/'app-store/design/screenshot-provenance.json').write_text(json.dumps({
    'method':'Original continuous vector-style wallpaper, original icon, licensed DM Sans, and native iOS captures. No generated or fictional app UI.',
    'renderer':'scripts/render-store.py','generationSpendUSD':0,'panels':ledger
},indent=2)+'\n')
print('Rendered 3 iPhone and 3 iPad RGB screenshots and contact sheets.')
