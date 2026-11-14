var HG_BASE="https://api5-normal-sinfonlineb.fqnovel.com";
var HG_UA="com.phoenix.read/73532 (Linux; U; Android 16; zh_CN; 25053RT47C; Build/BP2A.250605.031.A3; Cronet/TTNetVersion:04657795 2026-01-23 QuicVersion:c67e9834 2025-09-08)";
var HG_GENRES=[{id:"short_play",name:"真人剧",scene:"default"},{id:"comic_series",name:"漫剧",scene:"comic_series"},{id:"ai_series",name:"AI剧",scene:"ai_series"}];
function hexBytes(text){return text.match(/../g).map(function(item){return parseInt(item,16);});}
function hex(values){return values.map(function(value){return (value&255).toString(16).padStart(2,"0");}).join("");}
function reverseByte(value){var result=0;for(var bit=0;bit<8;bit++){result=(result<<1)|((value>>bit)&1);}return result;}
function hgSign(q,body,now){var timestamp=Math.floor(now/1000),payload=hexBytes(md5(q)).slice(0,4).concat(body?hexBytes(md5(body)).slice(0,4):[0,0,0,0],[0,0,0,0,0,6,11,28],[(timestamp>>>24)&255,(timestamp>>>16)&255,(timestamp>>>8)&255,timestamp&255]);var key=[68,185,185,217,164,174,249,252,164,147,170,117,124,163,194,196,164,150,147,143];for(var i=0;i<20;i++)payload[i]^=key[i];for(var j=0;j<20;j++)payload[j]=(reverseByte(((payload[j]<<4)|(payload[j]>>>4))&255 ^ payload[(j+1)%20])^255^20)&255;return {"X-Gorgon":"8404401c0000"+hex(payload),"X-Khronos":String(timestamp),"X-SS-Req-Ticket":String(now),"X-SS-STUB":body?md5(body).toUpperCase():""};}
function hgDeviceID(){var value="1";for(var i=0;i<15;i++)value+=String(Math.floor(Math.random()*10));return value;}
function* hgRequest(route,payload,extra,state,identity){
 var attempts=route.indexOf("video_model")>=0?2:3;
 for(var attempt=0;attempt<attempts;attempt++){
  var now=Date.now(),params={aid:"8662",app_name:"novelread",version_code:"73532",version_name:"7.3.5.32",manifest_version_code:"73532",update_version_code:"73532",channel:"update_64",device_platform:"android",os:"android",ssmix:"a",device_type:"25053RT47C",device_brand:"Redmi",language:"zh",os_api:"36",os_version:"16",resolution:"1280*2772",dpi:"520",ac:"wifi",device_id:(state.deviceId=state.deviceId||hgDeviceID()),iid:(state.installId=state.installId||hgDeviceID()),_rticket:String(now)};
  Object.assign(params,extra||{},identity||{});
  var q=query(params),body=payload?JSON.stringify(payload):null,signed=typeof hongguoSign==="function"?JSON.parse(hongguoSign(JSON.stringify(params),body||"",now)):{query:q,headers:hgSign(q,body,now)};
  var headers=Object.assign({"User-Agent":HG_UA,"Accept":"application/json","X-XS-From-Web":"0","Sdk-Version":"2","Content-Type":"application/json; charset=utf-8"},signed.headers);
  if(identity)headers["User-Agent"]="com.phoenix.read/71532 (Linux; U; Android 9; SM-N9860; Build/PQ3A.190705.10241111;tt-ok/3.12.13.20)";
  var text=yield* http((route.indexOf("video_model")>=0&&attempt?"https://api5-normal-hl.fqnovel.com":HG_BASE)+route+"?"+signed.query,{method:payload?"POST":"GET",body:body,headers:headers});
  if(!String(text||"").trim()){if(attempt+1<attempts)continue;throw new Error("Hongguo empty response");}
  var result=JSON.parse(text);
  if(result.status_code&&Number(result.status_code)!==0||result.code&&String(result.code)!=="0")throw new Error("Hongguo unavailable");
  return result.data||{};
 }
}
function hgDrama(raw,category){var outer=raw;raw=raw.video_data||raw;var id=String(first(raw,["series_id_str","series_id"],first(outer,["series_id_str","series_id","keyword"],"")));var schema=raw.category_schema;try{if(typeof schema==='string')schema=JSON.parse(schema);}catch(error){schema=[];}var tags=array(raw.tags).concat(array(raw.category_list),array(schema)).map(function(item){return typeof item==="string"?item:first(item,["name","category_name"],"");}).filter(Boolean);if(category&&tags.indexOf(category)<0)tags.push(category);return {id:"hongguo:"+id,source:"hongguo",sourceId:id,title:String(first(raw,["series_title","series_name","title"],id)),description:String(first(raw,["series_intro","video_desc"],"")),cover:String(first(raw,["series_cover","cover"],"")),episodes:Number(raw.episode_cnt)||0,category:String(first(raw,['category_name','categoryName','category'],tags[0]||category||'短剧')),tags:tags,heat:String(first(raw,["heat","hot_value","series_heat"],"")),views:String(first(raw,['series_play_cnt','play_cnt'],'')),onlineDate:String(first(raw,["publish_time","online_time"],"")),releaseStatus:String(raw.series_status)==='1'?'finished':String(raw.series_status)==='0'?'ongoing':''};}
function hgContentKey(value){var bytes=base64bytes(value);var tag=(bytes[0]^bytes[1]^bytes[2])-48,n=bytes.length-tag-1;if(tag<1||n<33)throw new Error("Invalid key");var seed=bytes[bytes.length-tag-2]^bytes[bytes.length-tag-1],label=bytes.slice(-tag).map(function(x){return String.fromCharCode(x^seed);}).join("");if(label==="app_v2"||label==="web_v2")throw new Error("Unsupported key");var even=250,odd=85,decoded=[];for(var i=0;i<n;i++){var current=bytes[i+1],previous=i%2?odd:even;if(i%2)odd=current;else even=current;var count=i.toString(2).replace(/0/g,"").length;decoded.push((previous^current)-21-count&255);}if(n-parseInt(String.fromCharCode(decoded[0]),36)-1!==32)throw new Error('Invalid padding');var key=decoded.slice(1,33).map(function(x){return String.fromCharCode(x);}).join("");if(!/^[0-9a-fA-F]{32}$/.test(key))throw new Error("Invalid key");return key;}

