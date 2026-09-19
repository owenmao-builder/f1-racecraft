"""Generate independent reference deltas by running the original TUM Python engine."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import random
import sys

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/generate-tum-fixtures.py /path/to/race-simulation')
root=Path(sys.argv[1]).expanduser().resolve()
sys.path.insert(0,str(root))
spec=importlib.util.spec_from_file_location('upstream',root/'racesim_basic/src/calc_racetimes_basic.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
rng=random.Random(32);cases=[]
compounds=['SOFT','MEDIUM','HARD']
for i in range(90):
    remaining=rng.randint(3,78);compound=rng.choice(compounds);age=rng.randint(0,40)
    tyres={c:{'offset':round(rng.uniform(0,2),2),'rate':round(rng.uniform(.01,.3),3)} for c in compounds}
    settings={'tyres':tyres,'pitLoss':round(rng.uniform(5,40),1),'warmup':round(rng.uniform(0,3),1),'twoCompounds':False}
    kwargs=dict(t_base=90,tot_no_laps=remaining,t_lap_sens_mass=.03,t_pitdrive_inlap=2,
      t_pitdrive_outlap=settings['pitLoss']-2,t_pit_tirechange=0,pits_aft_finishline=True,
      tire_pars={'tire_deg_model':'lin','t_add_coldtires':settings['warmup'],**{c:{'k_0':p['offset'],'k_1_lin':p['rate']} for c,p in tyres.items()}},
      p_grid=1,t_loss_pergridpos=1,t_loss_firstlap=2.5,drivetype='combustion',m_fuel_init=50,b_fuel_perlap=.5,t_pit_refuel_perkg=None,t_pit_charge_perkwh=None)
    start=[0,compound,age,0.0]
    stops=[{'after':n,'compound':rng.choice(compounds)} for n in sorted(rng.sample(range(1,remaining),i%3))]
    with contextlib.redirect_stdout(io.StringIO()):
        baseline=module.calc_racetimes_basic(**kwargs,strategy=[start])[0][-1]
        simulated=module.calc_racetimes_basic(**kwargs,strategy=[start]+[[p['after'],p['compound'],0,0.] for p in stops])[0][-1]
    cases.append({'context':{'remaining':remaining,'compound':compound,'age':age,'used':[compound]},'settings':settings,'stops':stops,'expectedDelta':float(simulated-baseline)})
out=Path(__file__).with_name('tum-parity.json');out.write_text(json.dumps(cases,indent=2));print(f'{len(cases)} original-engine cases written to {out}')
