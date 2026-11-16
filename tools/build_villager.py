#!/usr/bin/env python3
"""Build Skyre's original, skinned glTF character rig. No Blender or network needed.

All geometry, materials, and animation clips are authored specifically for Skyre.
The approved character concept informs proportions, outfits, and palettes; this
script does not turn a picture into a photogrammetry scan.
"""
from __future__ import annotations
import io, json, math, struct
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation

OUT=Path(__file__).resolve().parents[1]/'assets/characters/skyre-villager.glb'

JOINTS=[
 ('Hips',None,(0,.78,0)),
 ('Spine','Hips',(0,.22,0)),
 ('Chest','Spine',(0,.25,0)),
 ('Neck','Chest',(0,.19,0)),
 ('Head','Neck',(0,.15,0)),
 ('Arm_L','Chest',(-.255,.095,0)),
 ('Elbow_L','Arm_L',(-.060,-.250,0)),
 ('Hand_L','Elbow_L',(-.014,-.245,0)),
 ('Arm_R','Chest',(.255,.095,0)),
 ('Elbow_R','Arm_R',(.060,-.250,0)),
 ('Hand_R','Elbow_R',(.014,-.245,0)),
 ('Thigh_L','Hips',(-.135,-.068,0)),
 ('Knee_L','Thigh_L',(0,-.330,.012)),
 ('Foot_L','Knee_L',(0,-.300,0)),
 ('Thigh_R','Hips',(.135,-.068,0)),
 ('Knee_R','Thigh_R',(0,-.330,.012)),
 ('Foot_R','Knee_R',(0,-.300,0)),
]
J={name:i for i,(name,_,_) in enumerate(JOINTS)}
global_pos={}
for name,parent,xyz in JOINTS:
    global_pos[name]=np.array(xyz,dtype=np.float32)+(global_pos[parent] if parent else 0)

MATERIALS={
 'Skin':('#e6b591','skin',.92), 'Cheek':('#dc8f87','skin',.91),
 'EyeWhite':('#fff8ef',None,.4), 'Iris':('#554131',None,.5), 'Pupil':('#211a20',None,.3),
 'Mouth':('#a35e58',None,.85), 'Hair':('#4a312c','hair',.92), 'Brow':('#4a312c','hair',.93),
 'Shirt':('#ecdec5','fabric',.96), 'Vest':('#99705e','fabric',.93),
 'Apron':('#e6c6a7','fabric',.98), 'Pants':('#716457','fabric',.93),
 'Boots':('#63483b','leather',.89), 'Leather':('#78533f','leather',.86),
 'Trim':('#e3c994',None,.73), 'Accent':('#84986f','fabric',.92),
 'HatCloth':('#ab795d','fabric',.94), 'Straw':('#d8b980','straw',.96),
 'Basket':('#a8794b','straw',.96), 'Cargo':('#e9d6a7','fabric',.94),
}
def srgb(c):
    return [int(c[i:i+2],16)/255 for i in (1,3,5)]

class Bucket:
    __slots__=('pos','norm','uv','joint','weight','indices')
    def __init__(self):
        self.pos=[];self.norm=[];self.uv=[];self.joint=[];self.weight=[];self.indices=[]

# Each named group can be selectively hidden (hair style, role outfit, cargo).
meshes={}
def append_mesh(group,material,positions,normals,uv,indices,skin):
    key=(group,material)
    bucket=meshes.setdefault(key,Bucket())
    start=len(bucket.pos)
    bucket.pos.extend(positions);bucket.norm.extend(normals);bucket.uv.extend(uv)
    bucket.indices.extend(int(i)+start for i in indices)
    # A maximum of two influences is intentionally used for predictable mobile skinning.
    for weights in skin:
        a,b=weights
        if b is None:
            bucket.joint.append([J[a],0,0,0]);bucket.weight.append([1.,0.,0.,0.])
        else:
            bname,frac=b
            bucket.joint.append([J[a],J[bname],0,0]);bucket.weight.append([1.-frac,frac,0.,0.])