function hgFlatContentKey(value){
 var raw=base64bytes(value),n=Math.min(raw.length-(raw[0]^raw[1]^raw[2])+47,raw.length-1);
 if(raw.length<3||n<33)throw new Error("Invalid key");
 var even=246,odd=85,decoded=[];
 for(var i=0;i<n;i++){var old=raw[i+1],previous=i%2?odd:even;if(i%2)odd=old;else even=old;decoded.push((-21-i.toString(2).replace(/0/g,"").length+(previous^old))&255);}
 var key=decoded.slice(1,33).map(function(v){return String.fromCharCode(v);}).join("");
 if(!/^[a-f0-9]{32}$/i.test(key))throw new Error("Invalid key");return key;
}
function hgMediaAddress(value,seed){
 if(typeof value!=="string"||value.length>32768)return "";
 var address=value;
 if(!/^https:\/\//.test(address)){
  if(seed){if(typeof hongguoMediaURL!=="function")return "";address=hongguoMediaURL(address,seed);}
  else address=base64decode(address);
 }
 if(!/^https:\/\/[a-z0-9.-]+(?::443)?\//i.test(address)||/\/video\/public\//i.test(address))return "";
 return address;
}
function hgChoices(model){
 var list=model&&model.video_list,rows=Array.isArray(list)?list:Object.keys(list||{}).map(function(key){return list[key];}),choices=[],seen={};
 rows.forEach(function(row){
  if(!row||typeof row!=="object")return;
  var meta=row.video_meta||{},codec=String(row.codec_type||meta.codec_type||'').toLowerCase();
  if(codec&&!['h264','avc','avc1','avc3','hevc','h265','h265_hvc1','hvc1','hev1','bytevc1'].includes(codec)||/bytevc2|bvc2/i.test(String(row.gear_des_key||'')))return;
  var encryption=row.encrypt_info||{},key='',spade=encryption.spade_a||row.spade_a,encrypted=encryption.encrypt!==undefined?encryption.encrypt:row.encrypt;
  try{
   if(spade)key=encryption.spade_a?hgContentKey(spade):hgFlatContentKey(spade);
   else if(![false,0,'0','false'].includes(encrypted))return;
  }catch(error){return;}
  var width=Number(meta.vwidth||meta.width||row.vwidth||row.width),height=Number(meta.vheight||meta.height||row.vheight||row.height);
  var definition=String(meta.definition||row.definition||row.quality_desc||'').match(/\d+/);
  height=width>0&&height>0?Math.min(width,height):definition?Number(definition[0]):0;
  ['main_url','backup_url','backup_url_1','backup_url_2','backup_urls','backup_url_list','url_list'].forEach(function(field){
   var values=Array.isArray(row[field])?row[field]:[row[field]];
   values.forEach(function(value){try{var address=hgMediaAddress(value,model.key_seed),identity=address+':'+key;if(address&&!seen[identity]){seen[identity]=true;choices.push({url:address,height:height,key:key,headers:{'Referer':'https://novel.snssdk.com/'}});}}catch(error){}});
  });
 });
 return choices;
}
function hgModel(value){if(typeof value==='string')value=JSON.parse(value);if(!value||typeof value!=='object')throw new Error('Missing model');return value;}
function hgFallbackAddress(value){
 if(typeof value==='string'&&value.trim().startsWith('{'))value=JSON.parse(value);
 if(Array.isArray(value))value=value[0];else if(value&&typeof value==='object')value=value.fallback_api;
 if(typeof value!=='string'||value.length>32768||!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:fqnovel|snssdk)\.com(?::443)?\//i.test(value))throw new Error('Invalid fallback');
 return value;
}
function* hgModelChoices(model){
 var choices=hgChoices(model);if(choices.length)return choices;
 var address=hgFallbackAddress(model.fallback_api),data=yield* json(address,{headers:{'User-Agent':HG_UA}});
 if(Number(data.code||data.Code||0)!==0||Number(data.video_info&&(data.video_info.code||data.video_info.Code)||0)!==0)throw new Error('Fallback unavailable');
 var info=data.video_info&&data.video_info.data;
 if(!info||typeof model.video_id!=='string'||!model.video_id||info.video_id!==model.video_id)throw new Error('Wrong fallback video');
 var duration=Number(model.video_duration),actual=Number(info.video_duration);
 if(!(actual>0)||duration>0&&Math.abs(duration-actual)>0.5)throw new Error('Wrong fallback duration');
 return hgChoices(info);
}
function* hgRegister(){
 if(typeof hongguoRegisterRequest!=='function')throw new Error('Client update required');
 var request=JSON.parse(hongguoRegisterRequest(Date.now())),response=yield request;
 if(!response||response.status!==200){var error=new Error('Device registration unavailable');error.sourceError='http';error.httpStatus=response&&response.status||0;throw error;}
 var raw=String(response.text||'').replace(/("(?:device_id|install_id)"\s*:\s*)(\d+)(?=\s*[,}])/g,'$1"$2"'),data=JSON.parse(raw);
 var device=String(data.device_id_str||data.device_id||''),install=String(data.install_id_str||data.install_id||'');
 if(Number(data.code||data.Code||0)!==0||!/^\d{1,30}$/.test(device)||!/[1-9]/.test(device)||!/^\d{1,30}$/.test(install)||!/[1-9]/.test(install))throw new Error('Invalid registration');
 return {device_id:device,iid:install,cdid:request.cdid};
}
function* hgResolve(input,state){
 var episode=input.chapter||{},videoId=episode.videoId||String(episode.id||'').split(':').pop();
 if(!/^\d{1,30}$/.test(videoId))throw new Error('Invalid episode');
 var quality=Number(input.quality)||0;
 if(typeof hongguoRegisterRequest==='function'){
  try{
   var identity=yield* hgRegister();
   Object.assign(identity,{version_code:"71332",version_name:"7.1.3.32",manifest_version_code:"71332",update_version_code:"71332",host_abi:"arm64-v8a",dragon_device_type:"phone",pv_player:"71332",compliance_status:"0",need_personal_recommend:"1",player_so_load:"1",is_android_pad_screen:"0",ts:String(Math.floor(Date.now()/1000))});
   var modern=yield* hgRequest('/novel/player/multi_video_model/v1/',{mixed_video_id_map:{'1004':[videoId]},biz_param:{detail_page_version:0,device_level:3,disable_digg_stat:false,need_all_video_definition:true,need_mp4_align:false,use_os_player:false,use_server_dns:false,video_platform:1024}},null,state,identity);
   if(!Object.prototype.hasOwnProperty.call(modern,videoId))throw new Error('Wrong episode model');
   return select(yield* hgModelChoices(hgModel(modern[videoId].video_model)),quality);
  }catch(error){if(error.httpStatus===429)throw error;}
 }
 var data=yield* hgRequest('/novel/player/video_model/v1/',{video_id:videoId,content_type:1,biz_param:{need_all_video_definition:true,video_platform:3}},null,state);
 return select(yield* hgModelChoices(hgModel(data.video_model)),quality);
}

