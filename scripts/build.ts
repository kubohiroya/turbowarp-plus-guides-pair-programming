import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import YAML from 'yaml';
import {readAppRelease, appBasePath} from './app-dependency.ts';
import {units} from '../story/lesson.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const storyRoot = path.join(root, 'story');
const output = path.join(root, 'docs/work');
const packageRoot = path.join(root,'node_modules/@kubohiroya/turbowarp-kamishibai-app');
const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const hash = (b: Uint8Array|string, algorithm = 'sha256') => createHash(algorithm).update(b).digest('hex');
type GuideCue = {actor: 'Pura' | 'Moko'; target: string; action: string; message: string};
const guides: Record<string, GuideCue> = {};
const choices: Record<string, Record<string,string>> = {};
const art: Record<string, {file:string; kind:string; target?:string; center?:[number,number]}> = {};
const actors: Record<string, string> = {Pura:'PuraIdle', Moko:'MokoIdle'};
const timings: Record<string, any> = {};
const course = {id:'pair-programming',title:'プラとモコのペアプログラミング教室',subtitle:'相談して一つ直し、役割を交代しよう',units};

function wrap(s: string, width = 27) {
  const rows:string[]=[];let row='',used=0;
  for(const c of Array.from(s)){const weight=c.codePointAt(0)!>0x2ff?1:0.55;if(used+weight>width){rows.push(row);row='';used=0;}row+=c;used+=weight;}
  if(row)rows.push(row);
  return rows;
}
function text(s: string, x: number, y: number, size=18, color='#24314b', weight=500) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}">${xml(s)}</text>`;
}
async function svg(id: string, body: string, width=480,height=360,kind='backdrop',target?:string) {
  const file = `assets/${id}.svg`;
  await writeFile(path.join(storyRoot,file),`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g font-family="Noto Sans JP,Hiragino Kaku Gothic ProN,Arial,sans-serif">${body}</g></svg>\n`);
  art[id]={kind,file,...(target?{target}:{})};
}
async function board(id: string, title: string, rows: readonly string[], label:string) {
  let body = '<rect width="480" height="360" fill="#edf3fb"/><path d="M0 265 Q240 205 480 265 V360 H0" fill="#dce9ef"/>';
  body += '<rect x="16" y="14" width="448" height="151" rx="18" fill="white"/><rect x="16" y="14" width="7" height="151" rx="3" fill="#6366df"/>';
  body+=text(label,34,39,11,'#666b88',600)+text(title,34,68,21,'#263454',700);
  let y=92;
  for(const row of rows) for (const line of wrap(row,30)) {body+=text(line,34,y,13.5); y+=20;}
  body+=text('プラ',70,337,11,'#454fbe',700)+text('モコ',355,337,11,'#178c77',700);
  body+=text('Space：次へ　・　緑の旗：最初から',132,352,10,'#626f86');
  await svg(id,body);
}
async function button(id:string, label:string, caption:string, color='#6366df') {
  const body=`<rect x="2" y="2" width="206" height="58" rx="12" fill="white" stroke="${color}" stroke-width="3"/>`+text(label,14,26,17,color,700)+text(caption,14,47,10,'#5b6b82');
  await svg(id,body,210,62,'costume',id); actors[id]=id;
}
const show=(actor:string,x:number,y:number,scale=100,skin=actors[actor])=>({[`${actor}.show`]:{skin,x,y,scale}});
const hide=(actor:string)=>({[`${actor}.hide`]:{}});
const cast=()=>[show('Pura',-135,-110,9.5),show('Moko',135,-110,9.5)];
const noButtons=()=>Object.keys(actors).filter(a=>a!=='Pura'&&a!=='Moko').map(hide);
function say(lines: readonly (readonly string[])[], key:string) {
  let seconds=0,characters=0;
  const actions = lines.map(([speaker,line])=>{
    const duration=Math.max(4.5,Math.round((Array.from(line).length/6.2+1.4)*10)/10);
    seconds+=duration;characters+=Array.from(line).length;
    return {[`${speaker==='P'?'Pura':'Moko'}.say`]:{text:line,seconds:duration,styles:['lesson']}};
  });
  timings[key]={dialogueSeconds:Math.round(seconds),characters};return actions;
}
function guide(id:string, spec:GuideCue) {guides[id]=spec; return {broadcastMessageAndWait:`lesson:${id}`};}
function nativeChoices(scenes:Record<string,any[]>,prefix:string) {
  for(const [scene,actions]of Object.entries(scenes))for(let i=0;i<actions.length;i++)if(actions[i].touchInputToChangeScene){
    const id=`${prefix}_${scene}`;choices[id]=actions[i].touchInputToChangeScene;
    actions[i]={broadcastMessageAndWait:`choice:${id}`};
  }
}