def ellipsoid(name,mat,center,radius,bone,segments=16,rings=12):
    positions=[];normals=[];uv=[];tri=[];skin=[]
    cx,cy,cz=center;rx,ry,rz=radius
    for j in range(rings+1):
        theta=j*math.pi/rings; sn=math.sin(theta);cs=math.cos(theta)
        for i in range(segments+1):
            phi=i*2*math.pi/segments;co=math.cos(phi);si=math.sin(phi)
            x=sn*co;y=cs;z=sn*si
            positions.append((cx+x*rx,cy+y*ry,cz+z*rz))
            n=np.array((x/max(rx,1e-3),y/max(ry,1e-3),z/max(rz,1e-3)));n/=max(np.linalg.norm(n),1e-6)
            normals.append(tuple(n));uv.append((i/segments,j/rings));skin.append((bone,None))
    for j in range(rings):
        for i in range(segments):
            k=j*(segments+1)+i
            tri.extend((k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1))
    append_mesh(name,mat,positions,normals,uv,tri,skin)

def loft(name,mat,levels,bones,segments=18):
    # levels: y, width, depth, zOffset; smooth ring-based cloth/body surface
    pos=[];norm=[];uv=[];tri=[];skin=[]
    for k,(y,rx,rz,zcenter) in enumerate(levels):
        for i in range(segments+1):
            a=2*math.pi*i/segments;x=math.cos(a);z=math.sin(a)
            pos.append((rx*x,y,zcenter+rz*z));n=np.array([x/max(rx,1e-3),0,z/max(rz,1e-3)]);n/=max(np.linalg.norm(n),1e-6)
            norm.append(tuple(n));uv.append((i/segments,k/(len(levels)-1)))
            if len(bones)==1: skin.append((bones[0],None))
            else:
                fraction=min(1.,max(0.,(y-levels[0][0])/(levels[-1][0]-levels[0][0])))
                skin.append((bones[0],(bones[1],fraction)))
    for k in range(len(levels)-1):
        for i in range(segments):
            a=k*(segments+1)+i;b=a+segments+1
            tri.extend((a,b,a+1,a+1,b,b+1))
    append_mesh(name,mat,pos,norm,uv,tri,skin)

def limb(name,mat,start,end,rad0,rad1,b0,b1,segments=12):
    a=np.array(start,dtype=np.float64);b=np.array(end,dtype=np.float64)
    axis=b-a;axis/=np.linalg.norm(axis)
    tangent=np.array([0,0,1.],dtype=np.float64)
    if abs(np.dot(axis,tangent))>.95:tangent=np.array([1.,0,0])
    u=np.cross(axis,tangent);u/=np.linalg.norm(u);v=np.cross(axis,u)
    pos=[];norm=[];uv=[];tri=[];skin=[];rings=7
    for j in range(rings+1):
        t=j/rings
        # tapers smoothly toward the elbows and wrists
        r=rad0*(1-t)+rad1*t
        center=a*(1-t)+b*t
        for i in range(segments+1):
            theta=i*math.tau/segments; radial=u*math.cos(theta)+v*math.sin(theta)
            pos.append(tuple(center+radial*r));norm.append(tuple(radial));uv.append((i/segments,t));skin.append((b0,(b1,t)))
    for j in range(rings):
        for i in range(segments):
            k=j*(segments+1)+i;q=k+segments+1
            tri.extend([k,k+1,q,k+1,q+1,q])
    append_mesh(name,mat,pos,norm,uv,tri,skin)

def flattened_disc(name,mat,center,radius,thickness,bone,segments=26):
    # Ellipsoid provides a softly bevelled, non-boxy hat brim and belt shape.
    ellipsoid(name,mat,center,(radius,thickness,radius),bone,segments,8)