function* hgApp(action,input,state){var drama=input.drama||{},id=drama.sourceId||String(drama.id||"").split(":").pop();
 if(action==="categories")return {items:HG_GENRES.map(function(item){return {id:item.id,name:item.name};})};
 if(action==="catalog"||action==="check"){
  state.feeds=state.feeds||{};var genres=input.category?HG_GENRES.filter(function(item){return item.id===input.category;}):HG_GENRES;if(!genres.length)throw new Error('分类无效');var items=[],more=false;
  for(var g=0;g<genres.length;g++){var genre=genres[g],feed=state.feeds[genre.id]||{offset:0,session:''};if(input.page===1||action==='check')feed={offset:0,session:''};var payload={req_scene:genre.scene,offset:feed.offset||0,limit:18,req_type:"only_content",need_selector_panel:false,client_req_type:feed.offset?2:3,session_id:feed.session||"",filter_ids:"",select_items:{genre:[genre.id],sort:["online_time"],gender:[],category_dim_theme:[],category_dim_role:[],category_dim_epoch:[],online_time:[],creation_status:[]}};
  var data=yield* hgRequest("/reading/distribution/category/landpage/v/",payload,null,state);if(!Array.isArray(data.video_data))throw new Error('分类数据格式异常');var rows=data.video_data.map(function(row){return hgDrama(row,genre.name);}).filter(function(row){return /^\d+$/.test(row.sourceId)&&row.title;});if(data.has_more&&Number(data.next_offset)<=Number(feed.offset||0))throw new Error("Cursor did not advance");feed.offset=Number(data.next_offset||0);feed.session=data.session_id||"";state.feeds[genre.id]=feed;items=items.concat(rows);more=more||!!data.has_more;}return {items:items,count:items.length,hasMore:more};
 }
 if(action==="detail"||action==="metadata"){
  var cacheKey="detail:"+id,cached=hgCached(state,cacheKey,input.force);if(cached)return cached;
  var data=yield* hgRequest("/novel/player/video_detail/v1/",{series_id:id},null,state),row=data.video_data||{};if(String(row.series_id_str||row.series_id)!==id)throw new Error("Wrong series");var parsed=hgDrama(row,drama.category);var chapters=array(row.video_list).map(function(video){return {id:"hongguo:"+id+":"+video.vid,title:"第"+video.vid_index+"集",currentEpisode:Number(video.vid_index),videoId:String(video.vid)};}).sort(function(a,b){return a.currentEpisode-b.currentEpisode;});if(!chapters.length||chapters.length<Number(row.episode_cnt||0))throw new Error("Incomplete episodes");return hgRemember(state,cacheKey,{drama:parsed,chapters:chapters});
 }
 if(action==="resolve"){
  return yield* hgResolve(input,state);
 }
 return {error:"此站源版本尚不支持该操作"};
}
