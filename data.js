/* ==========================================================================
   Commissioning App — question bank (Europac coal-fired, v1)
   --------------------------------------------------------------------------
   Pure data. The app engine renders everything from these structures, so
   adding a section or an item means editing this file only.

   Sources:
     F27  PB-CON-4.12.PR01-F27  Pre-commissioning checklist – Europac coal fired
     F63  PB-CON-4.12.PR01-F63  Commissioning report – Europac (Rev 7)
     F40  PB-CON-4.12.PR01-F40  Final snaglist
     F69  PB-CON-4.12.PR01-F69  Taking over certificate
     WEG  "VSD SETUP CFW11_CFW500" + F63 VSD pages (corrected, see CHANGELOG)
     TD102 PB-ENG-4.16.TD102 Yaskawa GA500 & GA700 parameters (06 Apr 2023)
   ========================================================================== */

/* ---------- Plant builder ------------------------------------------------
   type: 'count'  -> stepper (min..max)
         'choice' -> single select, `library` key lets the user add options (+)
         'multi'  -> multi select,  `library` key lets the user add options (+)
         'toggle' -> yes / no
   `show(plant)` hides a question that does not apply.                       */
const PLANT_QUESTIONS = [
  { group: 'Boilers', items: [
    { id: 'boilers', label: 'Number of boilers', type: 'count', min: 1, max: 6, def: 1 },
    { id: 'fuel', label: 'Fuel / firing', type: 'choice', library: 'fuel',
      options: ['Coal – chain grate stoker'], def: 'Coal – chain grate stoker' },
  ]},
  { group: 'Stoker & combustion air', items: [
    { id: 'stokers', label: 'Stokers per boiler', type: 'choice', options: ['LHS + RHS', 'LHS only'], def: 'LHS + RHS' },
    { id: 'fdFans', label: 'FD fans per boiler', type: 'choice', options: ['LHS + RHS', 'LHS only', 'None'], def: 'LHS + RHS' },
    { id: 'ofaFans', label: 'Overfire air fans per boiler', type: 'choice', options: ['LHS + RHS', 'LHS only', 'None'], def: 'LHS + RHS' },
    { id: 'fsaFan', label: 'FSA fan', type: 'toggle', def: false },
    { id: 'ssaFan', label: 'SSA fan', type: 'toggle', def: false },
  ]},
  { group: 'Drives', items: [
    { id: 'vsdMake', label: 'VSD make on this plant', type: 'choice', library: 'vsdMake',
      options: ['Yaskawa (GA700 / GA500)', 'WEG (CFW11 / CFW500)'], def: 'Yaskawa (GA700 / GA500)',
      hint: 'Sets the default drive for every motor. Each drive can still be changed on its VSD card.' },
  ]},
  { group: 'Water side', items: [
    { id: 'feedPumps', label: 'Feed pumps per boiler', type: 'count', min: 1, max: 3, def: 2 },
    { id: 'feedPumpSize', label: 'Feed pump motor size', type: 'choice', options: ['≤ 15 kW', '> 15 kW'], def: '≤ 15 kW' },
    { id: 'transferPumps', label: 'Transfer pumps', type: 'count', min: 0, max: 3, def: 0 },
    { id: 'transferPumpSize', label: 'Transfer pump motor size', type: 'choice', options: ['≤ 15 kW', '> 15 kW'], def: '≤ 15 kW',
      show: p => p.transferPumps > 0 },
    { id: 'waterLevel', label: 'Water level control', type: 'choice', library: 'waterLevel',
      options: ['Spirax Sarco LP21'], def: 'Spirax Sarco LP21' },
    { id: 'tds', label: 'TDS control', type: 'choice', library: 'tds',
      options: ['None', 'Spirax Sarco (LP boiler)', 'Yokogawa (HP boiler)'], def: 'Spirax Sarco (LP boiler)' },
  ]},
  { group: 'Instruments', items: [
    { id: 'o2', label: 'Oxygen analyser', type: 'choice', library: 'o2',
      options: ['None', 'Lamtec LT2', 'Techno Control'], def: 'Lamtec LT2' },
    { id: 'steamFlow', label: 'Steam flow transmitter', type: 'toggle', def: true },
  ]},
  { group: 'Sootblowers', items: [
    { id: 'sootblowers', label: 'Sootblowers', type: 'choice', options: ['None', 'Manual', 'Automatic'], def: 'Automatic' },
    { id: 'sootblowerQty', label: 'Number of sootblowers', type: 'count', min: 1, max: 3, def: 3,
      show: p => p.sootblowers !== 'None' },
  ]},
  { group: 'Coal handling', items: [
    { id: 'swingingChutes', label: 'Swinging chutes', type: 'toggle', def: true },
    { id: 'inclinedScrews', label: 'Inclined coal screws', type: 'count', min: 0, max: 4, def: 1 },
    { id: 'horizontalScrews', label: 'Horizontal coal screws', type: 'count', min: 0, max: 4, def: 0 },
  ]},
  { group: 'Ash & grit', items: [
    { id: 'ash', label: 'Ash handling', type: 'multi', library: 'ash',
      options: ['Submerged belt conveyor', 'Dry belt conveyor', 'Ash trolley with shut-off door'],
      def: ['Submerged belt conveyor'] },
    { id: 'gritCollector', label: 'Grit collector', type: 'toggle', def: true },
    { id: 'gritSluicing', label: 'Grit sluicing', type: 'toggle', def: false },
  ]},
  { group: 'Flue gas', items: [
    { id: 'stack', label: 'Chimney stack', type: 'choice', library: 'stack',
      options: ['Self-supporting', 'Guyed'], def: 'Self-supporting' },
  ]},
];

