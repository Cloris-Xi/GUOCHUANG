/* ---------------- Module 4: Matrix ---------------- */
function renderMatrix(){
  const body = document.getElementById('matrixBody');
  const empty = document.getElementById('matrixEmpty');
  body.innerHTML='';
  if(!courses.length){ empty.style.display='block'; document.getElementById('matrixTable').style.display='none'; return; }
  empty.style.display='none'; document.getElementById('matrixTable').style.display='table';

  const rows = courses.map(c=>{
    const {known, knownWeight, remaining} = courseKnownTotal(c);
    const impact = (remaining/100) * c.credit;
    return {c, known, remaining, impact};
  }).sort((a,b)=>b.impact-a.impact);

  const n = rows.length;
  rows.forEach((r,idx)=>{
    let tier, color, bg;
    if(idx < Math.ceil(n/3)){ tier='高优先级'; color='#B5460A'; bg='var(--plan-soft)'; }
    else if(idx < Math.ceil(2*n/3)){ tier='中优先级'; color='#4A3AAE'; bg='var(--matrix-soft)'; }
    else { tier='低优先级'; color='#0E7A5E'; bg='var(--sim-soft)'; }
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.c.name}</td><td>${r.c.credit}</td><td>${r.remaining}%</td><td>${r.known.toFixed(1)}</td>
      <td><span class="pill" style="background:${bg}; color:${color};">${tier}</span></td>`;
    body.appendChild(tr);
  });
}