# Torso + shaped clothes; no cylinder-stick figure shapes.
ellipsoid('Body','Pants',(0,.79,0),(.202,.21,.159),'Hips')
loft('Body','Shirt',[(.81,.155,.135,0),(.95,.192,.152,0),(1.20,.231,.165,0),(1.35,.19,.141,0)],['Hips','Chest'])
loft('Body','Vest',[(.85,.190,.157,0),(.98,.213,.163,0),(1.17,.231,.169,0),(1.31,.170,.143,0)],['Spine','Chest'])
# A raised front placket, collar pieces and brown belt.
ellipsoid('Body','Shirt',(-.10,1.334,.108),(.088,.048,.077),'Chest')
ellipsoid('Body','Shirt',(.10,1.334,.108),(.088,.048,.077),'Chest')
loft('Body','Leather',[(.883,.216,.174,0),(.927,.220,.174,0)],['Spine'])
ellipsoid('Body','Trim',(0,.918,.175),(.035,.039,.023),'Spine')
for y in [1.11,1.20,1.28]:ellipsoid('Body','Trim',(0,y,.174),(.012,.014,.014),'Chest',12,9)
# Collar scarf and shirt folds.
ellipsoid('Body','Accent',(0,1.375,.06),(.179,.036,.145),'Chest')
# Optional flared cloth skirt, visible only for identities wearing skirts.
loft('Skirt','Pants',[(.76,.24,.20,0),(.84,.226,.18,0),(.95,.196,.168,0)],['Hips','Spine'])
# Pants with separate round hips, knees and leather footwear.
for side in (-1,1):
    prefix='L' if side<0 else 'R'
    upper=f'Thigh_{prefix}';knee=f'Knee_{prefix}';foot=f'Foot_{prefix}'
    hip=global_pos[upper];kn=global_pos[knee];ft=global_pos[foot]
    limb('Body','Pants',tuple(hip),tuple(kn),.114,.087,upper,knee)
    ellipsoid('Body','Pants',tuple(kn),(.083,.092,.097),knee,14,10)
    limb('Body','Pants',tuple(kn),tuple(ft),.083,.071,knee,foot)
    ellipsoid('Body','Boots',(float(ft[0]),float(ft[1])+.052,.035),(.102,.126,.102),foot,15,11)
    ellipsoid('Body','Boots',(float(ft[0]),float(ft[1])-.024,.13),(.116,.061,.182),foot,17,11)
    ellipsoid('Body','Leather',(float(ft[0]),float(ft[1])+.101,.065),(.102,.029,.117),foot,12,9)
    for xoff in [-.035,.033]:
        ellipsoid('Body','Trim',(float(ft[0])+xoff,float(ft[1])+.12,.149),(.014,.008,.011),foot,10,6)
    # Puffy sleeves plus real elbow, wrist and hand joints.
    shoulder=global_pos[f'Arm_{prefix}'];el=global_pos[f'Elbow_{prefix}'];hand=global_pos[f'Hand_{prefix}']
    limb('Body','Shirt',tuple(shoulder),tuple(el),.109,.078,f'Arm_{prefix}',f'Elbow_{prefix}')
    ellipsoid('Body','Shirt',tuple(shoulder+np.array([0,-.065,0])),(.109,.117,.12),f'Arm_{prefix}')
    limb('Body','Shirt',tuple(el),tuple(hand),.073,.056,f'Elbow_{prefix}',f'Hand_{prefix}')
    ellipsoid('Body','Accent',tuple(hand+np.array([0,.05,0])),(.073,.035,.076),f'Hand_{prefix}')
    ellipsoid('Body','Skin',tuple(hand+np.array([0,-.064,.01])),(.057,.100,.06),f'Hand_{prefix}',14,10)
    for f in range(3):
        ellipsoid('Body','Skin',tuple(hand+np.array([(f-1)*.027,-.135,.051])),(.018,.038,.019),f'Hand_{prefix}',10,8)
# Skin-toned neck visibly joins the shoulders to the sculpted head.
ellipsoid('Face','Skin',(0,1.455,0),(.082,.134,.077),'Neck',16,12)
# Tailored pockets and seam details to read as actual clothing.
for s in (-1,1):
    ellipsoid('Body','Leather',(s*.122,1.071,.158),(.046,.058,.017),'Chest',12,9)
    ellipsoid('Body','Trim',(s*.122,1.109,.167),(.042,.009,.011),'Chest',12,7)