async function createStory() {
  await mkdir(path.join(storyRoot,'assets'),{recursive:true}); await mkdir(output,{recursive:true});
  art.PuraIdle={kind:'costume',target:'Pura',file:'assets/pura.png'};
  art.MokoIdle={kind:'costume',target:'Moko',file:'assets/moko.png'};
  for (let i=0;i<units.length;i++) await button(`Unit${i+1}`,`${i+1}　${units[i].title}`,units[i].subtitle);
  await button('AnswerA','A','考えて選ぼう');await button('AnswerB','B','考えて選ぼう','#168b77');
  await button('NextUnit','次の単元へ','おすすめの順番で進む');await button('Menu','単元メニューへ','好きなところから学び直す','#168b77');
  const common={kamishibai:'4.0',controls:{keymaps:{production:{Space:'navigation.nextAction'}}},bubbleStyles:{lesson:{maxWidth:320,textLocale:'ja',distance:0,tailLength:8}},assets:art,actors};
  const documentFor=(scenes:Record<string,any[]>,backdrop:string)=>{
    const used=new Set([...Object.values(actors),backdrop]);
    for(const actions of Object.values(scenes))for(const action of actions)for(const[key,value]of Object.entries(action)){
      if(key==='stage')used.add(value as string);
      if(key.endsWith('.show'))used.add((value as any).skin);
    }
    return {...common,assets:Object.fromEntries(Object.entries(art).filter(([id])=>used.has(id))),cover:{backdrop},scenes};
  };
  const courseUnits=course.units;
  const menuId=`${course.id}Menu`;
  await svg(menuId,'<rect width="480" height="360" fill="#edf3fb"/>'+text(course.title,24,38,20,'#263454',700)+text(course.subtitle,24,64,12)+text('好きな単元をクリック。順番に学ぶと約10〜12分。',24,85,12)+text('操作は省略OK。クイズは何度でも選び直せます。',24,315,12)+text('Scratchの知識を出発点に、プラとモコがご案内します。',24,338,11));
  const menuSkins:string[]=[];
  for(let i=0;i<courseUnits.length;i++){
    const id=`${course.id}Button${i+1}`;menuSkins.push(id);
    await svg(id,'<rect x="2" y="2" width="206" height="58" rx="12" fill="white" stroke="#6366df" stroke-width="3"/>'+text(`${i+1}　${courseUnits[i].title}`,14,26,17,'#6366df',700)+text(courseUnits[i].subtitle,14,47,10,'#5b6b82'),210,62,'costume',`Unit${i+1}`);
  }
  const fs:Record<string,any[]>={};
  fs.menu=[{stage:menuId},...noButtons(),hide('Pura'),hide('Moko'),...courseUnits.map((u,i)=>show(`Unit${i+1}`,i%2===0?-112:112,55-Math.floor(i/2)*67,100,menuSkins[i])),{touchInputToChangeScene:Object.fromEntries(courseUnits.map((u,i)=>[`Unit${i+1}`,`${u.id}_intro`]))},{goto:'menu'}];
  for(let i=0;i<courseUnits.length;i++) {
    const u=courseUnits[i];const key=`${course.id}_${u.id}`;
    const b=`Board_${key}`;await board(b,`${i+1} / ${u.title}`,u.board,course.title);
    fs[`${u.id}_intro`]=[{stage:b},...noButtons(),...cast(),...say(u.lines,key),...('guide'in u?[guide(key,u.guide)]:[]),{goto:`${u.id}_quiz`}];
    const q=`Quiz_${key}`;await board(q,'ちょっと考えよう',[u.quiz.question,`A　${u.quiz.choices[0]}`,`B　${u.quiz.choices[1]}`],course.title);
    fs[`${u.id}_quiz`]=[{stage:q},...noButtons(),...cast(),show('AnswerA',-112,-57),show('AnswerB',112,-57),{touchInputToChangeScene:{AnswerA:`${u.id}_${u.quiz.correct===0?'yes':'retry'}`,AnswerB:`${u.id}_${u.quiz.correct===1?'yes':'retry'}`}},{goto:`${u.id}_quiz`}];
    fs[`${u.id}_retry`]=[{stage:q},...noButtons(),...cast(),...say([['P',u.quiz.retry]],`${key}_retry`),{goto:`${u.id}_quiz`}];
    const r=`Recap_${key}`;await board(r,'この単元の持ち帰り',u.takeaway,course.title);
    fs[`${u.id}_yes`]=[{stage:r},...noButtons(),...cast(),...say([['P',u.quiz.why]],`${key}_yes`),show('Menu',112,-57),...(i<5?[show('NextUnit',-112,-57)]:[]),{touchInputToChangeScene:{Menu:'menu',...(i<5?{NextUnit:`${courseUnits[i+1].id}_intro`}:{})}},{goto:'menu'}];
  }
  nativeChoices(fs,course.id);
  await writeFile(path.join(storyRoot,`${course.id}.k4.yml`),YAML.stringify(documentFor(fs,menuId),{lineWidth:0}));
}

