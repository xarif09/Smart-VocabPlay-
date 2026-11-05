#!/usr/bin/env python3
"""ปรับ src/images.js ตามผลตรวจรูปด้วยตา (v3.8): DROP = เลิกใช้รูปถ่าย (ไปใช้ภาพออกแบบ/อีโมจิใหญ่) · RENAME = เปลี่ยนบทความ Wikipedia
   แก้ในที่เดิมทุกบล็อก add("หมวด", [...]) — ใช้ซ้ำได้ (idempotent)"""
import re, sys
p = 'src/images.js'; s = open(p, encoding='utf-8').read()
DROP = {
 'body': ['NOSE','CHIN','NAIL','HEAD','HAIR','CHEEK','FINGER','MUSTACHE'],
 'actions': ['SMELL','OPEN','CLOSE','ANSWER','WAIT','PICK','REMEMBER','FORGET','WANT','NEED','WIN','READ','SLIDE'],
 'family': ['GRANDMOTHER','GRANDFATHER','GRANDPARENTS','COUSIN','NEIGHBOR','WIFE','HUSBAND','SISTER','BROTHER'],
 'school': ['GRADE','STICKER','BELL'],
 'technology': ['EMAIL','SCREENSHOT'],
 'toys': ['SCOOTER','SLIDE'],
 # รอบ 2 (v3.8): รูปใหม่ยังไม่สื่อ → ใช้ภาพออกแบบ/อีโมจิใหญ่
 'weather': ['HOT','SUNNY'], 'sports': ['MEDAL'], 'opposites': ['OPEN','CLOSED','HOT'],
 'jobs': ['PRINCE','PRINCESS','WRITER','DESIGNER','ELECTRICIAN','TAXI DRIVER','MAIL CARRIER','CAPTAIN','CARPENTER','MAGICIAN','SCIENTIST','ARTIST','ENGINEER'],
 'clothes': ['COAT','SUIT','SWIMSUIT','EARRINGS','SKIRT'],
 'fruits': ['ROSE APPLE'], 'time': ['APRIL'], 'vegetables': ['GINGER','BEAN SPROUTS'], 'music': ['HARP'],
}
RENAME = {
 ('weather','SUNNY'):'Sun', ('weather','HOT'):'Sunbathing', ('opposites','HOT'):'Sunbathing', ('weather','FOG'):'Mist', ('weather','FLOOD'):'2011 Thailand floods',
 ('jobs','SCIENTIST'):'Scientist', ('jobs','ARTIST'):'Artist', ('jobs','ENGINEER'):'Engineer', ('jobs','CARPENTER'):'Woodworking', ('jobs','MAGICIAN'):'Stage magic',
 ('clothes','COAT'):'Trench coat', ('clothes','SUIT'):'Lounge suit', ('clothes','SKIRT'):'Miniskirt', ('clothes','SWIMSUIT'):'One-piece swimsuit', ('clothes','EARRINGS'):'Stud earring',
 ('sports','MEDAL'):'Medal', ('sports','TEAM'):'Team sport', ('sports','THROW'):'Javelin throw', ('actions','THROW'):'Javelin throw', ('actions','CLAP'):'Applause',
 ('fruits','ROSE APPLE'):'Syzygium jambos', ('school','BELL'):'Handbell', ('school','PAPER'):'Notepad', ('school','P.E.'):'Calisthenics',
 ('nature','SEA'):'Coast', ('toys','LEGO'):'Lego', ('vehicles','SCOOTER'):'Motor scooter', ('home','OVEN'):'Toaster oven',
 ('time','APRIL'):'Songkran', ('time','HOLIDAY'):'Vacation', ('countries','MALAYSIA'):'Kuala Lumpur', ('countries','FRANCE'):'Louvre',
 ('technology','CHARGER'):'AC adapter', ('technology','GAME'):'Gamepad', ('technology','CABLE'):'Electrical cable', ('music','HARP'):'Harp',
 ('vegetables','GINGER'):'Zingiber', ('vegetables','BEAN SPROUTS'):'Sprouting',
}
used_drop, used_ren = set(), set()
def block(m):
    cat, body = m.group(1), m.group(2)
    def pair(pm):
        w, t = pm.group(1), pm.group(2)
        if w in DROP.get(cat, []): used_drop.add((cat, w)); return ''
        if (cat, w) in RENAME: used_ren.add((cat, w)); return f'["{w}","{RENAME[(cat, w)]}"]'
        return pm.group(0)
    nb = re.sub(r'\["([^"\]]+)","([^"]+)"\]', pair, body)
    nb = re.sub(r',\s*,', ',', nb); nb = re.sub(r'\[\s*,', '[', nb); nb = re.sub(r',\s*\]', ']', nb)
    return f'add("{cat}", [{nb}]);'
s2 = re.sub(r'add\("(\w+)", \[([\s\S]*?)\]\);', block, s)
open(p, 'w', encoding='utf-8').write(s2)
miss_d = [(c, w) for c, ws in DROP.items() for w in ws if (c, w) not in used_drop]
miss_r = [k for k in RENAME if k not in used_ren]
print(f'dropped {len(used_drop)} · renamed {len(used_ren)}')
if miss_d: print('ไม่พบ (drop):', miss_d)
if miss_r: print('ไม่พบ (rename):', miss_r)