/* ---------- Helpers used by the section/motor rules ---------------------- */
const sides = v => v === 'LHS + RHS' ? ['LHS', 'RHS'] : v === 'LHS only' ? ['LHS'] : [];
const range = n => Array.from({ length: Math.max(0, n || 0) }, (_, i) => i + 1);
const hasAsh = (p, s) => (p.ash || []).includes(s);

/* ---------- Commissioning sections (F63 order) ---------------------------
   Every section is listed so the dashboard shows the full shape of the job.
   `when(plant)` decides if the section applies. `items` empty = not built yet
   (shown greyed "next build").                                             */
const SECTIONS = [
  { key: 'safety',   no: '01', short: 'Safety',     title: 'Safety devices & interlocks', items: [] },
  { key: 'boiler',   no: '02', short: 'Boiler',     title: 'Boiler & mountings',  items: [] },
  { key: 'stoker',   no: '03', short: 'Stoker',     title: 'Stoker',              items: [] },
  { key: 'coal',     no: '04', short: 'Coal',       title: 'Swinging chute / coal conveyor',
    when: p => p.swingingChutes || p.inclinedScrews > 0 || p.horizontalScrews > 0, items: [] },
  { key: 'instr',    no: '05', short: 'Instr',      title: 'Instrumentation',     items: [] },
  { key: 'level',    no: '06', short: 'WaterLevel', title: 'Water level control', items: [] },
  { key: 'llwl',     no: '07', short: 'ExtraLowWL', title: 'Extra low water level', items: [] },
  { key: 'tds',      no: '08', short: 'TDS',        title: 'TDS control', when: p => p.tds !== 'None', items: [] },
  { key: 'o2',       no: '09', short: 'O2',         title: 'Oxygen analyser', when: p => p.o2 !== 'None', items: [] },
  { key: 'sootblow', no: '10', short: 'Sootblow',   title: 'Sootblowers', when: p => p.sootblowers !== 'None', items: [] },
  { key: 'ashconv',  no: '11', short: 'AshConv',    title: 'Ash conveyor',
    when: p => hasAsh(p, 'Submerged belt conveyor') || hasAsh(p, 'Dry belt conveyor'), items: [] },
  { key: 'ashtrol',  no: '12', short: 'AshTrolley', title: 'Ash trolleys & shut-off door',
    when: p => hasAsh(p, 'Ash trolley with shut-off door'), items: [] },
  { key: 'gritsl',   no: '13', short: 'GritSluice', title: 'Grit sluicing', when: p => p.gritSluicing, items: [] },
  { key: 'idfan',    no: '14', short: 'IDFan',      title: 'ID fan', motor: 'idfan',
    items: [
      { g: 'Mechanical' },
      { id: 'frame',     t: 'Frame level' },
      { id: 'grout',     t: 'Grouting complete' },
      { id: 'pulley',    t: 'Pulleys aligned' },
      { id: 'belts',     t: 'Belts tensioned' },
      { id: 'guards',    t: 'Guards fitted' },
      { id: 'debris',    t: 'Fan free of debris' },
      { id: 'hatch',     t: 'Inspection hatch securely closed' },
      { id: 'bearings',  t: 'Bearings greased' },
      { id: 'inlet',     t: 'Inlet collar correctly fitted' },
      { id: 'outlet',    t: 'Outlet collar correctly fitted' },
      { id: 'bdamper',   t: 'Banking damper fitted' },
      { id: 'bdlimit',   t: 'Banking damper limit switch fitted (BM65)' },
      { g: 'Electrical' },
      { id: 'cable',     t: 'Power cable glanded & terminated', set: 'Star/delta per motor nameplate' },
      { id: 'bond',      t: 'ID fan housing bonded across inlet & outlet flexible collars' },
      { id: 'estopinst', t: 'E-stop installed and terminated', set: 'Within 2 m of drive' },
      { id: 'megger',    t: 'Motor and cable meggered (insulation & earth)' },
      { id: 'rotation',  t: 'Direction of rotation correct' },
      { g: 'Emergency stop test' },
      { id: 'estop',     t: 'E-stop functional', set: 'VSD must stop completely' },
      { id: 'estopplc',  t: 'PLC program correct' },
      { g: 'Steam pressure control' },
      { id: 'startstop', t: 'ID fan stop / start functional' },
      { id: 'locrem',    t: 'Local / remote control functional' },
      { id: 'automan',   t: 'Auto / manual control functional' },
      { id: 'bumpless',  t: 'Bumpless transfer auto to manual' },
      { id: 'hold',      t: 'ID hold on decrease if furnace is pressurised in auto + advice note' },
      { id: 'bdstart',   t: 'Banking damper prevents start-up of ID fan' },
      { id: 'minmax',    t: 'ID fan min / max speeds set', input: true },
      { id: 'estopall',  t: 'E-stop stops all drives' },
      { g: 'Interlocks' },
      { id: 'ilhp',      t: 'ID fan switches off on high steam pressure' },
      { id: 'illw',      t: 'ID fan switches off on extra low water level' },
      { id: 'ileg',      t: 'ID fan switches off on high exit gas temperature' },
      { id: 'ilestop',   t: 'ID fan switches off on panel emergency stop' },
      { g: 'Alarms' },
      { id: 'alinv',     t: 'ID fan inverter trip alarm' },
      { id: 'alman',     t: 'ID fan switched to manual alarm' },
      { id: 'albd',      t: 'Banking damper not fully open alarm' },
    ] },
  { key: 'fdfan',    no: '15', short: 'FDFan',      title: 'FD fans', when: p => p.fdFans !== 'None', items: [] },
  { key: 'ofafan',   no: '16', short: 'OFAFan',     title: 'Overfire air fans', when: p => p.ofaFans !== 'None', items: [] },
  { key: 'feedpump', no: '17', short: 'FeedPump',   title: 'Feed pumps', items: [] },
  { key: 'grit',     no: '18', short: 'GritColl',   title: 'Grit collector', when: p => p.gritCollector, items: [] },
  { key: 'stack',    no: '19', short: 'Stack',      title: 'Chimney stack & ducting', items: [] },
  { key: 'elec',     no: '20', short: 'Elec',       title: 'Electrical & earthing', items: [] },
  { key: 'water',    no: '21', short: 'WaterTreat', title: 'Water softener / feedwater tank / chemical dosing', items: [] },
  { key: 'plchw',    no: '22', short: 'PLCHW',      title: 'PLC hardware / touch screen', items: [] },
  { key: 'plcops',   no: '23', short: 'PLCOps',     title: 'PLC program / operational checks', items: [] },
];