# Face: defined features with white eyes, iris, subtle lashes, nose, cheeks and smile.
ellipsoid('Face','Skin',(0,1.79,0),(.214,.250,.196),'Head',24,17)
for s in (-1,1):
    ellipsoid('Face','Skin',(s*.211,1.762,-.014),(.044,.067,.039),'Head')
    ellipsoid('Face','EyeWhite',(s*.084,1.807,.184),(.045,.052,.015),'Head',14,10)
    ellipsoid('Face','Iris',(s*.086,1.800,.198),(.022,.032,.014),'Head',14,10)
    ellipsoid('Face','Pupil',(s*.086,1.800,.209),(.014,.022,.008),'Head',12,9)
    ellipsoid('Face','EyeWhite',(s*.078,1.816,.221),(.006,.009,.006),'Head',9,7)
    ellipsoid('Face','Cheek',(s*.146,1.709,.144),(.048,.015,.023),'Head',14,8)
    ellipsoid('Face','Brow',(s*.084,1.889,.176),(.058,.018,.023),'Head',15,8)
ellipsoid('Face','Skin',(0,1.745,.202),(.037,.050,.039),'Head')
ellipsoid('Face','Mouth',(0,1.689,.189),(.048,.012,.010),'Head',14,8)
ellipsoid('Face','Skin',(0,1.674,.182),(.035,.010,.013),'Head',14,8)
# Optional bearded villager and a round-spectacled villager from the concept sheet.
ellipsoid('Beard','Hair',(0,1.615,.112),(.117,.077,.097),'Head')
for side in [-1,1]:
    ellipsoid('Beard','Hair',(side*.139,1.680,.107),(.058,.073,.058),'Head')
    for k in range(20):
        theta=k*math.tau/20
        cx=side*.086+.064*math.cos(theta);cy=1.802+.063*math.sin(theta)
        nxt=theta+math.tau/20
        nx=side*.086+.064*math.cos(nxt);ny=1.802+.063*math.sin(nxt)
        limb('Glasses','Leather',(cx,cy,.218),(nx,ny,.218),.007,.007,'Head','Head',8)
limb('Glasses','Leather',(-.020,1.817,.222),(.020,1.817,.222),.008,.008,'Head','Head',8)
# Character hair: one of five selectively-visible meshes, all skinned to Head.
for style in ['tousled','sidepart','braids','curly','bob']:
    group='Hair_'+style
    ellipsoid(group,'Hair',(0,1.945,-.038),(.216,.123,.196),'Head')
    if style=='tousled':
        for x,y,z,r in [(-.14,2.00,.11,.082),(-.04,2.052,.09,.077),(.075,2.03,.08,.086),(.155,1.982,.03,.070)]:
            ellipsoid(group,'Hair',(x,y,z),(r,r*.73,r*.9),'Head')
    elif style=='sidepart':
        ellipsoid(group,'Hair',(.060,1.965,.143),(.168,.079,.084),'Head')
        ellipsoid(group,'Hair',(-.177,1.842,-.02),(.051,.126,.102),'Head')
    elif style=='braids':
        ellipsoid(group,'Hair',(0,1.978,.099),(.161,.069,.096),'Head')
        for s in (-1,1):
            for i in range(3):
                ellipsoid(group,'Hair',(s*.200,1.743-i*.102,-.048),(.071-i*.007,.071-i*.004,.063-i*.004),'Head')
            ellipsoid(group,'Accent',(s*.20,1.477,-.043),(.032,.030,.036),'Head')
    elif style=='curly':
        for x,y,z in [(-.17,1.996,.085),(-.09,2.079,.071),(0,2.077,.11),(.105,2.075,.068),(.175,1.99,.07),(-.188,1.874,.015),(.183,1.861,.01)]:
            ellipsoid(group,'Hair',(x,y,z),(.084,.08,.08),'Head',12,9)
    elif style=='bob':
        for s in (-1,1):
            ellipsoid(group,'Hair',(s*.181,1.755,-.012),(.067,.176,.119),'Head')
        ellipsoid(group,'Hair',(0,1.95,.136),(.174,.065,.072),'Head')