function block(opcode:string,next:string|null,parent:string|null,inputs={},fields={},topLevel=false) {
  return {opcode,next,parent,inputs,fields,topLevel,shadow:false,...(topLevel?{x:40,y:40}:{})};
}
const literal=(s:string)=>[1,[10,s]];
async function actorBase(base:Uint8Array) {
  const files=unzipSync(base);const project=JSON.parse(strFromU8(files['project.json']));
  const story = YAML.parse(await readFile(path.join(storyRoot, course.id+'.k4.yml'),'utf8'));
  const stage=project.targets.find((t:any)=>t.isStage);stage.variables.lessonGuideResult=['ガイドの状態',''];
  // This work begins with its own unit menu rather than the generic App title.
  stage.blocks.titleFlagShow.next='lessonStart';
  stage.blocks.lessonStart=block('kubohiroyakamishibai4_kubohiroyakamishibairuntime4__closeTitle',null,'titleFlagShow');
  delete stage.blocks.titleStageClick;
  delete stage.blocks.titleStageClickClose;
  stage.variables.lessonChoice=['教材の選択',''];
  for(const [id,g]of Object.entries(guides))stage.broadcasts[`lesson_${id}`]=`lesson:${id}`;
  for(const[id,routes]of Object.entries(choices)){
    const hat=`choice_${id}`,reset=hat+'_reset',wait=hat+'_wait';stage.broadcasts[hat]=`choice:${id}`;
    stage.blocks[hat]={...block('event_whenbroadcastreceived',reset,null,{}, {BROADCAST_OPTION:[`choice:${id}`,hat]},true),x:800,y:1000+Object.keys(stage.broadcasts).length*40};
    stage.blocks[reset]=block('data_setvariableto',wait,hat,{VALUE:literal('')},{VARIABLE:['教材の選択','lessonChoice']});
    const entries=Object.entries(routes);
    const equals=(key:string,value:string,parent:string)=>{
      stage.blocks[key]=block('operator_equals',null,parent,{OPERAND1:[3,key+'_var',[10,'']],OPERAND2:literal(value)});
      stage.blocks[key+'_var']=block('data_variable',null,key,{}, {VARIABLE:['教材の選択','lessonChoice']});return key;
    };
    const conditions=entries.map(([name],i)=>equals(hat+'_eq'+i,name,i===0?wait:hat+'_or'+i));
    let condition=conditions[0];
    for(let i=1;i<conditions.length;i++){const key=hat+'_or'+i;stage.blocks[key]=block('operator_or',null,i===conditions.length-1?wait:hat+'_or'+(i+1),{OPERAND1:[2,condition],OPERAND2:[2,conditions[i]]});stage.blocks[condition].parent=key;condition=key;}
    stage.blocks[wait]=block('control_wait_until',hat+'_if0',reset,{CONDITION:[2,condition]});
    entries.forEach(([name,destination],i)=>{
      const key=hat+'_if'+i,next=hat+'_if'+(i+1),eq=equals(hat+'_route'+i,name,key),go=hat+'_go'+i;
      stage.blocks[key]=block(i<entries.length-1?'control_if_else':'control_if',null,i===0?wait:hat+'_if'+(i-1),{CONDITION:[2,eq],SUBSTACK:[2,go],...(i<entries.length-1?{SUBSTACK2:[2,next]}:{})});
      stage.blocks[go]=block('kubohiroyakamishibai4_kubohiroyakamishibairuntime4__goto',null,key,{SCENE:literal(destination)});
    });
  }
  let layer=1;
  for(const[name,asset]of Object.entries(story.actors as Record<string,string>)) {
    const data=await readFile(path.join(storyRoot,art[asset].file));const png=art[asset].file.endsWith('.png');
    const assetId=hash(data,'md5'),md5ext=`${assetId}.${png?'png':'svg'}`;files[md5ext]=data;
    const blocks:Record<string,any>={};let y=40;
    if(name!=='Pura'&&name!=='Moko'){
      blocks.clicked=block('event_whenthisspriteclicked','choose',null,{}, {},true);
      blocks.choose=block('data_setvariableto',null,'clicked',{VALUE:literal(name)},{VARIABLE:['教材の選択','lessonChoice']});
    }
    for(const[id,g]of Object.entries(guides).filter(([,g])=>g.actor===name)) {
      blocks[`hat_${id}`]={...block('event_whenbroadcastreceived',`save_${id}`,null,{}, {BROADCAST_OPTION:[`lesson:${id}`,`lesson_${id}`]},true),y};y+=180;
      blocks[`save_${id}`]=block('data_setvariableto',null,`hat_${id}`,{VALUE:[3,`wait_${id}`,[10,'']]},{VARIABLE:['ガイドの状態','lessonGuideResult']});
      blocks[`wait_${id}`]=block('kubohiroyaeditorguide_spriteAndWait',null,`save_${id}`,{TARGET:literal(g.target),SIDE:literal('bottom'),MESSAGE:literal(g.message),ACTION:literal(g.action)});
    }
    const costumes = [{name:asset,assetId,md5ext,dataFormat:png?'png':'svg',
      rotationCenterX:art[asset].center?.[0]??(png?656:105),rotationCenterY:art[asset].center?.[1]??(png?599.5:31),
      ...(png?{bitmapResolution:art[asset].center?1:2}:{})}];
    project.targets.push({isStage:false,name,variables:{},lists:{},broadcasts:{},blocks,comments:{},currentCostume:0,
      costumes,
      sounds:[],volume:100,layerOrder:layer++,visible:false,x:0,y:0,size:png?18:100,direction:90,draggable:false,rotationStyle:'don\'t rotate'});
  }
  const star='<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="M30 2 37 21 58 22 42 36 48 57 30 45 12 57 18 36 2 22 23 21Z" fill="#ffc857" stroke="#ad6b20" stroke-width="2"/></svg>';
  const starId=hash(star,'md5');files[starId+'.svg']=strToU8(star);
  const b:Record<string,any>={
    key:block('event_whenkeypressed','position',null,{}, {KEY_OPTION:['g',null]},true),
    position:block('motion_gotoxy','call','key',{X:[1,[4,'-160']],Y:[1,[4,'0']]}),
    call:{...block('procedures_call',null,'position',{count:[1,[4,'5']],gap:[1,[4,'60']]}),mutation:{tagName:'mutation',children:[],proccode:'星を並べる %s %s',argumentids:'["count","gap"]',warp:'false'}},
    def:{...block('procedures_definition','repeat',null,{custom_block:[1,'prototype']},{},true),x:420,y:40},
    prototype:{...block('procedures_prototype',null,'def',{count:[1,'count_shadow'],gap:[1,'gap_shadow']}),shadow:true,mutation:{tagName:'mutation',children:[],proccode:'星を並べる %s %s',argumentids:'["count","gap"]',argumentnames:'["個数","間隔"]',argumentdefaults:'["5","60"]',warp:'false'}},
    count_shadow:{...block('argument_reporter_string_number',null,'prototype',{}, {VALUE:['個数',null]}),shadow:true},
    gap_shadow:{...block('argument_reporter_string_number',null,'prototype',{}, {VALUE:['間隔',null]}),shadow:true},
    repeat:block('control_repeat',null,'def',{TIMES:[2,'count_arg'],SUBSTACK:[2,'clone']}),
    count_arg:block('argument_reporter_string_number',null,'repeat',{}, {VALUE:['個数',null]}),
    clone:block('control_create_clone_of','move','repeat',{CLONE_OPTION:[1,'myself']}),
    myself:{...block('control_create_clone_of_menu',null,'clone',{}, {CLONE_OPTION:['_myself_',null]}),shadow:true},
    move:block('motion_changexby','pause','clone',{DX:[2,'gap_arg']}),
    gap_arg:block('argument_reporter_string_number',null,'move',{}, {VALUE:['間隔',null]}),
    pause:block('control_wait',null,'move',{DURATION:[1,[4,'0.3']]}),
    cloned:{...block('control_start_as_clone','visible',null,{}, {},true),x:40,y:250},
    visible:block('looks_show','rest','cloned'),rest:block('control_wait','delete','visible',{DURATION:[1,[4,'1.8']]}),delete:block('control_delete_this_clone',null,'rest'),
  };
  project.targets.push({isStage:false,name:'ペア練習',variables:{},lists:{},broadcasts:{},blocks:b,comments:{},currentCostume:0,costumes:[{name:'星',assetId:starId,md5ext:starId+'.svg',dataFormat:'svg',rotationCenterX:30,rotationCenterY:30}],sounds:[],volume:100,layerOrder:layer,visible:false,x:-160,y:0,size:50,direction:90,draggable:false,rotationStyle:'all around'});
  project.targets.splice(1,0,project.targets.pop());
  project.extensions=[...new Set([...project.extensions,'kubohiroyaeditorguide'])];
  project.meta.agent='Plus Editor lessons / GitHub issue #724';
  files['project.json']=strToU8(JSON.stringify(project));return zipSync(files,{mtime:new Date(1980,0,1)});
}