/* ---------- Motors -------------------------------------------------------
   Built from the plant answers. `drive` = which VSD family applies (null = DOL).
   `ydef`/`wdef` = default Yaskawa / WEG parameter set for that motor.       */
function motorsFor(p) {
  const m = [];
  const big = s => s === '> 15 kW';
  m.push({ id: 'idfan', name: 'ID fan', drive: true, ydef: 'GA700_ID', wdef: 'CFW11_ID' });
  sides(p.fdFans).forEach(s => m.push({ id: 'fd' + s, name: 'FD fan ' + s, drive: true, ydef: 'GA500_FD', wdef: 'CFW500_FAN' }));
  sides(p.ofaFans).forEach(s => m.push({ id: 'ofa' + s, name: 'Overfire air fan ' + s, drive: true, ydef: 'GA500_FD', wdef: 'CFW500_OFA' }));
  if (p.fsaFan) m.push({ id: 'fsa', name: 'FSA fan', drive: true, ydef: 'GA500_FSA', wdef: 'CFW500_FAN' });
  if (p.ssaFan) m.push({ id: 'ssa', name: 'SSA fan', drive: true, ydef: 'GA500_SSA', wdef: 'CFW500_FAN' });
  sides(p.stokers).forEach(s => m.push({ id: 'stoker' + s, name: 'Stoker drive ' + s, drive: true, ydef: 'GA500_STOKER', wdef: 'CFW500_STOKER',
    typical: { mfr: 'Bonfiglioli', kw: '0.37', rpm: '1375', a: '1.32', pf: '0.77', eff: '68' } }));
  range(p.feedPumps).forEach(n => m.push({ id: 'fp' + n, name: 'Feed pump no. ' + n, drive: true, ydef: 'GA500_PUMP',
    wdef: big(p.feedPumpSize) ? 'CFW11_PUMP' : 'CFW500_PUMP', typical: { mfr: 'Grundfos', rpm: '2900' } }));
  range(p.transferPumps).forEach(n => m.push({ id: 'tp' + n, name: 'Transfer pump no. ' + n, drive: true, ydef: 'GA500_PUMP',
    wdef: big(p.transferPumpSize) ? 'CFW11_PUMP' : 'CFW500_PUMP' }));
  range(p.inclinedScrews).forEach(n => m.push({ id: 'isc' + n, name: 'Inclined coal screw ' + n, drive: true, ydef: 'GA500_SCREW', wdef: 'CFW500_SCREW',
    typical: { mfr: 'Bonfiglioli', kw: '4', rpm: '1440' } }));
  range(p.horizontalScrews).forEach(n => m.push({ id: 'hsc' + n, name: 'Horizontal coal screw ' + n, drive: true, ydef: 'GA500_SCREW', wdef: 'CFW500_SCREW',
    typical: { mfr: 'Bonfiglioli', kw: '4', rpm: '1440' } }));
  if (p.swingingChutes) sides(p.stokers).forEach(s => m.push({ id: 'chute' + s, name: 'Swinging chute motor ' + s, drive: false,
    typical: { mfr: 'Bonfiglioli', kw: '0.25', rpm: '1440', a: '1.35', conn: 'Star' } }));
  if (p.gritCollector) m.push({ id: 'gritflap', name: 'Grit collector double flap valve motor', drive: false,
    typical: { mfr: 'Bonfiglioli', kw: '0.12', rpm: '1440', a: '0.47', conn: 'Star' } });
  if (p.sootblowers === 'Automatic') range(p.sootblowerQty).forEach(n => m.push({ id: 'sb' + n, name: 'Sootblower motor no. ' + n, drive: false,
    typical: { mfr: 'Bonfiglioli', kw: '0.25', rpm: '1440', a: '0.78', conn: 'Star' } }));
  if (hasAsh(p, 'Submerged belt conveyor')) m.push({ id: 'ashsub', name: 'Ash conveyor – submerged belt', drive: false,
    typical: { mfr: 'Bonfiglioli', kw: '0.37', rpm: '1440', a: '1.05', conn: 'Star' } });
  if (hasAsh(p, 'Dry belt conveyor')) m.push({ id: 'ashdry', name: 'Ash conveyor – dry / inclined belt', drive: false,
    typical: { mfr: 'Bonfiglioli', kw: '0.55', rpm: '1440', a: '1.3', conn: 'Star' } });
  return m;
}