# Job hats and aprons use toggleable submesh groups, no per-job .glb download.
flattened_disc('Hat_straw','Straw',(0,2.057,0),.339,.028,'Head')
ellipsoid('Hat_straw','Straw',(0,2.13,-.02),(.178,.122,.170),'Head')
ellipsoid('Hat_straw','Leather',(0,2.069,.162),(.173,.024,.040),'Head')
flattened_disc('Hat_cap','HatCloth',(0,2.009,0),.208,.042,'Head')
ellipsoid('Hat_cap','HatCloth',(0,2.066,-.035),(.205,.093,.195),'Head')
ellipsoid('Hat_cap','HatCloth',(0,2.011,.151),(.160,.022,.126),'Head')
flattened_disc('Hat_chef','Apron',(0,2.029,0),.187,.04,'Head')
for x,z in [(-.115,-.045),(-.025,.06),(.09,-.052),(.10,.063)]:
    ellipsoid('Hat_chef','Apron',(x,2.159,z),(.107,.118,.099),'Head')
ellipsoid('Hat_kerchief','HatCloth',(0,2.007,0),(.206,.055,.2),'Head')
ellipsoid('Hat_kerchief','HatCloth',(.20,1.885,-.068),(.05,.12,.075),'Head')
# Bib, hem and straps modelled over torso, skinned to chest.
loft('Apron','Apron',[(.84,.198,.018,.167),(.98,.210,.019,.165),(1.16,.153,.019,.166),(1.28,.115,.018,.153)],['Spine','Chest'])
for s in (-1,1):
    ellipsoid('Apron','Leather',(s*.117,1.308,.136),(.020,.076,.018),'Chest')
loft('Apron','Accent',[(.88,.13,.017,.197),(.91,.13,.017,.193)],['Spine'])
# Cargo basket: skin to chest so it follows upper-body animation, shown only in Carry clip.
loft('CargoBasket','Basket',[(.95,.180,.17,.343),(1.02,.221,.204,.342),(1.128,.244,.217,.342)],['Chest'])
loft('CargoBasket','Leather',[(1.12,.249,.221,.342),(1.146,.25,.225,.342)],['Chest'])
for x in (-.126,0,.126):
    ellipsoid('CargoBasket','Trim',(x,1.02,.561),(.017,.108,.015),'Chest')
ellipsoid('CargoBasket','Cargo',(0,1.155,.339),(.19,.063,.16),'Chest')
for x in [-.09,.065]:
    ellipsoid('CargoBasket','Accent',(x,1.202,.362),(.041,.052,.048),'Chest')
