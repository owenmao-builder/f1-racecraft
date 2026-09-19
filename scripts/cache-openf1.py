from pathlib import Path
import urllib.request,urllib.parse,json,time,datetime,concurrent.futures
out=Path(__file__).resolve().parents[1]/'dist'/'data';out.mkdir(exist_ok=True)
races=[('spain','2026-09-13'),('italy','2026-09-06'),('netherlands','2026-08-23'),('hungary','2026-07-26'),('belgium','2026-07-19'),('great-britain','2026-07-05'),('austria','2026-06-28'),('barcelona-catalunya','2026-06-14'),('monaco','2026-06-07'),('canada','2026-05-24')]
base='https://api.openf1.org/v1/'
def get(endpoint,query):
 url=base+endpoint+'?'+urllib.parse.urlencode(query)
 for attempt in range(4):
  try:
   with urllib.request.urlopen(url,timeout=50) as r:return json.load(r),url
  except Exception:
   if attempt==3:raise
   time.sleep(2*(attempt+1))
def stamp(t):return datetime.datetime.fromisoformat(t.replace('Z','+00:00')).timestamp()
sessions,_=get('sessions',{'year':2026,'session_name':'Race'})
def build(item):
 id,date=item
 if (out/(id+'.json')).exists():return
 matches=[s for s in sessions if s['date_start'][:10]==date and not s.get('is_cancelled')]
 if len(matches)!=1:raise Exception('Session match '+id)
 session=matches[0];key=session['session_key'];zero=stamp(session['date_start']);data={};sources=[]
 for endpoint in ['drivers','laps','stints','intervals','position','race_control','session_result']:
  data[endpoint],url=get(endpoint,{'session_key':key});sources.append({'endpoint':endpoint,'url':url,'records':len(data[endpoint])});time.sleep(1)
 def ts(t):return round(stamp(t)-zero,3) if t else None
 value={'schema':1,'session':session,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':sources,
 'results':[{k:d.get(k) for k in ['driver_number','dnf','dns','dsq','number_of_laps','position']} for d in data['session_result']],
 'drivers':[{k:d.get(k) for k in ['driver_number','name_acronym','full_name','team_name']} for d in data['drivers']],
 'laps':[[d.get(k) if k!='date_start' else ts(d.get(k)) for k in ['driver_number','lap_number','date_start','lap_duration','is_pit_out_lap','duration_sector_1','duration_sector_2','duration_sector_3']] for d in data['laps']],
 'stints':[[d.get(k) for k in ['driver_number','lap_start','lap_end','compound','tyre_age_at_start']] for d in data['stints']],
 'intervals':[[ts(d['date']),d.get('driver_number'),d.get('gap_to_leader'),d.get('interval')] for d in data['intervals']],
 'positions':[[ts(d['date']),d.get('driver_number'),d.get('position')] for d in data['position']],
 'control':[[ts(d['date']),d.get('lap_number'),d.get('flag'),d.get('scope'),d.get('sector'),d.get('message')] for d in data['race_control']]}
 for field in ['intervals','positions','control']:value[field].sort(key=lambda x:x[0])
 value['laps'].sort(key=lambda x:(x[0],x[1]));(out/(id+'.json')).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')))
 print(json.dumps({'race':id,'session':key,'bytes':(out/(id+'.json')).stat().st_size,'records':{x['endpoint']:x['records'] for x in sources}}),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
 for _ in pool.map(build,races):pass