/* Nameplate fields captured per motor (F63 "Electric motor data" + VSD inputs). */
const NAMEPLATE_FIELDS = [
  { k: 'mfr',  t: 'Manufacturer' },
  { k: 'model',t: 'Model / frame' },
  { k: 'serial', t: 'Serial no.' },
  { k: 'kw',   t: 'Rated power', u: 'kW', num: true },
  { k: 'v',    t: 'Rated voltage', u: 'V', num: true },
  { k: 'a',    t: 'Rated current', u: 'A', num: true },
  { k: 'rpm',  t: 'Rated speed', u: 'rpm', num: true },
  { k: 'hz',   t: 'Frequency', u: 'Hz', num: true, def: '50' },
  { k: 'pf',   t: 'Power factor', u: 'cos φ', num: true },
  { k: 'eff',  t: 'Efficiency', u: '%', num: true },
  { k: 'conn', t: 'Connection', opts: ['Star', 'Delta'] },
  { k: 'fla',  t: 'Measured full-load current', u: 'A', num: true, measured: true },
];

/* ---------- VSD parameter sets -------------------------------------------
   v   = expected value (string, shown as-is)
   np  = filled from the motor nameplate (key from NAMEPLATE_FIELDS, or 'poles')
   site = established on site during commissioning (F63 "**")
   fix = note about a correction made to the source document               */