# Each material owns a painted repeating texture. Procedural artwork is original.
from PIL import ImageDraw, ImageFilter
rng=np.random.default_rng(29491)
def create_texture(kind):
    a=np.zeros((128,128,4),dtype=np.uint8)
    for y in range(128):
        for x in range(128):
            noise=float(rng.normal(0,3.5))
            if kind=='fabric':val=234+ (6 if (x//3+y//3)%2 else -6)+(2 if x%4==0 else 0)+noise
            elif kind=='leather':val=231+8*math.sin(y*.12+x*.03)+noise
            elif kind=='hair':val=232+8*math.sin(x*.48+math.sin(y*.12)*2)+noise
            elif kind=='straw':val=234+9*math.sin(x*.95)+4*math.sin(y*.20)+noise
            elif kind=='skin':val=244+noise
            else:val=245+noise
            a[y,x,:3]=np.uint8(min(255,max(185,val)));a[y,x,3]=255
    im=Image.fromarray(a,mode='RGBA')
    bio=io.BytesIO();im.save(bio,'PNG',optimize=True)
    return bio.getvalue()

buffer=bytearray();views=[];accessors=[]
def put_bytes(raw,target=None):
    while len(buffer)%4:buffer.append(0)
    offset=len(buffer);buffer.extend(raw)
    view={'buffer':0,'byteOffset':offset,'byteLength':len(raw)}
    if target:view['target']=target
    views.append(view)
    return len(views)-1

def accessor(data,dtype,typ,target=None,components=None,normalized=False):
    arr=np.ascontiguousarray(np.array(data,dtype=dtype));
    if arr.ndim==1:arr=arr.reshape(-1,1)
    if components is None:components=arr.shape[1]
    view=put_bytes(arr.tobytes(),target)
    d={'bufferView':view,'componentType':{np.dtype('float32'):5126,np.dtype('int8'):5120,np.dtype('uint8'):5121,np.dtype('uint16'):5123,np.dtype('uint32'):5125}[arr.dtype],
       'count':len(arr),'type':typ}
    if normalized:d['normalized']=True
    if typ=='VEC3' and arr.dtype==np.float32:
        d['min']=arr.min(axis=0).tolist();d['max']=arr.max(axis=0).tolist()
    accessors.append(d)
    return len(accessors)-1

textures=[];images=[];samplers=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
for kind in ['fabric','leather','hair','straw','skin']:
    by=create_texture(kind)
    view=put_bytes(by)
    images.append({'name':kind+'-handpainted','bufferView':view,'mimeType':'image/png'})
    textures.append({'sampler':0,'source':len(images)-1})
texture_id={name:i for i,name in enumerate(['fabric','leather','hair','straw','skin'])}
materials=[];mat_id={}
for name,(color,texture,rough) in MATERIALS.items():
    pbr={'baseColorFactor':srgb(color)+[1.0],'metallicFactor':0,'roughnessFactor':rough}
    if texture:pbr['baseColorTexture']={'index':texture_id[texture]}
    materials.append({'name':name,'pbrMetallicRoughness':pbr,'doubleSided':True})
    mat_id[name]=len(materials)-1

nodes=[];jointnodes={}
for name,parent,xyz in JOINTS:
    jointnodes[name]=len(nodes)
    nodes.append({'name':name,'translation':list(xyz),'children':[]})
for name,parent,_ in JOINTS:
    if parent is not None:nodes[jointnodes[parent]]['children'].append(jointnodes[name])

inverse=[]
for name,_,_ in JOINTS:
    xyz=global_pos[name]
    m=np.eye(4,dtype=np.float32);m[:3,3]=-xyz
    inverse.append(m.flatten(order='F'))
ibm=accessor(inverse,'float32','MAT4')
skins=[{'name':'SkyreVillageRig','joints':list(range(len(JOINTS))), 'inverseBindMatrices':ibm,'skeleton':jointnodes['Hips']}]
mesh_nodes=[];gltf_meshes=[]
for (group,material),b in meshes.items():
    # Make a separate primitive per material; named scene nodes permit filtering.
    attrs={
      'POSITION':accessor(b.pos,'float32','VEC3',34962),
      'NORMAL':accessor(b.norm,'float32','VEC3',34962),
      'TEXCOORD_0':accessor(np.clip(np.rint(np.array(b.uv)*65535),0,65535),'uint16','VEC2',34962,normalized=True),
      'JOINTS_0':accessor(b.joint,'uint8','VEC4',34962),
      'WEIGHTS_0':accessor([[int(round(q[0]*255)),255-int(round(q[0]*255)),0,0] for q in b.weight],'uint8','VEC4',34962,normalized=True),
    }
    indices=accessor(np.array(b.indices,dtype=np.uint16).reshape(-1,1),'uint16','SCALAR',34963)
    prim={'attributes':attrs,'indices':indices,'material':mat_id[material],'mode':4}
    name=group+'__'+material
    gltf_meshes.append({'name':name,'primitives':[prim]})
    nodes.append({'name':name,'mesh':len(gltf_meshes)-1,'skin':0})
    mesh_nodes.append(len(nodes)-1)

# Animate each joint in the file; each clip loops seamlessly with first == last.
def rot(x=0,y=0,z=0):return Rotation.from_euler('xyz',[x,y,z]).as_quat().astype(np.float32)
def keypose(clip,p):
    a=math.tau*p;si=math.sin(a);co=math.cos(a)
    q={}
    if clip=='Idle':
        q.update(Spine=(.022*si,0,.017*co),Chest=(-.022*si,.015*si,0),Head=(0,.105*si,.026*co),
                 Arm_L=(.065*si,0,-.045),Arm_R=(-.065*si,0,.045),Thigh_L=(.015*si,0,0),Thigh_R=(-.015*si,0,0))
    elif clip=='Walk':
        q.update(Spine=(.035*co,0,.035*si),Chest=(0,.055*si,0),Head=(.025*co,-.06*si,0),
                 Thigh_L=(.59*si,0,0),Knee_L=(.53*max(0,-si),0,0),Thigh_R=(-.59*si,0,0),Knee_R=(.53*max(0,si),0,0),
                 Arm_L=(-.44*si,0,-.04),Arm_R=(.44*si,0,.04),Elbow_L=(-.2,0,0),Elbow_R=(-.2,0,0))
    elif clip=='Carry':
        q.update(Spine=(.03*co,0,.012*si),Head=(-.02,.09*si,0),
                 Thigh_L=(.36*si,0,0),Knee_L=(.28*max(0,-si),0,0),Thigh_R=(-.36*si,0,0),Knee_R=(.28*max(0,si),0,0),
                 Arm_L=(-.76,0,-.28),Arm_R=(-.76,0,.28),Elbow_L=(-.61,0,0),Elbow_R=(-.61,0,0))
    elif clip=='Work':
        q.update(Spine=(.18+.10*co,0,0),Head=(.12+.08*co,0,0),
                 Arm_L=(-.40+.2*si,0,-.20),Arm_R=(-.55+.58*si,0,.13),
                 Elbow_L=(-.28,0,0),Elbow_R=(-.39-.30*max(0,si),0,0),
                 Thigh_L=(.04,0,0),Thigh_R=(-.04,0,0))
    elif clip=='Wave':
        q.update(Head=(0,.15*si,.03*co),Arm_R=(-1.35,0,-.6),Elbow_R=(-.65,0,.26*si),Arm_L=(.05*si,0,-.03))
    return {name:rot(*angles) for name,angles in q.items()}

animations=[]
for clip,duration in [('Idle',2.2),('Walk',.92),('Carry',1.15),('Work',1.22),('Wave',1.7)]:
    steps=17
    ts=np.linspace(0,duration,steps,dtype=np.float32)
    timeidx=accessor(ts.reshape(-1,1),'float32','SCALAR')
    changed=sorted({name for p in np.linspace(0,1,steps) for name in keypose(clip,p)})
    samplersA=[];channels=[]
    for name in changed:
        values=[keypose(clip,k/(steps-1))[name].tolist() for k in range(steps)]
        values[-1]=values[0] # a seamless repeat
        idx=accessor(values,'float32','VEC4')
        samplersA.append({'input':timeidx,'output':idx,'interpolation':'LINEAR'})
        channels.append({'sampler':len(samplersA)-1,'target':{'node':jointnodes[name],'path':'rotation'}})
    animations.append({'name':clip,'samplers':samplersA,'channels':channels})

scene_nodes=[jointnodes['Hips']]+mesh_nodes
asset={'asset':{'version':'2.0','generator':'Skyre character builder v0.9','copyright':'Skyre original assets'},
       'scene':0,'scenes':[{'name':'SkyreVillager','nodes':scene_nodes}],
       'nodes':nodes,'meshes':gltf_meshes,'skins':skins,'animations':animations,
       'materials':materials,'textures':textures,'images':images,'samplers':samplers,
       'buffers':[{'byteLength':0}],'bufferViews':views,'accessors':accessors,
       'extras':{'artistNote':'Original stylized sculpt based on approved Skyre character concept. Includes shared skeleton, role accessories, original texture patterns and five animations.'}}
asset['buffers'][0]['byteLength']=len(buffer)
jsonchunk=json.dumps(asset,separators=(',',':'),ensure_ascii=False).encode('utf-8')
while len(jsonchunk)%4:jsonchunk+=b' '
while len(buffer)%4:buffer.append(0)
length=12+8+len(jsonchunk)+8+len(buffer)
header=struct.pack('<4sII',b'glTF',2,length)
glb=header+struct.pack('<I4s',len(jsonchunk),b'JSON')+jsonchunk+struct.pack('<I4s',len(buffer),b'BIN\x00')+buffer
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_bytes(glb)
print(f'{OUT}: {len(glb):,} bytes; {len(JOINTS)} bones; {len(gltf_meshes)} skinned material groups; {sum(len(v.pos) for v in meshes.values()):,} vertices; {len(animations)} animations')