async function main() {
  await createStory();
  const release = await readAppRelease();
  const pkg = JSON.parse(await readFile(path.join(packageRoot,'package.json'),'utf8'));
  assert.equal(pkg.version,release.version);
  const {buildDsl4RuntimeComponent,createDsl4ProductionSourceFrontend,dsl4CliDefaultLimits} =
    await import(pathToFileURL(path.join(packageRoot,'dist/builder/index.js')).href);
  const base = await readFile(appBasePath(release.version));
  assert.equal(base.length,release.artifact.size);
  assert.equal(hash(base),release.artifact.sha256);
  const schema = JSON.parse(await readFile(path.join(packageRoot,'schema/dsl-4.schema.json'),'utf8'));
  const script = course.id + '.k4.yml';
  const result = await buildDsl4RuntimeComponent({
    baseSb3Bytes: await actorBase(base),
    projectRoot: storyRoot,
    sourceManifest: {formatVersion:1,mode:'external',sourceId:script,path:script},
    sourceFrontend: createDsl4ProductionSourceFrontend(schema,{narrativeControlEnabled:true}),
    controlProfile:'production',channel:'bundled',...dsl4CliDefaultLimits,
    featureFlags:{dsl4Runtime:true,dsl4AppShell:true,dsl4BroadcastMessageAndWait:true,dsl4NarrativeControl:true,dsl4TurboWarpActionSurface:true},
    replaceExisting:true,embeddedSourceDocuments:true
  });
  const filename = course.id + '-4.0.sb3';
  await writeFile(path.join(output,filename),result.bytes);
  const artifact = {filename,bytes:result.bytes.length,sha256:hash(result.bytes)};
  const chapterTimes = course.units.map(u=>({
    unit:u.id,dialogueSeconds:timings[`${course.id}_${u.id}`].dialogueSeconds+timings[`${course.id}_${u.id}_yes`].dialogueSeconds
  }));
  await writeFile(path.join(output,'build-manifest.json'),JSON.stringify({
    formatVersion:1,title:course.title,issue:'kubohiroya/turbowarp-plus-editor#724',
    app:release,builder:{name:pkg.name,version:pkg.version},artifact,
    units:chapterTimes
  },null,2)+'\n');
  console.log(JSON.stringify(artifact,null,2));
}
main().catch(error=>{console.error(error);if(error.diagnostics)console.error(JSON.stringify(error.diagnostics,null,2));process.exitCode=1;});