const YA_BASE = [
  { p: 'A1-01', n: 'Access level selection', v: '3', i: 'Expert level' },
  { p: 'A1-02', n: 'Control method selection', v: '0', i: 'V/f control' },
  { p: 'A1-03', n: 'Initialize parameters', v: '0', i: 'No initialization' },
  { p: 'b1-01', n: 'Frequency reference selection 1', v: '1', i: 'Analog input' },
  { p: 'b1-02', n: 'Run command selection 1', v: '1', i: 'Digital input' },
  { p: 'b1-03', n: 'Stopping method selection', v: '0', i: 'Ramp to stop' },
  { p: 'b1-04', n: 'Reverse operation selection', v: '1', i: 'Reverse disabled' },
  { p: 'b1-07', n: 'LOCAL/REMOTE run selection', v: '0', i: 'Disregard existing RUN command' },
  { p: 'b1-08', n: 'Run command select in PRG mode', v: '0', i: 'Disregard RUN while programming' },
  { p: 'b1-14', n: 'Phase order selection', v: '0', i: 'Standard' },
  { p: 'C1-01', n: 'Acceleration time 1', v: '25.0', u: 's' },
  { p: 'C1-02', n: 'Deceleration time 1', v: '25.0', u: 's' },
  { p: 'C6-01', n: 'Normal / heavy duty selection', v: '1', i: 'Normal duty rating' },
  { p: 'd2-01', n: 'Frequency reference upper limit', v: '100.00', u: '%' },
  { p: 'd2-02', n: 'Frequency reference lower limit', v: '0.00', u: '%' },
  { p: 'E1-03', n: 'V/f pattern selection', v: '4', i: 'VT, 50 Hz, 65% Vmid reduction' },
  { p: 'E2-01', n: 'Motor rated current (FLA)', np: 'a', u: 'A' },
  { p: 'E2-04', n: 'Motor pole count', np: 'poles' },
  { p: 'E2-11', n: 'Motor rated power', np: 'kw', u: 'kW' },
  { p: 'H1-01', n: 'Terminal S1 function selection', v: '40', i: 'Forward RUN (2-wire)' },
  { p: 'H2-01', n: 'Term MA,MB,MC function selection', v: '000E', i: 'Fault' },
  { p: 'H2-02', n: 'Term P1 function selection', v: '0', i: 'During run' },
  { p: 'H3-09', n: 'Terminal A2 signal level select', v: '2', i: '4 to 20 mA' },
  { p: 'H3-10', n: 'Terminal A2 function selection', v: '0', i: 'Frequency reference' },
  { p: 'H4-01', n: 'Terminal AM analog output select', v: '102', i: 'Output frequency' },
  { p: 'H4-07', n: 'Terminal AM signal level select', v: '2', i: '4 to 20 mA' },
  { p: 'o1-01', n: 'User monitor selection', v: '106', i: 'Output voltage ref' },
  { p: 'o1-02', n: 'Monitor selection at power-up', v: '1', i: 'Output frequency reference (U1-02)' },
  { p: 'o2-01', n: 'LO/RE key function selection', v: '0', i: 'Disabled' },
  { p: 'o2-02', n: 'STOP key function selection', v: '1', i: 'Enabled' },
];
// Override / extend a base list by parameter number. `null` removes a row.
function withParams(base, changes, extra) {
  const out = base.map(r => Object.assign({}, r));
  Object.keys(changes || {}).forEach(k => {
    const ix = out.findIndex(r => r.p === k);
    if (changes[k] === null) { if (ix >= 0) out.splice(ix, 1); return; }
    if (ix >= 0) out[ix] = Object.assign({}, out[ix], changes[k]);
  });
  (extra || []).forEach(e => {
    const after = out.findIndex(r => r.p === e.after);
    const row = Object.assign({}, e); delete row.after;
    out.splice(after >= 0 ? after + 1 : out.length, 0, row);
  });
  return out;
}
const YA_VECTOR = {  // stoker & coal screw: open loop vector, reverse enabled, torque output
  'A1-02': { v: '2', i: 'Open loop vector' },
  'b1-04': { v: '0', i: 'Reverse enabled' },
  'C1-01': { v: '20.0' }, 'C1-02': { v: '20.0' },
  'C6-01': { v: '0', i: 'Heavy duty' },
  'd2-02': { v: '10.00' },
  'E1-03': { v: '0F', i: 'Custom' },
  'H4-01': { v: '109', i: 'Torque reference' },
  'o1-01': { v: '109', i: 'Torque reference' },
  'o1-02': { v: '4', i: 'Output current (U1-03)' },
};
const YA_VECTOR_EXTRA = [
  { after: 'C1-02', p: 'C4-01', n: 'Torque compensation gain', v: '0.5' },
  { after: 'H1-01', p: 'H1-02', n: 'Terminal S2 function selection', v: '41', i: 'Reverse RUN (2-wire)' },
];

const W_NP = { // WEG nameplate rows
  P399: { p: 'P399', n: 'Motor rated efficiency', np: 'eff', u: '%' },
  P400: { p: 'P400', n: 'Motor rated voltage', np: 'v', u: 'V' },
  P401: { p: 'P401', n: 'Motor rated current', np: 'a', u: 'A' },
  P402: { p: 'P402', n: 'Motor rated speed', np: 'rpm', u: 'rpm' },
  P403: { p: 'P403', n: 'Motor rated frequency', np: 'hz', u: 'Hz' },
  P404: { p: 'P404', n: 'Motor rated power', np: 'kw', u: 'kW', i: 'Select the matching code in the drive list' },
  P407: { p: 'P407', n: 'Motor rated power factor', np: 'pf', u: 'cos φ' },
};
const CFW11 = (accel, decel, minSpd, faultRelay) => [
  { p: 'P204', n: 'Load factory settings', v: '6', i: 'Load 50 Hz' },
  { p: 'P100', n: 'Acceleration time', v: accel, u: 's', fix: 'Unit corrected from rpm to s (F63 Rev 7)' },
  { p: 'P101', n: 'Deceleration time', v: decel, u: 's', fix: 'Unit corrected from rpm to s (F63 Rev 7)' },
  { p: 'P133', n: 'Minimum speed', v: minSpd, u: 'rpm' },
  { p: 'P134', n: 'Maximum speed', v: '1500', u: 'rpm' },
  { p: 'P201', n: 'Language', v: '1', i: 'English' },
  { p: 'P220', n: 'Local / remote selection', v: '1', i: 'Remote' },
  { p: 'P231', n: 'AI1 signal function', v: '0', i: 'Speed reference' },
  { p: 'P233', n: 'AI1 signal type', v: '1', i: '4–20 mA' },
  { p: 'P251', n: 'AO1 function', v: '0', i: 'Speed' },
  { p: 'P252', n: 'AO1 gain', site: true, i: 'Ratio' },
  { p: 'P253', n: 'AO1 signal type', v: '1', i: '4–20 mA' },
  { p: 'P275', n: 'Relay RL1 function', v: '11', i: 'Run' },
  { p: faultRelay, n: faultRelay === 'P276' ? 'Relay RL2 function' : 'Relay RL3 function', v: '26', i: 'Fault' },
  { p: 'P296', n: 'Line rated voltage', site: true, i: '1 = 380 V · 2 = 400–415 V · 5 = 500–525 V' },
  W_NP.P399, W_NP.P400, W_NP.P401, W_NP.P402, W_NP.P403, W_NP.P404,
  { p: 'P406', n: 'Motor ventilation', v: '0', i: 'Self ventilated' },
  W_NP.P407,
  { p: 'P320', n: 'Ride through', v: '3', i: 'Ride through' },
];
const CFW500_BASE = [
  { p: 'P100', n: 'Acceleration time', v: '20', u: 's' },
  { p: 'P101', n: 'Deceleration time', v: '20', u: 's' },
  { p: 'P133', n: 'Minimum frequency', v: '0', u: 'Hz' },
  { p: 'P134', n: 'Maximum frequency', v: '50', u: 'Hz' },
  { p: 'P220', n: 'Local / remote source', v: '1', i: 'Remote' },
  { p: 'P233', n: 'AI1 signal type', v: '1', i: '4–20 mA' },
  { p: 'P252', n: 'AO1 gain', site: true, i: 'Ratio' },
  { p: 'P263', n: 'DI1 function', v: '4', i: 'Forward run' },
  { p: 'P264', n: 'DI2 function', v: '5', i: 'Reverse run' },
  { p: 'P275', n: 'DO1 function', v: '11', i: 'Run' },
  { p: 'P276', n: 'DO2 function', v: '26', i: 'Running' },
  W_NP.P401, W_NP.P407,
];
const CFW500_VECTOR = (keypadRef) => [
  { p: 'P100', n: 'Acceleration time', v: '20', u: 's' },
  { p: 'P101', n: 'Deceleration time', v: '20', u: 's', fix: 'Label corrected from "Acceleration" (F63 Rev 7)' },
  { p: 'P133', n: 'Minimum frequency', v: '0', u: 'Hz' },
  { p: 'P134', n: 'Maximum frequency', v: '50', u: 'Hz' },
  { p: 'P220', n: 'Local / remote source', v: '1', i: 'Remote' },
].concat(keypadRef ? [{ p: 'P222', n: 'Remote reference selection', v: '0', i: 'HMI keypad' }] : []).concat([
  { p: 'P231', n: 'AI1 signal function', v: '0', i: 'Speed reference' },
  { p: 'P233', n: 'AI1 signal type', v: '1', i: '4–20 mA' },
  { p: 'P251', n: 'AO1 function', v: '11', i: 'Motor torque' },
  { p: 'P253', n: 'AO1 signal type', v: '2', i: '4–20 mA', fix: 'Set to 2 = 4–20 mA (CFW500: 1 = 0–20 mA, never used)' },
  { p: 'P263', n: 'DI1 function', v: '4', i: 'Forward run' },
  { p: 'P264', n: 'DI2 function', v: '5', i: 'Reverse run' },
  { p: 'P275', n: 'DO1 function', v: '11', i: 'Run' },
  { p: 'P276', n: 'DO2 function', v: '26', i: 'Fault' },
  { p: 'P202', n: 'Control mode', v: '5', i: 'Vector control' },
  W_NP.P399, W_NP.P401, W_NP.P402, W_NP.P403, W_NP.P404, W_NP.P407,
  { p: 'P408', n: 'Auto-tune', v: '1', i: 'Run auto-tune' },
]);

const VSD_SETS = {
  GA700_ID:     { make: 'Yaskawa', model: 'GA700', label: 'ID fan (TD102 table 1)',
    params: withParams(YA_BASE, { 'C1-01': { v: '120.0' }, 'C1-02': { v: '270.0' }, 'd2-02': { v: '20.00' },
      'H2-01': { p: 'H2-01', n: 'Term M1-M2 function selection', v: '0', i: 'During run' }, 'H2-02': null,
      'H4-01': { n: 'Terminal FM analog output select' }, 'H4-07': { n: 'Terminal FM signal level select' },
      'o1-02': { i: 'Frequency reference (U1-01)' } }) },
  GA500_FD:     { make: 'Yaskawa', model: 'GA500', label: 'FD fan (TD102 table 3)',
    params: withParams(YA_BASE, { 'C1-01': { v: '30.0' }, 'C1-02': { v: '25.0' } }) },
  GA500_FSA:    { make: 'Yaskawa', model: 'GA500', label: 'FSA fan (TD102 table 4)',
    params: withParams(YA_BASE, { 'H4-01': null, 'H4-07': null }) },
  GA500_SSA:    { make: 'Yaskawa', model: 'GA500', label: 'SSA fan (TD102 table 5)',
    params: withParams(YA_BASE, { 'H4-01': null, 'H4-07': null }) },
  GA500_PUMP:   { make: 'Yaskawa', model: 'GA500', label: 'Feed / transfer pump (TD102 table 7)',
    params: withParams(YA_BASE, {}) },
  GA500_STOKER: { make: 'Yaskawa', model: 'GA500', label: 'Stoker (TD102 table 8)', autotune: true,
    params: withParams(YA_BASE, YA_VECTOR, YA_VECTOR_EXTRA) },
  GA500_SCREW:  { make: 'Yaskawa', model: 'GA500', label: 'Coal screw (TD102 table 9)', autotune: true,
    params: withParams(YA_BASE, Object.assign({}, YA_VECTOR, { 'b1-01': { v: '0', i: 'Keypad' }, 'C1-01': { v: '25.0' }, 'C1-02': { v: '25.0' } }),
      [{ after: 'C1-02', p: 'C4-01', n: 'Torque compensation gain', v: '1' }, YA_VECTOR_EXTRA[1]]) },
  CFW11_ID:     { make: 'WEG', model: 'CFW11', label: 'ID fan (BCP 16.30)', params: CFW11('90', '270', '75', 'P276') },
  CFW11_PUMP:   { make: 'WEG', model: 'CFW11', label: 'Feed / transfer pump > 15 kW (BCP 16.30)', params: CFW11('20', '20', '0', 'P277') },
  CFW500_FAN:   { make: 'WEG', model: 'CFW500', label: 'FD fan (BCP 16.40)', params: CFW500_BASE },
  CFW500_PUMP:  { make: 'WEG', model: 'CFW500', label: 'Feed / transfer pump ≤ 15 kW (BCP 16.40)', params: CFW500_BASE },
  CFW500_OFA:   { make: 'WEG', model: 'CFW500', label: 'Overfire air fan (BCP 16.40)',
    params: [
      { p: 'P100', n: 'Acceleration time', v: '20', u: 's' },
      { p: 'P101', n: 'Deceleration time', v: '20', u: 's', fix: 'Label corrected from "Acceleration" (F63 Rev 7)' },
      { p: 'P133', n: 'Minimum frequency', v: '0', u: 'Hz' },
      { p: 'P134', n: 'Maximum frequency', v: '50', u: 'Hz' },
      { p: 'P220', n: 'Local / remote source', v: '1', i: 'Remote' },
      { p: 'P231', n: 'AI1 signal function', v: '0', i: 'Speed reference' },
      { p: 'P233', n: 'AI1 signal type', v: '1', i: '4–20 mA' },
      { p: 'P251', n: 'AO1 function', v: '2', i: 'Real speed' },
      { p: 'P253', n: 'AO1 signal type', v: '2', i: '4–20 mA', fix: 'Set to 2 = 4–20 mA (CFW500: 1 = 0–20 mA, never used)' },
      { p: 'P263', n: 'DI1 function', v: '4', i: 'Forward run' },
      { p: 'P264', n: 'DI2 function', v: '5', i: 'Reverse run' },
      W_NP.P401, W_NP.P407,
    ] },
  CFW500_STOKER:{ make: 'WEG', model: 'CFW500', label: 'Stoker drive (BCP 16.40)', params: CFW500_VECTOR(false) },
  CFW500_SCREW: { make: 'WEG', model: 'CFW500', label: 'Coal screw (BCP 16.40)', params: CFW500_VECTOR(true) },
};

/* Snag responsibility options (F40 "Responsibility"). */
const RESPONSIBILITY = ['John Thompson', 'Client', 'Contractor', 'Consultant'];
